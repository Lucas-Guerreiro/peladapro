const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.xgsdaavryzhqxkwsonkk:L7s71204110411%40supabase@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('🐘 Conectado ao banco de dados PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool do PostgreSQL:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
