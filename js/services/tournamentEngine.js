/**
 * js/services/tournamentEngine.js
 * Motor de Gerenciamento de Mini Torneios Rápidos
 * Suporta Tabela Mista (Round-Robin todos-contra-todos), Mata-Mata (Semifinais) e Finais (1º a 4º lugar).
 */

window.TournamentEngine = {

  /**
   * Gera a tabela mista (Round-Robin) onde todos os times jogam entre si exatamente o mesmo número de vezes.
   * @param {Array} teams Lista de objetos de times [{ id, nome, cor, emblema, ... }]
   * @returns {Array} Lista de partidas agendadas para a fase de grupos
   */
  generateGroupSchedule(teams, turno = 'ida') {
    if (!Array.isArray(teams) || teams.length < 2) return [];

    const matches = [];
    const teamList = teams.map((t, idx) => {
      const name = (t && (t.nome || t.name)) ? String(t.nome || t.name).trim() : `Time ${String.fromCharCode(65 + idx)}`;
      return {
        id: (t && t.id) || `t_${idx + 1}`,
        nome: name,
        emblema: (t && (t.emblema || t.emblema_url)) || null,
        cor: (t && t.cor) || null,
        players: (t && (t.players || t.jogadores)) || []
      };
    });

    // Algoritmo de Circle Method (Round Robin)
    let list = [...teamList];
    const isOdd = list.length % 2 !== 0;
    if (isOdd) {
      list.push({ id: '__BYE__', nome: 'BYE', isBye: true });
    }

    const numTeams = list.length;
    const numRounds = numTeams - 1;
    const half = numTeams / 2;

    let matchCount = 0;

    // --- TURNO DE IDA ---
    for (let round = 0; round < numRounds; round++) {
      for (let i = 0; i < half; i++) {
        const teamA = list[i];
        const teamB = list[numTeams - 1 - i];

        // Ignora jogos de folga (BYE)
        if (teamA.isBye || teamB.isBye) continue;

        matchCount++;
        matches.push({
          id: `torneio_g_${matchCount}_${Date.now().toString(36)}`,
          fase: 'grupo',
          turno: 'ida',
          faseNome: 'Fase de Grupos (Ida)',
          rodada: round + 1,
          numeroJogo: matchCount,
          teamA: teamA.nome,
          teamB: teamB.nome,
          teamAObj: teamA,
          teamBObj: teamB,
          golsA: null,
          golsB: null,
          status: 'agendado', // 'agendado' | 'em_andamento' | 'encerrado'
          vencedor: null,
          penaltisA: null,
          penaltisB: null
        });
      }

      // Rotaciona os elementos da lista mantendo o primeiro fixo
      const fixed = list[0];
      const rest = list.slice(1);
      const last = rest.pop();
      rest.unshift(last);
      list = [fixed, ...rest];
    }

    // --- TURNO DE VOLTA (SE turno === 'ida_volta') ---
    if (turno === 'ida_volta') {
      const totalIdaMatches = matches.length;
      for (let i = 0; i < totalIdaMatches; i++) {
        const idaMatch = matches[i];
        matchCount++;
        matches.push({
          id: `torneio_g_volta_${matchCount}_${Date.now().toString(36)}`,
          fase: 'grupo',
          turno: 'volta',
          faseNome: 'Fase de Grupos (Volta)',
          rodada: numRounds + idaMatch.rodada,
          numeroJogo: matchCount,
          teamA: idaMatch.teamB,
          teamB: idaMatch.teamA,
          teamAObj: idaMatch.teamBObj,
          teamBObj: idaMatch.teamAObj,
          golsA: null,
          golsB: null,
          status: 'agendado',
          vencedor: null,
          penaltisA: null,
          penaltisB: null
        });
      }
    }

    return this.optimizeMatchSequence(matches);
  },

  /**
   * Reordena e otimiza a sequência de partidas da fase de grupos para equilibrar o descanso das equipes.
   * Evita jogos seguidos do mesmo time e impede que equipes fiquem muito tempo sem jogar.
   */
  optimizeMatchSequence(matches) {
    if (!Array.isArray(matches) || matches.length <= 2) return matches;

    const playedMatches = matches.filter(m => m.status === 'encerrado' || m.status === 'em_andamento');
    const unplayedMatches = matches.filter(m => m.status !== 'encerrado' && m.status !== 'em_andamento');

    if (unplayedMatches.length <= 1) return matches;

    const pool = [...unplayedMatches];
    const ordered = [...playedMatches];
    const lastPlayed = {};

    playedMatches.forEach((m, idx) => {
      lastPlayed[m.teamA] = idx;
      lastPlayed[m.teamB] = idx;
    });

    while (pool.length > 0) {
      const currentIndex = ordered.length;
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        const tA = candidate.teamA;
        const tB = candidate.teamB;

        const restA = (tA in lastPlayed) ? (currentIndex - lastPlayed[tA]) : 999;
        const restB = (tB in lastPlayed) ? (currentIndex - lastPlayed[tB]) : 999;

        let score = 0;

        if (restA === 999 && restB === 999) score += 2500;

        // Penalidade gravíssima para jogos seguidos (rest == 1)
        if (restA === 1) score -= 10000;
        if (restB === 1) score -= 10000;

        // Penalidade para descanso curto (rest == 2)
        if (restA === 2) score -= 1200;
        if (restB === 2) score -= 1200;

        // Bônus proporcional para times esperando há mais tempo
        score += (restA * 200) + (restB * 200);

        // Penalidade se a diferença de descanso entre os 2 times for alta
        score -= Math.abs(restA - restB) * 100;

        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      const chosen = pool.splice(bestIdx, 1)[0];
      lastPlayed[chosen.teamA] = currentIndex;
      lastPlayed[chosen.teamB] = currentIndex;
      ordered.push(chosen);
    }

    ordered.forEach((m, idx) => {
      m.numeroJogo = idx + 1;
    });

    return ordered;
  },

  /**
   * Calcula a tabela de classificação ao vivo da fase de grupos.
   * @param {Array} teams Lista de times
   * @param {Array} matches Lista de partidas da fase de grupos
   * @returns {Array} Tabela de classificação ordenada
   */
  calculateStandings(teams, matches) {
    if (!Array.isArray(teams)) return [];

    const statsMap = {};
    const aliasMap = {};

    // 1. Mapeia cada time oficial e cria aliases (Time A, Time B, Time 1, Time 2...)
    teams.forEach((t, idx) => {
      const officialName = (t.nome || t.name || `Time ${idx + 1}`).trim();
      const nameKey = officialName.toLowerCase();

      const letterAlias = String.fromCharCode(65 + idx).toLowerCase(); // 'a', 'b', 'c', 'd'...
      const timeLetterAlias = `time ${letterAlias}`; // 'time a', 'time b'...
      const numAlias = `time ${idx + 1}`; // 'time 1', 'time 2'...

      aliasMap[nameKey] = nameKey;
      aliasMap[timeLetterAlias] = nameKey;
      aliasMap[numAlias] = nameKey;

      // Se for Time A/B/C/D, mapeia também as cores correspondentes (Azul->Time A, Preto->Time B, Vermelho->Time C, Branco->Time D)
      if (idx === 0 || letterAlias === 'a') { aliasMap['azul'] = nameKey; aliasMap['time azul'] = nameKey; }
      if (idx === 1 || letterAlias === 'b') { aliasMap['preto'] = nameKey; aliasMap['time preto'] = nameKey; }
      if (idx === 2 || letterAlias === 'c') { aliasMap['vermelho'] = nameKey; aliasMap['time vermelho'] = nameKey; }
      if (idx === 3 || letterAlias === 'd') { aliasMap['branco'] = nameKey; aliasMap['time branco'] = nameKey; }

      statsMap[nameKey] = {
        nome: officialName,
        emblema: t.emblema || t.emblema_url || null,
        cor: t.cor || null,
        jogos: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        golsPro: 0,
        golsContra: 0,
        saldoGols: 0,
        pontos: 0
      };
    });

    (matches || []).forEach(m => {
      if (m.fase !== 'grupo' || m.status !== 'encerrado') return;
      if (m.golsA === null || m.golsB === null) return;

      const rawKeyA = (m.teamA || '').trim().toLowerCase();
      const rawKeyB = (m.teamB || '').trim().toLowerCase();

      // Resolve alias para a chave do time oficial
      const keyA = aliasMap[rawKeyA] || rawKeyA;
      const keyB = aliasMap[rawKeyB] || rawKeyB;

      if (!statsMap[keyA]) {
        statsMap[keyA] = { nome: m.teamA, emblema: null, cor: null, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldoGols: 0, pontos: 0 };
      }
      if (!statsMap[keyB]) {
        statsMap[keyB] = { nome: m.teamB, emblema: null, cor: null, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldoGols: 0, pontos: 0 };
      }

      const stA = statsMap[keyA];
      const stB = statsMap[keyB];

      const gA = parseInt(m.golsA) || 0;
      const gB = parseInt(m.golsB) || 0;

      stA.jogos++;
      stB.jogos++;

      stA.golsPro += gA;
      stA.golsContra += gB;

      stB.golsPro += gB;
      stB.golsContra += gA;

      if (gA > gB) {
        stA.vitorias++;
        stA.pontos += 3;
        stB.derrotas++;
      } else if (gB > gA) {
        stB.vitorias++;
        stB.pontos += 3;
        stA.derrotas++;
      } else {
        stA.empates++;
        stB.empates++;
        stA.pontos += 1;
        stB.pontos += 1;
      }

      stA.saldoGols = stA.golsPro - stA.golsContra;
      stB.saldoGols = stB.golsPro - stB.golsContra;
    });

    const standings = Object.values(statsMap);

    // Ordenação por Pontos > Vitórias > Saldo de Gols > Gols Pró > Nome
    standings.sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
      if (b.saldoGols !== a.saldoGols) return b.saldoGols - a.saldoGols;
      if (b.golsPro !== a.golsPro) return b.golsPro - a.golsPro;
      return a.nome.localeCompare(b.nome);
    });

    return standings;
  },

  /**
   * Gera os confrontos diretos de Mata-Mata (sem fase de grupos prévia).
   * @param {Array} teams Lista de times sorteados
   * @returns {Array} Lista de jogos eliminatórios
   */
  generateDirectKnockoutMatches(teams) {
    if (!Array.isArray(teams) || teams.length < 2) return [];

    const formattedTeams = teams.map((t, idx) => ({
      nome: (t.nome || t.name || `Time ${idx + 1}`).trim(),
      emblema: t.emblema || t.emblema_url || null,
      cor: t.cor || null
    }));

    if (formattedTeams.length === 2) {
      return [{
        id: `torneio_final_direta_${Date.now().toString(36)}`,
        fase: 'final',
        faseNome: '🏆 Grande Final (Mata-Mata Direto)',
        numeroJogo: 1,
        teamA: formattedTeams[0].nome,
        teamB: formattedTeams[1].nome,
        teamAObj: formattedTeams[0],
        teamBObj: formattedTeams[1],
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      }];
    }

    return this.generateKnockoutMatches(formattedTeams);
  },

  /**
   * Gera os confrontos do Mata-Mata adaptando-se estritamente ao número de times (2, 3, 4, 5, 6, 8+).
   * @param {Array} standings Classificação da fase de grupos ou lista de times
   * @returns {Array} Lista de jogos da primeira rodada do Mata-Mata
   */
  generateKnockoutMatches(standings) {
    if (!Array.isArray(standings) || standings.length < 2) return [];

    const list = standings.map((s, idx) => typeof s === 'string' ? { nome: s } : {
      nome: s.nome || s.name || `Time ${idx + 1}`,
      emblema: s.emblema || s.emblema_url || null,
      cor: s.cor || null
    });
    const n = list.length;
    const knockoutMatches = [];

    if (n === 2) {
      // 2 Times: Vai direto pra Grande Final!
      knockoutMatches.push({
        id: `torneio_final_${Date.now().toString(36)}`,
        fase: 'final',
        faseNome: '🏆 Grande Final (Mata-Mata)',
        numeroJogo: 1,
        teamA: list[0].nome,
        teamB: list[1].nome,
        teamAObj: list[0],
        teamBObj: list[1],
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
    } else if (n === 3) {
      // 3 Times: 1º vai direto pra final, 2º x 3º jogam Semifinal
      knockoutMatches.push({
        id: `torneio_sf1_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal (2º x 3º)',
        numeroJogo: 1,
        teamA: list[1].nome,
        teamB: list[2].nome,
        teamAObj: list[1],
        teamBObj: list[2],
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
    } else if (n === 4) {
      // 4 Times: Semifinais (1º x 4º e 2º x 3º)
      knockoutMatches.push({
        id: `torneio_sf1_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal 1 (1º x 4º)',
        numeroJogo: 1,
        teamA: list[0].nome,
        teamB: list[3].nome,
        teamAObj: list[0],
        teamBObj: list[3],
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
      knockoutMatches.push({
        id: `torneio_sf2_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal 2 (2º x 3º)',
        numeroJogo: 2,
        teamA: list[1].nome,
        teamB: list[2].nome,
        teamAObj: list[1],
        teamBObj: list[2],
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
    } else if (n === 5) {
      // 5 Times: Jogo Preliminar de Quartas (4º x 5º); 1º, 2º e 3º avançam direto
      knockoutMatches.push({
        id: `torneio_qf1_${Date.now().toString(36)}`,
        fase: 'quartas',
        faseNome: 'Jogo Repescagem / Quartas (4º x 5º)',
        numeroJogo: 1,
        teamA: list[3].nome,
        teamB: list[4].nome,
        teamAObj: list[3],
        teamBObj: list[4],
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
    } else if (n === 6) {
      // 6 Times: Quartas de Final (3º x 6º e 4º x 5º); 1º e 2º avançam direto pras Semifinais
      knockoutMatches.push({
        id: `torneio_qf1_${Date.now().toString(36)}`,
        fase: 'quartas',
        faseNome: 'Quartas de Final 1 (3º x 6º)',
        numeroJogo: 1,
        teamA: list[2].nome,
        teamB: list[5].nome,
        teamAObj: list[2],
        teamBObj: list[5],
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
      knockoutMatches.push({
        id: `torneio_qf2_${Date.now().toString(36)}`,
        fase: 'quartas',
        faseNome: 'Quartas de Final 2 (4º x 5º)',
        numeroJogo: 2,
        teamA: list[3].nome,
        teamB: list[4].nome,
        teamAObj: list[3],
        teamBObj: list[4],
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
    } else {
      // 7 ou 8+ Times: Quartas de Final completas (1º x 8º, 2º x 7º, 3º x 6º, 4º x 5º)
      const top8 = list.slice(0, 8);
      const half = Math.floor(top8.length / 2);
      for (let i = 0; i < half; i++) {
        const teamA = top8[i];
        const teamB = top8[top8.length - 1 - i];
        knockoutMatches.push({
          id: `torneio_qf_${i + 1}_${Date.now().toString(36)}`,
          fase: 'quartas',
          faseNome: `Quartas de Final ${i + 1} (${i + 1}º x ${top8.length - i}º)`,
          numeroJogo: i + 1,
          teamA: teamA.nome,
          teamB: teamB.nome,
          teamAObj: teamA,
          teamBObj: teamB,
          golsA: null,
          golsB: null,
          status: 'agendado',
          vencedor: null,
          penaltisA: null,
          penaltisB: null
        });
      }
    }

    return knockoutMatches;
  },

  /**
   * Gera as Semifinais a partir dos vencedores das Quartas de Final e times pré-classificados.
   * @param {Array} qfMatches Partidas de Quartas de Final encerradas
   * @param {Array} standings Classificação da fase de grupos ou times
   * @returns {Array} Partidas de Semifinal
   */
  generateSemifinalsFromQuartas(qfMatches, standings) {
    if (!Array.isArray(qfMatches) || qfMatches.length === 0) return [];
    const list = standings || [];
    const numTeams = list.length;
    const sfMatches = [];

    const getWinner = (m) => m ? (m.vencedor === m.teamA ? m.teamA : m.teamB) : null;

    if (numTeams === 5 && qfMatches.length === 1) {
      const winnerQF1 = getWinner(qfMatches[0]) || 'Vencedor QF';
      sfMatches.push({
        id: `torneio_sf1_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal 1 (1º x Vencedor QF)',
        numeroJogo: 1,
        teamA: list[0] ? list[0].nome : '1º Colocado',
        teamB: winnerQF1,
        golsA: null, golsB: null, status: 'agendado', vencedor: null
      });
      sfMatches.push({
        id: `torneio_sf2_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal 2 (2º x 3º)',
        numeroJogo: 2,
        teamA: list[1] ? list[1].nome : '2º Colocado',
        teamB: list[2] ? list[2].nome : '3º Colocado',
        golsA: null, golsB: null, status: 'agendado', vencedor: null
      });
    } else if (numTeams === 6 && qfMatches.length === 2) {
      const winnerQF1 = getWinner(qfMatches[0]) || 'Vencedor QF1';
      const winnerQF2 = getWinner(qfMatches[1]) || 'Vencedor QF2';
      sfMatches.push({
        id: `torneio_sf1_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal 1 (1º x Vencedor QF2)',
        numeroJogo: 1,
        teamA: list[0] ? list[0].nome : '1º Colocado',
        teamB: winnerQF2,
        golsA: null, golsB: null, status: 'agendado', vencedor: null
      });
      sfMatches.push({
        id: `torneio_sf2_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal 2 (2º x Vencedor QF1)',
        numeroJogo: 2,
        teamA: list[1] ? list[1].nome : '2º Colocado',
        teamB: winnerQF1,
        golsA: null, golsB: null, status: 'agendado', vencedor: null
      });
    } else if (qfMatches.length >= 4) {
      const winnerQF1 = getWinner(qfMatches[0]) || 'Vencedor QF1';
      const winnerQF2 = getWinner(qfMatches[1]) || 'Vencedor QF2';
      const winnerQF3 = getWinner(qfMatches[2]) || 'Vencedor QF3';
      const winnerQF4 = getWinner(qfMatches[3]) || 'Vencedor QF4';
      sfMatches.push({
        id: `torneio_sf1_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal 1',
        numeroJogo: 1,
        teamA: winnerQF1,
        teamB: winnerQF4,
        golsA: null, golsB: null, status: 'agendado', vencedor: null
      });
      sfMatches.push({
        id: `torneio_sf2_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal 2',
        numeroJogo: 2,
        teamA: winnerQF2,
        teamB: winnerQF3,
        golsA: null, golsB: null, status: 'agendado', vencedor: null
      });
    } else {
      const winner1 = getWinner(qfMatches[0]) || 'Vencedor 1';
      const winner2 = getWinner(qfMatches[1]) || 'Vencedor 2';
      sfMatches.push({
        id: `torneio_sf1_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal',
        numeroJogo: 1,
        teamA: winner1,
        teamB: winner2,
        golsA: null, golsB: null, status: 'agendado', vencedor: null
      });
    }

    return sfMatches;
  },

  /**
   * Gera a disputa de 3º lugar e a Grande Final a partir dos resultados das Semifinais.
   * @param {Array} sfMatches Lista de partidas de semifinal concluídas
   * @param {Array} standings Classificação da fase de grupos para fallback
   * @returns {Array} Lista de partidas de Finais (3º lugar + Grande Final)
   */
  generateFinalsMatches(sfMatches, standings) {
    if (!Array.isArray(sfMatches) || sfMatches.length === 0) return [];

    const finalMatches = [];

    if (sfMatches.length === 2) {
      const sf1 = sfMatches[0];
      const sf2 = sfMatches[1];

      const winnerSF1 = sf1.vencedor === sf1.teamA ? sf1.teamA : sf1.teamB;
      const loserSF1  = sf1.vencedor === sf1.teamA ? sf1.teamB : sf1.teamA;

      const winnerSF2 = sf2.vencedor === sf2.teamA ? sf2.teamA : sf2.teamB;
      const loserSF2  = sf2.vencedor === sf2.teamA ? sf2.teamB : sf2.teamA;

      // Disputa de 3º lugar
      finalMatches.push({
        id: `torneio_3rd_${Date.now().toString(36)}`,
        fase: 'terceiro_lugar',
        faseNome: 'Disputa de 3º Lugar 🥉',
        numeroJogo: 1,
        teamA: loserSF1,
        teamB: loserSF2,
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });

      // Grande Final
      finalMatches.push({
        id: `torneio_final_${Date.now().toString(36)}`,
        fase: 'final',
        faseNome: '🏆 Grande Final',
        numeroJogo: 2,
        teamA: winnerSF1,
        teamB: winnerSF2,
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
    } else if (sfMatches.length === 1) {
      const sf = sfMatches[0];
      const winnerSF = sf.vencedor === sf.teamA ? sf.teamA : sf.teamB;
      const winner1stGroup = standings[0] ? standings[0].nome : '1º Colocado';

      finalMatches.push({
        id: `torneio_final_${Date.now().toString(36)}`,
        fase: 'final',
        faseNome: '🏆 Grande Final',
        numeroJogo: 1,
        teamA: winner1stGroup,
        teamB: winnerSF,
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
    }

    return finalMatches;
  },

  /**
   * Apura o pódio completo (1º, 2º, 3º e 4º colocados) após o término da Final e Disputa de 3º Lugar.
   * @param {Array} finalsMatches Lista de partidas de Finais concluídas
  /**
   * Apura o pódio direto por Pontos Corridos (1º ao 4º lugar da tabela de classificação final).
   * @param {Array} standings Tabela de classificação ordenada
   * @returns {Object} { primeiro, segundo, terceiro, quarto }
   */
  determinePodiumPontosCorridos(standings = []) {
    return {
      primeiro: standings[0] ? standings[0].nome : null,
      segundo:  standings[1] ? standings[1].nome : null,
      terceiro: standings[2] ? standings[2].nome : null,
      quarto:   standings[3] ? standings[3].nome : null
    };
  },

  /**
   * Apura o pódio completo (1º, 2º, 3º e 4º colocados) após o término da Final ou por Pontos Corridos.
   * @param {Array} finalsMatches Lista de partidas de Finais concluídas
   * @param {Array} standings Classificação da fase de grupos para fallback
   * @returns {Object} { primeiro, segundo, terceiro, quarto }
   */
  determinePodium(finalsMatches, standings = []) {
    let primeiro = null;
    let segundo = null;
    let terceiro = null;
    let quarto = null;

    const matchFinal = (finalsMatches || []).find(m => m.fase === 'final' && m.status === 'encerrado');
    const match3rd   = (finalsMatches || []).find(m => m.fase === 'terceiro_lugar' && m.status === 'encerrado');

    if (matchFinal && matchFinal.vencedor) {
      primeiro = matchFinal.vencedor;
      segundo  = matchFinal.vencedor === matchFinal.teamA ? matchFinal.teamB : matchFinal.teamA;
    }

    if (match3rd && match3rd.vencedor) {
      terceiro = match3rd.vencedor;
      quarto   = match3rd.vencedor === match3rd.teamA ? match3rd.teamB : match3rd.teamA;
    }

    // Se não houver mata-mata (Pontos Corridos) ou faltarem dados, usa a tabela de classificação
    if (!primeiro && standings.length > 0) {
      return this.determinePodiumPontosCorridos(standings);
    }
    if (!terceiro && standings.length >= 3) {
      terceiro = standings[2] ? standings[2].nome : null;
      quarto   = standings[3] ? standings[3].nome : null;
    }

    return { primeiro, segundo, terceiro, quarto };
  }

};
