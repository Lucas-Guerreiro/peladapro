const db = require('../config/database');
const crypto = require('crypto');

// Helper para gerar o código da licença
const gerarCodigoLicenca = (plano) => {
  const prefix = plano === 'anual' ? 'PP-ANUAL' : 'PP-MENSAL';
  const rand = () => crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${rand()}-${rand()}-${rand()}`;
};

// --- Criar Intenção de Checkout / Pix --------------------------------------
exports.criarCheckout = async (req, res) => {
  const { email, plano } = req.body;

  if (!email || !plano) {
    return res.status(400).json({ error: 'E-mail e plano são obrigatórios' });
  }

  const planoNormalizado = plano.toLowerCase() === 'anual' ? 'anual' : 'mensal';
  const valor = planoNormalizado === 'anual' ? 149.90 : 19.90;
  
  // Código de licença único gerado
  const codigoLicenca = gerarCodigoLicenca(planoNormalizado);

  try {
    // Insere a licença com status 'disponivel' (pendente de pagamento)
    const query = `
      INSERT INTO licencas (codigo, email_comprador, plano, status)
      VALUES ($1, $2, $3, 'disponivel')
      RETURNING *`;
    
    await db.query(query, [codigoLicenca, email.trim().toLowerCase(), planoNormalizado]);

    // QR Code Pix Copia e Cola fictício de teste
    const qrCodePix = `00020101021226850014br.gov.bcb.pix2563pix-qr.prod.br/v2/peladapro-${codigoLicenca}5204000053039865405${valor.toFixed(2)}5802BR5909PeladaPro6009Sao Paulo62070503***6304`;

    res.json({
      message: 'Checkout criado com sucesso! Faça o pagamento simulado para ativar.',
      licenca_codigo: codigoLicenca,
      email_comprador: email.trim().toLowerCase(),
      plano: planoNormalizado,
      valor: valor,
      qr_code_pix: qrCodePix
    });

  } catch (err) {
    console.error('[VendasController.criarCheckout] Erro:', err);
    res.status(500).json({ error: 'Erro ao processar checkout de vendas', detail: err.message });
  }
};

// --- Confirmar Pagamento Pix (Simulação / Webhook do Gateway) --------------
exports.confirmarPagamento = async (req, res) => {
  const { email_comprador, licenca_codigo } = req.body;

  if (!email_comprador || !licenca_codigo) {
    return res.status(400).json({ error: 'E-mail e código de licença são obrigatórios para confirmação' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar se a licença existe e está disponível
    const queryCheck = `
      SELECT * FROM licencas 
      WHERE codigo = $1 AND email_comprador = $2 AND status = 'disponivel'`;
    const checkRes = await client.query(queryCheck, [licenca_codigo, email_comprador.trim().toLowerCase()]);

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Licença disponível não encontrada para este e-mail' });
    }

    const licenca = checkRes.rows[0];
    
    // Calcular a expiração
    const diasValidade = licenca.plano === 'anual' ? 365 : 30;
    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + diasValidade);

    // 2. Atualizar o status da licença para 'ativa'
    const queryUpdateLicenca = `
      UPDATE licencas
      SET status = 'ativa', ativada_em = NOW(), expira_em = $1
      WHERE id = $2 RETURNING *`;
    const updateLicRes = await client.query(queryUpdateLicenca, [expiraEm, licenca.id]);
    const licencaAtualizada = updateLicRes.rows[0];

    // 3. Sincronizar ativação imediata do grupo do gestor se ele já tiver cadastro
    const queryGetGestor = `SELECT id FROM usuarios WHERE email = $1 AND tipo = 'gestor'`;
    const gestorRes = await client.query(queryGetGestor, [email_comprador.trim().toLowerCase()]);

    let grupoAtivado = null;

    if (gestorRes.rows.length > 0) {
      const gestorId = gestorRes.rows[0].id;
      
      // Busca o grupo do gestor
      const queryGetGrupo = `SELECT id FROM grupos WHERE gestor_id = $1 LIMIT 1`;
      const grupoRes = await client.query(queryGetGrupo, [gestorId]);

      if (grupoRes.rows.length > 0) {
        const grupoId = grupoRes.rows[0].id;
        
        // Atualiza o grupo com os dados da licença ativa
        const queryUpdateGrupo = `
          UPDATE grupos
          SET licenca_codigo = $1,
              licenca_expira_em = $2,
              licenca_status = 'ativa'
          WHERE id = $3 RETURNING *`;
        
        const updateGrupoRes = await client.query(queryUpdateGrupo, [licenca_codigo, expiraEm, grupoId]);
        grupoAtivado = updateGrupoRes.rows[0];

        // Atualiza o id do grupo de volta na tabela de licenças
        await client.query('UPDATE licencas SET grupo_id = $1 WHERE id = $2', [grupoId, licenca.id]);
      }
    }

    await client.query('COMMIT');

    res.json({
      message: 'Pagamento confirmado e licença ativada com sucesso!',
      licenca: licencaAtualizada,
      grupo_ativado: grupoAtivado ? { id: grupoAtivado.id, nome: grupoAtivado.nome, status: grupoAtivado.licenca_status } : null
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[VendasController.confirmarPagamento] Erro:', err);
    res.status(500).json({ error: 'Erro ao confirmar pagamento', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

// --- Ativação Manual de Licença no Painel do Gestor ------------------------
exports.ativarLicencaManual = async (req, res) => {
  const { grupo_id, codigo_licenca } = req.body;
  const gestorId = req.usuarioId;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor') {
    return res.status(403).json({ error: 'Apenas gestores podem ativar licenças em grupos.' });
  }

  if (!grupo_id || !codigo_licenca) {
    return res.status(400).json({ error: 'Grupo e código de licença são obrigatórios' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar se o grupo pertence ao gestor logado
    const queryGrupoCheck = `SELECT id, gestor_id FROM grupos WHERE id = $1 AND gestor_id = $2`;
    const grupoCheckRes = await client.query(queryGrupoCheck, [parseInt(grupo_id), gestorId]);

    if (grupoCheckRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Você não tem permissão para gerenciar este grupo.' });
    }

    // 2. Verificar se a licença inserida existe, está disponível ou já está ativa/válida
    const queryLicCheck = `SELECT * FROM licencas WHERE codigo = $1`;
    const licCheckRes = await client.query(queryLicCheck, [codigo_licenca.trim()]);

    if (licCheckRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Código de licença inválido.' });
    }

    const licenca = licCheckRes.rows[0];

    // Se já está sendo usada em outro grupo
    if (licenca.status === 'ativa' && licenca.grupo_id && String(licenca.grupo_id) !== String(grupo_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta licença já está sendo usada em outro grupo.' });
    }

    // Se a licença já expirou
    if (licenca.status === 'expirada' || (licenca.expira_em && new Date(licenca.expira_em) < new Date())) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta licença já expirou.' });
    }

    // Calcular expiração a partir de hoje
    const diasValidade = licenca.plano === 'anual' ? 365 : 30;
    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + diasValidade);

    // 3. Atualizar licença no banco
    const queryUpdateLicenca = `
      UPDATE licencas
      SET status = 'ativa', grupo_id = $1, ativada_em = NOW(), expira_em = $2
      WHERE id = $3 RETURNING *`;
    const updateLicRes = await client.query(queryUpdateLicenca, [parseInt(grupo_id), expiraEm, licenca.id]);

    // 4. Atualizar o grupo do gestor com os campos da licença ativa
    const queryUpdateGrupo = `
      UPDATE grupos
      SET licenca_codigo = $1,
          licenca_expira_em = $2,
          licenca_status = 'ativa'
      WHERE id = $3 RETURNING *`;
    const updateGrupoRes = await client.query(queryUpdateGrupo, [codigo_licenca.trim(), expiraEm, parseInt(grupo_id)]);

    await client.query('COMMIT');

    res.json({
      message: 'Licença ativada com sucesso para o grupo!',
      licenca: updateLicRes.rows[0],
      grupo: {
        id: updateGrupoRes.rows[0].id,
        nome: updateGrupoRes.rows[0].nome,
        licenca_status: updateGrupoRes.rows[0].licenca_status,
        licenca_expira_em: updateGrupoRes.rows[0].licenca_expira_em
      }
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[VendasController.ativarLicencaManual] Erro:', err);
    res.status(500).json({ error: 'Erro ao ativar licença no grupo', detail: err.message });
  } finally {
    if (client) client.release();
  }
};
