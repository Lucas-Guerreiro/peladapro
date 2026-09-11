// ==========================================================================
// SCRIPT: SEED DE PELADA E CONVOCAÇÕES DE TESTE (seed_pelada_teste.js)
// Cria uma pelada de teste e confirma a presença dos 22 atletas cadastrados.
// ==========================================================================

require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function seedPeladaTeste() {
  let client;

  try {
    client = await db.pool.connect();
    console.log("Conectado ao PostgreSQL com sucesso!");

    // 1. Busca o primeiro grupo ativo no banco
    const grupoRes = await client.query("SELECT id, nome, gestor_id FROM grupos WHERE ativo = true LIMIT 1");
    if (grupoRes.rows.length === 0) {
      console.error("Nenhum grupo ativo encontrado. Crie uma pelada/grupo primeiro.");
      process.exit(1);
    }
    const grupo = grupoRes.rows[0];
    console.log(`Grupo selecionado: ID ${grupo.id} - ${grupo.nome}`);

    // 2. Cria ou atualiza a Pelada de Teste para Hoje/Amanhã
    const hojeStr = new Date().toISOString().split('T')[0]; // Data atual YYYY-MM-DD
    
    // Verifica se já existe uma pelada hoje/futura para este grupo
    let peladaRes = await client.query("SELECT id FROM peladas WHERE grupo_id = $1 AND data >= $2 LIMIT 1", [grupo.id, hojeStr]);
    let peladaId;

    if (peladaRes.rows.length > 0) {
      peladaId = peladaRes.rows[0].id;
      console.log(`Usando pelada existente ID: ${peladaId}`);
      // Atualiza o modo para torneio
      await client.query("UPDATE peladas SET modo = 'torneio', turno_torneio = 'ida' WHERE id = $1", [peladaId]);
    } else {
      const insertPeladaQuery = `
        INSERT INTO peladas (grupo_id, data, horario, local, max_jogadores, valor_convocacao, modo, turno_torneio)
        VALUES ($1, $2, '20:00:00', 'Arena PeladaPro - Campo 1 (Torneio)', 30, 20.00, 'torneio', 'ida')
        RETURNING id`;
      const newPelada = await client.query(insertPeladaQuery, [grupo.id, hojeStr]);
      peladaId = newPelada.rows[0].id;
      console.log(`Nova pelada de teste criada com sucesso! ID: ${peladaId}`);
    }

    // 3. Busca todos os atletas de teste
    const atletasRes = await client.query("SELECT id, nome FROM usuarios WHERE tipo = 'jogador' ORDER BY id ASC");
    const atletas = atletasRes.rows;
    console.log(`Encontrados ${atletas.length} atletas para convocação.`);

    if (atletas.length === 0) {
      console.error("Nenhum atleta de teste encontrado em usuarios. Execute node seed_22_atletas.js primeiro.");
      process.exit(1);
    }

    // 4. Confirma presença de todos os 22 atletas na pelada_id
    console.log("Confirmando check-in de todos os 22 atletas...");
    await client.query("DELETE FROM convocacoes WHERE pelada_id = $1", [peladaId]);

    let count = 0;
    for (const a of atletas) {
      await client.query(
        "INSERT INTO convocacoes (pelada_id, usuario_id, status) VALUES ($1, $2, 'confirmado')",
        [peladaId, a.id]
      );
      count++;
    }

    console.log(`✅ SUCESSO! ${count} atletas confirmados na Pelada de Teste (ID: ${peladaId}).`);
    console.log("Agora você pode abrir o app, selecionar esta data e realizar os testes dos Mini Torneios!");

  } catch (err) {
    console.error("Erro durante a execução do seed de pelada:", err);
  } finally {
    if (client) client.release();
    await db.pool.end();
    process.exit(0);
  }
}

seedPeladaTeste();
