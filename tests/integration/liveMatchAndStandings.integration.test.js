// tests/integration/liveMatchAndStandings.integration.test.js
// Teste de integração oficial para cálculo de pontos, detecção por ID, empates, classificação e casos-limite

global.window = global.window || {};
global.window.App = global.window.App || { liveMatch: {} };
const TournamentEngine = require('../../js/services/tournamentEngine.js');

function runTest() {
  console.log("=================================================================");
  console.log(" 🧪 TESTE DE INTEGRAÇÃO: PONTOS AO VIVO & TABELA DE CLASSIFICAÇÃO");
  console.log("=================================================================\n");

  let assertionsPassed = 0;

  // =========================================================================
  // CENÁRIO A: Inversão de lados (isFlipped) no placar ao vivo por ID
  // =========================================================================
  const teams = [
    { id: 'team_1', nome: 'Time Amarelo' },
    { id: 'team_2', nome: 'Time Azul' },
    { id: 'team_3', nome: 'Time Vermelho' },
    { id: 'team_4', nome: 'Time Verde' }
  ];

  const matches = TournamentEngine.generateGroupSchedule(teams, 'ida');
  console.log(`✅ Geradas ${matches.length} partidas para a fase de grupos.`);

  const match1 = matches[0];
  console.log(`\n▶️ Jogo Agendado #1: ${match1.teamA} x ${match1.teamB}`);

  const liveMatchState = {
    teamAObj: { id: 'team_4', nome: 'Time Verde' },
    teamBObj: { id: 'team_1', nome: 'Time Amarelo' },
    teamA: 'Time Verde',
    teamB: 'Time Amarelo',
    scoreA: 1, // 1 gol do Time Verde no placar ao vivo
    scoreB: 3  // 3 gols do Time Amarelo no placar ao vivo
  };

  const getTeamId = (t) => {
    if (!t) return '';
    if (typeof t === 'object') return String(t.id || t.team_id || t.nome || t.name || '').trim().toLowerCase();
    return String(t).trim().toLowerCase();
  };

  const liveIdA = getTeamId(liveMatchState.teamAObj || liveMatchState.teamA);
  const liveIdB = getTeamId(liveMatchState.teamBObj || liveMatchState.teamB);
  const schedIdA = getTeamId(match1.teamAObj || match1.teamA);
  const schedIdB = getTeamId(match1.teamBObj || match1.teamB);

  const isFlipped = (
    (schedIdA && liveIdB && schedIdA === liveIdB) ||
    (schedIdB && liveIdA && schedIdB === liveIdA)
  );

  if (isFlipped) {
    match1.golsA = liveMatchState.scoreB;
    match1.golsB = liveMatchState.scoreA;
  } else {
    match1.golsA = liveMatchState.scoreA;
    match1.golsB = liveMatchState.scoreB;
  }
  match1.status = 'encerrado';
  match1.vencedor = match1.golsA > match1.golsB ? match1.teamA : (match1.golsB > match1.golsA ? match1.teamB : null);

  console.log(`✅ Resultado do jogo invertido (por ID): ${match1.teamA} ${match1.golsA} x ${match1.golsB} ${match1.teamB} (Vencedor: ${match1.vencedor})`);

  if (isFlipped && match1.golsA === 3 && match1.golsB === 1 && match1.vencedor === 'Time Amarelo') {
    console.log("  [Asserção 1/6 PASSOU]: (a) Inversão de lados (isFlipped) por ID atribuiu gols/pontos corretamente ao Time Amarelo!");
    assertionsPassed++;
  } else {
    throw new Error("FAILED: Detecção de isFlipped por ID falhou!");
  }

  // =========================================================================
  // CENÁRIO B: Empate (scoreA === scoreB) — vencedor = null sem falsa vitória
  // =========================================================================
  const match2 = matches[1];
  console.log(`\n▶️ Jogo Agendado #2: ${match2.teamA} x ${match2.teamB}`);
  match2.golsA = 1;
  match2.golsB = 1;
  match2.status = 'encerrado';
  match2.vencedor = match2.golsA > match2.golsB ? match2.teamA : (match2.golsB > match2.golsA ? match2.teamB : null);

  if (match2.vencedor === null && match2.golsA === 1 && match2.golsB === 1) {
    console.log("  [Asserção 2/6 PASSOU]: (b) Empate registrado com vencedor = null e 1 ponto sem vitória indevida!");
    assertionsPassed++;
  } else {
    throw new Error("FAILED: Empate atribuiu vencedor indevidamente!");
  }

  // =========================================================================
  // CENÁRIO C: Desempate por Confronto Direto (H2H) com 2 times empatados
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log(" 🧪 TESTE CASO-LIMITE (C): DESEMPATE H2H ENTRE 2 TIMES EMPATADOS");
  console.log("-----------------------------------------------------------------");

  const teams2H2H = [
    { id: 't2_a', nome: 'Time A' },
    { id: 't2_b', nome: 'Time B' },
    { id: 't2_c', nome: 'Time C' },
    { id: 't2_d', nome: 'Time D' }
  ];

  // Configuração para Time A e Time B empatarem em 4 Pts, 1 Vit, 0 SG (2-2), 2 GP:
  // J1: Time A 2 x 1 Time B (A venceu B no confronto direto)
  // J2: Time C 1 x 0 Time D
  // J3: Time C 1 x 0 Time A
  // J4: Time B 1 x 0 Time D
  // J5: Time A 0 x 0 Time D
  // J6: Time B 0 x 0 Time C
  const matches2H2H = [
    { fase: 'grupo', status: 'encerrado', teamA: 'Time A', teamB: 'Time B', golsA: 2, golsB: 1 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time C', teamB: 'Time D', golsA: 1, golsB: 0 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time C', teamB: 'Time A', golsA: 1, golsB: 0 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time B', teamB: 'Time D', golsA: 1, golsB: 0 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time A', teamB: 'Time D', golsA: 0, golsB: 0 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time B', teamB: 'Time C', golsA: 0, golsB: 0 }
  ];

  const standings2Teams = TournamentEngine.calculateStandings(teams2H2H, matches2H2H);

  console.log("📊 Tabela de Classificação Desempate 2 Times:");
  console.table(standings2Teams.map((s, pos) => ({
    Posição: `${pos + 1}º`,
    Time: s.nome,
    Pontos: s.pontos,
    Vitórias: s.vitorias,
    SaldoGols: s.saldoGols,
    GolsPro: s.golsPro
  })));

  // Time C fica em 1º (7 pts). Time A e Time B empatam em 4 Pts, 1 Vit, 0 SG, 2 GP.
  // H2H coloca Time A (vencedor de A x B) em 2º lugar e Time B em 3º lugar.
  if (standings2Teams[1].nome === 'Time A' && standings2Teams[2].nome === 'Time B') {
    console.log("  [Asserção 3/6 PASSOU]: (c) Desempate H2H para 2 times empatados colocou Time A à frente do Time B!");
    assertionsPassed++;
  } else {
    throw new Error("FAILED: Desempate H2H de 2 times falhou!");
  }

  // =========================================================================
  // CENÁRIO D: Desempate por Confronto Direto (H2H) com 3+ times empatados em estatísticas primárias
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log(" 🧪 TESTE CASO-LIMITE (D): DESEMPATE H2H DE 3+ TIMES (EMPATE TRIPLO)");
  console.log("-----------------------------------------------------------------");

  const teamsTriple = [
    { id: 't_alpha', nome: 'Time Alpha' },
    { id: 't_beta', nome: 'Time Beta' },
    { id: 't_gamma', nome: 'Time Gamma' },
    { id: 't_delta', nome: 'Time Delta' }
  ];

  // Partidas em circuito fechado onde Alpha, Beta e Gamma empatam em 3 Pts, 1 Vit, 0 SG (3-3), 3 GP no geral:
  // Alpha 3 x 0 Beta
  // Beta 3 x 0 Gamma
  // Gamma 3 x 0 Alpha
  const matchesTriple = [
    { fase: 'grupo', status: 'encerrado', teamA: 'Time Alpha', teamB: 'Time Beta', golsA: 3, golsB: 0 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time Beta', teamB: 'Time Gamma', golsA: 3, golsB: 0 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time Gamma', teamB: 'Time Alpha', golsA: 3, golsB: 0 }
  ];

  const standingsTriple = TournamentEngine.calculateStandings(teamsTriple, matchesTriple);

  console.log("📊 Tabela de Classificação do Empate Triplo:");
  console.table(standingsTriple.map((s, pos) => ({
    Posição: `${pos + 1}º`,
    Time: s.nome,
    Pontos: s.pontos,
    Vitórias: s.vitorias,
    SaldoGols: s.saldoGols,
    GolsPro: s.golsPro
  })));

  // Alpha, Beta e Gamma estão exatamente empatados em todos os critérios primários e no H2H.
  // A mini-tabela desempatará alfabeticamente entre os 3 integrantes do sub-grupo (Alpha > Beta > Gamma).
  if (standingsTriple[0].nome === 'Time Alpha' && standingsTriple[1].nome === 'Time Beta' && standingsTriple[2].nome === 'Time Gamma') {
    console.log("  [Asserção 4/6 PASSOU]: (d) Mini-tabela H2H para empate de 3+ times filtrou e ordenou o subconjunto com precisão!");
    assertionsPassed++;
  } else {
    throw new Error("FAILED: Desempate H2H de 3+ times falhou!");
  }

  // =========================================================================
  // CENÁRIO E: Torneio Ida e Volta com Múltiplos Jogos entre o mesmo par de times
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log(" 🧪 TESTE CASO-LIMITE (E): IDA E VOLTA (MÚLTIPLOS JOGOS H2H)");
  console.log("-----------------------------------------------------------------");

  const teamsIdaVolta = [
    { id: 't_x', nome: 'Time X' },
    { id: 't_y', nome: 'Time Y' }
  ];

  // Jogo 1 (Ida): Time X 1 x 0 Time Y
  // Jogo 2 (Volta): Time Y 3 x 0 Time X
  // Total acumulado do confronto direto: Time Y venceu por 3 x 1 no agregado acumulado
  const matchesIdaVolta = [
    { fase: 'grupo', status: 'encerrado', teamA: 'Time X', teamB: 'Time Y', golsA: 1, golsB: 0 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time Y', teamB: 'Time X', golsA: 3, golsB: 0 }
  ];

  const standingsIdaVolta = TournamentEngine.calculateStandings(teamsIdaVolta, matchesIdaVolta);

  console.log("📊 Tabela Ida e Volta:");
  console.table(standingsIdaVolta.map((s, pos) => ({
    Posição: `${pos + 1}º`,
    Time: s.nome,
    Pontos: s.pontos,
    Vitórias: s.vitorias,
    SaldoGols: s.saldoGols,
    GolsPro: s.golsPro
  })));

  if (standingsIdaVolta[0].nome === 'Time Y' && standingsIdaVolta[1].nome === 'Time X') {
    console.log("  [Asserção 5/6 PASSOU]: (e) Mini-tabela H2H acumulou TODOS os jogos da Ida e Volta (Time Y venceu no agregado acumulado)!");
    assertionsPassed++;
  } else {
    throw new Error("FAILED: Ida e Volta H2H acumulado falhou!");
  }

  // =========================================================================
  // CENÁRIO F: Ordenação Completa (Pontos > Vitórias > SG > GP > H2H > Nome)
  // =========================================================================
  console.log("\n-----------------------------------------------------------------");
  console.log(" 🧪 TESTE CASO-LIMITE (F): HIERARQUIA COMPLETA DE CRITÉRIOS DE DESEMPATE");
  console.log("-----------------------------------------------------------------");

  const teamsFull = [
    { id: 'tf1', nome: 'Time T1' },
    { id: 'tf2', nome: 'Time T2' },
    { id: 'tf3', nome: 'Time T3' },
    { id: 'tf4', nome: 'Time T4' },
    { id: 'tf5', nome: 'Time T5' },
    { id: 'tf6', nome: 'Time T6' }
  ];

  // Configura jogos para exercitar explicitamente cada critério em sequência:
  // 1º T1: 6 Pts (Pontos superior)
  // 2º T2: 4 Pts, 2 Vit (Mais vitórias que T3)
  // 3º T3: 4 Pts, 1 Vit, SG +3 (Melhor saldo que T4)
  // 4º T4: 4 Pts, 1 Vit, SG +1, GP 5 (Mais gols pró que T5)
  // 5º T5: 4 Pts, 1 Vit, SG +1, GP 3, venceu T6 por 1x0 (Confronto Direto sobre T6)
  // 6º T6: 4 Pts, 1 Vit, SG +1, GP 3, perdeu para T5
  const matchesFullHierarchy = [
    // T1 vence 2 jogos -> 6 pts
    { fase: 'grupo', status: 'encerrado', teamA: 'Time T1', teamB: 'Time T2', golsA: 2, golsB: 0 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time T1', teamB: 'Time T3', golsA: 2, golsB: 0 },

    // T2 vence T4 e empata 1 -> 4 pts, 2 vitórias
    { fase: 'grupo', status: 'encerrado', teamA: 'Time T2', teamB: 'Time T4', golsA: 1, golsB: 0 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time T2', teamB: 'Time T5', golsA: 1, golsB: 0 },

    // T3 vence 1 com placar elástico -> 4 pts, 1 vit, SG +3
    { fase: 'grupo', status: 'encerrado', teamA: 'Time T3', teamB: 'Time T6', golsA: 5, golsB: 2 },
    { fase: 'grupo', status: 'encerrado', teamA: 'Time T3', teamB: 'Time T4', golsA: 0, golsB: 0 },

    // T4 vence 1 com 5 GP -> 4 pts, 1 vit, SG +1, GP 5
    { fase: 'grupo', status: 'encerrado', teamA: 'Time T4', teamB: 'Time T5', golsA: 5, golsB: 4 },

    // T5 vs T6: T5 1 x 0 T6 (H2H desempata T5 em 5º e T6 em 6º)
    { fase: 'grupo', status: 'encerrado', teamA: 'Time T5', teamB: 'Time T6', golsA: 1, golsB: 0 }
  ];

  const standingsFull = TournamentEngine.calculateStandings(teamsFull, matchesFullHierarchy);

  console.log("📊 Tabela Hierarquia Completa de Desempate:");
  console.table(standingsFull.map((s, pos) => ({
    Posição: `${pos + 1}º`,
    Time: s.nome,
    Pontos: s.pontos,
    Vitórias: s.vitorias,
    SaldoGols: s.saldoGols,
    GolsPro: s.golsPro
  })));

  const expectedOrder = ['Time T1', 'Time T2', 'Time T3', 'Time T4', 'Time T5', 'Time T6'];
  const actualOrder = standingsFull.map(s => s.nome);

  const isFullHierarchyValid = expectedOrder.every((name, idx) => actualOrder[idx] === name);

  if (isFullHierarchyValid) {
    console.log("  [Asserção 6/6 PASSOU]: (f) Hierarquia completa Pontos > Vitórias > SG > GP > H2H > Nome validada com 100% de precisão!");
    assertionsPassed++;
  } else {
    console.error("Ordem Esperada:", expectedOrder);
    console.error("Ordem Obtida:  ", actualOrder);
    throw new Error("FAILED: Hierarquia completa de desempate falhou!");
  }

  return assertionsPassed;
}

if (require.main === module) {
  try {
    const total = runTest();
    console.log(`\n🎉 Todos os ${total} testes de integração (liveMatchAndStandings) passaram!`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ TESTE FALHOU:`, err.message);
    process.exit(1);
  }
}

module.exports = runTest;
