const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // Lista todas as partidas da pelada 13 com seus autores
  const { rows } = await db.query("SELECT id, autores_gols FROM partidas WHERE pelada_id = 13 ORDER BY id");
  console.log(`Total de partidas na pelada 13: ${rows.length}`);

  for (const p of rows) {
    let gols = [];
    try { if (p.autores_gols) gols = JSON.parse(p.autores_gols); } catch(e) {}
    if (gols.length > 0) {
      console.log(`\nPartida ${p.id}:`);
      gols.forEach(g => console.log(`  autorId=${g.autorId}, autorNome="${g.autorNome}"`));
    }
  }

  // Top artilheiros pela tabela usuarios
  const { rows: topGols } = await db.query(
    'SELECT id, apelido, nome, gols FROM usuarios WHERE gols > 0 ORDER BY gols DESC LIMIT 15'
  );
  console.log('\n=== Top artilheiros (campo gols na tabela usuarios) ===');
  topGols.forEach(u => console.log(`  id=${u.id}: "${u.apelido || u.nome}" = ${u.gols} gols`));

  await db.end();
}
main().catch(async e => { console.error(e.message); await db.end(); });
