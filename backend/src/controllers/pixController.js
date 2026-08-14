const db = require('../config/database');

// Criar tabela de pagamentos do Mercado Pago se não existir (idempotente)
db.query(`
  CREATE TABLE IF NOT EXISTS pagamentos_mercado_pago (
    id VARCHAR(100) PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    pelada_id INT REFERENCES peladas(id) ON DELETE CASCADE,
    valor NUMERIC(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    qr_code TEXT NOT NULL,
    qr_code_base64 TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(err => console.error('[PixController] Erro ao inicializar tabela pagamentos_mercado_pago:', err));

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

// ============================================================
// MERCADO PAGO INTEGRATION
// ============================================================

// Função auxiliar para efetivar a convocação do jogador após aprovação do Pix
async function efetivarConvocacaoPixAprovado(client, usuarioId, peladaId, valorPago, paymentId) {
  // 1. Obter informações da pelada e limite de atletas
  const queryConfig = `
    SELECT p.grupo_id, p.data, p.limite_atletas,
           COALESCE(p.valor_convocacao, c.valor_convocacao, 20.00) as custo
    FROM peladas p
    LEFT JOIN configs c ON p.grupo_id = c.grupo_id
    WHERE p.id = $1`;
  const configRes = await client.query(queryConfig, [peladaId]);
  if (configRes.rows.length === 0) {
    throw new Error('Configuração da pelada não encontrada');
  }

  const { grupo_id, custo, limite_atletas, data: dataPelada } = configRes.rows[0];
  const limiteMaxAtletas = limite_atletas || 20;

  // 2. Contar atletas confirmados
  const countRes = await client.query(
    `SELECT COUNT(*)::int AS total FROM convocacoes 
     WHERE pelada_id = $1 AND status = 'confirmado'`,
    [peladaId]
  );
  const confirmados = countRes.rows[0].total;

  const vaiParaFila = (confirmados >= limiteMaxAtletas);

  // 3. Atualizar status da convocação
  let statusConv = 'confirmado';
  let posicaoFila = null;

  if (vaiParaFila) {
    statusConv = 'espera';
    const filaRes = await client.query(
      `SELECT COALESCE(MAX(posicao_fila), 0)::int AS ultima
       FROM convocacoes WHERE pelada_id = $1 AND status = 'espera'`,
      [peladaId]
    );
    posicaoFila = filaRes.rows[0].ultima + 1;
  }

  const queryConv = `
    INSERT INTO convocacoes (pelada_id, usuario_id, status, forma_pagamento, data_convocacao, posicao_fila)
    VALUES ($1, $2, $3, 'pix', NOW(), $4)
    ON CONFLICT (pelada_id, usuario_id) 
    DO UPDATE SET status = $3, forma_pagamento = 'pix', data_convocacao = NOW(), posicao_fila = $4`;
  await client.query(queryConv, [peladaId, usuarioId, statusConv, posicaoFila]);

  // 4. Buscar informações do usuário para registrar a transação
  const userRes = await client.query('SELECT nome, apelido FROM usuarios WHERE id = $1', [usuarioId]);
  const atletaNome = (userRes.rows[0] && (userRes.rows[0].apelido || userRes.rows[0].nome)) || 'Atleta';
  const dataFmt = formatarDataDDMM(dataPelada);

  // Registrar transação de débito (pela participação na pelada)
  const descDebito = `Presença de ${atletaNome} no dia ${dataFmt}`;
  await client.query(`
    INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
    VALUES ($1, $2, $3, 'debito', $4)`,
    [usuarioId, grupo_id, valorPago, descDebito]
  );

  // Registrar transação de crédito (pela entrada do dinheiro via Pix)
  const descCredito = `Pagamento Pix Convocação - ID ${paymentId}`;
  await client.query(`
    INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
    VALUES ($1, $2, $3, 'credito', $4)`,
    [usuarioId, grupo_id, valorPago, descCredito]
  );

  // 5. Disparar notificação push
  try {
    const { sendNotificationInternal } = require('./pushController');
    if (vaiParaFila) {
      sendNotificationInternal({
        usuarioId: usuarioId,
        title: 'Fila de Espera! ⏳',
        body: `Seu Pix de R$ ${valorPago.toFixed(2)} foi aprovado, mas a lista oficial lotou. Você está na fila de espera (Posição #${posicaoFila}).`,
        url: '/#/jogador/convocacao'
      }).catch(e => console.warn('[Push] Erro:', e.message));
    } else {
      sendNotificationInternal({
        usuarioId: usuarioId,
        title: 'Presença Confirmada via Pix! ⚽',
        body: `Seu pagamento de R$ ${valorPago.toFixed(2)} foi processado. Presença confirmada no dia ${dataFmt}!`,
        url: '/#/jogador/convocacao'
      }).catch(e => console.warn('[Push] Erro:', e.message));
    }
  } catch (e) {}

  return { statusConv, posicaoFila };
}

