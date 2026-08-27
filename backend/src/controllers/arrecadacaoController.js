const db = require('../config/database');

function validarCPF(cpfStr) {
  const str = (cpfStr || '').replace(/\D/g, '');
  if (str.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(str)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(str.charAt(i)) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(str.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(str.charAt(i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(str.charAt(10))) return false;

  return true;
}

// 1. Criar Nova Campanha de Arrecadação (Gestor)
exports.criarArrecadacao = async (req, res) => {
  const { grupo_id, titulo, descricao, meta_valor, valor_sugerido, categoria, chave_pix_custom } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
  }

  if (!grupo_id || !titulo || !meta_valor) {
    return res.status(400).json({ error: 'Grupo, título e meta de valor são obrigatórios.' });
  }

  try {
    const query = `
      INSERT INTO arrecadacoes (grupo_id, titulo, descricao, meta_valor, valor_sugerido, categoria, chave_pix_custom, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ativa')
      RETURNING *
    `;
    const { rows } = await db.query(query, [
      grupo_id,
      titulo.trim(),
      descricao ? descricao.trim() : '',
      parseFloat(meta_valor),
      valor_sugerido ? parseFloat(valor_sugerido) : 10.00,
      categoria || 'Material',
      chave_pix_custom ? chave_pix_custom.trim() : null
    ]);

    // Notificar atletas via push se disponível
    try {
      const { sendNotificationInternal } = require('./pushController');
      sendNotificationInternal({
        grupoId: grupo_id,
        title: '📢 Nova Arrecadação Aberta!',
        body: `${titulo}: Meta de R$ ${parseFloat(meta_valor).toFixed(2)}. Acesse o app para contribuir via Pix!`,
        url: '/#/jogador/arrecadacao'
      }).catch(e => console.warn('[Push Arrecadacao]', e.message));
    } catch(e) {}

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[criarArrecadacao]', err);
    res.status(500).json({ error: 'Erro ao criar campanha de arrecadação.', detail: err.message });
  }
};

// 2. Listar Arrecadações do Grupo com Total Arrecadado e Contribuições (Pública para membros do grupo)
exports.listarArrecadacoesDoGrupo = async (req, res) => {
  let { grupoId } = req.params;

  // Se o grupoId for 'me', 'undefined', 'null' ou inválido, busca o grupo do usuário autenticado no banco
  if (!grupoId || grupoId === 'me' || grupoId === 'undefined' || grupoId === 'null') {
    try {
      if (req.usuarioId) {
        const userRes = await db.query(`SELECT grupo_id FROM usuarios WHERE id = $1`, [req.usuarioId]);
        if (userRes.rows.length > 0 && userRes.rows[0].grupo_id) {
          grupoId = userRes.rows[0].grupo_id;
        }
      }
    } catch (e) {
      console.warn('[listarArrecadacoesDoGrupo Fallback User Group]', e.message);
    }
  }

  // Se ainda assim não encontrar grupo_id, pega o primeiro grupo do banco como fallback
  if (!grupoId || grupoId === 'me' || grupoId === 'undefined' || grupoId === 'null') {
    try {
      const firstGroupRes = await db.query(`SELECT id FROM grupos ORDER BY created_at ASC LIMIT 1`);
      if (firstGroupRes.rows.length > 0) {
        grupoId = firstGroupRes.rows[0].id;
      }
    } catch (e) {}
  }

  if (!grupoId || grupoId === 'me' || grupoId === 'undefined' || grupoId === 'null') {
    return res.json([]);
  }

  try {
    const query = `
      SELECT 
        a.*,
        COALESCE(SUM(CASE WHEN c.status = 'approved' THEN c.valor ELSE 0 END), 0) AS total_arrecadado,
        COUNT(CASE WHEN c.status = 'approved' THEN 1 END) AS total_apoiadores
      FROM arrecadacoes a
      LEFT JOIN arrecadacoes_contribuicoes c ON a.id = c.arrecadacao_id
      WHERE a.grupo_id = $1
      GROUP BY a.id
      ORDER BY 
        CASE WHEN a.status = 'ativa' THEN 1 ELSE 2 END,
        a.created_at DESC
    `;
    const { rows } = await db.query(query, [grupoId]);

    // Para cada arrecadação, busca as contribuições aprovadas
    for (const arr of rows) {
      const contribQuery = `
        SELECT c.id, c.valor, c.status, c.created_at, u.nome, u.apelido, u.foto
        FROM arrecadacoes_contribuicoes c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.arrecadacao_id = $1 AND c.status = 'approved'
        ORDER BY c.created_at DESC
      `;
      const contribRes = await db.query(contribQuery, [arr.id]);
      arr.contribuicoes = contribRes.rows;
    }

    res.json(rows);
  } catch (err) {
    console.error('[listarArrecadacoesDoGrupo]', err);
    res.status(500).json({ error: 'Erro ao listar campanhas de arrecadação.', detail: err.message });
  }
};

// 3. Atualizar Status da Arrecadação (Encerrar / Concluir / Cancelar) - Gestor
exports.atualizarStatusArrecadacao = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
  }

  try {
    const { rows } = await db.query(
      `UPDATE arrecadacoes SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Arrecadação não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[atualizarStatusArrecadacao]', err);
    res.status(500).json({ error: 'Erro ao atualizar status da arrecadação.', detail: err.message });
  }
};

// 4. Gerar QR Code Pix para Contribuição (Atleta)
exports.gerarPixContribuicao = async (req, res) => {
  const { arrecadacao_id, valor, cpf } = req.body;
  const usuario_id = req.usuarioId;

  if (!arrecadacao_id || !valor || isNaN(parseFloat(valor)) || parseFloat(valor) <= 0) {
    return res.status(400).json({ error: 'Arrecadação e valor válido são obrigatórios.' });
  }

  const valorContribuicao = parseFloat(valor);

  let client;
  try {
    client = await db.pool.connect();

    // 1. Obter informações da arrecadação
    const arrRes = await client.query('SELECT * FROM arrecadacoes WHERE id = $1 AND status = \'ativa\'', [arrecadacao_id]);
    if (arrRes.rows.length === 0) {
      return res.status(400).json({ error: 'Campanha de arrecadação encerrada ou não encontrada.' });
    }
    const arrecadacao = arrRes.rows[0];

    // 2. Obter informações do atleta
    const userRes = await client.query('SELECT nome, email FROM usuarios WHERE id = $1', [usuario_id]);
    const { nome, email } = userRes.rows[0];

    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

    // 3. Fallback MOCK se não houver chave Mercado Pago
    if (!accessToken) {
      const mockPaymentId = `arr_mock_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const mockQrCode = `00020101021226870014br.gov.bcb.pix2565peladapro-arrecadacao-mock-key5204000053039865405${valorContribuicao.toFixed(2)}5802BR5913PeladaPro Mock6009SAO PAULO62070503***6304FC7F`;
      const mockQrCodeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAQBAAAEAQAQMAAAD71YlPAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAWElEQVRYhe3MsQkAMBAEsdf/0K4j9zCBQODuBvCSpI6qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsqPvwH8f668W2n0gAAAAABJRU5ErkJggg==';

      const insertRes = await client.query(`
        INSERT INTO arrecadacoes_contribuicoes (arrecadacao_id, usuario_id, valor, status, payment_id, qr_code, qr_code_base64)
        VALUES ($1, $2, $3, 'pending', $4, $5, $6)
        RETURNING id
      `, [arrecadacao_id, usuario_id, valorContribuicao, mockPaymentId, mockQrCode, mockQrCodeBase64]);

      return res.json({
        contribuicao_id: insertRes.rows[0].id,
        payment_id: mockPaymentId,
        valor: valorContribuicao,
        status: 'pending',
        qr_code: mockQrCode,
        qr_code_base64: mockQrCodeBase64,
        isMock: true
      });
    }

    // 4. Integração Real Mercado Pago
    const cleanCpf = (cpf || '').replace(/\D/g, '');
    const payerCpf = validarCPF(cleanCpf) ? cleanCpf : '19119119100';

    let payerEmail = (email || '').trim().toLowerCase();
    if (!payerEmail || payerEmail.endsWith('.local') || !payerEmail.includes('@') || !payerEmail.includes('.')) {
      payerEmail = `atleta${usuario_id}@peladapro.com`;
    }

    const payload = {
      transaction_amount: valorContribuicao,
      description: `Contribuição: ${arrecadacao.titulo.substring(0, 50)}`,
      payment_method_id: 'pix',
      payer: {
        email: payerEmail,
        first_name: nome.split(' ')[0] || 'Atleta',
        last_name: nome.split(' ').slice(1).join(' ') || 'PeladaPro',
        identification: {
          type: 'CPF',
          number: payerCpf
        }
      }
    };

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `pix_arr_${usuario_id}_${arrecadacao_id}_${Date.now()}`
      },
      body: JSON.stringify(payload)
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok || !mpData.point_of_interaction) {
      console.error('[MP Arrecadacao Error]', mpData);
      return res.status(400).json({
        error: 'Erro ao gerar Pix no Mercado Pago.',
        detail: mpData.message || 'Verifique as credenciais.'
      });
    }

    const paymentId = String(mpData.id);
    const qrCode = mpData.point_of_interaction.transaction_data.qr_code;
    const qrCodeBase64 = mpData.point_of_interaction.transaction_data.qr_code_base64;

    const insertRes = await client.query(`
      INSERT INTO arrecadacoes_contribuicoes (arrecadacao_id, usuario_id, valor, status, payment_id, qr_code, qr_code_base64)
      VALUES ($1, $2, $3, 'pending', $4, $5, $6)
      RETURNING id
    `, [arrecadacao_id, usuario_id, valorContribuicao, paymentId, qrCode, qrCodeBase64]);

    res.json({
      contribuicao_id: insertRes.rows[0].id,
      payment_id: paymentId,
      valor: valorContribuicao,
      status: 'pending',
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64
    });

  } catch (err) {
    console.error('[gerarPixContribuicao]', err);
    res.status(500).json({ error: 'Erro ao gerar Pix para contribuição.', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

// 5. Consultar Status da Contribuição Pix (Polling / Confirmação)
exports.consultarStatusContribuicao = async (req, res) => {
  const { contribuicaoId } = req.params;
  const usuario_id = req.usuarioId;

  let client;
  try {
    client = await db.pool.connect();
    const cRes = await client.query(`
      SELECT c.*, a.titulo, a.grupo_id, u.nome, u.apelido
      FROM arrecadacoes_contribuicoes c
      JOIN arrecadacoes a ON c.arrecadacao_id = a.id
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = $1 AND c.usuario_id = $2
    `, [contribuicaoId, usuario_id]);

    if (cRes.rows.length === 0) {
      return res.status(404).json({ error: 'Contribuição não encontrada.' });
    }

    const contribuicao = cRes.rows[0];

    // Se já está aprovada, retorna
    if (contribuicao.status === 'approved') {
      return res.json({ status: 'approved', valor: parseFloat(contribuicao.valor) });
    }

    // Se tiver Mercado Pago configurado e status for pendente, consulta na API do MP
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (accessToken && contribuicao.payment_id && !contribuicao.payment_id.startsWith('arr_mock_')) {
      try {
        const mpCheck = await fetch(`https://api.mercadopago.com/v1/payments/${contribuicao.payment_id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (mpCheck.ok) {
          const mpData = await mpCheck.json();
          if (mpData.status === 'approved') {
            await client.query('BEGIN');

            const travado = await client.query(
              `UPDATE arrecadacoes_contribuicoes SET status = 'approved', updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING id`,
              [contribuicao.id]
            );

            if (travado.rows.length > 0) {
              const atletaNome = contribuicao.apelido || contribuicao.nome || 'Atleta';
              // Registra crédito no caixa da pelada com o nome da arrecadação
              await client.query(`
                INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
                VALUES ($1, $2, $3, 'credito', $4)
              `, [usuario_id, contribuicao.grupo_id, parseFloat(contribuicao.valor), `Arrecadação: ${contribuicao.titulo} (${atletaNome})`]);
            }

            await client.query('COMMIT');
            return res.json({ status: 'approved', valor: parseFloat(contribuicao.valor) });
          }
        }
      } catch (mpErr) {
        console.warn('[StatusContribuicao MP Error]', mpErr.message);
      }
    }

    res.json({
      status: contribuicao.status,
      valor: parseFloat(contribuicao.valor),
      qr_code: contribuicao.qr_code,
      qr_code_base64: contribuicao.qr_code_base64
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[consultarStatusContribuicao]', err);
    res.status(500).json({ error: 'Erro ao consultar status da contribuição.', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

// 6. Simular Aprovação de Contribuição (Ambiente Dev / Teste)
exports.simularAprovacaoContribuicao = async (req, res) => {
  const { contribuicaoId } = req.body;
  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const cRes = await client.query(`
      SELECT c.*, a.titulo, a.grupo_id, u.nome, u.apelido
      FROM arrecadacoes_contribuicoes c
      JOIN arrecadacoes a ON c.arrecadacao_id = a.id
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = $1
    `, [contribuicaoId]);

    if (cRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Contribuição não encontrada.' });
    }

    const contribuicao = cRes.rows[0];
    await client.query(
      `UPDATE arrecadacoes_contribuicoes SET status = 'approved', updated_at = NOW() WHERE id = $1`,
      [contribuicaoId]
    );

    const atletaNome = contribuicao.apelido || contribuicao.nome || 'Atleta';
    await client.query(`
      INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
      VALUES ($1, $2, $3, 'credito', $4)
    `, [contribuicao.usuario_id, contribuicao.grupo_id, parseFloat(contribuicao.valor), `Arrecadação: ${contribuicao.titulo} (${atletaNome})`]);

    await client.query('COMMIT');
    res.json({ message: 'Contribuição aprovada com sucesso!', status: 'approved' });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[simularAprovacaoContribuicao]', err);
    res.status(500).json({ error: 'Erro ao simular aprovação.', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

// 7. Contribuir com a Vaquinha utilizando o Saldo do Atleta
exports.contribuirComSaldo = async (req, res) => {
  const { arrecadacao_id, valor } = req.body;
  const usuario_id = req.usuarioId;

  if (!arrecadacao_id || !valor || isNaN(parseFloat(valor)) || parseFloat(valor) <= 0) {
    return res.status(400).json({ error: 'Arrecadação e valor válido são obrigatórios.' });
  }

  const valorContrib = parseFloat(valor);
  let client = null;

  try {
    if (db.pool && typeof db.pool.connect === 'function') {
      try {
        client = await db.pool.connect();
      } catch (poolErr) {
        console.warn('[contribuirComSaldo Pool Connect Warning]', poolErr.message);
      }
    }

    const queryFn = client ? (text, params) => client.query(text, params) : (text, params) => db.query(text, params);

    if (client) await client.query('BEGIN');

    // 1. Verifica usuário e saldo atual
    const uRes = await queryFn('SELECT id, nome, apelido, saldo FROM usuarios WHERE id = $1', [usuario_id]);
    if (uRes.rows.length === 0) {
      if (client) await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const usuario = uRes.rows[0];
    const saldoAtual = parseFloat(usuario.saldo || 0);

    if (saldoAtual < valorContrib) {
      if (client) await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Saldo insuficiente. Seu saldo atual é R$ ${saldoAtual.toFixed(2).replace('.', ',')}.`
      });
    }

    // 2. Verifica se a arrecadação existe (aceita qualquer status ativo/concluido no banco)
    const aRes = await queryFn('SELECT id, titulo, grupo_id, status FROM arrecadacoes WHERE id = $1', [arrecadacao_id]);
    if (aRes.rows.length === 0) {
      if (client) await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Campanha de arrecadação não encontrada.' });
    }
    const arrecadacao = aRes.rows[0];
    if (String(arrecadacao.status).toLowerCase() === 'cancelada') {
      if (client) await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta campanha de arrecadação foi cancelada.' });
    }

    // 3. Debita do saldo do usuário
    const novoSaldo = Math.max(0, saldoAtual - valorContrib);
    await queryFn('UPDATE usuarios SET saldo = $1, updated_at = NOW() WHERE id = $2', [novoSaldo, usuario_id]);

    // 4. Insere a contribuição aprovada
    const paymentId = `saldo_${usuario_id}_${Date.now()}`;
    await queryFn(`
      INSERT INTO arrecadacoes_contribuicoes (arrecadacao_id, usuario_id, valor, status, payment_id)
      VALUES ($1, $2, $3, 'approved', $4)
    `, [arrecadacao_id, usuario_id, valorContrib, paymentId]);

    // 5. Registra o crédito de entrada no caixa geral (transacoes)
    const atletaNome = usuario.apelido || usuario.nome || 'Atleta';
    try {
      await queryFn(`
        INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
        VALUES ($1, $2, $3, 'credito', $4)
      `, [usuario_id, arrecadacao.grupo_id, valorContrib, `Arrecadação (Saldo): ${arrecadacao.titulo} (${atletaNome})`]);
    } catch (tErr) {
      console.warn('[contribuirComSaldo Transacao Warning]', tErr.message);
    }

    if (client) await client.query('COMMIT');

    res.json({
      success: true,
      status: 'approved',
      novoSaldo: novoSaldo,
      message: 'Contribuição realizada com sucesso usando seu saldo!'
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[contribuirComSaldo Error]', err);
    res.status(500).json({ error: 'Erro ao processar contribuição com saldo.', detail: err.message });
  } finally {
    if (client) {
      try { client.release(); } catch(e){}
    }
  }
};
