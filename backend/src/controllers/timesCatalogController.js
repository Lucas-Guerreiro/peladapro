const db = require('../config/database');

// Garante a existência da tabela nomes_times_grupo no PostgreSQL
async function ensureTableExists() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS nomes_times_grupo (
          id SERIAL PRIMARY KEY,
          grupo_id INT REFERENCES grupos(id) ON DELETE CASCADE,
          nome VARCHAR(100) NOT NULL,
          cor VARCHAR(10) DEFAULT '#0284C7',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_grupo_nome UNIQUE(grupo_id, nome)
      );
    `);
  } catch(e) {
    console.error('[ensureTableExists] Erro ao verificar/criar tabela nomes_times_grupo:', e.message);
  }
}

// GET /api/times-catalogo/grupo/:groupId
exports.getCatalogo = async (req, res) => {
  let { groupId } = req.params;
  try {
    await ensureTableExists();

    if (!groupId || groupId === 'null' || groupId === 'undefined' || groupId === '0') {
      const gRes = await db.query('SELECT id FROM grupos ORDER BY id ASC LIMIT 1');
      if (gRes.rows.length > 0) groupId = gRes.rows[0].id;
    }

    const targetGroupId = groupId ? parseInt(groupId) : null;

    let { rows } = await db.query(
      'SELECT id, grupo_id, nome, cor, created_at FROM nomes_times_grupo WHERE grupo_id = $1 OR $1 IS NULL ORDER BY id ASC',
      [targetGroupId]
    );

    // Se o banco não tiver registros para este grupo, auto-popula com times padrão
    if (rows.length === 0 && targetGroupId) {
      try {
        const defaultNames = [
          { nome: 'Time A', cor: '#2196F3' },
          { nome: 'Time B', cor: '#FFC107' },
          { nome: 'Time C', cor: '#FF1744' },
          { nome: 'Time D', cor: '#00C853' }
        ];
        for (const d of defaultNames) {
          await db.query(`
            INSERT INTO nomes_times_grupo (grupo_id, nome, cor)
            VALUES ($1, $2, $3)
            ON CONFLICT (grupo_id, nome) DO NOTHING
          `, [targetGroupId, d.nome, d.cor]);
        }

        const reFetch = await db.query(
          'SELECT id, grupo_id, nome, cor, created_at FROM nomes_times_grupo WHERE grupo_id = $1 ORDER BY id ASC',
          [targetGroupId]
        );
        rows = reFetch.rows;
      } catch(popErr) {
        console.error('[getCatalogo] Erro ao auto-popular times:', popErr.message);
      }
    }

    res.json(rows);
  } catch (err) {
    console.error('[timesCatalogController.getCatalogo] Erro grave:', err.message);
    res.json([]);
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
    await ensureTableExists();

    if (!groupId || groupId === 'null' || groupId === 'undefined' || groupId === '0') {
      const gRes = await db.query('SELECT id FROM grupos ORDER BY id ASC LIMIT 1');
      if (gRes.rows.length > 0) groupId = gRes.rows[0].id;
    }

    const targetGroupId = groupId ? parseInt(groupId) : 7;
    const nomeClean = nome.trim();
    const corClean = (cor && cor.trim()) || '#0284C7';

    // Grava SOMENTE no catálogo de nomes do grupo (nomes_times_grupo), sem poluir a tabela times das peladas
    const { rows } = await db.query(
      `INSERT INTO nomes_times_grupo (grupo_id, nome, cor)
       VALUES ($1, $2, $3)
       ON CONFLICT (grupo_id, nome) DO UPDATE SET cor = EXCLUDED.cor
       RETURNING id, grupo_id, nome, cor`,
      [targetGroupId, nomeClean, corClean]
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
    await ensureTableExists();

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
    await ensureTableExists();

    const { rowCount } = await db.query('DELETE FROM nomes_times_grupo WHERE id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Time não encontrado para exclusão' });
    }

    res.json({ message: 'Time removido com sucesso do catálogo de nomes' });
  } catch (err) {
    console.error('[timesCatalogController.excluir] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao excluir time do banco de dados', detail: err.message });
  }
};
