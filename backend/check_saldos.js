require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function checkSaldos() {
  try {
    console.log("=== 1. CHECANDO TABELA TRANSAÇÕES ===");
    const countRes = await db.pool.query("SELECT count(*) FROM transacoes");
    console.log(`Total de transações no banco: ${countRes.rows[0].count}`);

    const transList = await db.pool.query(`
      SELECT t.id, t.usuario_id, u.nome, u.email, t.valor, t.tipo, t.descricao, t.data
      SELECT t.* FROM transacoes t
      ORDER BY t.id DESC LIMIT 30
    `).catch(() => null);

    const transQuery = await db.pool.query(`
      SELECT t.usuario_id, u.nome, u.email,
             SUM(CASE WHEN t.tipo = 'credito' THEN t.valor ELSE -t.valor END) as saldo_transacoes
      FROM transacoes t
      JOIN usuarios u ON t.usuario_id = u.id
      GROUP BY t.usuario_id, u.nome, u.email
    `);

    console.table(transQuery.rows);

    console.log("\n=== 2. SALDOS ATUAIS NA TABELA USUARIOS ===");
    const userSaldos = await db.pool.query("SELECT id, nome, email, saldo FROM usuarios WHERE saldo != 0 ORDER BY saldo DESC");
    console.table(userSaldos.rows);

  } catch (err) {
    console.error("Erro ao checar saldos:", err.message);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

checkSaldos();
