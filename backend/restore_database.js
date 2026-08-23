const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL não configurada no arquivo .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runRestore(backupFileName) {
  const backupsDir = path.join(__dirname, 'backups');
  let filePath = backupFileName;
  if (!fs.existsSync(filePath)) {
    filePath = path.join(backupsDir, backupFileName);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo de backup não encontrado: ${backupFileName}`);
    console.log(`Verifique a pasta: ${backupsDir}`);
    process.exit(1);
  }

  console.log(`📖 Lendo arquivo de backup: ${filePath}...`);
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const backupData = JSON.parse(rawContent);

  const client = await pool.connect();
  try {
    console.log(`🔄 Iniciando restauração do backup de (${backupData.backupTimestamp})...`);
    await client.query('BEGIN');

    for (const [tableName, tableInfo] of Object.entries(backupData.tables)) {
      if (!tableInfo.rows || tableInfo.rows.length === 0) continue;

      console.log(`📦 Restaurando ${tableInfo.rowCount} registros na tabela '${tableName}'...`);
      for (const row of tableInfo.rows) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const colNamesStr = columns.map(c => `"${c}"`).join(', ');
        const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
        const updateAssigns = columns.map((c, idx) => `"${c}" = EXCLUDED."${c}"`).join(', ');

        const queryStr = `
          INSERT INTO "${tableName}" (${colNamesStr})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING;
        `;
        await client.query(queryStr, values);
      }
    }

    await client.query('COMMIT');
    console.log("\n=======================================================");
    console.log(`✅ Banco de dados restaurado com sucesso a partir de ${path.basename(filePath)}!`);
    console.log("=======================================================\n");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Erro durante a restauração do backup:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

const targetFile = process.argv[2];
if (!targetFile) {
  console.log("Uso: node backend/restore_database.js <nome_do_arquivo_backup.json>");
  process.exit(0);
}

runRestore(targetFile);
