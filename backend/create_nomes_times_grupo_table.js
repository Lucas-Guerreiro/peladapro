const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Criando tabela nomes_times_grupo no PostgreSQL...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS nomes_times_grupo (
          id SERIAL PRIMARY KEY,
          grupo_id INT REFERENCES grupos(id) ON DELETE CASCADE,
          nome VARCHAR(100) NOT NULL,
          cor VARCHAR(10) DEFAULT '#0284C7',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_grupo_nome UNIQUE(grupo_id, nome)
      );
    `);
    console.log('  ✅ Tabela nomes_times_grupo criada ou verificada com sucesso.');

    // Popula a tabela nomes_times_grupo com os nomes existentes nas peladas/grupos
    console.log('📦 Populando nomes_times_grupo com nomes de times existentes no banco...');
    
    // Busca peladas e seus grupos
    const existingTimes = await client.query(`
      SELECT DISTINCT p.grupo_id, TRIM(t.nome) as nome, COALESCE(t.cor, '#0284C7') as cor
      FROM times t
      JOIN peladas p ON t.pelada_id = p.id
      WHERE t.nome IS NOT NULL AND TRIM(t.nome) <> '' AND p.grupo_id IS NOT NULL
    `);

    console.log(`Encontrados ${existingTimes.rows.length} nomes de times vinculados a grupos.`);

    for (const row of existingTimes.rows) {
      await client.query(`
        INSERT INTO nomes_times_grupo (grupo_id, nome, cor)
        VALUES ($1, $2, $3)
        ON CONFLICT (grupo_id, nome) DO UPDATE SET cor = EXCLUDED.cor
      `, [row.grupo_id, row.nome, row.cor]);
    }

    // Garante que todo grupo existente possua os nomes padrão mínimos (Time A, Time B, Time C, Time D)
    const grupos = await client.query(`SELECT id FROM grupos`);
    const defaultNames = [
      { nome: 'Time A', cor: '#2196F3' },
      { nome: 'Time B', cor: '#FFC107' },
      { nome: 'Time C', cor: '#FF1744' },
      { nome: 'Time D', cor: '#00C853' }
    ];

    for (const g of grupos.rows) {
      for (const d of defaultNames) {
        await client.query(`
          INSERT INTO nomes_times_grupo (grupo_id, nome, cor)
          VALUES ($1, $2, $3)
          ON CONFLICT (grupo_id, nome) DO NOTHING
        `, [g.id, d.nome, d.cor]);
      }
    }

    console.log('  ✅ Nomes de times padrão e customizados populados com sucesso no banco!');
  } catch (err) {
    console.error('❌ Erro ao criar tabela nomes_times_grupo:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
