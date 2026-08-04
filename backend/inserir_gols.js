const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const PELADA_ID = 13; // 03/08/2026

// IDs mapeados diretamente do banco (confirmados na consulta anterior)
const golsParaInserir = [
  { id: 73,  apelido: 'Pr. Ewerton',    gols: 4 },
  { id: 71,  apelido: 'Sangar',         gols: 1 },
  { id: 92,  apelido: 'Guerreiro',      gols: 4 },
  { id: 102, apelido: 'Carlos Netto',   gols: 2 },
  { id: 79,  apelido: 'Lobo',           gols: 2 },
  { id: 76,  apelido: 'Linconl',        gols: 3 },
  { id: 74,  apelido: 'Andrew',         gols: 2 },
  { id: 112, apelido: 'Luciano',        gols: 2 },
  { id: 91,  apelido: 'Sávio',          gols: 3 },
  { id: 83,  apelido: 'Kaio',           gols: 2 },
  { id: 104, apelido: 'Fernando',       gols: 2 },
  { id: 85,  apelido: 'Victor Silva',   gols: 1 },
  { id: 77,  apelido: 'Madson',         gols: 1 },
  { id: 103, apelido: 'Marcleive',      gols: 2 },
  { id: 86,  apelido: 'Weslley',        gols: 1 },
];

async function main() {
  // Apaga a partida vazia criada nos testes anteriores
  const del = await db.query("DELETE FROM partidas WHERE pelada_id=$1 AND autores_gols IS NULL AND time_a_nome='Geral A' RETURNING id", [PELADA_ID]);
  if (del.rowCount > 0) console.log(`Partidas de teste limpas: ${del.rows.map(r=>r.id).join(', ')}`);

  // Monta o autores_gols como JSON array para salvar na partida
  const autoresGols = golsParaInserir.map(e => ({ id: e.id, apelido: e.apelido, gols: e.gols }));

  // Cria uma partida consolidada da rodada para guardar os autores de gols
  const nomeA = 'Geral A';
  const nomeB = 'Geral B';
  const totalGolsA = golsParaInserir.reduce((s, e) => s + e.gols, 0);

  const insPartida = await db.query(
    `INSERT INTO partidas (pelada_id, time_a_nome, time_b_nome, gols_time_a, gols_time_b, autores_gols, status)
     VALUES ($1, $2, $3, $4, 0, $5, 'finalizada') RETURNING id`,
    [PELADA_ID, nomeA, nomeB, totalGolsA, JSON.stringify(autoresGols)]
  );
  const partidaId = insPartida.rows[0].id;
  console.log(`Partida da rodada criada: id=${partidaId}, total de gols=${totalGolsA}`);

  // Atualiza os gols diretamente na tabela usuarios (campo acumulado)
  const inserted = [];
  const erros = [];

  for (const entrada of golsParaInserir) {
    try {
      const res = await db.query(
        'UPDATE usuarios SET gols = COALESCE(gols, 0) + $1 WHERE id = $2 RETURNING id, apelido, nome, gols',
        [entrada.gols, entrada.id]
      );
      if (res.rowCount === 0) {
        erros.push(`id=${entrada.id} não encontrado`);
        console.warn(`[NÃO ENCONTRADO] id=${entrada.id} (${entrada.apelido})`);
      } else {
        const u = res.rows[0];
        inserted.push(u);
        console.log(`✅ ${u.apelido || u.nome} (id=${u.id}): +${entrada.gols} → total agora: ${u.gols} gols`);
      }
    } catch (e) {
      erros.push(`id=${entrada.id}: ${e.message}`);
      console.error(`Erro id=${entrada.id}:`, e.message);
    }
  }

  console.log('\n=== RESUMO FINAL ===');
  console.log(`Atualizados: ${inserted.length}/${golsParaInserir.length}`);
  inserted.forEach(u => console.log(`  ${u.apelido || u.nome}: ${u.gols} gols (total acumulado)`));
  if (erros.length > 0) console.log('Erros:', erros);

  await db.end();
}

main().catch(async e => { console.error(e.message); await db.end(); });
