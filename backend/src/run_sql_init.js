const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

console.log('🏁 Iniciando criação sequencial de tabelas no Supabase...');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const run = async () => {
  try {
    await client.connect();
    const sql = fs.readFileSync('database.sql', 'utf8');
    
    // Dividir os comandos por ponto-e-vírgula
    // Evitar quebras dentro de arrays ou comentários removendo os comentários antes
    const cleanSql = sql
      .replace(/--.*$/gm, '') // remove comentários de linha
      .replace(/\/\*[\s\S]*?\*\//g, ''); // remove comentários de bloco
      
    const statements = cleanSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (let statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await client.query(statement);
    }

    console.log('✅ Todas as tabelas e relacionamentos criados com sucesso no Supabase!');
  } catch (err) {
    console.error('❌ Erro na migração do banco de dados:', err.message);
  } finally {
    await client.end();
  }
};

run();
