const db = require('../config/database');

exports.criarPartida = async (req, res) => {
  const { pelada_id, time_a_nome, time_b_nome, gols_time_a, gols_time_b, autores_gols } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem lançar resultados de partidas.' });
  }

  if (!pelada_id || !time_a_nome || !time_b_nome) {
    return res.status(400).json({ error: 'Pelada e nomes dos times são obrigatórios.' });
  }

  try {
    await db.query('ALTER TABLE partidas ADD COLUMN IF NOT EXISTS autores_gols TEXT').catch(() => {});

    const query = `
      INSERT INTO partidas (pelada_id, time_a_nome, time_b_nome, gols_time_a, gols_time_b, autores_gols, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'finalizada')
      RETURNING id, pelada_id, time_a_nome, time_b_nome, gols_time_a, gols_time_b, autores_gols, status, created_at`;
    
    const { rows } = await db.query(query, [
      pelada_id,
      time_a_nome,
      time_b_nome,
      parseInt(gols_time_a) || 0,
      parseInt(gols_time_b) || 0,
      autores_gols ? String(autores_gols) : null
    ]);

    // Incrementar gols e partidas disputadas para autores e assistentes envolvidos
    if (autores_gols) {
      try {
        const goalsList = typeof autores_gols === 'string' ? JSON.parse(autores_gols) : autores_gols;
        for (let g of (goalsList || [])) {
          if (g.autorId) {
            await db.query("UPDATE usuarios SET gols = COALESCE(gols, 0) + 1 WHERE id = $1", [g.autorId]).catch(() => {});
          } else if (g.autorNome) {
            await db.query("UPDATE usuarios SET gols = COALESCE(gols, 0) + 1 WHERE LOWER(nome) = $1 OR LOWER(apelido) = $1", [g.autorNome.trim().toLowerCase()]).catch(() => {});
          }
        }
      } catch(e) {}
    }

    res.status(201).json({ message: 'Partida salva com sucesso!', partida: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar partida no banco.', detail: err.message });
  }
};

exports.listarPartidas = async (req, res) => {
  const { peladaId } = req.params;
  try {
    await db.query('ALTER TABLE partidas ADD COLUMN IF NOT EXISTS autores_gols TEXT').catch(() => {});

    const query = `
      SELECT id, pelada_id, time_a_nome, time_b_nome, gols_time_a, gols_time_b, autores_gols, status, created_at
      FROM partidas
      WHERE pelada_id = $1
      ORDER BY created_at ASC`;
    const { rows } = await db.query(query, [peladaId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar partidas da pelada.', detail: err.message });
  }
};

exports.editarPartida = async (req, res) => {
  const { id } = req.params;
  const { gols_time_a, gols_time_b, time_a_nome, time_b_nome, autores_gols } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem editar partidas.' });
  }

  try {
    const query = `
      UPDATE partidas 
      SET gols_time_a = $1, 
          gols_time_b = $2, 
          time_a_nome = COALESCE($3, time_a_nome), 
          time_b_nome = COALESCE($4, time_b_nome),
          autores_gols = COALESCE($5, autores_gols)
      WHERE id = $6 RETURNING id, pelada_id, time_a_nome, time_b_nome, gols_time_a, gols_time_b, autores_gols`;
    const { rows } = await db.query(query, [
      parseInt(gols_time_a) || 0,
      parseInt(gols_time_b) || 0,
      time_a_nome || null,
      time_b_nome || null,
      autores_gols !== undefined ? (typeof autores_gols === 'string' ? autores_gols : JSON.stringify(autores_gols)) : null,
      id
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Partida não encontrada.' });
    }

    res.json({ message: 'Partida atualizada com sucesso!', partida: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao editar partida.', detail: err.message });
  }
};

exports.deletarPartida = async (req, res) => {
  const { id } = req.params;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem deletar partidas.' });
  }

  try {
    const { rows } = await db.query('DELETE FROM partidas WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Partida não encontrada.' });
    }
    res.json({ message: 'Partida deletada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar partida.', detail: err.message });
  }
};

exports.deletarTodasPartidasDaPelada = async (req, res) => {
  const { peladaId } = req.params;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem deletar partidas da pelada.' });
  }

  try {
    await db.query('DELETE FROM gols WHERE pelada_id = $1', [peladaId]).catch(() => {});
    await db.query('DELETE FROM partidas WHERE pelada_id = $1', [peladaId]);
    res.json({ message: 'Todas as partidas e gols da pelada foram zerados com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao zerar partidas da pelada.', detail: err.message });
  }
};

exports.deletarPartidasPorIds = async (req, res) => {
  const { ids } = req.body;
  const gestorTipo = req.usuarioTipo;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem deletar partidas.' });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.json({ message: 'Nenhuma partida informada para remoção.' });
  }

  try {
    await db.query('DELETE FROM gols WHERE partida_id = ANY($1::int[])', [ids]).catch(() => {});
    await db.query('DELETE FROM partidas WHERE id = ANY($1::int[])', [ids]);
    res.json({ message: `${ids.length} partidas excedentes foram removidas com sucesso!` });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar partidas excedentes.', detail: err.message });
  }
};
