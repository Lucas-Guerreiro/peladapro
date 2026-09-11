const db = require('./src/config/database');

async function testCompleteFlow() {
  try {
    const targetGroupId = 7;
    const nomeClean = 'Time Teste Completo';
    const corClean = '#0284C7';

    console.log('--- 1. Inserindo no catálogo nomes_times_grupo ---');
    const { rows } = await db.query(
      `INSERT INTO nomes_times_grupo (grupo_id, nome, cor)
       VALUES ($1, $2, $3)
       ON CONFLICT (grupo_id, nome) DO UPDATE SET cor = EXCLUDED.cor
       RETURNING id, grupo_id, nome, cor`,
      [targetGroupId, nomeClean, corClean]
    );
    console.log('✅ Inserido em nomes_times_grupo:', rows[0]);

    console.log('\n--- 2. Replicando para tabela times das peladas do grupo ---');
    const peladasRes = await db.query('SELECT id FROM peladas WHERE grupo_id = $1', [targetGroupId]);
    console.log('Peladas do grupo 7:', peladasRes.rows.map(p => p.id));

    for (const p of peladasRes.rows) {
      const tRes = await db.query(
        'SELECT id FROM times WHERE pelada_id = $1 AND LOWER(TRIM(nome)) = LOWER(TRIM($2))',
        [p.id, nomeClean]
      );
      if (tRes.rows.length === 0) {
        const ins = await db.query(
          'INSERT INTO times (pelada_id, nome, cor) VALUES ($1, $2, $3) RETURNING id, pelada_id, nome, cor',
          [p.id, nomeClean, corClean]
        );
        console.log(`  ➕ Inserido na pelada ${p.id}:`, ins.rows[0]);
      } else {
        console.log(`  ℹ️ Já existe na pelada ${p.id}`);
      }
    }

    console.log('\n--- 3. Verificando tabela times geral ---');
    const allTimes = await db.query('SELECT id, pelada_id, nome, cor FROM times ORDER BY id DESC LIMIT 10');
    console.log(allTimes.rows);

    console.log('\n--- 4. Verificando tabela nomes_times_grupo geral ---');
    const allCatalog = await db.query('SELECT id, grupo_id, nome, cor FROM nomes_times_grupo ORDER BY id ASC');
    console.log(allCatalog.rows);

  } catch(e) {
    console.error('❌ Erro no teste:', e);
  } finally {
    process.exit(0);
  }
}

testCompleteFlow();
