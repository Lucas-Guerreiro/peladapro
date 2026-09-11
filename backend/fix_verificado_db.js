require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function fixVerificado() {
  try {
    const res = await db.pool.query("UPDATE usuarios SET verificado = true WHERE ativo = true AND tipo != 'incorporado'");
    console.log(`✅ Sucesso! Total de usuários atualizados com verificado = true: ${res.rowCount}`);
  } catch (err) {
    console.error("❌ Erro ao atualizar usuários:", err);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

fixVerificado();
