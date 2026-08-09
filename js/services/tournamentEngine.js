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
  generateGroupSchedule(teams) {
    if (!Array.isArray(teams) || teams.length < 2) return [];

    const matches = [];
    const teamList = teams.map((t, idx) => ({
      id: t.id || `t_${idx + 1}`,
      nome: t.nome || t.name || `Time ${idx + 1}`,
      emblema: t.emblema || t.emblema_url || null,
      cor: t.cor || null,
      players: t.players || t.jogadores || []
    }));

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
          faseNome: 'Fase de Grupos',
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

    return matches;
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

    teams.forEach((t, idx) => {
      const nameKey = (t.nome || t.name || `Time ${idx + 1}`).trim().toLowerCase();
      statsMap[nameKey] = {
        nome: t.nome || t.name || `Time ${idx + 1}`,
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

      const keyA = (m.teamA || '').trim().toLowerCase();
      const keyB = (m.teamB || '').trim().toLowerCase();

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
   * Gera os confrontos do Mata-Mata a partir da classificação final da fase de grupos.
   * @param {Array} standings Tabela de classificação
   * @returns {Array} Lista de jogos de Mata-Mata (Semifinais)
   */
  generateKnockoutMatches(standings) {
    if (!Array.isArray(standings) || standings.length < 2) return [];

    const knockoutMatches = [];

    if (standings.length >= 4) {
      // 4 ou mais times: 1º x 4º e 2º x 3º
      knockoutMatches.push({
        id: `torneio_sf1_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal 1',
        numeroJogo: 1,
        teamA: standings[0].nome,
        teamB: standings[3].nome,
        teamAObj: { nome: standings[0].nome, emblema: standings[0].emblema, cor: standings[0].cor },
        teamBObj: { nome: standings[3].nome, emblema: standings[3].emblema, cor: standings[3].cor },
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
        faseNome: 'Semifinal 2',
        numeroJogo: 2,
        teamA: standings[1].nome,
        teamB: standings[2].nome,
        teamAObj: { nome: standings[1].nome, emblema: standings[1].emblema, cor: standings[1].cor },
        teamBObj: { nome: standings[2].nome, emblema: standings[2].emblema, cor: standings[2].cor },
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
    } else if (standings.length === 3) {
      // 3 times: 1º vai direto pra final, 2º x 3º jogam semifinal
      knockoutMatches.push({
        id: `torneio_sf1_${Date.now().toString(36)}`,
        fase: 'semifinal',
        faseNome: 'Semifinal',
        numeroJogo: 1,
        teamA: standings[1].nome,
        teamB: standings[2].nome,
        teamAObj: { nome: standings[1].nome, emblema: standings[1].emblema, cor: standings[1].cor },
        teamBObj: { nome: standings[2].nome, emblema: standings[2].emblema, cor: standings[2].cor },
        golsA: null,
        golsB: null,
        status: 'agendado',
        vencedor: null,
        penaltisA: null,
        penaltisB: null
      });
    }

    return knockoutMatches;
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
    } else if (standings.length >= 4 && !terceiro) {
      terceiro = standings[2] ? standings[2].nome : null;
      quarto   = standings[3] ? standings[3].nome : null;
    }

    return { primeiro, segundo, terceiro, quarto };
  }

};
