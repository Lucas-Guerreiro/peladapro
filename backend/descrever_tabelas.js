const { Pool } = require('pg');
const db = require('./src/config/database');

async function run() {
  console.log('--- Colunas da tabela convocacoes ---');
  try {
    const { rows } = await db.pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'convocacoes'`);
    console.log(rows);
  } catch (err) {
    console.error(err.message);
  }

  console.log('--- Colunas da tabela partidas ---');
  try {
    const { rows } = await db.pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'partidas'`);
    console.log(rows);
  } catch (err) {
    console.error(err.message);
  }

  console.log('--- Colunas da tabela peladas ---');
  try {
    const { rows } = await db.pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'peladas'`);
    console.log(rows);
  } catch (err) {
    console.error(err.message);
  }

  process.exit(0);
}

run();
