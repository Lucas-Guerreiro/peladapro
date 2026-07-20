const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  console.log('🔗 Conectando ao Supabase...');
  const client = await pool.connect();
  try {
    console.log('⚡ Executando migration para adicionar colunas de verificação de e-mail...');
    
    const query = `
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS verificado BOOLEAN DEFAULT false;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_verificacao VARCHAR(6);
    `;
    
    await client.query(query);
    console.log('✅ Migration executada com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao rodar migration:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
