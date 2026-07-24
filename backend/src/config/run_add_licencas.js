const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  console.log('🔗 Conectando ao banco de dados Supabase...');
  const client = await pool.connect();
  try {
    console.log('⚡ Lendo o arquivo add_licencas.sql...');
    const sqlPath = path.join(__dirname, 'add_licencas.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('⚡ Executando comandos SQL...');
    await client.query(sql);
    console.log('✅ Migracao de licencas concluida com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao rodar migracao de licencas:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
