const db = require('../config/database');

function formatarDataDDMM(dataInput) {
  if (!dataInput) return '';
  try {
    const d = new Date(dataInput);
    if (isNaN(d.getTime())) {
      const parts = String(dataInput).split('-');
      if (parts.length >= 3) {
        return `${parts[2].substring(0, 2)}/${parts[1]}`;
      }
      return '';
    }
    const dia = String(d.getUTCDate()).padStart(2, '0');
    const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}`;
  } catch (e) {
    return '';
  }
}

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

    // Obter o grupo_id e data associados à pelada
    let grupo_id = null;
    let dataPelada = null;
    if (pelada_id) {
      const peladaRes = await client.query('SELECT grupo_id, data FROM peladas WHERE id = $1', [pelada_id]);
      if (peladaRes.rows.length > 0) {
        grupo_id = peladaRes.rows[0].grupo_id;
        dataPelada = peladaRes.rows[0].data;
      }
    }

    // Busca o nome ou apelido do atleta
    const uRes = await client.query('SELECT nome, apelido FROM usuarios WHERE id = $1', [usuario_id]);
    const nomeExibir = uRes.rows.length > 0 ? (uRes.rows[0].apelido || uRes.rows[0].nome) : 'Atleta';

    // a. Trava de Duplicidade pelo E2E ID do Pix
    const checkE2E = await client.query('SELECT id, status FROM comprovantes_pix WHERE e2e_id = $1', [cleanE2E]);
    if (checkE2E.rows.length > 0) {
      // E2E oficial do Banco Central (E + 31 chars): bloqueia sempre — é único por lei
      const isE2EOficial = /^E[A-Z0-9]{31}$/.test(cleanE2E);
      // E2E gerado por heurística (prefixo PIX_ ou hash genérico): pode colidir entre imagens diferentes.
      // Nesse caso, só bloqueia se o MESMO USUÁRIO enviou um comprovante com o MESMO VALOR nas últimas 24h.
      const isHeuristico = cleanE2E.startsWith('PIX_') || cleanE2E.length < 32;
      if (isE2EOficial) {
        throw new Error('Este comprovante Pix já foi utilizado e cadastrado no sistema.');
      } else if (isHeuristico) {
        const checkDuplaUsario = await client.query(
          `SELECT id FROM comprovantes_pix
           WHERE atleta_email = $1 AND valor = $2 AND created_at >= NOW() - INTERVAL '24 hours'`,
          [atleta_email, valorNum]
        );
        if (checkDuplaUsario.rows.length > 0) {
          throw new Error(
            'Identificamos um comprovante com o mesmo valor já enviado por você nas últimas 24 horas. ' +
            'Se este é um novo pagamento, aguarde ou entre em contato com o gestor.'
          );
        }
        // Hash colidiu mas é outro atleta ou outro valor: permite prosseguir (sobrescreve a verificação)
        // O sistema aceita e registra normalmente.
      } else {
        // Código de banco com confiança média: bloqueia normalmente
        throw new Error('Este comprovante Pix já foi utilizado e cadastrado no sistema.');
      }
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

    // d. Registrar transação de crédito Pix no formato padronizado: Presença de "Apelido" no dia "DD/MM"
    const dataFmt = formatarDataDDMM(dataPelada);
    const descTx = `Presença de ${nomeExibir} no dia ${dataFmt}`.substring(0, 140);
    await client.query(`
      INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
      VALUES ($1, $2, $3, 'credito', $4)`,
      [usuario_id, grupo_id, valorNum, descTx]
    );

    await client.query('COMMIT');

    // Notifica todos os gestores por push sobre o novo comprovante recebido
    try {
      const { sendNotificationInternal } = require('./pushController');
      
      sendNotificationInternal({
        title: '💸 Novo Comprovante Pix!',
        body: `${nomeExibir} enviou um comprovante de R$ ${valorNum.toFixed(2)}. Saldo creditado automaticamente!`,
        url: '/#/gestor/financeiro',
        onlyGestores: true
      }).catch(e => console.warn('[Push] Erro ao disparar push de comprovante para gestores:', e.message));
    } catch(e) {}

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

    // Obter o grupo_id e data associados à pelada do comprovante
    let grupo_id = null;
    let dataPelada = null;
    if (pix.pelada_id) {
      const peladaRes = await client.query('SELECT grupo_id, data FROM peladas WHERE id = $1', [pix.pelada_id]);
      if (peladaRes.rows.length > 0) {
        grupo_id = peladaRes.rows[0].grupo_id;
        dataPelada = peladaRes.rows[0].data;
      }
    }

    // b. Atualizar status do comprovante para estornado
    await client.query("UPDATE comprovantes_pix SET status = 'estornado_pelo_gestor' WHERE id = $1", [comprovante_id]);

    // c. Reverter saldo do atleta (débito do valor)
    const userRes = await client.query('SELECT id, saldo, nome, apelido FROM usuarios WHERE LOWER(email) = LOWER($1)', [pix.atleta_email]);
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const novoSaldo = parseFloat(user.saldo || 0) - parseFloat(pix.valor);

      await client.query('UPDATE usuarios SET saldo = $1 WHERE id = $2', [novoSaldo, user.id]);

      const nomeExibir = user.apelido || user.nome || 'Atleta';
      const dataFmt = formatarDataDDMM(dataPelada);
      const descEstorno = `Estorno de presença de ${nomeExibir} no dia ${dataFmt}`;

      // Registrar transação de estorno pelo gestor
      await client.query(`
        INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
        VALUES ($1, $2, $3, 'debito', $4)`,
        [user.id, grupo_id, pix.valor, descEstorno]
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
