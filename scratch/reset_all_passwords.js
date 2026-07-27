const bcrypt = require('../backend/node_modules/bcrypt');
const dotenv = require('../backend/node_modules/dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
const db = require('../backend/src/config/database');

async function resetAllPasswords() {
  try {
    console.log('🔄 Gerando hash bcrypt para a senha "123456"...');
    const hash = await bcrypt.hash('123456', 10);

    console.log('⚡ Atualizando todos os usuários no banco de dados PostgreSQL...');
    const result = await db.query('UPDATE usuarios SET senha_hash = $1 RETURNING id, nome, email', [hash]);

    console.log(`✅ Sucesso! Senha "123456" atribuída para ${result.rowCount} usuário(s).`);
    result.rows.forEach(u => {
      console.log(`  - [ID ${u.id}] ${u.nome} (${u.email})`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao redefinir senhas:', err);
    process.exit(1);
  }
}

resetAllPasswords();
