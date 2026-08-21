const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function verify() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, grupo_id, nome, cor FROM nomes_times_grupo ORDER BY id ASC');
    console.log(`\n✅ Registros na tabela nomes_times_grupo: ${res.rows.length}\n`);
    res.rows.forEach(r => console.log(`  [ID:${r.id}] grupo_id=${r.grupo_id} | nome="${r.nome}" | cor=${r.cor}`));
  } finally {
    client.release();
    pool.end();
  }
}

verify();
