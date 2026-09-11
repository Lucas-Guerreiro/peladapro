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

async function runBackup() {
  const client = await pool.connect();
  try {
    console.log("🔍 Buscando lista de tabelas públicas no banco de dados...");
    const resTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = resTables.rows.map(r => r.table_name);
    console.log(`📋 Tabelas encontradas (${tables.length}): ${tables.join(', ')}`);

    const backupData = {
      backupTimestamp: new Date().toISOString(),
      databaseUrlHost: process.env.DATABASE_URL.split('@')[1] ? process.env.DATABASE_URL.split('@')[1].split('/')[0] : 'hidden',
      tables: {}
    };

    for (const table of tables) {
      console.log(`📦 Exportando dados da tabela '${table}'...`);
      const resData = await client.query(`SELECT * FROM "${table}"`);
      backupData.tables[table] = {
        rowCount: resData.rows.length,
        rows: resData.rows
      };
    }

    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const d = new Date();
    const dateStr = d.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const fileName = `backup_peladapro_${dateStr}.json`;
    const filePath = path.join(backupsDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log("\n=======================================================");
    console.log(`✅ Backup do banco de dados concluído com sucesso!`);
    console.log(`📁 Arquivo salvo em: ${filePath}`);
    console.log(`📊 Total de tabelas exportadas: ${tables.length}`);
    console.log("=======================================================\n");
  } catch (err) {
    console.error("❌ Erro durante a geração do backup:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runBackup();
