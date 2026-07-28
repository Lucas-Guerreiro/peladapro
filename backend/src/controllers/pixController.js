const db = require('../config/database');

// 1. Enviar e Validar Comprovante Pix (Atleta)
exports.enviarComprovante = async (req, res) => {
  const { pelada_id, e2e_id, valor, beneficiario_nome, comprovante_url } = req.body;
  const usuario_id = req.usuarioId;
  let atleta_email = req.usuarioEmail;

  if (!e2e_id || !valor) {
    return res.status(400).json({ error: 'Código de Autenticação/E2E do Pix e valor são obrigatórios.' });
  }

  // Garantir limite de caracteres para evitar estouro de VARCHAR no PostgreSQL
  const cleanE2E = String(e2e_id).trim().toUpperCase().substring(0, 100);
  const cleanBeneficiario = beneficiario_nome ? String(beneficiario_nome).trim().substring(0, 200) : null;
  const valorNum = parseFloat(valor);

  if (isNaN(valorNum) || valorNum <= 0) {
    return res.status(400).json({ error: 'Valor inválido para o comprovante Pix.' });
  }

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // Se atleta_email não veio no token JWT, busca na tabela usuarios
    if (!atleta_email) {
      const uRes = await client.query('SELECT email FROM usuarios WHERE id = $1', [usuario_id]);
      if (uRes.rows.length > 0 && uRes.rows[0].email) {
        atleta_email = uRes.rows[0].email;
      } else {
        atleta_email = `atleta_${usuario_id}@peladapro.com`;
      }
    }

    // a. Trava de Duplicidade pelo E2E ID do Pix
    const checkE2E = await client.query('SELECT id, status FROM comprovantes_pix WHERE e2e_id = $1', [cleanE2E]);
    if (checkE2E.rows.length > 0) {
      throw new Error('Este comprovante Pix já foi utilizado e cadastrado no sistema.');
    }

    // b. Registrar comprovante na tabela comprovantes_pix
    const insertQuery = `
      INSERT INTO comprovantes_pix (pelada_id, atleta_email, e2e_id, valor, beneficiario_nome, status, comprovante_url)
      VALUES ($1, $2, $3, $4, $5, 'aprovado', $6)
      RETURNING id, created_at`;
    const pixRes = await client.query(insertQuery, [
      pelada_id || null,
      atleta_email,
      cleanE2E,
      valorNum,
      cleanBeneficiario,
      comprovante_url || null
    ]);

    // c. Creditar saldo na conta do usuário
    const updateSaldo = `
      UPDATE usuarios 
      SET saldo = COALESCE(saldo, 0) + $1 
      WHERE id = $2 RETURNING saldo`;
    const userRes = await client.query(updateSaldo, [valorNum, usuario_id]);

    // d. Registrar transação de crédito Pix (limitando a descrição a 140 chars max para VARCHAR(150))
    const descTx = `Recarga Pix (Autenticação ${cleanE2E})`.substring(0, 140);
    await client.query(`
      INSERT INTO transacoes (usuario_id, valor, tipo, descricao)
      VALUES ($1, $2, 'credito', $3)`,
      [usuario_id, valorNum, descTx]
    );

    await client.query('COMMIT');
    res.json({
      message: 'Comprovante Pix aprovado e saldo creditado com sucesso!',
      novoSaldo: userRes.rows[0].saldo,
      comprovante: pixRes.rows[0]
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

// 2. Listar Comprovantes Pix (Gestor / Auditoria)
exports.listarComprovantes = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
  }

  try {
    const query = `
      SELECT c.id, c.pelada_id, c.atleta_email, c.e2e_id, c.valor, c.beneficiario_nome, c.status, c.comprovante_url, c.created_at,
             u.nome as atleta_nome, u.apelido as atleta_apelido
      FROM comprovantes_pix c
      LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(c.atleta_email)
      ORDER BY c.created_at DESC`;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar comprovantes Pix.', detail: err.message });
  }
};

// 3. Estornar / Desfazer Transação (Gestor)
exports.estornarTransacao = async (req, res) => {
  const { comprovante_id } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem estornar transações Pix.' });
  }

  if (!comprovante_id) {
    return res.status(400).json({ error: 'ID do comprovante é obrigatório.' });
  }

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // a. Obter dados do comprovante
    const pixRes = await client.query('SELECT * FROM comprovantes_pix WHERE id = $1', [comprovante_id]);
    if (pixRes.rows.length === 0) {
      throw new Error('Comprovante não encontrado.');
    }

    const pix = pixRes.rows[0];
    if (pix.status === 'estornado_pelo_gestor') {
      throw new Error('Esta transação já foi estornada anteriormente.');
    }

    // b. Atualizar status do comprovante para estornado
    await client.query("UPDATE comprovantes_pix SET status = 'estornado_pelo_gestor' WHERE id = $1", [comprovante_id]);

    // c. Reverter saldo do atleta (débito do valor)
    const userRes = await client.query('SELECT id, saldo FROM usuarios WHERE LOWER(email) = LOWER($1)', [pix.atleta_email]);
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const novoSaldo = parseFloat(user.saldo || 0) - parseFloat(pix.valor);

      await client.query('UPDATE usuarios SET saldo = $1 WHERE id = $2', [novoSaldo, user.id]);

      // Registrar transação de estorno pelo gestor
      await client.query(`
        INSERT INTO transacoes (usuario_id, valor, tipo, descricao)
        VALUES ($1, $2, 'debito', $3)`,
        [user.id, pix.valor, `Estorno de Pix pelo gestor (Ref E2E ${pix.e2e_id})`]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Transação estornada com sucesso e saldo revertido!' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};