exports.criarPagamentoMercadoPago = async (req, res) => {
  const { pelada_id } = req.body;
  const usuario_id = req.usuarioId;

  if (!pelada_id) {
    return res.status(400).json({ error: 'ID da pelada é obrigatório.' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Obter custo da convocação e informações do grupo/pelada
    const queryConfig = `
      SELECT p.id, p.grupo_id, p.data,
             COALESCE(p.valor_convocacao, c.valor_convocacao, 20.00) as custo
      FROM peladas p
      LEFT JOIN configs c ON p.grupo_id = c.grupo_id
      WHERE p.id = $1`;
    const configRes = await client.query(queryConfig, [pelada_id]);
    if (configRes.rows.length === 0) {
      throw new Error('Pelada não encontrada.');
    }
    const { custo, data: dataPelada } = configRes.rows[0];
    const valorCusto = parseFloat(custo || 20.00);

    // 2. Obter dados do usuário
    const userRes = await client.query('SELECT nome, cpf, email FROM usuarios WHERE id = $1', [usuario_id]);
    if (userRes.rows.length === 0) {
      throw new Error('Usuário não encontrado.');
    }
    const { nome, cpf, email } = userRes.rows[0];

    // 3. Verificar se já existe um pagamento pendente gerado nos últimos 30 minutos
    const checkPaymentRes = await client.query(`
      SELECT id, valor, status, qr_code, qr_code_base64
      FROM pagamentos_mercado_pago
      WHERE usuario_id = $1 AND pelada_id = $2 AND status = 'pending' AND created_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY created_at DESC LIMIT 1
    `, [usuario_id, pelada_id]);

    if (checkPaymentRes.rows.length > 0) {
      await client.query('COMMIT');
      return res.json(checkPaymentRes.rows[0]);
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // 4. Se não houver token do Mercado Pago, usar MOCK para ambiente de desenvolvimento local
    if (!accessToken) {
      console.warn('[MercadoPago] MERCADO_PAGO_ACCESS_TOKEN não configurada. Gerando pagamento mock.');
      const mockPaymentId = `mp_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const mockQrCode = `00020101021226870014br.gov.bcb.pix2565peladapro-pix-mock-uuid-key5204000053039865405${valorCusto.toFixed(2)}5802BR5913PeladaPro Mock6009SAO PAULO62070503***6304FC7F`;
      const mockQrCodeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAQBAAAEAQAQMAAAD71YlPAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAWElEQVRYhe3MsQkAMBAEsdf/0K4j9zCBQODuBvCSpI6qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsqPvwH8f668W2n0gAAAAABJRU5ErkJggg==';

      await client.query(`
        INSERT INTO pagamentos_mercado_pago (id, usuario_id, pelada_id, valor, status, qr_code, qr_code_base64)
        VALUES ($1, $2, $3, $4, 'pending', $5, $6)
      `, [mockPaymentId, usuario_id, pelada_id, valorCusto, mockQrCode, mockQrCodeBase64]);

      // Insere convocação pendente para que o jogador apareça como aguardando pagamento
      await client.query(`
        INSERT INTO convocacoes (pelada_id, usuario_id, status, forma_pagamento, data_convocacao)
        VALUES ($1, $2, 'pendente', 'pix', NOW())
        ON CONFLICT (pelada_id, usuario_id) DO UPDATE SET status = 'pendente', forma_pagamento = 'pix', data_convocacao = NOW()
      `, [pelada_id, usuario_id]);

      await client.query('COMMIT');
      return res.json({
        id: mockPaymentId,
        valor: valorCusto,
        status: 'pending',
        qr_code: mockQrCode,
        qr_code_base64: mockQrCodeBase64,
        isMock: true
      });
    }

    // 5. Integração Real com API do Mercado Pago
    // CPF é opcional — usa fallback genérico aceito pelo Mercado Pago se não cadastrado
    const cleanCpf = (cpf || '').replace(/\D/g, '');
    const payerCpf = (cleanCpf.length >= 11) ? cleanCpf : '19119119100';

    const payload = {
      transaction_amount: valorCusto,
      description: `Convocação PeladaPro - ${formatarDataDDMM(dataPelada)}`,
      payment_method_id: 'pix',
      payer: {
        email: email || `atleta${usuario_id}@peladapro.com`,
        first_name: nome.split(' ')[0] || 'Atleta',
        last_name: nome.split(' ').slice(1).join(' ') || 'PeladaPro',
        identification: {
          type: 'CPF',
          number: payerCpf
        }
      }
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `pix_pelada_${usuario_id}_${pelada_id}_${Date.now()}`
      },
      body: JSON.stringify(payload)
    });

    const mpData = await response.json();

    if (response.status < 200 || response.status >= 300) {
      throw new Error(mpData.message || mpData.description || 'Erro ao gerar Pix na API do Mercado Pago.');
    }

    const paymentId = String(mpData.id);
    const qrCode = mpData.point_of_interaction.transaction_data.qr_code;
    const qrCodeBase64 = mpData.point_of_interaction.transaction_data.qr_code_base64;

    await client.query(`
      INSERT INTO pagamentos_mercado_pago (id, usuario_id, pelada_id, valor, status, qr_code, qr_code_base64)
      VALUES ($1, $2, $3, $4, 'pending', $5, $6)
    `, [paymentId, usuario_id, pelada_id, valorCusto, qrCode, qrCodeBase64]);

    await client.query(`
      INSERT INTO convocacoes (pelada_id, usuario_id, status, forma_pagamento, data_convocacao)
      VALUES ($1, $2, 'pendente', 'pix', NOW())
      ON CONFLICT (pelada_id, usuario_id) DO UPDATE SET status = 'pendente', forma_pagamento = 'pix', data_convocacao = NOW()
    `, [pelada_id, usuario_id]);

    await client.query('COMMIT');
    res.json({
      id: paymentId,
      valor: valorCusto,
      status: 'pending',
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[criarPagamentoMercadoPago]', err);
    res.status(400).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

exports.obterStatusPagamento = async (req, res) => {
  const { peladaId } = req.params;
  const usuario_id = req.usuarioId;

  let client;
  try {
    // 1. Obter o pagamento mais recente do banco local
    const paymentQuery = `
      SELECT id, valor, status, qr_code, qr_code_base64, created_at
      FROM pagamentos_mercado_pago
      WHERE usuario_id = $1 AND pelada_id = $2
      ORDER BY created_at DESC LIMIT 1`;
    const paymentRes = await db.query(paymentQuery, [usuario_id, peladaId]);

    if (paymentRes.rows.length === 0) {
      return res.json({ statusPagamento: 'none' });
    }

    const pagamento = paymentRes.rows[0];

    // 2. Se o pagamento local ainda está pendente, consultar diretamente a API do Mercado Pago
    //    (fallback para quando o Webhook não está configurado ou falhou)
    if (pagamento.status === 'pending') {
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

      // Só faz a consulta ativa se o token real estiver presente (não é mock)
      if (accessToken && !String(pagamento.id).startsWith('mp_mock_')) {
        try {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${pagamento.id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (mpRes.ok) {
            const mpData = await mpRes.json();
            const mpStatus = mpData.status;

            // Se aprovado no Mercado Pago mas ainda pendente localmente → efetivar a convocação agora
            if (mpStatus === 'approved') {
              client = await db.pool.connect();
              await client.query('BEGIN');

              await client.query(
                `UPDATE pagamentos_mercado_pago SET status = 'approved' WHERE id = $1`,
                [pagamento.id]
              );

              await efetivarConvocacaoPixAprovado(client, usuario_id, peladaId, parseFloat(pagamento.valor), pagamento.id);

              await client.query('COMMIT');
              client.release();
              client = null;

              console.log(`[StatusPolling] Auto-aprovação via polling! Usuário ${usuario_id}, Pelada ${peladaId}`);

              const convRes2 = await db.query(`SELECT status, posicao_fila FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2`, [peladaId, usuario_id]);
              return res.json({
                id: pagamento.id,
                valor: parseFloat(pagamento.valor),
                statusPagamento: 'approved',
                statusConvocacao: convRes2.rows[0]?.status || 'confirmado',
                posicaoFila: convRes2.rows[0]?.posicao_fila || null
              });
            } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
              // Pagamento rejeitado — atualizar localmente
              await db.query(
                `UPDATE pagamentos_mercado_pago SET status = $1 WHERE id = $2`,
                [mpStatus, pagamento.id]
              );
              await db.query(
                `DELETE FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2 AND status = 'pendente'`,
                [peladaId, usuario_id]
              );
              return res.json({ statusPagamento: mpStatus, statusConvocacao: null });
            }
          }
        } catch (mpErr) {
          console.warn('[StatusPolling] Erro ao consultar MP:', mpErr.message);
        }
      }
    }

    // 3. Retornar dados do banco local (estado atual)
    const convQuery = `SELECT status, posicao_fila FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2`;
    const convRes = await db.query(convQuery, [peladaId, usuario_id]);
    const statusConvocacao = convRes.rows.length > 0 ? convRes.rows[0].status : null;
    const posicaoFila = convRes.rows.length > 0 ? convRes.rows[0].posicao_fila : null;

    res.json({
      id: pagamento.id,
      valor: parseFloat(pagamento.valor),
      statusPagamento: pagamento.status,
      statusConvocacao,
      posicaoFila,
      qr_code: pagamento.qr_code,
      qr_code_base64: pagamento.qr_code_base64,
      created_at: pagamento.created_at
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[obterStatusPagamento]', err);
    res.status(500).json({ error: 'Erro ao consultar status do pagamento.', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

exports.receberWebhookMercadoPago = async (req, res) => {
  // O Mercado Pago pode enviar eventos com formas de notificação diferentes
  const paymentId = req.body.data && req.body.data.id ? String(req.body.data.id) : null;
  const action = req.body.action;

  // Responder 200 OK de imediato para o Mercado Pago não reenviar a notificação
  res.status(200).send('OK');

  if (!paymentId || (action && action !== 'payment.updated' && action !== 'payment.created')) {
    return;
  }

  let client;
  try {
    client = await db.pool.connect();
    
    // Verificar se esse pagamento existe no nosso banco local e se está pendente
    const localPayRes = await client.query(
      `SELECT usuario_id, pelada_id, valor, status FROM pagamentos_mercado_pago WHERE id = $1`,
      [paymentId]
    );

    if (localPayRes.rows.length === 0) {
      return; // Pagamento não cadastrado na nossa plataforma
    }

    const { usuario_id, pelada_id, valor, status: statusLocal } = localPayRes.rows[0];

    if (statusLocal !== 'pending') {
      return; // Já foi processado anteriormente
    }

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      return; // Mock local, webhook não será chamado de verdade, mas a rota existe
    }

    // Consultar o status real do pagamento no Mercado Pago
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar pagamento ${paymentId} no Mercado Pago`);
    }

    const mpData = await response.json();
    const mpStatus = mpData.status; // 'approved', 'pending', 'rejected', 'cancelled'

    if (mpStatus === 'approved') {
      await client.query('BEGIN');

      // Atualizar status do pagamento
      await client.query(
        `UPDATE pagamentos_mercado_pago SET status = 'approved' WHERE id = $1`,
        [paymentId]
      );

      // Confirmar convocação
      await efetivarConvocacaoPixAprovado(client, usuario_id, pelada_id, parseFloat(valor), paymentId);

      await client.query('COMMIT');
      console.log(`[WebhookMP] Pagamento aprovado com sucesso! Usuário ${usuario_id}, Pelada ${pelada_id}`);
    } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      await client.query('BEGIN');

      // Atualizar pagamento para rejeitado
      await client.query(
        `UPDATE pagamentos_mercado_pago SET status = $1 WHERE id = $2`,
        [mpStatus, paymentId]
      );

      // Remover a convocação pendente que falhou
      await client.query(
        `DELETE FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2 AND status = 'pendente'`,
        [pelada_id, usuario_id]
      );

      await client.query('COMMIT');
      console.log(`[WebhookMP] Pagamento recusado/cancelado. ID ${paymentId}, Status ${mpStatus}`);
    }

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[receberWebhookMercadoPago]', err);
  } finally {
    if (client) client.release();
  }
};

exports.simularAprovacao = async (req, res) => {
  const { payment_id } = req.body;

  if (!payment_id) {
    return res.status(400).json({ error: 'payment_id é obrigatório.' });
  }

  let client;
  try {
    client = await db.pool.connect();
    
    // Verificar se existe
    const payRes = await client.query(
      `SELECT usuario_id, pelada_id, valor, status FROM pagamentos_mercado_pago WHERE id = $1`,
      [payment_id]
    );

    if (payRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado.' });
    }

    const { usuario_id, pelada_id, valor, status } = payRes.rows[0];

    if (status !== 'pending') {
      return res.status(400).json({ error: 'Este pagamento já foi processado ou aprovado.' });
    }

    await client.query('BEGIN');

    // Atualizar status do pagamento
    await client.query(
      `UPDATE pagamentos_mercado_pago SET status = 'approved' WHERE id = $1`,
      [payment_id]
    );

    // Efetiva a convocação do jogador
    const { statusConv, posicaoFila } = await efetivarConvocacaoPixAprovado(
      client,
      usuario_id,
      pelada_id,
      parseFloat(valor),
      payment_id
    );

    await client.query('COMMIT');
    res.json({
      message: 'Simulação de aprovação do Pix executada com sucesso!',
      statusConvocacao: statusConv,
      posicaoFila
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[simularAprovacao]', err);
    res.status(500).json({ error: 'Erro ao processar simulação.', detail: err.message });
  } finally {
    if (client) client.release();
  }
};
