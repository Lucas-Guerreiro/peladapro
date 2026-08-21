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

    // Se o banco não tiver registros para este grupo, auto-popula com times das peladas do grupo ou nomes padrão
    if (rows.length === 0 && targetGroupId) {
      try {
        const existingTimes = await db.query(`
          SELECT DISTINCT TRIM(t.nome) as nome, COALESCE(t.cor, '#0284C7') as cor
          FROM times t
          JOIN peladas p ON t.pelada_id = p.id
          WHERE t.nome IS NOT NULL AND TRIM(t.nome) <> '' AND p.grupo_id = $1
        `, [targetGroupId]);

        if (existingTimes.rows.length > 0) {
          for (const t of existingTimes.rows) {
            await db.query(`
              INSERT INTO nomes_times_grupo (grupo_id, nome, cor)
              VALUES ($1, $2, $3)
              ON CONFLICT (grupo_id, nome) DO NOTHING
            `, [targetGroupId, t.nome, t.cor]);
          }
        } else {
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

    // 1. Grava no catálogo permanente do grupo (nomes_times_grupo)
    const { rows } = await db.query(
      `INSERT INTO nomes_times_grupo (grupo_id, nome, cor)
       VALUES ($1, $2, $3)
       ON CONFLICT (grupo_id, nome) DO UPDATE SET cor = EXCLUDED.cor
       RETURNING id, grupo_id, nome, cor`,
      [targetGroupId, nomeClean, corClean]
    );

    const savedCatalogItem = rows[0];

    // 2. Replicar/sincronizar também nas tabelas times de todas as peladas do grupo
    try {
      const peladasRes = await db.query('SELECT id FROM peladas WHERE grupo_id = $1', [targetGroupId]);
      for (const p of peladasRes.rows) {
        const timeExists = await db.query(
          'SELECT id FROM times WHERE pelada_id = $1 AND LOWER(TRIM(nome)) = LOWER(TRIM($2))',
          [p.id, nomeClean]
        );
        if (timeExists.rows.length === 0) {
          await db.query(
            'INSERT INTO times (pelada_id, nome, cor) VALUES ($1, $2, $3)',
            [p.id, nomeClean, corClean]
          );
        }
      }
    } catch(syncErr) {
      console.warn('[timesCatalogController.cadastrar] Aviso ao sincronizar com tabela times:', syncErr.message);
    }

    res.status(201).json(savedCatalogItem);
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

    const updatedItem = rows[0];

    // Atualiza também nas tabelas times vinculadas ao grupo
    if (updatedItem.grupo_id && updatedItem.nome) {
      try {
        await db.query(`
          UPDATE times 
          SET cor = COALESCE($1, cor)
          WHERE pelada_id IN (SELECT id FROM peladas WHERE grupo_id = $2)
            AND LOWER(TRIM(nome)) = LOWER(TRIM($3))
        `, [updatedItem.cor, updatedItem.grupo_id, updatedItem.nome]);
      } catch(e) {}
    }

    res.json(updatedItem);
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

    const itemRes = await db.query('SELECT nome, grupo_id FROM nomes_times_grupo WHERE id = $1', [id]);
    const item = itemRes.rows[0];

    const { rowCount } = await db.query('DELETE FROM nomes_times_grupo WHERE id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Time não encontrado para exclusão' });
    }

    // Opcional: remove da tabela times se não houver partidas vinculadas
    if (item && item.grupo_id && item.nome) {
      try {
        await db.query(`
          DELETE FROM times 
          WHERE pelada_id IN (SELECT id FROM peladas WHERE grupo_id = $1)
            AND LOWER(TRIM(nome)) = LOWER(TRIM($2))
            AND id NOT IN (SELECT time_1_id FROM partidas WHERE time_1_id IS NOT NULL UNION SELECT time_2_id FROM partidas WHERE time_2_id IS NOT NULL)
        `, [item.grupo_id, item.nome]);
      } catch(e) {}
    }

    res.json({ message: 'Time removido com sucesso do banco de dados' });
  } catch (err) {
    console.error('[timesCatalogController.excluir] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao excluir time do banco de dados', detail: err.message });
  }
};
