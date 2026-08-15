const db = require('../config/database');
const { verificarRegra2Horas } = require('../services/convocacaoService');

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

exports.confirmar = async (req, res) => {
  const { pelada_id, forma_pagamento } = req.body;
  const usuario_id = req.usuarioId;

  if (!pelada_id || !forma_pagamento) {
    return res.status(400).json({ error: 'Pelada e forma de pagamento são obrigatórias' });
  }

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Obter informações da pelada, custos, limites e configurações do grupo
    const queryConfig = `
      SELECT p.grupo_id,
             p.data,
             p.limite_atletas,
             COALESCE(p.valor_convocacao, c.valor_convocacao, 20.00) as custo,
             c.limite_saldo_negativo
      FROM peladas p
      LEFT JOIN configs c ON p.grupo_id = c.grupo_id
      WHERE p.id = $1`;
    const configRes = await client.query(queryConfig, [pelada_id]);

    if (configRes.rows.length === 0) {
      throw new Error('Configuração do grupo/pelada não encontrada');
    }

    const { grupo_id, custo, limite_saldo_negativo, data: dataPelada, limite_atletas } = configRes.rows[0];
    const valorCusto = parseFloat(custo || 0);
    const limiteNegativo = parseFloat(limite_saldo_negativo || 0);
    const limiteMaxAtletas = limite_atletas || 20; // fallback se limite_atletas for null

    // 2. Contar quantos atletas confirmados já estão na pelada (lista oficial)
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS total FROM convocacoes 
       WHERE pelada_id = $1 AND status = 'confirmado'`,
      [pelada_id]
    );
    const confirmados = countRes.rows[0].total;

    // Verificar se o próprio usuário já tem uma convocação
    const userConvRes = await client.query(
      `SELECT status FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2`,
      [pelada_id, usuario_id]
    );
    const jaConvocado = userConvRes.rows.length > 0;
    const statusAtual = jaConvocado ? userConvRes.rows[0].status : null;

    // Se ele já estava confirmado, o status não muda e não conta como novo
    // Se ele não estava confirmado, e já atingiu o limite, ele vai para a fila
    const vaiParaFila = (statusAtual !== 'confirmado') && (confirmados >= limiteMaxAtletas);

    // 3. Buscar informações do usuário
    const userRes = await client.query('SELECT saldo, nome, apelido FROM usuarios WHERE id = $1', [usuario_id]);
    if (userRes.rows.length === 0) {
      throw new Error('Usuário não encontrado');
    }
    const saldoAtual = parseFloat(userRes.rows[0].saldo || 0);
    const atletaNome = userRes.rows[0].apelido || userRes.rows[0].nome || 'Atleta';
    const dataFmt = formatarDataDDMM(dataPelada);
    const descText = `Presença de ${atletaNome} no dia ${dataFmt}`;

    // Só debita o saldo/registra transação se o atleta de fato entrar na lista oficial (não vai para fila)
    if (!vaiParaFila) {
      if (forma_pagamento === 'saldo') {
        const novoSaldo = saldoAtual - valorCusto;
        if (novoSaldo < -limiteNegativo) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: `Saldo insuficiente. O custo da pelada é R$ ${valorCusto.toFixed(2)}, mas seu saldo é R$ ${saldoAtual.toFixed(2)} (limite negativo: R$ ${limiteNegativo.toFixed(2)}). Selecione PIX.` 
          });
        }

        // Atualizar saldo do usuário
        await client.query('UPDATE usuarios SET saldo = $1 WHERE id = $2', [novoSaldo, usuario_id]);

        // Registrar transação de débito
        await client.query(`
          INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
          VALUES ($1, $2, $3, 'debito', $4)`,
          [usuario_id, grupo_id, valorCusto, descText]
        );
      } else {
        // Registrar transação de débito para pagamento via PIX/Dinheiro
        await client.query(`
          INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
          VALUES ($1, $2, $3, 'debito', $4)`,
          [usuario_id, grupo_id, valorCusto, descText]
        );
      }
    }

    // 4. Inserir ou atualizar convocação (lista oficial ou fila de espera)
    let statusConv = 'confirmado';
    let posicaoFila = null;

    if (vaiParaFila) {
      statusConv = 'espera';
      const filaRes = await client.query(
        `SELECT COALESCE(MAX(posicao_fila), 0)::int AS ultima
         FROM convocacoes WHERE pelada_id = $1 AND status = 'espera'`,
        [pelada_id]
      );
      posicaoFila = filaRes.rows[0].ultima + 1;
    }

    const queryConv = `
      INSERT INTO convocacoes (pelada_id, usuario_id, status, forma_pagamento, data_convocacao, posicao_fila)
      VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (pelada_id, usuario_id) 
      DO UPDATE SET status = $3, forma_pagamento = $4, data_convocacao = NOW(), posicao_fila = $5`;
    await client.query(queryConv, [pelada_id, usuario_id, statusConv, forma_pagamento, posicaoFila]);

    await client.query('COMMIT');

    // 5. Dispara notificação push de confirmação para o próprio usuário e para o gestor
    try {
      const { sendNotificationInternal } = require('./pushController');
      if (vaiParaFila) {
        sendNotificationInternal({
          usuarioId: usuario_id,
          title: 'Fila de Espera! ⏳',
          body: `A lista oficial está cheia. Você está na fila de espera (Posição #${posicaoFila}) para a pelada de ${dataFmt}.`,
          url: '/#/jogador/convocacao'
        }).catch(e => console.warn('[Push] Erro ao disparar push de fila de espera:', e.message));

        sendNotificationInternal({
          onlyGestores: true,
          grupoId: grupo_id,
          title: '⏳ Atleta na Fila de Espera!',
          body: `${atletaNome} entrou na fila de espera (Posição #${posicaoFila}) para a pelada de ${dataFmt}.`,
          url: '/#/gestor/partidas'
        }).catch(e => console.warn('[Push] Erro ao notificar gestor sobre fila de espera:', e.message));
      } else {
        sendNotificationInternal({
          usuarioId: usuario_id,
          title: 'Presença Confirmada! ⚽',
          body: `Você confirmou presença na pelada de ${dataFmt} via ${forma_pagamento.toUpperCase()}. Bom jogo!`,
          url: '/#/jogador/convocacao'
        }).catch(e => console.warn('[Push] Erro ao disparar push de presenca:', e.message));
      }
    } catch(e) {}

    if (vaiParaFila) {
      res.json({ message: 'Você foi adicionado à fila de espera!', custo: 0, naFila: true, posicao: posicaoFila });
    } else {
      res.json({ message: 'Presença confirmada!', custo: valorCusto, naFila: false });
    }
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

