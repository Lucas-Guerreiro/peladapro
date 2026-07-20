// ==========================================================================
// SEED DE 30 ATLETAS DE TESTE (seed_30_atletas.js)
// ==========================================================================

const db = require('./src/config/database');
const bcrypt = require('bcrypt');

const nomes = [
  "Thiago Silva", "Lucas Lima", "Gabriel Barbosa", "Bruno Henrique", "Giorgian Arrascaeta",
  "Everton Ribeiro", "Filipe Luis", "Diego Alves", "Willian Arão", "Gerson Santos",
  "Rodrigo Caio", "Pablo Mari", "Rafinha Souza", "Vitinho Santos", "Pedro Guilherme",
  "Matheus Thuler", "Rene Rodrigues", "Cesar Bernardo", "Hugo Souza", "Lincoln Correa",
  "Luan Guilherme", "Dudu Silva", "Gustavo Gomez", "Weverton Pereira", "Raphael Veiga",
  "Rony Barbosa", "Ze Rafael", "Marcos Rocha", "Mayke Rocha", "Murilo Cerqueira"
];

async function seedAtletas() {
  const senhaHash = await bcrypt.hash('123456', 10);
  let client;

  try {
    client = await db.pool.connect();
    console.log("Conectado ao PostgreSQL com sucesso!");

    console.log("Inserindo 30 atletas de teste...");

    let count = 0;
    for (let i = 0; i < 30; i++) {
      const nome = nomes[i];
      const email = `atleta${i + 1}@teste.com`;
      
      // Gera CPF formatado e único de teste: 999.888.777-XX
      const sufixo = String(i + 1).padStart(2, '0');
      const cpf = `999.888.777-${sufixo}`;
      
      const dob = `199${Math.floor(Math.random() * 10)}-0${Math.floor(Math.random() * 9) + 1}-15`;
      const whatsapp = `(11) 9${Math.floor(Math.random() * 90000000 + 10000000)}`;
      const autoavaliacao = Math.floor(Math.random() * 4) + 2; // Notas de 2 a 5
      const goleiro = (i % 8 === 0); // A cada 8 jogadores, 1 é goleiro
      const saldo = parseFloat((Math.random() * 150 - 50).toFixed(2)); // Saldo entre -50 e +100
      const apelido = nome.split(" ")[0] + (goleiro ? " Muralha" : "");

      // Verifica no banco antes se o email ou cpf já existem para evitar violação de Unique Key
      const check = await client.query('SELECT id FROM usuarios WHERE email = $1 OR cpf = $2', [email, cpf]);
      if (check.rows.length > 0) {
        continue;
      }

      const query = `
        INSERT INTO usuarios (nome, email, cpf, data_nascimento, whatsapp, senha_hash, autoavaliacao, tipo, goleiro, saldo, apelido, ativo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'jogador', $8, $9, $10, true)`;

      const result = await client.query(query, [
        nome, email, cpf, dob, whatsapp, senhaHash, autoavaliacao, goleiro, saldo, apelido
      ]);

      if (result.rowCount > 0) {
        count++;
      }
    }

    console.log(`Sucesso: ${count} novos atletas inseridos no banco.`);

  } catch (err) {
    console.error("Erro durante o seed dos atletas:", err);
  } finally {
    if (client) {
      client.release();
    }
    // Fecha a conexão com o pool para terminar o script
    await db.pool.end();
    process.exit(0);
  }
}

seedAtletas();
