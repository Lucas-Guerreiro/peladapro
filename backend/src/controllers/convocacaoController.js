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
      return res.status(400).json({ error: 'Prazo de estorno expirado (menos de 2h para a pelada)' });
    }

    // 2. Buscar detalhes da convocação atual
    const convRes = await client.query(
      'SELECT status, forma_pagamento FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2',
      [pelada_id, usuario_id]
    );

    if (convRes.rows.length === 0 || convRes.rows[0].status !== 'confirmado') {
      return res.status(400).json({ error: 'Você não está confirmado nesta pelada' });
    }

    const { forma_pagamento } = convRes.rows[0];

    // 3. Executar lógica de reembolso se aplicável
    if (forma_pagamento === 'saldo' && opcao_remocao === 'estorno' && podeEstornar) {
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
      SET status = $1, motivo_remocao = $2, data_remocao = NOW()
      WHERE pelada_id = $3 AND usuario_id = $4`;
    await client.query(queryUpdate, [statusFinal, opcao_remocao, pelada_id, usuario_id]);

    // 4.5 Se o atleta removido era da LISTA OFICIAL, promover o 1º da fila de espera
    if (convRes.rows[0].status === 'confirmado') {
      const filaRes = await client.query(
        `SELECT * FROM convocacoes
         WHERE pelada_id = $1 AND status = 'espera'
         ORDER BY posicao_fila ASC
         LIMIT 1 FOR UPDATE`,
        [pelada_id]
      );

      if (filaRes.rows.length > 0) {
        const promovido = filaRes.rows[0];
        await client.query(
          `UPDATE convocacoes
           SET status = 'confirmado', posicao_fila = NULL
           WHERE id = $1`,
          [promovido.id]
        );

        // Reordena a fila restante (posições 1, 2, 3...)
        const restantesRes = await client.query(
          `SELECT id FROM convocacoes
           WHERE pelada_id = $1 AND status = 'espera'
           ORDER BY posicao_fila ASC`,
          [pelada_id]
        );
        for (let i = 0; i & lt; restantesRes.rows.length; i++) {
          await client.query(
            'UPDATE convocacoes SET posicao_fila = $1 WHERE id = $2',
            [i + 1, restantesRes.rows[i].id]
          );
        }

        // Notificação push ao atleta promovido
        try {
          const { sendNotificationInternal } = require('./pushController');
          sendNotificationInternal({
            usuarioId: promovido.usuario_id,
            title: 'Você entrou na lista oficial! 🎉',
            body: 'Um atleta desistiu e você foi promovido da fila de espera para a lista oficial.',
            url: '/#/jogador/convocacao'
          }).catch(e => console.warn('[Push] Erro ao notificar promovido:', e.message));
        } catch (e) { }
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Remoção processada com sucesso!', estornado: podeEstornar && opcao_remocao === 'estorno' });
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
    const query = `
      SELECT u.id, u.nome, u.apelido, u.goleiro, u.autoavaliacao, u.foto, c.status, c.forma_pagamento, c.data_convocacao, c.presenca
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
  const gestorTipo = req.usuarioTipo;
  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem desconvocar atletas.' });
  }

  const { pelada_id, usuario_id } = req.body;
  if (!pelada_id || !usuario_id) {
    return res.status(400).json({ error: 'pelada_id e usuario_id são obrigatórios.' });
  }

  try {
    // Verifica se existe a convocação
    const { rows: check } = await db.query(
      'SELECT usuario_id FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2',
      [pelada_id, usuario_id]
    );
    if (check.length === 0) {
      return res.status(404).json({ error: 'Convocação não encontrada.' });
    }

    // Remove a convocação completamente
    await db.query(
      'DELETE FROM convocacoes WHERE pelada_id = $1 AND usuario_id = $2',
      [pelada_id, usuario_id]
    );

    res.json({ message: 'Atleta desconvocado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desconvocar atleta.', detail: err.message });
  }
};

exports.adicionarPorGestor = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem adicionar atletas.' });
  }

  const { pelada_id, usuario_id, convidado } = req.body;

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
         SET status = 'confirmado', presenca = true, motivo_remocao = null, data_remocao = null 
         WHERE pelada_id = $1 AND usuario_id = $2`,
        [pelada_id, finalUsuarioId]
      );
    } else {
      // Se não existir convocação, insere uma nova confirmada e presente
      await db.query(
        `INSERT INTO convocacoes (pelada_id, usuario_id, status, presenca, forma_pagamento) 
         VALUES ($1, $2, 'confirmado', true, 'saldo')`,
        [pelada_id, finalUsuarioId]
      );
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

  if (!limite || limite & lt; 2 || limite > 100) {
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
