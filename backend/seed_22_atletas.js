// ==========================================================================
// SCRIPT: SEED DE ATLETAS REAIS DO USUÁRIO (seed_22_atletas.js)
// Conecta ao banco Postgres e substitui os atletas mockados antigos.
// ==========================================================================

require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');
const bcrypt = require('bcrypt');

const atletas = [
  { nome: "Erivan", goleiro: false, autoavaliacao: 4 },
  { nome: "Leda", goleiro: false, autoavaliacao: 4 },
  { nome: "Levy", goleiro: true, autoavaliacao: 4 },
  { nome: "David Araújo", goleiro: false, autoavaliacao: 5 },
  { nome: "Sangar", goleiro: false, autoavaliacao: 3 },
  { nome: "Netto", goleiro: false, autoavaliacao: 4 },
  { nome: "Ewerton", goleiro: false, autoavaliacao: 3 },
  { nome: "Andrew", goleiro: false, autoavaliacao: 4 },
  { nome: "Josimar", goleiro: false, autoavaliacao: 4 },
  { nome: "Linconl", goleiro: false, autoavaliacao: 4 },
  { nome: "Madson", goleiro: false, autoavaliacao: 4 },
  { nome: "Darlan", goleiro: false, autoavaliacao: 4 },
  { nome: "Lobo", goleiro: false, autoavaliacao: 5 },
  { nome: "Elia", goleiro: false, autoavaliacao: 4 },
  { nome: "Dhárcio", goleiro: false, autoavaliacao: 4 },
  { nome: "Arthur", goleiro: true, autoavaliacao: 4 },
  { nome: "Kaio", goleiro: false, autoavaliacao: 4 },
  { nome: "Cleber Bindá", goleiro: false, autoavaliacao: 4 },
  { nome: "Victor Silva", goleiro: false, autoavaliacao: 4 },
  { nome: "Weslley", goleiro: false, autoavaliacao: 4 },
  { nome: "F Abbade", goleiro: false, autoavaliacao: 4 },
  { nome: "ícaro", goleiro: false, autoavaliacao: 4 }
];

async function seedAtletas() {
  const senhaHash = await bcrypt.hash('123456', 10);
  let client;

  try {
    client = await db.pool.connect();
    console.log("Conectado ao PostgreSQL com sucesso!");

    // 1. Limpa os jogadores antigos para evitar duplicação ou mistura
    console.log("Limpando jogadores anteriores com tipo = 'jogador'...");
    await client.query("DELETE FROM usuarios WHERE tipo = 'jogador'");
    console.log("Limpeza concluída.");

    console.log("Inserindo os 22 novos atletas de teste...");

    let count = 0;
    for (let i = 0; i < atletas.length; i++) {
      const a = atletas[i];
      const email = `${a.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '')}@teste.com`;
      const sufixo = String(i + 1).padStart(2, '0');
      const cpf = `111.111.111-${sufixo}`;
      const dob = `199${Math.floor(Math.random() * 10)}-0${Math.floor(Math.random() * 9) + 1}-15`;
      const whatsapp = `(61) 99999-10${sufixo}`;
      const autoavaliacao = a.autoavaliacao;
      const goleiro = a.goleiro;
      const saldo = 0.00;
      const apelido = a.nome;

      const query = `
        INSERT INTO usuarios (nome, email, cpf, data_nascimento, whatsapp, senha_hash, autoavaliacao, tipo, goleiro, saldo, apelido, ativo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'jogador', $8, $9, $10, true)`;

      const result = await client.query(query, [
        a.nome, email, cpf, dob, whatsapp, senhaHash, autoavaliacao, goleiro, saldo, apelido
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
    await db.pool.end();
    process.exit(0);
  }
}

seedAtletas();
