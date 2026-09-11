require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function seed24Presencas(targetPeladaId) {
  let client;
  try {
    client = await db.pool.connect();
    console.log("🐘 Conectado ao PostgreSQL com sucesso!");

    // 1. Busca peladas recentes ou usa a informada
    let peladaIds = [];
    if (targetPeladaId) {
      peladaIds = [parseInt(targetPeladaId)];
    } else {
      const pelRes = await client.query("SELECT id FROM peladas ORDER BY id DESC LIMIT 5");
      peladaIds = pelRes.rows.map(r => r.id);
    }

    if (peladaIds.length === 0) {
      console.error("❌ Nenhuma pelada encontrada no banco de dados.");
      process.exit(1);
    }

    console.log(`📋 Peladas alvo para adicionar presenças: ${peladaIds.join(', ')}`);

    // 2. Busca 24 atletas reais do grupo (priorizando goleiros e atletas ativos)
    const userQuery = `
      SELECT id, nome, apelido, goleiro, email 
      FROM usuarios 
      WHERE ativo = true AND verificado = true AND email NOT LIKE '%@teste.com'
      ORDER BY goleiro DESC, id ASC 
      LIMIT 24
    `;
    const usersRes = await client.query(userQuery);
    const selectedUsers = usersRes.rows;

    if (selectedUsers.length < 24) {
      console.warn(`⚠️ Encontrados ${selectedUsers.length} atletas. Serão inseridos todos os ${selectedUsers.length} disponíveis.`);
    }

    console.log(`⚽ Selecionados ${selectedUsers.length} atletas reais:`);
    console.log(selectedUsers.map(u => `${u.nome} (${u.goleiro ? '🧤 Goleiro' : '🏃 Linha'})`).join(', '));

    // 3. Insere a presença de cada atleta nas peladas alvo
    let inseridosTotal = 0;

    for (const peladaId of peladaIds) {
      await client.query("BEGIN");
      
      // Limpa confirmações de teste anteriores para ter exatamente 24 confirmados limpos
      await client.query("DELETE FROM convocacoes WHERE pelada_id = $1", [peladaId]);

      for (let i = 0; i < selectedUsers.length; i++) {
        const u = selectedUsers[i];
        const status = 'confirmado';
        const formaPagamento = (i % 3 === 0) ? 'mensalista' : ((i % 3 === 1) ? 'pix' : 'saldo');

        await client.query(`
          INSERT INTO convocacoes (pelada_id, usuario_id, status, forma_pagamento, posicao_fila, presenca)
          VALUES ($1, $2, $3, $4, NULL, true)
          ON CONFLICT (pelada_id, usuario_id) 
          DO UPDATE SET status = EXCLUDED.status, presenca = true, forma_pagamento = EXCLUDED.forma_pagamento
        `, [peladaId, u.id, status, formaPagamento]);

        inseridosTotal++;
      }

      await client.query("COMMIT");
      console.log(`✅ ${selectedUsers.length} atletas confirmados na Pelada ID ${peladaId}!`);
    }

    console.log(`\n🎉 SUCESSO! Total de ${inseridosTotal} confirmações inseridas no PostgreSQL.`);

  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("❌ Erro ao adicionar 24 presenças:", err);
  } finally {
    if (client) client.release();
    await db.pool.end();
    process.exit(0);
  }
}

const targetId = process.argv[2] || null;
seed24Presencas(targetId);
