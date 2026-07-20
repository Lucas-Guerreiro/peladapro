const { Client } = require('pg');
require('dotenv').config();

console.log('🧹 Limpando TODAS as tabelas do banco de dados para recriação limpa...');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const run = async () => {
  try {
    await client.connect();
    
    // Comando para deletar as tabelas cascateando
    const query = `
      DROP TABLE IF EXISTS times_jogadores CASCADE;
      DROP TABLE IF EXISTS times CASCADE;
      DROP TABLE IF EXISTS configs CASCADE;
      DROP TABLE IF EXISTS transacoes CASCADE;
      DROP TABLE IF EXISTS convocacoes CASCADE;
      DROP TABLE IF EXISTS peladas CASCADE;
      DROP TABLE IF EXISTS grupos CASCADE;
      DROP TABLE IF EXISTS usuarios CASCADE;
    `;
    
    await client.query(query);
    console.log('✅ Banco de dados limpo com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao limpar banco:', err.message);
  } finally {
    await client.end();
  }
};

run();