// Entrar diretamente na Fila de Espera sem realizar cobrança prévia
exports.entrarFila = async (req, res) => {
  const { pelada_id } = req.body;
  const usuario_id = req.usuarioId;

  if (!pelada_id) {
    return res.status(400).json({ error: 'ID da pelada é obrigatório' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Obter informações da pelada
    const queryConfig = `
      SELECT p.grupo_id, p.data
      FROM peladas p
      WHERE p.id = $1`;
    const configRes = await client.query(queryConfig, [pelada_id]);

    if (configRes.rows.length === 0) {
      throw new Error('Pelada não encontrada');
    }

    const { grupo_id, data: dataPelada } = configRes.rows[0];

    // 2. Buscar dados do usuário
    const userRes = await client.query('SELECT nome, apelido FROM usuarios WHERE id = $1', [usuario_id]);
    const atletaNome = (userRes.rows[0] && (userRes.rows[0].apelido || userRes.rows[0].nome)) || 'Atleta';
    const dataFmt = formatarDataDDMM(dataPelada);

    // 3. Obter a próxima posição da fila de espera
    const filaRes = await client.query(
      `SELECT COALESCE(MAX(posicao_fila), 0)::int AS ultima
       FROM convocacoes WHERE pelada_id = $1 AND status IN ('espera', 'fila_espera')`,
      [pelada_id]
    );
    const posicaoFila = filaRes.rows[0].ultima + 1;

    // 4. Inserir ou atualizar convocação com status 'espera' sem cobrar saldo/pix
    const queryConv = `
      INSERT INTO convocacoes (pelada_id, usuario_id, status, forma_pagamento, data_convocacao, posicao_fila)
      VALUES ($1, $2, 'espera', 'pendente', NOW(), $3)
      ON CONFLICT (pelada_id, usuario_id) 
      DO UPDATE SET status = 'espera', forma_pagamento = 'pendente', data_convocacao = NOW(), posicao_fila = $3`;
    await client.query(queryConv, [pelada_id, usuario_id, posicaoFila]);

    await client.query('COMMIT');

    // 5. Disparar notificações push para o atleta e para os gestores
    try {
      const { sendNotificationInternal } = require('./pushController');
      sendNotificationInternal({
        usuarioId: usuario_id,
        title: 'Fila de Espera! ⏳',
        body: `Você entrou na fila de espera (Posição #${posicaoFila}) para a pelada de ${dataFmt}. Se uma vaga for liberada, você será notificado para efetuar o pagamento.`,
        url: '/#/jogador/convocacao'
      }).catch(e => console.warn('[Push] Erro atleta:', e.message));

      sendNotificationInternal({
        onlyGestores: true,
        grupoId: grupo_id,
        title: '⏳ Atleta na Fila de Espera!',
        body: `${atletaNome} entrou na fila de espera (Posição #${posicaoFila}) para a pelada de ${dataFmt}.`,
        url: '/#/gestor/partidas'
      }).catch(e => console.warn('[Push] Erro gestores:', e.message));
    } catch(e) {}

    res.json({ message: 'Você foi adicionado à fila de espera!', posicao: posicaoFila });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

exports.remover = async (req, res) => {
  const { pelada_id, opcao_remocao } = req.body; // 'estorno', 'caixa', 'cortado'
  const usuario_id = req.usuarioId;

  if (!pelada_id || !opcao_remocao) {
    return res.status(400).json({ error: 'Pelada e opção de remoção são obrigatórias' });
  }

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Verificar se pode estornar (Regra das 2 horas)
    const podeEstornar = await verificarRegra2Horas(pelada_id);

    if (!podeEstornar && opcao_remocao === 'estorno') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Prazo de estorno expirado (menos de 2h para a pelada)' });
    }

    // 2. Buscar detalhes da convocação atual
    const convRes = await client.query(
      'SELECT status, forma_pagamento FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2',
      [pelada_id, usuario_id]
    );

    if (convRes.rows.length === 0 || (convRes.rows[0].status !== 'confirmado' && convRes.rows[0].status !== 'espera')) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Você não tem convocação ativa nesta pelada' });
    }

    const { status: statusAntes, forma_pagamento } = convRes.rows[0];

    // 3. Executar lógica de reembolso se aplicável (apenas se estava confirmado e pagou com saldo)
    if (statusAntes === 'confirmado' && forma_pagamento === 'saldo' && opcao_remocao === 'estorno' && podeEstornar) {
      // Obter custo real da pelada (respeitando override por data)
      const configRes = await client.query(`
        SELECT COALESCE(p.valor_convocacao, c.valor_convocacao, 20.00) as custo, p.grupo_id
        FROM peladas p
        LEFT JOIN configs c ON p.grupo_id = c.grupo_id
        WHERE p.id = $1`, [pelada_id]);

      if (configRes.rows.length > 0) {
        const { custo, grupo_id } = configRes.rows[0];
        const valorCusto = parseFloat(custo || 0);

        // Estornar saldo (soma ao saldo do usuário)
        await client.query('UPDATE usuarios SET saldo = saldo + $1 WHERE id = $2', [valorCusto, usuario_id]);

        // Registrar transação de crédito
        await client.query(`
          INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
          VALUES ($1, $2, $3, 'credito', $4)`,
          [usuario_id, grupo_id, valorCusto, `Estorno de presença na Pelada #${pelada_id}`]
        );
      }
    }

    // 4. Atualizar status da convocação
    const statusFinal = opcao_remocao === 'cortado' ? 'cortado' : 'pendente';
    const queryUpdate = `
      UPDATE convocacoes 
      SET status = $1, motivo_remocao = $2, data_remocao = NOW(), posicao_fila = NULL
      WHERE pelada_id = $3 AND usuario_id = $4`;
    await client.query(queryUpdate, [statusFinal, opcao_remocao, pelada_id, usuario_id]);

    // 4.5 Se o atleta removido era da LISTA OFICIAL, promover o 1º da fila de espera
    if (statusAntes === 'confirmado') {
      const filaRes = await client.query(
        `SELECT usuario_id FROM convocacoes
         WHERE pelada_id = $1 AND status IN ('espera', 'fila_espera')
         ORDER BY COALESCE(posicao_fila, 999) ASC, data_convocacao ASC
         LIMIT 1 FOR UPDATE`,
        [pelada_id]
      );

      if (filaRes.rows.length > 0) {
        const promovidoUsuarioId = filaRes.rows[0].usuario_id;
        await client.query(
          `UPDATE convocacoes
           SET status = 'confirmado', posicao_fila = NULL
           WHERE pelada_id = $1 AND usuario_id = $2`,
          [pelada_id, promovidoUsuarioId]
        );

        // Notificação push ao atleta promovido
        try {
          const { sendNotificationInternal } = require('./pushController');
          sendNotificationInternal({
            usuarioId: promovidoUsuarioId,
            title: '🎉 Vaga Liberada na Pelada!',
            body: 'Um atleta desistiu e uma vaga foi liberada para você! Acesse o aplicativo e efetue o pagamento para garantir sua vaga.',
            url: '/#/jogador/convocacao'
          }).catch(e => console.warn('[Push] Erro ao notificar promovido:', e.message));
        } catch (e) { }
      }
    }

    // Reordena a fila restante de forma incondicional para preencher quaisquer buracos
    const restantesRes = await client.query(
      `SELECT usuario_id FROM convocacoes
       WHERE pelada_id = $1 AND status IN ('espera', 'fila_espera')
       ORDER BY COALESCE(posicao_fila, 999) ASC, data_convocacao ASC`,
      [pelada_id]
    );
    for (let i = 0; i < restantesRes.rows.length; i++) {
      await client.query(
        'UPDATE convocacoes SET posicao_fila = $1 WHERE pelada_id = $2 AND usuario_id = $3',
        [i + 1, pelada_id, restantesRes.rows[i].usuario_id]
      );
    }

    // 4.6 Se o atleta removido era da FILA DE ESPERA, notificar o gestor e o próximo da fila
    if (statusAntes === 'espera' || statusAntes === 'fila_espera') {
      try {
        const { sendNotificationInternal } = require('./pushController');
        const peladaRes = await client.query('SELECT grupo_id, data FROM peladas WHERE id = $1', [pelada_id]);
        const grupo_id = peladaRes.rows[0] ? peladaRes.rows[0].grupo_id : null;
        const dataPelada = peladaRes.rows[0] ? peladaRes.rows[0].data : null;
        const dataFmt = formatarDataDDMM(dataPelada);

        const userRes = await client.query('SELECT nome, apelido FROM usuarios WHERE id = $1', [usuario_id]);
        const atletaNome = (userRes.rows[0] && (userRes.rows[0].apelido || userRes.rows[0].nome)) || 'Atleta';

        // Notificar Gestores
        if (grupo_id) {
          sendNotificationInternal({
            onlyGestores: true,
            grupoId: grupo_id,
            title: '⏳ Fila de Espera Atualizada',
            body: `${atletaNome} desconvocou-se e saiu da fila de espera para a pelada de ${dataFmt}.`,
            url: '/#/gestor/partidas'
          }).catch(e => console.warn('[Push] Erro gestor:', e.message));
        }

        // Notificar o próximo da fila (se houver alguém na fila agora)
        if (restantesRes.rows.length > 0) {
          const proximoId = restantesRes.rows[0].usuario_id;
          sendNotificationInternal({
            usuarioId: proximoId,
            title: '⏳ Posição Atualizada na Fila!',
            body: `Um atleta saiu da fila. Sua nova posição na fila de espera é #1 para a pelada de ${dataFmt}.`,
            url: '/#/jogador/convocacao'
          }).catch(e => console.warn('[Push] Erro próximo da fila:', e.message));
        }
      } catch (e) {
        console.warn('[Push] Erro nas notificações de remoção da fila:', e);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Remoção processada com sucesso!', estornado: statusAntes === 'confirmado' && podeEstornar && opcao_remocao === 'estorno' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
};

// Rota auxiliar para obter os convocados de uma pelada
exports.listarConvocados = async (req, res) => {
  const { peladaId } = req.params;
  try {
    // Garante que a coluna saldo_estornado existe (idempotente — só executa DDL se necessário)
    await db.query('ALTER TABLE convocacoes ADD COLUMN IF NOT EXISTS saldo_estornado BOOLEAN DEFAULT FALSE');

    const query = `
      SELECT u.id, u.nome, u.apelido, u.goleiro, u.autoavaliacao, u.foto, u.saldo,
             COALESCE(u.gols, 0) AS gols, COALESCE(u.partidas, 0) AS partidas, COALESCE(u.partidas, 0) AS jogos,
             u.data_nascimento, u.time_coracao,
             c.status, c.forma_pagamento, c.data_convocacao, c.presenca, c.posicao_fila,
             COALESCE(c.saldo_estornado, FALSE) AS saldo_estornado
      FROM convocacoes c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.pelada_id = $1
      ORDER BY c.data_convocacao ASC`;
    const { rows } = await db.query(query, [peladaId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar convocados', detail: err.message });
  }
};

exports.atualizarPresenca = async (req, res) => {
  const { pelada_id, usuario_id, presenca } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem registrar presença.' });
  }

  if (!pelada_id || !usuario_id) {
    return res.status(400).json({ error: 'Pelada e jogador são obrigatórios' });
  }

  try {
    const query = `
      UPDATE convocacoes 
      SET presenca = $1 
      WHERE pelada_id = $2 AND usuario_id = $3
      RETURNING pelada_id, usuario_id, presenca`;
    const { rows } = await db.query(query, [!!presenca, pelada_id, usuario_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Convocação não encontrada' });
    }

    res.json({ message: 'Presença atualizada com sucesso!', convocacao: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar presença', detail: err.message });
  }
};

exports.desconvocarPorGestor = async (req, res) => {
  const pelada_id = req.body.pelada_id || req.query.pelada_id;
  const usuario_id = req.body.usuario_id || req.query.usuario_id;

  if (!pelada_id || !usuario_id) {
    return res.status(400).json({ error: 'pelada_id e usuario_id são obrigatórios.' });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // Verifica se existe a convocação e qual o status dela
    const { rows: check } = await client.query(
      'SELECT status FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2',
      [pelada_id, usuario_id]
    );
    if (check.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Convocação não encontrada para esta pelada.' });
    }

    const statusRemovido = check[0].status;

    // Remove a convocação completamente
    await client.query(
      'DELETE FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2',
      [pelada_id, usuario_id]
    );

    // Se o atleta removido era da LISTA OFICIAL, promover o 1º da fila de espera
    if (statusRemovido === 'confirmado') {
      const filaRes = await client.query(
        `SELECT usuario_id FROM convocacoes
         WHERE pelada_id = $1 AND status IN ('espera', 'fila_espera')
         ORDER BY COALESCE(posicao_fila, 999) ASC, data_convocacao ASC
         LIMIT 1 FOR UPDATE`,
        [pelada_id]
      );

      if (filaRes.rows.length > 0) {
        const promovidoUsuarioId = filaRes.rows[0].usuario_id;
        await client.query(
          `UPDATE convocacoes
           SET status = 'confirmado', posicao_fila = NULL
           WHERE pelada_id = $1 AND usuario_id = $2`,
          [pelada_id, promovidoUsuarioId]
        );

        // Notificação push ao atleta promovido
        try {
          const pushController = require('./pushController');
          if (pushController && pushController.sendNotificationInternal) {
            pushController.sendNotificationInternal({
              usuarioId: promovidoUsuarioId,
              title: 'Você entrou na lista oficial! 🎉',
              body: 'Um atleta desistiu e você foi promovido da fila de espera para a lista oficial.',
              url: '/#/jogador/convocacao'
            }).catch(e => console.warn('[Push] Erro ao notificar promovido:', e.message));
          }
        } catch (e) { }
      }
    }

    // Reordena a fila restante (posições 1, 2, 3...)
    const restantesRes = await client.query(
      `SELECT usuario_id FROM convocacoes
       WHERE pelada_id = $1 AND status IN ('espera', 'fila_espera')
       ORDER BY COALESCE(posicao_fila, 999) ASC, data_convocacao ASC`,
      [pelada_id]
    );
    for (let i = 0; i < restantesRes.rows.length; i++) {
      await client.query(
        `UPDATE convocacoes SET posicao_fila = $1 WHERE pelada_id = $2 AND usuario_id = $3`,
        [i + 1, pelada_id, restantesRes.rows[i].usuario_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Atleta desconvocado com sucesso!' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[desconvocarPorGestor]', err);
    res.status(500).json({ error: 'Erro ao desconvocar atleta.', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

exports.adicionarPorGestor = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem adicionar atletas.' });
  }

  const { pelada_id, usuario_id, convidado, forma_pagamento } = req.body;
  const finalFormaPagamento = forma_pagamento === 'pix' ? 'pix' : 'saldo';

  if (!pelada_id) {
    return res.status(400).json({ error: 'ID da pelada é obrigatório.' });
  }

  try {
    let finalUsuarioId = usuario_id;

    // Se for um novo convidado
    if (convidado && convidado.nome) {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('123456', 10);
      const emailFicticio = `convidado_${Date.now()}_${Math.floor(Math.random() * 1000)}@convidado.com`;
      const autoRating = convidado.autoavaliacao !== undefined ? parseInt(convidado.autoavaliacao) : 3;

      // Inserir na tabela usuarios
      const insertUserQuery = `
        INSERT INTO usuarios (nome, email, senha_hash, autoavaliacao, tipo, goleiro, verificado, ativo, saldo, gols, partidas, avaliacao_media)
        VALUES ($1, $2, $3, $4, 'jogador', $5, true, true, 0.00, 0, 0, $6)
        RETURNING id`;

      const { rows: userInserted } = await db.query(insertUserQuery, [
        convidado.nome.trim(),
        emailFicticio,
        hash,
        autoRating,
        !!convidado.goleiro,
        parseFloat(autoRating)
      ]);
      finalUsuarioId = userInserted[0].id;
    }

    if (!finalUsuarioId) {
      return res.status(400).json({ error: 'É necessário informar um atleta existente ou dados do convidado.' });
    }

    // Obter informações do grupo_id e custo para transação
    const configRes = await db.query(`
      SELECT p.grupo_id, p.data, COALESCE(p.valor_convocacao, c.valor_convocacao, 20.00) as custo
      FROM peladas p
      LEFT JOIN configs c ON p.grupo_id = c.grupo_id
      WHERE p.id = $1`, [pelada_id]);

    let grupo_id = null;
    let valorCusto = 20.00;
    let dataPelada = null;
    if (configRes.rows.length > 0) {
      grupo_id = configRes.rows[0].grupo_id;
      valorCusto = parseFloat(configRes.rows[0].custo || 20.00);
      dataPelada = configRes.rows[0].data;
    }

    // Verifica se já existe convocação para esse usuário nesta pelada
    const { rows: check } = await db.query(
      'SELECT status FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2',
      [pelada_id, finalUsuarioId]
    );

    if (check.length > 0) {
      // Se já existir, força a presença como true e status como confirmado
      await db.query(
        `UPDATE convocacoes 
         SET status = 'confirmado', presenca = true, motivo_remocao = null, data_remocao = null, forma_pagamento = $3 
         WHERE pelada_id = $1 AND usuario_id = $2`,
        [pelada_id, finalUsuarioId, finalFormaPagamento]
      );
    } else {
      // Se não existir convocação, insere uma nova confirmada e presente
      await db.query(
        `INSERT INTO convocacoes (pelada_id, usuario_id, status, presenca, forma_pagamento) 
         VALUES ($1, $2, 'confirmado', true, $3)`,
        [pelada_id, finalUsuarioId, finalFormaPagamento]
      );
    }

    // Se for saldo, desconta do saldo do atleta no banco
    if (finalFormaPagamento === 'saldo') {
      await db.query('UPDATE usuarios SET saldo = COALESCE(saldo, 0) - $1 WHERE id = $2', [valorCusto, finalUsuarioId]);
    }

    // Registrar transação de débito no banco
    if (grupo_id) {
      const userRes = await db.query('SELECT nome, apelido FROM usuarios WHERE id = $1', [finalUsuarioId]);
      let atletaNome = 'Atleta';
      if (userRes.rows.length > 0) {
        atletaNome = userRes.rows[0].apelido || userRes.rows[0].nome || 'Atleta';
      }
      const dataFmt = formatarDataDDMM(dataPelada);
      const descText = `Presença de ${atletaNome} no dia ${dataFmt}`;
      await db.query(`
        INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
        VALUES ($1, $2, $3, 'debito', $4)`,
        [finalUsuarioId, grupo_id, valorCusto, descText]
      );
    }

    res.status(201).json({ message: 'Jogador adicionado à presença com sucesso!', usuario_id: finalUsuarioId });
  } catch (err) {
    console.error('[adicionarPorGestor]', err);
    res.status(500).json({ error: 'Erro ao adicionar jogador à pelada.', detail: err.message });
  }
};

// --- PUT /api/convocacoes/:peladaId/limite — Gestor define o limite de atletas ---
exports.alterarLimite = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem alterar o limite.' });
  }

  const { peladaId } = req.params;
  const { limite } = req.body;

  if (!limite || limite < 2 || limite > 100) {
    return res.status(400).json({ error: 'Limite inválido (mín. 2, máx. 100).' });
  }

  try {
    // Conta quantos estão na lista oficial
    const { rows: contagem } = await db.query(
      `SELECT COUNT(*)::int AS total FROM convocacoes
       WHERE pelada_id = $1 AND status = 'confirmado'`,
      [peladaId]
    );
    const oficiais = contagem[0].total;

    // Se o novo limite é menor que o nº de oficiais, avisa quantos serão movidos
    if (oficiais > limite) {
      const excedente = oficiais - limite;
      if (req.body.confirmacao !== true) {
        return res.status(409).json({
          error: `O novo limite (${limite}) é menor que o número de atletas confirmados (${oficiais}). ${excedente} atleta(s) serão movidos para a fila de espera.`,
          excedente
        });
      }
    }

    await db.query('UPDATE peladas SET limite_atletas = $1 WHERE id = $2', [limite, peladaId]);
    res.json({ success: true, limite });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar limite.', detail: err.message });
  }
};

// --- POST /api/convocacoes/estornar-saldo — Gestor estorna o saldo de um atleta ausente ---
exports.estornarSaldo = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem estornar saldo.' });
  }

  const { pelada_id, usuario_id } = req.body;
  if (!pelada_id || !usuario_id) {
    return res.status(400).json({ error: 'pelada_id e usuario_id são obrigatórios.' });
  }

  let client;
  try {
    // Garante que a coluna saldo_estornado existe (idempotente)
    await db.query('ALTER TABLE convocacoes ADD COLUMN IF NOT EXISTS saldo_estornado BOOLEAN DEFAULT FALSE');

    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Busca a convocação e verifica condições
    const { rows: conv } = await client.query(
      `SELECT c.forma_pagamento, c.presenca, c.saldo_estornado,
              p.grupo_id, p.data AS data_pelada,
              COALESCE(p.valor_convocacao, cfg.valor_convocacao, 20.00) AS custo
       FROM convocacoes c
       JOIN peladas p ON p.id = c.pelada_id
       LEFT JOIN configs cfg ON cfg.grupo_id = p.grupo_id
       WHERE c.pelada_id = $1 AND c.usuario_id = $2`,
      [pelada_id, usuario_id]
    );

    if (conv.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Convocação não encontrada.' });
    }

    const { forma_pagamento, presenca, saldo_estornado, grupo_id, data_pelada, custo } = conv[0];
    const valorCusto = parseFloat(custo || 20.00);

    if (forma_pagamento !== 'saldo') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Somente pagamentos por saldo podem ser estornados aqui.' });
    }

    if (presenca) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'O atleta marcou presença — não é possível estornar.' });
    }

    if (saldo_estornado) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'O saldo deste atleta já foi estornado anteriormente.' });
    }

    // 2. Credita o valor de volta no saldo do atleta
    await client.query(
      'UPDATE usuarios SET saldo = COALESCE(saldo, 0) + $1 WHERE id = $2',
      [valorCusto, usuario_id]
    );

    // 3. Registra transação de crédito no histórico
    if (grupo_id) {
      const userRes = await client.query('SELECT nome, apelido FROM usuarios WHERE id = $1', [usuario_id]);
      const atletaNome = (userRes.rows[0] && (userRes.rows[0].apelido || userRes.rows[0].nome)) || 'Atleta';
      const dataFmt = formatarDataDDMM(data_pelada);
      await client.query(
        `INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
         VALUES ($1, $2, $3, 'credito', $4)`,
        [usuario_id, grupo_id, valorCusto, `Estorno de ausência de ${atletaNome} no dia ${dataFmt}`]
      );
    }

    // 4. Marca a convocação como estornada (evita duplo estorno)
    await client.query(
      'UPDATE convocacoes SET saldo_estornado = TRUE WHERE pelada_id = $1 AND usuario_id = $2',
      [pelada_id, usuario_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Saldo estornado com sucesso!', valor: valorCusto });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[estornarSaldo]', err);
    res.status(500).json({ error: 'Erro ao estornar saldo.', detail: err.message });
  } finally {
    if (client) client.release();
  }
};
