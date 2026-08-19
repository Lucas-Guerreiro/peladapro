require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function checkStatus() {
  try {
    console.log("=== 1. GRUPOS NO BANCO ===");
    const grupos = await db.pool.query("SELECT g.id, g.nome, g.gestor_id, u.email as gestor_email FROM grupos g LEFT JOIN usuarios u ON g.gestor_id = u.id");
    console.table(grupos.rows);

    console.log("=== 2. PELADAS (DATAS) NO BANCO ===");
    const peladas = await db.pool.query("SELECT id, grupo_id, data, horario, local, modo FROM peladas ORDER BY id DESC LIMIT 10");
    console.table(peladas.rows);

    console.log("=== 3. CONVOCAÇÕES (CONFIRMADOS) POR PELADA ===");
    const confirmados = await db.pool.query("SELECT pelada_id, count(*) as total_confirmados FROM convocacoes WHERE status = 'confirmado' GROUP BY pelada_id");
    console.table(confirmados.rows);

  } catch(e) {
    console.error(e);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

checkStatus();
