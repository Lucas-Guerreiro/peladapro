// tests/integration/tournamentEngine.integration.test.js
// Teste de integração oficial para simulação completa de Mini Torneio e Engine de Torneios

global.window = global.window || {};
global.window.App = global.window.App || { liveMatch: {} };
const TournamentEngine = require('../../js/services/tournamentEngine.js');

function runTest() {
  console.log("=================================================================");
  console.log(" 🏆 TESTE DE INTEGRAÇÃO: MINI TORNEIO COMPLETO & ENGINE");
  console.log("=================================================================\n");

  let assertionsPassed = 0;

  const teams = [
    { id: 't1', nome: 'Time Amarelo 🟡' },
    { id: 't2', nome: 'Time Azul 🔵' },
    { id: 't3', nome: 'Time Vermelho 🔴' },
    { id: 't4', nome: 'Time Verde 🟢' }
  ];

  const matchesIda = TournamentEngine.generateGroupSchedule(teams, 'ida');
  if (matchesIda.length === 6) {
    console.log("✅ [Turno Único - Somente Ida]: Gerou 6 partidas.");
    assertionsPassed++;
  } else {
    throw new Error(`FAILED: Esperado 6 partidas na ida, gerou ${matchesIda.length}`);
  }

  const matchesIdaVolta = TournamentEngine.generateGroupSchedule(teams, 'ida_volta');
  if (matchesIdaVolta.length === 12) {
    console.log("✅ [Turno e Returno - Ida e Volta]: Gerou 12 partidas.");
    assertionsPassed++;
  } else {
    throw new Error(`FAILED: Esperado 12 partidas na ida e volta, gerou ${matchesIdaVolta.length}`);
  }

  // Simula resultados de 12 partidas
  const scoreResults = [
    [2, 1], [1, 1], [3, 0], [0, 2], [1, 3], [2, 2],
    [2, 1], [1, 1], [3, 0], [0, 2], [1, 3], [2, 2]
  ];

  matchesIdaVolta.forEach((m, idx) => {
    const [resA, resB] = scoreResults[idx];
    m.golsA = resA;
    m.golsB = resB;
    m.status = 'encerrado';
    m.vencedor = resA > resB ? m.teamA : (resB > resA ? m.teamB : null);
  });

  const standings = TournamentEngine.calculateStandings(teams, matchesIdaVolta);
  console.log("\n📊 TABELA DE CLASSIFICAÇÃO DA FASE DE GRUPOS:");
  console.table(standings.map((s, pos) => ({
    Posição: `${pos + 1}º`,
    Time: s.nome,
    Pontos: s.pontos,
    Jogos: s.jogos,
    Vitórias: s.vitorias,
    Empates: s.empates,
    Derrotas: s.derrotas,
    GP: s.golsPro,
    GC: s.golsContra,
    SG: s.saldoGols
  })));

  if (standings.length === 4 && standings[0].pontos >= standings[1].pontos) {
    console.log("✅ Classificação de grupos validada.");
    assertionsPassed++;
  } else {
    throw new Error("FAILED: Classificação de grupos inconsistente!");
  }

  const knockout = TournamentEngine.generateKnockoutMatches(standings);
  if (knockout.length === 2) {
    console.log("✅ Mata-mata (Semifinais 1º x 4º e 2º x 3º) gerado com sucesso.");
    assertionsPassed++;
  } else {
    throw new Error(`FAILED: Esperado 2 partidas de semifinal, gerado ${knockout.length}`);
  }

  return assertionsPassed;
}

if (require.main === module) {
  try {
    const total = runTest();
    console.log(`\n🎉 Todos os ${total} testes de integração (tournamentEngine) passaram!`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ TESTE FALHOU:`, err.message);
    process.exit(1);
  }
}

module.exports = runTest;
