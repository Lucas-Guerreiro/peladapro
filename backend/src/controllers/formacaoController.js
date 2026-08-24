const db = require('../config/database');
const { sortearTimes } = require('../services/sorteador');

exports.sortear = async (req, res) => {
  const { peladaId } = req.params;

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Obter configs da pelada e do grupo
    const queryConfig = `
      SELECT p.grupo_id, c.qtd_times, c.jogadores_por_time
      FROM peladas p
      JOIN configs c ON p.grupo_id = c.grupo_id
      WHERE p.id = $1`;
    const configRes = await client.query(queryConfig, [peladaId]);

    if (configRes.rows.length === 0) {
      return res.status(404).json({ error: 'Configuração da pelada não encontrada' });
    }

    const { grupo_id, qtd_times, jogadores_por_time } = configRes.rows[0];

    // Buscar emblemas customizados do grupo no banco de dados
    const emblemasGrupoRes = await client.query(
      'SELECT id, imagem_url FROM emblemas_grupo WHERE grupo_id = $1 ORDER BY id ASC',
      [grupo_id]
    );
    const emblemasGrupo = emblemasGrupoRes.rows;

    // 2. Buscar todos os jogadores confirmados na pelada
    const queryConfirmados = `
      SELECT u.id, u.nome, u.apelido, u.goleiro, u.autoavaliacao, u.avaliacao_media, u.foto
      FROM convocacoes c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.pelada_id = $1 AND c.status = 'confirmado'`;
    const confirmadosRes = await client.query(queryConfirmados, [peladaId]);

    if (confirmadosRes.rows.length === 0) {
      return res.status(400).json({ error: 'Nenhum jogador confirmado para realizar o sorteio' });
    }

    // 3. Executar o sorteador inteligente (Snake Draft)
    const timesSorteados = sortearTimes(
      confirmadosRes.rows, 
      qtd_times || 2, 
      jogadores_por_time || 7
    );

    // 4. Limpar times antigos criados para esta pelada
    await client.query('DELETE FROM times WHERE pelada_id = $1', [peladaId]);

    // 5. Salvar os novos times e jogadores no banco
    for (let i = 0; i < timesSorteados.length; i++) {
      let time = timesSorteados[i];
      const cor = time.nome.includes('Azul') ? '#2196F3' : 
                  time.nome.includes('Amarelo') ? '#FFC107' : 
                  time.nome.includes('Verde') ? '#00C853' : 
                  time.nome.includes('Preto') ? '#1A1A2E' : '#FF6D00';
      const emblema = i % 10;
      const emblemaUrl = (emblemasGrupo && emblemasGrupo.length > 0)
        ? emblemasGrupo[i % emblemasGrupo.length].imagem_url
        : null;

      const queryInsertTime = `
        INSERT INTO times (pelada_id, nome, cor, emblema, emblema_url)
        VALUES ($1, $2, $3, $4, $5) RETURNING id`;
      
      const timeRes = await client.query(queryInsertTime, [peladaId, time.nome, cor, emblema, emblemaUrl]);
      const timeId = timeRes.rows[0].id;
      time.db_id = timeId;
      time.emblema = emblema;
      if (emblemaUrl) time.emblema_url = emblemaUrl;

      for (let jogador of time.jogadores) {
        const queryInsertJogador = `
          INSERT INTO times_jogadores (time_id, usuario_id)
          VALUES ($1, $2)`;
        await client.query(queryInsertJogador, [timeId, jogador.id]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Sorteio realizado e salvo com sucesso!', times: timesSorteados });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro ao executar sorteio', detail: err.message });
  } finally {
    if (client) client.release();
  }
};

exports.obterTimesSorteados = async (req, res) => {
  const { peladaId } = req.params;
  try {
    // Buscar os times da pelada
    const { rows: times } = await db.query('SELECT * FROM times WHERE pelada_id = $1', [peladaId]);

    const result = [];
    for (let time of times) {
      // Buscar os jogadores de cada time
      const queryJogadores = `
        SELECT u.id, u.nome, u.apelido, u.goleiro, u.autoavaliacao, u.avaliacao_media, u.foto
        FROM times_jogadores tj
        JOIN usuarios u ON tj.usuario_id = u.id
        WHERE tj.time_id = $1`;
      const { rows: jogadores } = await db.query(queryJogadores, [time.id]);

      result.push({
        id: time.id,
        nome: time.nome,
        cor: time.cor,
        emblema: time.emblema !== undefined && time.emblema !== null ? time.emblema : 0,
        emblema_url: time.emblema_url || null,
        vitorias: time.vitorias,
        empates: time.empates,
        gols_pro: time.gols_pro,
        gols_contra: time.gols_contra,
        jogos: time.jogos,
        jogadores
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar times sorteados', detail: err.message });
  }
};

// Atualizar emblema de um time manualmente (número do sistema ou URL/Base64 de imagem customizada)
exports.atualizarEmblema = async (req, res) => {
  const { timeId } = req.params;
  const { emblema, emblemaUrl } = req.body;

  try {
    let query = '';
    let params = [];

    if (emblemaUrl !== undefined) {
      query = 'UPDATE times SET emblema_url = $1 WHERE id = $2 RETURNING id, nome, emblema, emblema_url';
      params = [emblemaUrl, parseInt(timeId)];
    } else if (emblema !== undefined && emblema !== null) {
      query = 'UPDATE times SET emblema = $1, emblema_url = NULL WHERE id = $2 RETURNING id, nome, emblema, emblema_url';
      params = [parseInt(emblema), parseInt(timeId)];
    } else {
      return res.status(400).json({ error: 'Forneça emblema (índice 0-9) ou emblemaUrl' });
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time não encontrado' });
    }

    res.json({ message: 'Emblema atualizado com sucesso', time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar emblema', detail: err.message });
  }
};

// --- BIBLIOTECA DE EMBLEMAS DO GRUPO ---

exports.listarEmblemasGrupo = async (req, res) => {
  const { grupoId } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT id, grupo_id, nome, imagem_url, criado_em FROM emblemas_grupo WHERE grupo_id = $1 ORDER BY id ASC',
      [parseInt(grupoId)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar emblemas do grupo', detail: err.message });
  }
};

exports.adicionarEmblemaGrupo = async (req, res) => {
  const { grupoId } = req.params;
  const { nome, imagemUrl } = req.body;

  if (!imagemUrl) {
    return res.status(400).json({ error: 'imagemUrl é obrigatório' });
  }

  try {
    const { rows } = await db.query(
      'INSERT INTO emblemas_grupo (grupo_id, nome, imagem_url) VALUES ($1, $2, $3) RETURNING *',
      [parseInt(grupoId), nome || 'Emblema Customizado', imagemUrl]
    );
    res.status(201).json({ message: 'Emblema salvo na galeria com sucesso', emblema: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar emblema no grupo', detail: err.message });
  }
};

exports.deletarEmblemaGrupo = async (req, res) => {
  const { emblemaId } = req.params;
  try {
    const result = await db.query('DELETE FROM emblemas_grupo WHERE id = $1 RETURNING id', [parseInt(emblemaId)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Emblema não encontrado' });
    }
    res.json({ message: 'Emblema removido com sucesso' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover emblema do grupo', detail: err.message });
  }
};

