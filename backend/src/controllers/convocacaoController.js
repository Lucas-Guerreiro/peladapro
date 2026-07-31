const db = require('../config/database');
const { verificarRegra2Horas } = require('../services/convocacaoService');

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

    // 1. Obter informações da pelada, custos e limites
    // Usa COALESCE: valor_convocacao da pelada (override) > config do grupo > 20.00
    const queryConfig = `
      SELECT p.grupo_id,
             COALESCE(p.valor_convocacao, c.valor_convocacao, 20.00) as custo,
             c.limite_saldo_negativo
      FROM peladas p
      LEFT JOIN configs c ON p.grupo_id = c.grupo_id
      WHERE p.id = $1`;
    const configRes = await client.query(queryConfig, [pelada_id]);

    if (configRes.rows.length === 0) {
      throw new Error('Configuração do grupo/pelada não encontrada');
    }

    const { grupo_id, custo, limite_saldo_negativo } = configRes.rows[0];
    const valorCusto = parseFloat(custo || 0);
    const limiteNegativo = parseFloat(limite_saldo_negativo || 0);

    // 2. Buscar informações do usuário
    const userRes = await client.query('SELECT saldo FROM usuarios WHERE id = $1', [usuario_id]);
    if (userRes.rows.length === 0) {
      throw new Error('Usuário não encontrado');
    }
    const saldoAtual = parseFloat(userRes.rows[0].saldo || 0);

    // 3. Se for pagamento por saldo, validar limite negativo
    if (forma_pagamento === 'saldo') {
      const novoSaldo = saldoAtual - valorCusto;
      if (novoSaldo < -limiteNegativo) {
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
        [usuario_id, grupo_id, valorCusto, `Confirmação de presença via Saldo na Pelada #${pelada_id}`]
      );
    }

    // 4. Inserir ou atualizar convocação
    const queryConv = `
      INSERT INTO convocacoes (pelada_id, usuario_id, status, forma_pagamento, data_convocacao)
      VALUES ($1, $2, 'confirmado', $3, NOW())
      ON CONFLICT (pelada_id, usuario_id) 
      DO UPDATE SET status = 'confirmado', forma_pagamento = $3, data_convocacao = NOW()`;
    await client.query(queryConv, [pelada_id, usuario_id, forma_pagamento]);

    await client.query('COMMIT');
    res.json({ message: 'Presença confirmada!', custo: valorCusto });
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

    res.status(201).json({ message: 'Jogador adicionado à presença com sucesso!', usuario_id: finalUsuarioId });
  } catch (err) {
    console.error('[adicionarPorGestor]', err);
    res.status(500).json({ error: 'Erro ao adicionar jogador à pelada.', detail: err.message });
  }
};
