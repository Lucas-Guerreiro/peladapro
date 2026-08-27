const db = require('./src/config/database');

async function zerarEstatisticas() {
  console.log('🔄 Iniciando limpeza geral de estatísticas (gols, jogos, partidas e pontos)...');
  try {
    // 1. Zera estatísticas acumuladas de todos os usuários
    const userRes = await db.query('UPDATE usuarios SET gols = 0, partidas = 0 RETURNING id');
    console.log(`✅ Estatísticas de ${userRes.rows.length} atletas zeradas (gols = 0, partidas = 0).`);

    // 2. Limpa tabela de gols (se existir)
    try {
      const golsRes = await db.query('DELETE FROM gols');
      console.log(`✅ Tabela de gols zerada (${golsRes.rowCount || 0} registros removidos).`);
    } catch (e) {
      console.log('ℹ️ Tabela de gols não continha registros ou não existe.');
    }

    // 3. Limpa todas as partidas registradas no banco de dados
    const partidasRes = await db.query('DELETE FROM partidas');
    console.log(`✅ Tabela de partidas zerada (${partidasRes.rowCount || 0} partidas removidas).`);

    console.log('🎉 TODAS AS ESTATÍSTICAS E RANKING FORAM ZERADOS COM SUCESSO!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao zerar estatísticas:', err);
    process.exit(1);
  }
}

zerarEstatisticas();
