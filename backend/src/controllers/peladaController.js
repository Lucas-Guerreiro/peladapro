const db = require('../config/database');

// --- Criar nova pelada principal (Grupo) ---------------------------------
exports.criarGrupo = async (req, res) => {
  const { nome, criterio_empate, vitorias_para_sair, jogadores_por_time, quantidade_times, regra_saida, valor_convocacao } = req.body;
  const gestor_id = req.usuarioId; // Obtido do Token JWT

  if (!nome) {
    return res.status(400).json({ error: 'O nome da pelada é obrigatório' });
  }

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Inserir o grupo
    const queryGrupo = `
      INSERT INTO grupos (nome, gestor_id)
      VALUES ($1, $2) RETURNING id, nome, gestor_id`;
    const grupoRes = await client.query(queryGrupo, [nome, gestor_id]);
    const grupo = grupoRes.rows[0];

    // 2. Criar configurações padrões customizadas para este novo grupo/pelada
    const queryConfig = `
      INSERT INTO configs (grupo_id, valor_mensalidade, limite_saldo_negativo, qtd_times, jogadores_por_time, criterio_empate, vitorias_para_sair, regra_saida, valor_convocacao)
      VALUES ($1, 30.00, 60.00, $2, $3, $4, $5, $6, $7)`;
    await client.query(queryConfig, [
      grupo.id,
      quantidade_times ? parseInt(quantidade_times) : 2,
      jogadores_por_time ? parseInt(jogadores_por_time) : 7,
      criterio_empate || 'ambos_permanecem',
      vitorias_para_sair ? parseInt(vitorias_para_sair) : 2,
      regra_saida || 'final_fila',
      valor_convocacao ? parseFloat(valor_convocacao) : 20.00
    ]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Nova pelada (grupo) criada com sucesso!', grupo });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao criar pelada', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

// --- Listar grupos/peladas (gestores veem apenas os seus, jogadores veem todos ativos) ----------
exports.listarGrupos = async (req, res) => {
  const usuario_id = req.usuarioId;
  const tipo = req.usuarioTipo;

  try {
    let query;
    let params;

    if (tipo === 'gestor') {
      query = `
        SELECT g.id, g.nome, g.ativo, c.valor_mensalidade as custo, c.limite_saldo_negativo,
               c.criterio_empate, c.vitorias_para_sair, c.regra_saida, c.qtd_times as quantidade_times, c.jogadores_por_time, c.valor_convocacao
        FROM grupos g
        LEFT JOIN configs c ON g.id = c.grupo_id
        WHERE g.gestor_id = $1 AND g.ativo = true
        ORDER BY g.nome ASC`;
      params = [usuario_id];
    } else {
      query = `
        SELECT g.id, g.nome, g.ativo, c.valor_mensalidade as custo, c.limite_saldo_negativo,
               c.criterio_empate, c.vitorias_para_sair, c.regra_saida, c.qtd_times as quantidade_times, c.jogadores_por_time, c.valor_convocacao
        FROM grupos g
        LEFT JOIN configs c ON g.id = c.grupo_id
        WHERE g.ativo = true
        ORDER BY g.nome ASC`;
      params = [];
    }

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar peladas', detail: err.message });
  }
};

// --- Agendar nova data/horário para a pelada (com notificação) ----------
exports.agendarData = async (req, res) => {
  const { grupo_id, data, horario, local, max_jogadores, valor_convocacao, chave_pix, chave_pix_nome } = req.body;

  if (!grupo_id || !data || !horario || !local) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes (grupo, data, horário, local)' });
  }

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Inserir a partida na tabela 'peladas'
    const queryPelada = `
      INSERT INTO peladas (grupo_id, data, horario, status, local, max_jogadores, valor_convocacao, chave_pix, chave_pix_nome)
      VALUES ($1, $2, $3, 'agendada', $4, $5, $6, $7, $8) RETURNING id, data, horario, local, chave_pix, chave_pix_nome`;
    const peladaRes = await client.query(queryPelada, [grupo_id, data, horario, local, max_jogadores || 20, valor_convocacao || 20.00, chave_pix || null, chave_pix_nome || null]);
    const pelada = peladaRes.rows[0];

    // 2. Buscar todos os atletas ativos no sistema (jogadores, gestores e tipo ambos)
    const { rows: atletas } = await client.query(
      "SELECT id, nome, whatsapp FROM usuarios WHERE (tipo = 'jogador' OR tipo = 'gestor' OR tipo = 'ambos') AND ativo = true"
    );

    // 3. Criar convocações pendentes para todos os atletas ativos
    const queryConv = `
      INSERT INTO convocacoes (pelada_id, usuario_id, status, forma_pagamento)
      VALUES ($1, $2, 'pendente', NULL)
      ON CONFLICT (pelada_id, usuario_id) DO NOTHING`;

    const notificados = [];
    for (let atleta of atletas) {
      await client.query(queryConv, [pelada.id, atleta.id]);
      if (atleta.whatsapp) {
        notificados.push(atleta.nome);
        // Simulação do envio de mensagem via WhatsApp (Log no console do backend)
        console.log(`💬 [WhatsApp Notificação] Enviado para ${atleta.nome} (${atleta.whatsapp}): ` +
          `"Nova convocação aberta para a pelada em ${data} às ${horario} no local ${local}. Confirme sua presença no app!"`);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Partida agendada e convocações abertas com sucesso!',
      pelada,
      totalNotificados: notificados.length,
      atletasNotificados: notificados
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao agendar data da pelada', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

// --- Deletar data agendada da pelada --------------------------------------
exports.deletarData = async (req, res) => {
  const { id } = req.params;
  const gestor_id = req.usuarioId;

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Validar se a pelada existe e pertence a um grupo gerenciado por este gestor
    const queryVerificar = `
      SELECT p.id, p.grupo_id 
      FROM peladas p
      JOIN grupos g ON p.grupo_id = g.id
      WHERE p.id = $1 AND g.gestor_id = $2`;
    const checkRes = await client.query(queryVerificar, [id, gestor_id]);

    if (checkRes.rows.length === 0) {
      return res.status(403).json({ error: 'Você não tem permissão para deletar esta partida ou ela não existe.' });
    }

    // 2. Deletar a pelada
    const queryDeletar = `DELETE FROM peladas WHERE id = $1`;
    await client.query(queryDeletar, [id]);

    await client.query('COMMIT');
    res.json({ message: 'Partida e suas convocações deletadas com sucesso!' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao deletar data da pelada', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

// --- Listar datas (peladas) de um grupo específico ------------------------
exports.listarDatasDoGrupo = async (req, res) => {
  const { grupoId } = req.params;
  const gestor_id = req.usuarioId;
  const tipo = req.usuarioTipo;

  try {
    // Valida se o gestor é dono do grupo apenas se for gestor
    if (tipo === 'gestor') {
      const queryGrupo = `SELECT id FROM grupos WHERE id = $1 AND gestor_id = $2`;
      const grupoRes = await db.query(queryGrupo, [grupoId, gestor_id]);
      if (grupoRes.rows.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a este grupo.' });
      }
    }

    const query = `
      SELECT p.id, p.data, p.horario, p.status, p.local, p.max_jogadores, p.chave_pix, p.chave_pix_nome,
             COALESCE(p.criterio_empate, c.criterio_empate, 'ambos_permanecem') as criterio_empate,
             COALESCE(p.vitorias_para_sair, c.vitorias_para_sair, 2) as vitorias_para_sair,
             COALESCE(p.jogadores_por_time, c.jogadores_por_time, 7) as jogadores_por_time,
             COALESCE(p.quantidade_times, c.qtd_times, 2) as quantidade_times,
             COALESCE(p.regra_saida, c.regra_saida, 'final_fila') as regra_saida,
             COALESCE(p.valor_convocacao, c.valor_convocacao, 20.00) as valor_convocacao
      FROM peladas p
      JOIN grupos g ON p.grupo_id = g.id
      LEFT JOIN configs c ON g.id = c.grupo_id
      WHERE p.grupo_id = $1
      ORDER BY p.data DESC, p.horario DESC`;
    const { rows } = await db.query(query, [grupoId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar datas', detail: err.message });
  }
};

exports.atualizarConfigPartida = async (req, res) => {
  const { id } = req.params;
  const gestorId = req.usuarioId;
  const tipo = req.usuarioTipo;
  const { criterio_empate, vitorias_para_sair, jogadores_por_time, quantidade_times, regra_saida, valor_convocacao, chave_pix, chave_pix_nome } = req.body;

  if (tipo !== 'gestor' && tipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem alterar configurações da partida.' });
  }

  try {
    // Validar se a pelada pertence a um grupo do gestor
    const queryCheck = `
      SELECT p.id FROM peladas p
      JOIN grupos g ON p.grupo_id = g.id
      WHERE p.id = $1 AND g.gestor_id = $2`;
    const checkRes = await db.query(queryCheck, [id, gestorId]);
    if (checkRes.rows.length === 0) {
      return res.status(403).json({ error: 'Você não tem permissão para alterar as configurações desta partida.' });
    }

    const queryUpdate = `
      UPDATE peladas
      SET criterio_empate = $1,
          vitorias_para_sair = $2,
          jogadores_por_time = $3,
          quantidade_times = $4,
          regra_saida = $5,
          valor_convocacao = $6,
          chave_pix = $7,
          chave_pix_nome = $8
      WHERE id = $9 RETURNING id`;
    await db.query(queryUpdate, [
      criterio_empate || null,
      vitorias_para_sair !== undefined ? parseInt(vitorias_para_sair) : null,
      jogadores_por_time !== undefined ? parseInt(jogadores_por_time) : null,
      quantidade_times !== undefined ? parseInt(quantidade_times) : null,
      regra_saida || null,
      valor_convocacao !== undefined ? parseFloat(valor_convocacao) : null,
      chave_pix !== undefined ? chave_pix : null,
      chave_pix_nome !== undefined ? chave_pix_nome : null,
      id
    ]);

    res.json({ message: 'Configurações da partida atualizadas com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar configurações da partida', detail: err.message });
  }
};

exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const gestorId = req.usuarioId;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem finalizar peladas.' });
  }

  if (!status) {
    return res.status(400).json({ error: 'O status é obrigatório.' });
  }

  try {
    const queryCheck = `
      SELECT p.id 
      FROM peladas p
      JOIN grupos g ON p.grupo_id = g.id
      WHERE p.id = $1 AND g.gestor_id = $2`;
    const checkRes = await db.query(queryCheck, [id, gestorId]);
    if (checkRes.rows.length === 0) {
      return res.status(403).json({ error: 'Você não tem permissão para alterar esta pelada.' });
    }

    let queryUpdate = `
      UPDATE peladas
      SET status = $1
      WHERE id = $2 RETURNING id, status`;

    if (status === 'finalizada' || status === 'encerrada') {
      queryUpdate = `
        UPDATE peladas
        SET status = $1, live_state = NULL
        WHERE id = $2 RETURNING id, status`;
      liveStateMap.delete(id);
    }

    const { rows } = await db.query(queryUpdate, [status, id]);

    // Se o status for finalizada/encerrada, envia push notification automatica aos atletas
    if (status === 'finalizada' || status === 'encerrada') {
      try {
        const { sendNotificationInternal } = require('./pushController');
        sendNotificationInternal({
          title: '🏆 Pelada Encerrada & Ranking Atualizado!',
          body: 'A pelada de hoje foi encerrada! Acesse o app para conferir seu desempenho, gols marcados e a tabela do ranking.',
          url: '/#/jogador/ranking'
        }).catch(e => console.warn('[Push] Erro ao disparar notificação de encerramento:', e));
      } catch(e) {}
    }

    res.json({ message: 'Status da pelada atualizado com sucesso!', pelada: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar status da pelada', detail: err.message });
  }
};

// Armazena em memória o estado do jogo ao vivo por pelada_id para cache rápido
const liveStateMap = new Map();

exports.atualizarLiveState = async (req, res) => {
  const { id } = req.params;
  const { liveMatch, waitingQueue, teams } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID da pelada é obrigatório' });
  }

  try {
    // 1. Busca estado anterior do banco de dados
    const selectRes = await db.query('SELECT live_state FROM peladas WHERE id = $1', [id]);
    let existing = {};
    if (selectRes.rows.length > 0 && selectRes.rows[0].live_state) {
      try { existing = JSON.parse(selectRes.rows[0].live_state) || {}; } catch(e) {}
    }

    const currentMatch = liveMatch !== undefined ? liveMatch : (existing.liveMatch || {});
    const currentTeams = (teams && Array.isArray(teams) && teams.length > 0) ? teams : (existing.teams || []);
    let currentQueue = waitingQueue !== undefined ? waitingQueue : (existing.waitingQueue || []);

    // Reconstrói a fila de espera se estiver vazia mas existirem mais de 2 times sorteados
    if ((!currentQueue || currentQueue.length === 0) && Array.isArray(currentTeams) && currentTeams.length > 2) {
      const tA = (currentMatch.teamA || '').toLowerCase().trim();
      const tB = (currentMatch.teamB || '').toLowerCase().trim();
      currentQueue = currentTeams
        .map(t => t.nome || t.name)
        .filter(n => {
          if (!n) return false;
          const low = String(n).toLowerCase().trim();
          return low !== tA && low !== tB;
        });
    }

    const updatedState = {
      liveMatch: currentMatch,
      waitingQueue: currentQueue,
      teams: currentTeams,
      updatedAt: Date.now()
    };

    const stateJson = JSON.stringify(updatedState);

    // 2. Persiste o estado ao vivo no PostgreSQL
    await db.query('UPDATE peladas SET live_state = $1 WHERE id = $2', [stateJson, id]);

    // Atualiza cache em memória
    liveStateMap.set(String(id), updatedState);

    res.json({ message: 'Estado ao vivo atualizado com sucesso no banco de dados', state: updatedState });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar estado ao vivo no banco', detail: err.message });
  }
};

exports.obterLiveState = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'ID da pelada é obrigatório' });
  }

  try {
    let state = liveStateMap.get(String(id)) || null;

    // Se nulo no cache da função, busca diretamente no banco PostgreSQL
    if (!state) {
      const selectRes = await db.query('SELECT live_state FROM peladas WHERE id = $1', [id]);
      if (selectRes.rows.length > 0 && selectRes.rows[0].live_state) {
        try {
          state = JSON.parse(selectRes.rows[0].live_state);
          if (state) liveStateMap.set(String(id), state);
        } catch(e) {}
      }
    }

    if (state) {
      const currentMatch = state.liveMatch || {};
      const currentTeams = state.teams || [];
      let currentQueue = state.waitingQueue || [];

      if ((!currentQueue || currentQueue.length === 0) && Array.isArray(currentTeams) && currentTeams.length > 2) {
        const tA = (currentMatch.teamA || '').toLowerCase().trim();
        const tB = (currentMatch.teamB || '').toLowerCase().trim();
        currentQueue = currentTeams
          .map(t => t.nome || t.name)
          .filter(n => {
            if (!n) return false;
            const low = String(n).toLowerCase().trim();
            return low !== tA && low !== tB;
          });
        state.waitingQueue = currentQueue;
      }
    }

    res.json({ state, serverTime: Date.now() });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar estado ao vivo no banco', detail: err.message });
  }
};

