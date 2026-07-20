const db = require('./src/config/database');

async function atualizar() {
  let client;
  try {
    client = await db.pool.connect();
    console.log("Conectado ao banco PostgreSQL local!");

    // 1. Adicionar a coluna presenca na tabela convocacoes se não existir
    console.log("Adicionando coluna 'presenca' na tabela convocacoes...");
    await client.query(`
      ALTER TABLE convocacoes 
      ADD COLUMN IF NOT EXISTS presenca BOOLEAN DEFAULT false
    `);
    console.log("Coluna 'presenca' verificada/adicionada com sucesso!");

    // 2. Recriar a tabela partidas com chaves compatíveis e simplificadas
    console.log("Recriando a tabela partidas para o ambiente local...");
    await client.query(`
      DROP TABLE IF EXISTS partidas CASCADE;
      CREATE TABLE partidas (
          id SERIAL PRIMARY KEY,
          pelada_id INT REFERENCES peladas(id) ON DELETE CASCADE,
          time_a_nome VARCHAR(50) NOT NULL,
          time_b_nome VARCHAR(50) NOT NULL,
          gols_time_a INT DEFAULT 0,
          gols_time_b INT DEFAULT 0,
          status VARCHAR(20) DEFAULT 'finalizada',
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("Tabela 'partidas' recriada com sucesso!");

  } catch (err) {
    console.error("Erro ao atualizar banco de dados:", err);
  } finally {
    if (client) client.release();
    process.exit(0);
  }
}

atualizar();
