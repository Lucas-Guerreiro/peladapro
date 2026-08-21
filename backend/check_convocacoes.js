require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function checkConvocacoes() {
  try {
    console.log("=== 1. CONVOCAÇÕES CONFIRMADAS NO POSTGRESQL ===");
    const convRes = await db.pool.query(`
      SELECT c.usuario_id, u.nome, u.email, c.forma_pagamento, c.status, count(*) as qtd
      FROM convocacoes c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      GROUP BY c.usuario_id, u.nome, u.email, c.forma_pagamento, c.status
    `);
    console.table(convRes.rows);

    console.log("\n=== 2. PAGAMENTOS MERCADO PAGO ===");
    const mpRes = await db.pool.query(`
      SELECT p.usuario_id, u.nome, p.valor, p.status, p.created_at
      FROM pagamentos_mercado_pago p
      LEFT JOIN usuarios u ON p.usuario_id = u.id
    `);
    console.table(mpRes.rows);

  } catch (err) {
    console.error("Erro convocacoes:", err.message);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

checkConvocacoes();
