const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

pool.on('connect', () => {
  console.log('🐘 Conectado ao banco de dados PostgreSQL');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
