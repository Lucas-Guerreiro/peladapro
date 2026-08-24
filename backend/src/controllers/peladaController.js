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
  const { grupo_id, data, horario, local, max_jogadores, valor_convocacao, chave_pix, chave_pix_nome, modo, turno_torneio } = req.body;

  if (!grupo_id || !data || !horario || !local) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes (grupo, data, horário, local)' });
  }

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    await client.query("ALTER TABLE peladas ADD COLUMN IF NOT EXISTS modo VARCHAR(50) DEFAULT 'normal'");
    await client.query("ALTER TABLE peladas ALTER COLUMN modo TYPE VARCHAR(50)");
    await client.query("ALTER TABLE peladas ADD COLUMN IF NOT EXISTS turno_torneio VARCHAR(20) DEFAULT 'ida'");

    // 1. Inserir a partida na tabela 'peladas'
    const queryPelada = `
      INSERT INTO peladas (grupo_id, data, horario, status, local, max_jogadores, limite_atletas, valor_convocacao, chave_pix, chave_pix_nome, modo, turno_torneio)
      VALUES ($1, $2, $3, 'agendada', $4, $5, $5, $6, $7, $8, $9, $10) RETURNING id, data, horario, local, chave_pix, chave_pix_nome, modo, turno_torneio`;
    const peladaRes = await client.query(queryPelada, [grupo_id, data, horario, local, max_jogadores || 20, valor_convocacao || 20.00, chave_pix || null, chave_pix_nome || null, modo || 'normal', turno_torneio || 'ida']);
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

    // 4. Envia notificação push para todos avisando que a convocação está aberta
    try {
      const { sendNotificationInternal } = require('./pushController');
      const dataFmt = data.split('-').reverse().join('/');
      sendNotificationInternal({
        title: '📋 Convocação Aberta!',
        body: `A pelada do dia ${dataFmt} às ${horario} no ${local} está com convocações abertas! Confirme sua presença no app.`,
        url: '/#/jogador/convocacao'
      }).catch(e => console.warn('[Push] Erro ao disparar push de agendamento:', e.message));
    } catch (e) { }

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
    // Garante que a coluna modo e turno_torneio existem na tabela peladas (idempotente)
    await db.query("ALTER TABLE peladas ADD COLUMN IF NOT EXISTS modo VARCHAR(20) DEFAULT 'normal'");
    await db.query("ALTER TABLE peladas ADD COLUMN IF NOT EXISTS turno_torneio VARCHAR(20) DEFAULT 'ida'");

    // Valida se o gestor é dono do grupo apenas se for gestor
    if (tipo === 'gestor') {
      const queryGrupo = `SELECT id FROM grupos WHERE id = $1 AND gestor_id = $2`;
      const grupoRes = await db.query(queryGrupo, [grupoId, gestor_id]);
      if (grupoRes.rows.length === 0) {
        return res.status(403).json({ error: 'Acesso negado a este grupo.' });
      }
    }

    const query = `
      SELECT p.id, p.data, p.horario, p.status, p.local, p.max_jogadores, p.limite_atletas, p.chave_pix, p.chave_pix_nome,
             COALESCE(p.modo, 'normal') as modo,
             COALESCE(p.turno_torneio, 'ida') as turno_torneio,
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
  const { modo, turno_torneio, criterio_empate, vitorias_para_sair, jogadores_por_time, quantidade_times, regra_saida, valor_convocacao, chave_pix, chave_pix_nome, limite_atletas } = req.body;

  if (tipo !== 'gestor' && tipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem alterar configurações da partida.' });
  }

  try {
    await db.query("ALTER TABLE peladas ADD COLUMN IF NOT EXISTS modo VARCHAR(50) DEFAULT 'normal'");
    await db.query("ALTER TABLE peladas ALTER COLUMN modo TYPE VARCHAR(50)");
    await db.query("ALTER TABLE peladas ADD COLUMN IF NOT EXISTS turno_torneio VARCHAR(20) DEFAULT 'ida'");

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
      SET modo = COALESCE($1, modo, 'normal'),
          turno_torneio = COALESCE($2, turno_torneio, 'ida'),
          criterio_empate = COALESCE($3, criterio_empate),
          vitorias_para_sair = COALESCE($4, vitorias_para_sair),
          jogadores_por_time = COALESCE($5, jogadores_por_time),
          quantidade_times = COALESCE($6, quantidade_times),
          regra_saida = COALESCE($7, regra_saida),
          valor_convocacao = COALESCE($8, valor_convocacao),
          chave_pix = COALESCE($9, chave_pix),
          chave_pix_nome = COALESCE($10, chave_pix_nome),
          limite_atletas = COALESCE($11, limite_atletas),
          max_jogadores = COALESCE($11, max_jogadores)
      WHERE id = $12 RETURNING id, modo, turno_torneio`;
    await db.query(queryUpdate, [
      modo || null,
      turno_torneio || null,
      criterio_empate || null,
      (vitorias_para_sair !== undefined && vitorias_para_sair !== null) ? parseInt(vitorias_para_sair) : null,
      (jogadores_por_time !== undefined && jogadores_por_time !== null) ? parseInt(jogadores_por_time) : null,
      (quantidade_times !== undefined && quantidade_times !== null) ? parseInt(quantidade_times) : null,
      regra_saida || null,
      (valor_convocacao !== undefined && valor_convocacao !== null) ? parseFloat(valor_convocacao) : null,
      chave_pix !== undefined ? chave_pix : null,
      chave_pix_nome !== undefined ? chave_pix_nome : null,
      (limite_atletas !== undefined && limite_atletas !== null) ? parseInt(limite_atletas) : null,
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
      } catch (e) { }
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
  const { liveMatch, waitingQueue, teams, isReset } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID da pelada é obrigatório' });
  }

  try {
    // Se for solicitação de reset, zera completamente o live_state da pelada no banco
    if (isReset) {
      await db.query('UPDATE peladas SET live_state = NULL WHERE id = $1', [id]);
      return res.json({ message: 'Estado ao vivo zerado com sucesso no servidor.' });
    }

    // 1. Busca estado anterior do banco de dados
    const selectRes = await db.query('SELECT live_state FROM peladas WHERE id = $1', [id]);
    let existing = {};
    if (selectRes.rows.length > 0 && selectRes.rows[0].live_state) {
      try { existing = JSON.parse(selectRes.rows[0].live_state) || {}; } catch (e) { }
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

    // ===== Persistência relacional: tabelas times e times_jogadores =====
    // Melhor esforço usando apenas db.query (o wrapper do projeto não expõe db.connect).
    // Fluxo idempotente: a próxima sincronização apaga e recria — falha parcial se autocorrige.
    // Nunca derruba o live_state (erro só é logado).
    try {
      if (Array.isArray(currentTeams) && currentTeams.length > 0) {
        // Garantia de unicidade de nomes de times para a pelada
        const seenTeamNames = new Set();
        const uniqueCurrentTeams = [];

        for (let i = 0; i < currentTeams.length; i++) {
          const t = currentTeams[i];
          let baseName = (t.nome || t.name || `Time ${String.fromCharCode(65 + i)}`).trim();
          let name = baseName;
          let counter = 2;
          while (seenTeamNames.has(name.toLowerCase())) {
            name = `${baseName} ${counter}`;
            counter++;
          }
          seenTeamNames.add(name.toLowerCase());
          t.nome = name;
          t.name = name;
          uniqueCurrentTeams.push(t);
        }

        // 1. Remove registros anteriores da pelada (evita duplicação)
        await db.query(
          'DELETE FROM times_jogadores WHERE time_id IN (SELECT id FROM times WHERE pelada_id = $1)',
          [id]
        );
        await db.query('DELETE FROM times WHERE pelada_id = $1', [id]);

        // 2. Insere cada time único e seus jogadores
        for (const [i, t] of uniqueCurrentTeams.entries()) {
          const timeRes = await db.query(
            `INSERT INTO times (pelada_id, nome, cor, emblema, emblema_url, vitorias, empates, gols_pro, gols_contra, jogos)
             VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, 0)
             ON CONFLICT (pelada_id, LOWER(TRIM(nome))) DO UPDATE SET 
               cor = EXCLUDED.cor, 
               emblema = EXCLUDED.emblema, 
               emblema_url = EXCLUDED.emblema_url
             RETURNING id`,
            [id, t.nome, t.cor || null, t.emblema ?? null, t.emblema_url || null]
          );
          const timeId = timeRes.rows[0].id;

          for (const p of (t.players || [])) {
            if (p.id == null) continue;
            await db.query(
              'INSERT INTO times_jogadores (time_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [timeId, p.id]
            );
          }
        }
      }
    } catch (persistErr) {
      console.error('[atualizarLiveState] Erro ao persistir times nas tabelas (não bloqueia o live_state):', persistErr.message);
    }

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
        } catch (e) { }
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

exports.listarTransacoesDoGrupo = async (req, res) => {
  const { grupoId } = req.params;
  if (!grupoId) {
    return res.status(400).json({ error: 'grupoId é obrigatório' });
  }

  try {
    const { rows } = await db.query(
      `SELECT t.*, u.nome as usuario_nome, u.apelido as usuario_apelido
       FROM transacoes t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.grupo_id = $1
       ORDER BY t.data DESC, t.id DESC`,
      [grupoId]
    );

    res.json(rows);
  } catch (err) {
    console.error('[listarTransacoesDoGrupo]', err);
    res.status(500).json({ error: 'Erro ao listar transações do grupo.', detail: err.message });
  }
};

exports.criarTransacaoManual = async (req, res) => {
  const { grupoId } = req.params;
  const { valor, tipo, descricao } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
  }

  if (!grupoId || !valor || !tipo || !descricao) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios (grupoId, valor, tipo, descricao).' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao, data)
       VALUES (NULL, $1, $2, $3, $4, NOW())
       RETURNING *`,
      [grupoId, parseFloat(valor), tipo, descricao]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[criarTransacaoManual]', err);
    res.status(500).json({ error: 'Erro ao criar transação manual no banco.', detail: err.message });
  }
};

exports.editarTransacaoManual = async (req, res) => {
  const { id } = req.params;
  const { valor, tipo, descricao } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
  }

  if (!id || valor === undefined || !tipo || !descricao) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios (id, valor, tipo, descricao).' });
  }

  try {
    const { rows } = await db.query(
      `UPDATE transacoes
       SET valor = $1, tipo = $2, descricao = $3
       WHERE id = $4
       RETURNING *`,
      [parseFloat(valor), tipo, descricao, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    res.json({ message: 'Transação atualizada com sucesso!', transacao: rows[0] });
  } catch (err) {
    console.error('[editarTransacaoManual]', err);
    res.status(500).json({ error: 'Erro ao editar transação no banco.', detail: err.message });
  }
};

exports.deletarTransacaoManual = async (req, res) => {
  const { id } = req.params;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
  }

  if (!id) {
    return res.status(400).json({ error: 'ID da transação é obrigatório.' });
  }

  try {
    const { rows } = await db.query('DELETE FROM transacoes WHERE id = $1 RETURNING *', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }
    res.json({ message: 'Transação apagada com sucesso!', id });
  } catch (err) {
    console.error('[deletarTransacaoManual]', err);
    res.status(500).json({ error: 'Erro ao deletar transação no banco.', detail: err.message });
  }
};

exports.ajustarSaldoAtleta = async (req, res) => {
  const { atletaId } = req.params;
  const { grupoId, valor, descricao } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Acesso restrito ao gestor.' });
  }

  if (!atletaId || !grupoId || valor === undefined || isNaN(parseFloat(valor))) {
    return res.status(400).json({ error: 'Atleta, grupo e valor do ajuste são obrigatórios.' });
  }

  const amt = parseFloat(valor);
  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Obter saldo atual do atleta
    const userRes = await client.query('SELECT saldo, nome, apelido FROM usuarios WHERE id = $1', [atletaId]);
    if (userRes.rows.length === 0) {
      throw new Error('Atleta não encontrado.');
    }
    const currentSaldo = parseFloat(userRes.rows[0].saldo || 0);
    const atletaNome = userRes.rows[0].apelido || userRes.rows[0].nome || 'Atleta';
    const novoSaldo = currentSaldo + amt;

    // 2. Atualizar saldo do atleta
    await client.query('UPDATE usuarios SET saldo = $1 WHERE id = $2', [novoSaldo, atletaId]);

    // 3. Inserir transação de acerto no banco
    const tipoTx = amt > 0 ? 'credito' : 'debito';
    const descTx = (descricao && String(descricao).trim())
      ? String(descricao).trim()
      : `Acerto manual: ${atletaNome}`;

    await client.query(
      `INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao, data)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [atletaId, grupoId, Math.abs(amt), tipoTx, descTx]
    );

    await client.query('COMMIT');
    res.json({ message: 'Saldo ajustado com sucesso!', novoSaldo, descricao: descTx });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[ajustarSaldoAtleta]', err);
    res.status(500).json({ error: 'Erro ao ajustar saldo do atleta no banco.', detail: err.message });
  } finally {
    if (client) client.release();
  }
};


