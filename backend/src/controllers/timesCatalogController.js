const db = require('../config/database');

// GET /api/times-catalogo/grupo/:groupId
exports.getCatalogo = async (req, res) => {
  let { groupId } = req.params;
  try {
    if (!groupId || groupId === 'null' || groupId === 'undefined' || groupId === '0') {
      const gRes = await db.query('SELECT id FROM grupos ORDER BY id ASC LIMIT 1');
      if (gRes.rows.length > 0) groupId = gRes.rows[0].id;
    }

    const { rows } = await db.query(
      'SELECT id, grupo_id, nome, cor, created_at FROM nomes_times_grupo WHERE grupo_id = $1 OR $1 IS NULL ORDER BY id ASC',
      [groupId || null]
    );

    res.json(rows);
  } catch (err) {
    console.error('[timesCatalogController.getCatalogo] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar catálogo de times do banco', detail: err.message });
  }
};

// POST /api/times-catalogo/grupo/:groupId
exports.cadastrar = async (req, res) => {
  let { groupId } = req.params;
  const { nome, cor } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ error: 'Nome do time é obrigatório' });
  }

  try {
    if (!groupId || groupId === 'null' || groupId === 'undefined') {
      const gRes = await db.query('SELECT id FROM grupos ORDER BY id ASC LIMIT 1');
      if (gRes.rows.length > 0) groupId = gRes.rows[0].id;
    }

    const nomeClean = nome.trim();
    const corClean = (cor && cor.trim()) || '#0284C7';

    // Insere ou atualiza no banco de dados
    const { rows } = await db.query(
      `INSERT INTO nomes_times_grupo (grupo_id, nome, cor)
       VALUES ($1, $2, $3)
       ON CONFLICT (grupo_id, nome) DO UPDATE SET cor = EXCLUDED.cor
       RETURNING id, grupo_id, nome, cor`,
      [groupId, nomeClean, corClean]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[timesCatalogController.cadastrar] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao cadastrar time no banco de dados', detail: err.message });
  }
};

// PUT /api/times-catalogo/:id
exports.atualizar = async (req, res) => {
  const { id } = req.params;
  const { nome, cor } = req.body;

  try {
    const { rows } = await db.query(
      `UPDATE nomes_times_grupo 
       SET nome = COALESCE($1, nome), cor = COALESCE($2, cor) 
       WHERE id = $3 
       RETURNING id, grupo_id, nome, cor`,
      [nome ? nome.trim() : null, cor ? cor.trim() : null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Time não encontrado no banco de dados' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[timesCatalogController.atualizar] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar time no banco de dados', detail: err.message });
  }
};

// DELETE /api/times-catalogo/:id
exports.excluir = async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await db.query('DELETE FROM nomes_times_grupo WHERE id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Time não encontrado para exclusão' });
    }

    res.json({ message: 'Time removido com sucesso do banco de dados' });
  } catch (err) {
    console.error('[timesCatalogController.excluir] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao excluir time do banco de dados', detail: err.message });
  }
};
