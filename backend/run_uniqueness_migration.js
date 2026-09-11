const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runUniquenessMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Iniciando migração de unicitadade para Usuários (E-mails) e Times...');

    await client.query('BEGIN');

    // 1. DEDUPLICAÇÃO DE E-MAILS NA TABELA USUARIOS
    console.log('1. Verificando e eliminando atletas/usuários com e-mails duplicados...');
    const dupUsersRes = await client.query(`
      SELECT LOWER(TRIM(email)) as email, ARRAY_AGG(id ORDER BY id ASC) as ids
      FROM usuarios
      WHERE email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1
    `);

    for (const row of dupUsersRes.rows) {
      const mainId = row.ids[0]; // Mantém o primeiro criado
      const duplicateIds = row.ids.slice(1);
      console.log(`  - E-mail "${row.email}": mantendo ID ${mainId}, eliminando excedentes IDs: ${duplicateIds.join(', ')}`);

      // Remapeia referências nas tabelas vinculadas
      for (const dupId of duplicateIds) {
        await client.query(`UPDATE convocacoes SET usuario_id = $1 WHERE usuario_id = $2 ON CONFLICT DO NOTHING`, [mainId, dupId]);
        await client.query(`DELETE FROM convocacoes WHERE usuario_id = $1`, [dupId]);

        await client.query(`UPDATE transacoes SET usuario_id = $1 WHERE usuario_id = $2`, [mainId, dupId]);

        await client.query(`UPDATE times_jogadores SET usuario_id = $1 WHERE usuario_id = $2 ON CONFLICT DO NOTHING`, [mainId, dupId]);
        await client.query(`DELETE FROM times_jogadores WHERE usuario_id = $1`, [dupId]);

        await client.query(`DELETE FROM usuarios WHERE id = $1`, [dupId]);
      }
    }

    // Aplica o Índice Único de E-mail (Case-Insensitive) em usuarios
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_unique_email 
      ON usuarios (LOWER(TRIM(email))) 
      WHERE email IS NOT NULL AND TRIM(email) <> '';
    `);
    console.log('  ✅ Índice de e-mail único aplicado com sucesso na tabela usuarios.');

    // 2. DEDUPLICAÇÃO DE TIMES POR PELADA NA TABELA TIMES
    console.log('2. Verificando e eliminando times excedentes com nomes repetidos por pelada...');
    const dupTeamsRes = await client.query(`
      SELECT pelada_id, LOWER(TRIM(nome)) as nome_clean, ARRAY_AGG(id ORDER BY id ASC) as ids
      FROM times
      WHERE nome IS NOT NULL AND TRIM(nome) <> ''
      GROUP BY pelada_id, LOWER(TRIM(nome))
      HAVING COUNT(*) > 1
    `);

    for (const row of dupTeamsRes.rows) {
      const mainId = row.ids[0]; // Mantém o primeiro time
      const duplicateIds = row.ids.slice(1);
      console.log(`  - Pelada ${row.pelada_id}, Time "${row.nome_clean}": mantendo ID ${mainId}, eliminando excedentes IDs: ${duplicateIds.join(', ')}`);

      for (const dupId of duplicateIds) {
        await client.query(`UPDATE times_jogadores SET time_id = $1 WHERE time_id = $2 ON CONFLICT DO NOTHING`, [mainId, dupId]);
        await client.query(`DELETE FROM times_jogadores WHERE time_id = $1`, [dupId]);
        await client.query(`DELETE FROM times WHERE id = $1`, [dupId]);
      }
    }

    // Aplica o Índice Único de Times por Pelada (Case-Insensitive)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_times_pelada_nome_unique 
      ON times (pelada_id, LOWER(TRIM(nome))) 
      WHERE pelada_id IS NOT NULL AND nome IS NOT NULL AND TRIM(nome) <> '';
    `);
    console.log('  ✅ Índice único de nomes de times por pelada aplicado com sucesso na tabela times.');

    await client.query('COMMIT');
    console.log('🎉 Migração concluída com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração de unicitadade:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runUniquenessMigration();
