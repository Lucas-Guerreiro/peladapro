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

    const { qtd_times, jogadores_por_time } = configRes.rows[0];

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
      const queryInsertTime = `
        INSERT INTO times (pelada_id, nome, cor, emblema)
        VALUES ($1, $2, $3, $4) RETURNING id`;
      const cor = time.nome.includes('Azul') ? '#2196F3' : 
                  time.nome.includes('Amarelo') ? '#FFC107' : 
                  time.nome.includes('Verde') ? '#00C853' : 
                  time.nome.includes('Preto') ? '#1A1A2E' : '#FF6D00';
      const emblema = i % 10; // índice fixo por ordem de sorteio
      
      const timeRes = await client.query(queryInsertTime, [peladaId, time.nome, cor, emblema]);
      const timeId = timeRes.rows[0].id;
      time.db_id = timeId;
      time.emblema = emblema;

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

// Atualizar emblema de um time manualmente
exports.atualizarEmblema = async (req, res) => {
  const { timeId } = req.params;
  const { emblema } = req.body;

  if (emblema === undefined || emblema === null || isNaN(parseInt(emblema))) {
    return res.status(400).json({ error: 'Campo emblema (número 0-9) é obrigatório' });
  }

  try {
    const result = await db.query(
      'UPDATE times SET emblema = $1 WHERE id = $2 RETURNING id, nome, emblema',
      [parseInt(emblema), parseInt(timeId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time não encontrado' });
    }

    res.json({ message: 'Emblema atualizado com sucesso', time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar emblema', detail: err.message });
  }
};
