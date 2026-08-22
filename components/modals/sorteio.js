// ==========================================================================
// MODAL: SORTEIO (sorteio.js)
// ==========================================================================

window.App.initModalSorteio = function () {
  document.getElementById("btn-close-sorteio-modal").onclick = window.App.closeModal;
  document.getElementById("btn-execute-sorteio").onclick = handleExecuteSorteio;

  // Sincroniza o modo de torneio ativo da pelada com o seletor do modal
  const modalSelectModo = document.getElementById("modal-select-pelada-modo");
  const activePelada = window.App.activePelada || {};
  if (modalSelectModo) {
    modalSelectModo.innerHTML = `
      <option value="normal">Pelada Normal (Reina Campo)</option>
      <option value="torneio">Mini Torneio (Misto: Tabela + Mata-Mata)</option>
      <option value="pontos_corridos">Mini Torneio (Pontos Corridos)</option>
      <option value="mata_mata_direto">Mini Torneio (Mata-Mata Direto)</option>
      <option value="torneio_livre">Torneio Livre (Confrontos Manuais)</option>
    `;
    if (activePelada.modo) {
      modalSelectModo.value = activePelada.modo;
    }
  }

  // --- Lógica do Seletor de Nomes Cadastrados para a Pelada (Vindo do Banco PostgreSQL) ---
  const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  const groupId = currentGroup ? currentGroup.id : null;
  const selectedNamesKey = groupId ? `customTeamNames_${groupId}` : 'customTeamNames';

  let dbTeamCatalog = [];

  const getSavedSelectedNames = () => {
    try {
      return JSON.parse(localStorage.getItem(selectedNamesKey)) || JSON.parse(localStorage.getItem('customTeamNames')) || [];
    } catch(e) {
      return [];
    }
  };

  const getMergedCatalog = () => {
    const list = [];
    const seen = new Set();

    // 1. Nomes vindos do banco de dados (nomes_times_grupo)
    if (Array.isArray(dbTeamCatalog) && dbTeamCatalog.length > 0) {
      dbTeamCatalog.forEach(item => {
        const n = (typeof item === 'object' ? item.nome : item || '').trim();
        if (n && !seen.has(n.toLowerCase())) {
          seen.add(n.toLowerCase());
          list.push(n);
        }
      });
    }

    // 2. Fallbacks padrão caso não haja registros
    const DEFAULT_CATALOG = ["Time A", "Time B", "Time C", "Time D", "Time E", "Time F", "Laranja", "Azul", "Branco", "Preto"];
    DEFAULT_CATALOG.forEach(n => {
      if (!seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        list.push(n);
      }
    });

    return list;
  };

  const renderTeamSelects = () => {
    const listContainer = document.getElementById("sorteio-teams-select-list");
    const modalSelectQtd = document.getElementById("modal-select-qtd-times");
    if (!listContainer || !modalSelectQtd) return;

    const qtyTeams = parseInt(modalSelectQtd.value) || 4;
    const catalog = getMergedCatalog();
    const savedSelected = getSavedSelectedNames();

    let html = '';
    for (let i = 0; i < qtyTeams; i++) {
      const defaultVal = savedSelected[i] || catalog[i] || `Time ${String.fromCharCode(65 + i)}`;
      if (!catalog.includes(defaultVal)) {
        catalog.push(defaultVal);
      }

      const optionsHtml = catalog.map(name => {
        const isSelected = name === defaultVal ? 'selected' : '';
        return `<option value="${name}" ${isSelected}>${name}</option>`;
      }).join('');

      html += `
        <div style="display: flex; align-items: center; gap: 10px; background: #FFFFFF; padding: 8px 12px; border-radius: 8px; border: 1.5px solid #E2E8F0;">
          <span style="font-size: 13px; font-weight: 800; color: #1E293B; min-width: 75px; flex-shrink: 0;">Equipe ${i + 1}:</span>
          <select class="sorteio-team-name-select" data-team-index="${i}" style="width: 100%; height: 40px; line-height: 1.4; padding: 6px 12px; font-size: 14px; font-weight: 700; color: #0F172A; background-color: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 6px; box-sizing: border-box; outline: none; cursor: pointer;">
            ${optionsHtml}
          </select>
        </div>
      `;
    }
    listContainer.innerHTML = html;
  };

  renderTeamSelects();

  // Carrega assincronamente os nomes do banco PostgreSQL
  if (window.Api && window.Api.getCatalogoTimes) {
    window.Api.getCatalogoTimes(groupId).then(dbItems => {
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        dbTeamCatalog = dbItems;
        renderTeamSelects();
      }
    }).catch(() => {});
  }

  if (modalSelectQtd) {
    modalSelectQtd.onchange = renderTeamSelects;
  }
};

function handleExecuteSorteio() {
  const checkedRadio = document.querySelector('input[name="sorteio-type"]:checked');
  const type = checkedRadio ? checkedRadio.value : "todos";

  // Salva os nomes de times selecionados dos selects do modal antes de rodar o draft
  const selectElements = document.querySelectorAll('.sorteio-team-name-select');
  if (selectElements && selectElements.length > 0) {
    const selectedNames = Array.from(selectElements).map(s => s.value.trim()).filter(Boolean);
    const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    const groupId = currentGroup ? currentGroup.id : null;
    try {
      if (groupId) localStorage.setItem(`customTeamNames_${groupId}`, JSON.stringify(selectedNames));
      localStorage.setItem('customTeamNames', JSON.stringify(selectedNames));
    } catch(e) {}
  }

  window.App.closeModal();

  const players = JSON.parse(localStorage.getItem("players")) || [];

  // Obter configurações específicas da pelada/data selecionada (ou do grupo ativo como fallback)
  const peladaAtiva = window.App.activePelada || {};
  const grupoAtivo = window.App.currentGroup || {};

  let playersPerTeam = parseInt(peladaAtiva.jogadores_por_time || grupoAtivo.jogadores_por_time || 6);
  if (isNaN(playersPerTeam) || playersPerTeam <= 0) playersPerTeam = 6;

  const modalSelectQtd = document.getElementById("modal-select-qtd-times");
  let maxTeams = modalSelectQtd ? parseInt(modalSelectQtd.value) : parseInt(peladaAtiva.quantidade_times || grupoAtivo.quantidade_times || 4);
  if (isNaN(maxTeams) || maxTeams <= 0) maxTeams = 4;

  window.App.activePelada.quantidade_times = maxTeams;
  localStorage.setItem("activePelada", JSON.stringify(window.App.activePelada));
  if (peladaAtiva.id && window.Api && window.Api.atualizarConfigPartida) {
    window.Api.atualizarConfigPartida(peladaAtiva.id, { quantidade_times: maxTeams });
  }

  // Filtra apenas jogadores que o gestor marcou manualmente como presentes (check-in ativo)
  const activePresent = players.filter(p => {
    return (window.App.presentPlayers || []).some(id => String(id) === String(p.id));
  });

  if (activePresent.length < 2) {
    window.App.showToast("Número insuficiente de jogadores para o sorteio.", "error");
    return;
  }

  let qtyTeams = maxTeams; // Padrão Sorteio A (cria todos os times configurados)
  let selectedPlayers = [...activePresent];
  let waitingQueue = [];

  if (type === "necessarios") {
    // SORTEIO B:
    // Pega o número de presentes e divide pelo número de atletas configurado por time
    const qtyTeamsNeeded = Math.ceil(activePresent.length / playersPerTeam);

    if (qtyTeamsNeeded > maxTeams) {
      qtyTeams = maxTeams;
      const totalCapacity = qtyTeams * playersPerTeam;

      // Ordena por habilidade com fator randômico em caso de empates para ser justo
      const sortedBySkill = [...activePresent].sort((a, b) => {
        if (b.autoavaliacao === a.autoavaliacao) return Math.random() - 0.5;
        return b.autoavaliacao - a.autoavaliacao;
      });

      selectedPlayers = sortedBySkill.slice(0, totalCapacity);
      waitingQueue = sortedBySkill.slice(totalCapacity).map(p => p.nome);
    } else {
      qtyTeams = Math.max(1, isNaN(qtyTeamsNeeded) ? 1 : qtyTeamsNeeded);
    }
  }

  // Definir vagas máximas permitidas por time no sorteio
  let vagasPorTime = [];
  for (let i = 0; i < qtyTeams; i++) {
    if (type === "necessarios") {
      // Sorteio B:
      if (i === qtyTeams - 1) {
        // O último time fica com a sobra
        vagasPorTime.push(selectedPlayers.length - (qtyTeams - 1) * playersPerTeam);
      } else {
        // Os primeiros times preenchem completamente com a capacidade por time
        vagasPorTime.push(playersPerTeam);
      }
    } else {
      // Sorteio A:
      // Divide todos os presentes o mais igualmente possível por todos os times configurados
      const base = Math.floor(selectedPlayers.length / qtyTeams);
      const rest = selectedPlayers.length % qtyTeams;
      vagasPorTime.push(base + (i < rest ? 1 : 0));
    }
  }

  // Separa goleiros e jogadores de linha
  const gkList = selectedPlayers.filter(p => p.goleiro);
  let fieldList = selectedPlayers.filter(p => !p.goleiro);

  let drawnTeams = [];
  const teamColors = ["#2196F3", "#FFC107", "#FF1744", "#00C853", "#FF6D00", "#9C27B0", "#E91E63", "#00BCD4", "#795548", "#607D8B"];
  const groupEmblems = window._groupEmblemsList || [];

  // Busca nomes de times cadastrados pelo gestor
  let customNames = [];
  try {
    const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    const groupId = currentGroup ? currentGroup.id : null;
    customNames = JSON.parse(localStorage.getItem(`customTeamNames_${groupId}`)) || JSON.parse(localStorage.getItem('customTeamNames')) || [];
  } catch(e) {}

  const usedNames = new Set();
  for (let i = 0; i < qtyTeams; i++) {
    let customName = (customNames && customNames[i] && String(customNames[i]).trim()) ? String(customNames[i]).trim() : `Time ${getColoName(i)}`;
    let baseName = customName;
    let counter = 2;
    while (usedNames.has(customName.toLowerCase())) {
      customName = `${baseName} ${counter}`;
      counter++;
    }
    usedNames.add(customName.toLowerCase());

    const teamObj = {
      id: `team_${i + 1}`,
      nome: customName,
      cor: teamColors[i] || "#777",
      emblema: i % 10,
      players: []
    };
    if (Array.isArray(groupEmblems) && groupEmblems.length > 0) {
      const embItem = groupEmblems[i % groupEmblems.length];
      if (embItem && embItem.imagem_url) {
        teamObj.emblema_url = embItem.imagem_url;
        teamObj.emblemaUrl = embItem.imagem_url;
      }
    }
    drawnTeams.push(teamObj);
  }

  // =========================================================================
  // NOVO ALGORITMO: SIMULAÇÃO COM 20 CANDIDATOS + SNAKE DRAFT + PENALIDADE DE HISTÓRICO
  // =========================================================================
  const pesoEquilibrio = 3;
  const pesoRepeticao = 1;

  // Carrega histórico de pares de sorteios anteriores deste grupo para evitar repetições
  const historyKey = groupId ? `teamPairsHistory_${groupId}` : 'teamPairsHistory';
  let pairHistory = {};
  try {
    pairHistory = JSON.parse(localStorage.getItem(historyKey)) || {};
  } catch (e) {
    pairHistory = {};
  }

  // Função auxiliar para calcular repetições de pares entre atletas no mesmo time
  const calcularRepeticaoPares = (teamsList) => {
    let score = 0;
    teamsList.forEach(t => {
      const pIds = t.players.map(p => String(p.id));
      for (let a = 0; a < pIds.length; a++) {
        for (let b = a + 1; b < pIds.length; b++) {
          const pairKey = pIds[a] < pIds[b] ? `${pIds[a]}_${pIds[b]}` : `${pIds[b]}_${pIds[a]}`;
          if (pairHistory[pairKey]) {
            score += pairHistory[pairKey];
          }
        }
      }
    });
    return score;
  };

  // Função auxiliar para calcular a diferença máxima de força (soma de autoavaliação) entre os times
  const calcularForcaTotal = (t) => {
    return t.players.reduce((sum, p) => sum + (parseInt(p.autoavaliacao) || 3), 0);
  };

  const calcularScoreEquilibrio = (teamsList) => {
    if (teamsList.length <= 1) return 0;
    const forcas = teamsList.map(calcularForcaTotal);
    const maxF = Math.max(...forcas);
    const minF = Math.min(...forcas);
    return maxF - minF;
  };

  // Função para executar UMA simulação de sorteio
  const gerarCandidatoSorteio = () => {
    // Clona a estrutura básica de times
    const simTeams = drawnTeams.map(t => ({
      ...t,
      players: []
    }));

    // 1. Restrição de Goleiros: um por time, embaralhados
    const shuffledGks = shuffleArray([...gkList]);
    shuffledGks.forEach((gk) => {
      const timeDisponivel = simTeams.find((t, idx) => {
        const hasGk = t.players.some(p => p.goleiro);
        return !hasGk && t.players.length < vagasPorTime[idx];
      });
      if (timeDisponivel) {
        timeDisponivel.players.push(gk);
      } else {
        const timeQualquer = simTeams.find((t, idx) => t.players.length < vagasPorTime[idx]);
        if (timeQualquer) {
          timeQualquer.players.push(gk);
        }
      }
    });

    // 2. Ordena jogadores de linha por habilidade (5★ → 1★)
    let ordenados = [...fieldList].sort((a, b) => {
      const notaA = parseInt(a.autoavaliacao) || 3;
      const notaB = parseInt(b.autoavaliacao) || 3;
      if (notaB === notaA) return Math.random() - 0.5;
      return notaB - notaA;
    });

    // 3. Snake Draft com Aleatoriedade Controlada (Pool de força similar: próximos 2 a 3)
    let serpenteDirection = 1;
    let currentTeamIdx = 0;

    while (ordenados.length > 0) {
      // Pega pool dos próximos 2 a 3 de força similar
      const poolSize = Math.min(ordenados.length, Math.max(2, Math.min(3, qtyTeams)));
      const poolIdx = Math.floor(Math.random() * poolSize);
      const escolhido = ordenados.splice(poolIdx, 1)[0];

      let found = false;
      let startIdx = currentTeamIdx;

      while (!found) {
        const team = simTeams[currentTeamIdx];
        const maxVagas = vagasPorTime[currentTeamIdx];

        if (team.players.length < maxVagas) {
          team.players.push(escolhido);
          found = true;
        }

        // Alterna ordem na serpentina
        currentTeamIdx += serpenteDirection;
        if (currentTeamIdx >= qtyTeams) {
          currentTeamIdx = qtyTeams - 1;
          serpenteDirection = -1;
        } else if (currentTeamIdx < 0) {
          currentTeamIdx = 0;
          serpenteDirection = 1;
        }

        // Fallback de segurança contra time cheio
        if (!found && currentTeamIdx === startIdx) {
          const timeLivre = simTeams.find((t, idx) => t.players.length < vagasPorTime[idx]);
          if (timeLivre) timeLivre.players.push(escolhido);
          found = true;
        }
      }
    }

    // Refinamento fino por trocas de menor impacto
    balanceDrawnTeams(simTeams);

    const diffForca = calcularScoreEquilibrio(simTeams);
    const repeticoes = calcularRepeticaoPares(simTeams);
    const totalScore = (pesoEquilibrio * diffForca) + (pesoRepeticao * repeticoes);

    return {
      teams: simTeams,
      score: totalScore,
      diffForca,
      repeticoes
    };
  };

  // Executa 20 simulações e escolhe a melhor combinação (menor score)
  let melhoresCandidatos = [];
  for (let tentativa = 1; tentativa <= 20; tentativa++) {
    melhoresCandidatos.push(gerarCandidatoSorteio());
  }

  // Ordena pelo menor score ponderado
  melhoresCandidatos.sort((a, b) => a.score - b.score);
  const melhorCandidato = melhoresCandidatos[0];
  drawnTeams = melhorCandidato.teams;

  // 4. Registra no histórico os pares sorteados para evitar repetições em futuros sorteios
  drawnTeams.forEach(t => {
    const pIds = t.players.map(p => String(p.id));
    for (let a = 0; a < pIds.length; a++) {
      for (let b = a + 1; b < pIds.length; b++) {
        const pairKey = pIds[a] < pIds[b] ? `${pIds[a]}_${pIds[b]}` : `${pIds[b]}_${pIds[a]}`;
        pairHistory[pairKey] = (pairHistory[pairKey] || 0) + 1;
      }
    }
  });

  try {
    localStorage.setItem(historyKey, JSON.stringify(pairHistory));
  } catch (e) {}

  console.log(`[Sorteio Inteligente] Melhor de 20 simulações escolhido! Diferença de força: ${melhorCandidato.diffForca}★ | Repetições históricas: ${melhorCandidato.repeticoes}`);

  // Salvar no localStorage local de forma segura usando a chave específica por data/pelada e a genérica
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  const teamsKey = peladaId ? `teams_${peladaId}` : "teams";

  // Enxuga: remove emblemas e fotos base64 dos times — só o essencial para o sorteio
  const teamsParaSalvar = drawnTeams.map(t => {
    const copia = { ...t };
    delete copia.emblema_url;
    delete copia.emblemaUrl;
    copia.players = t.players.map(p => {
      const leve = { ...p };
      delete leve.foto;          // foto base64 pesada
      delete leve.emblema_url;
      delete leve.emblemaUrl;
      return leve;
    });
    return copia;
  });

  try {
    localStorage.setItem(teamsKey, JSON.stringify(teamsParaSalvar));
  } catch (e) {
    console.error("[Sorteio] Falha ao salvar times:", e);
    window.App.showToast("Erro ao salvar os times: " + (e && e.message ? e.message : e), "error");
    return;
  }

  // Cópia genérica (fallback para outras telas): melhor esforço, NÃO bloqueia o sorteio se falhar
  try { localStorage.setItem("teams", JSON.stringify(teamsParaSalvar)); } catch (e) { }
  window.App.teams = teamsParaSalvar;

  // Reset e alimentação da fila de espera global
  window.App.waitingQueue.length = 0;

  if (type === "necessarios" && waitingQueue.length > 0) {
    window.App.waitingQueue.push(...waitingQueue);
  } else {
    // Para Sorteio A ou Sorteio B sem excedentes imediatos, os times adicionais (a partir do 3º) entram na fila de espera inicial
    drawnTeams.forEach((t, idx) => {
      if (idx >= 2) {
        window.App.waitingQueue.push(t.nome);
      }
    });
  }

  const modalSelectModo = document.getElementById("modal-select-pelada-modo");
  const selectModo = document.getElementById("select-pelada-modo");
  const selectTurno = document.getElementById("select-pelada-turno");
  const modoAtual = (modalSelectModo && modalSelectModo.value) ? modalSelectModo.value : ((selectModo && selectModo.value) ? selectModo.value : ((peladaAtiva && peladaAtiva.modo) || 'normal'));
  const turnoAtual = (selectTurno && selectTurno.value) ? selectTurno.value : ((peladaAtiva && peladaAtiva.turno_torneio) || 'ida');
  
  if (selectModo) selectModo.value = modoAtual;
  if (peladaAtiva) {
    peladaAtiva.modo = modoAtual;
    peladaAtiva.turno_torneio = turnoAtual;
    try { localStorage.setItem("activePelada", JSON.stringify(peladaAtiva)); } catch(e) {}
  }

  const isTorneio = modoAtual === 'torneio' || modoAtual === 'pontos_corridos' || modoAtual === 'torneio_pontos_corridos' || modoAtual === 'mata_mata_direto' || modoAtual === 'torneio_livre';
  const isPontosCorridos = modoAtual === 'pontos_corridos' || modoAtual === 'torneio_pontos_corridos';
  const isMataMataDireto = modoAtual === 'mata_mata_direto';
  const isTorneioLivre = modoAtual === 'torneio_livre';

  if (isTorneio && window.TournamentEngine) {
    let tState;
    if (isTorneioLivre) {
      const standings = window.TournamentEngine.calculateStandings(drawnTeams, []);
      tState = {
        modo: modoAtual,
        formato: 'livre',
        turno: 'livre',
        fase: 'livre',
        teams: drawnTeams,
        matches: [],
        currentIndex: 0,
        standings: standings,
        knockoutMatches: [],
        finalsMatches: [],
        podium: null
      };

      if (drawnTeams.length >= 2) {
        window.App.liveMatch.teamA = drawnTeams[0].nome;
        window.App.liveMatch.teamB = drawnTeams[1].nome;
        window.App.liveMatch.scoreA = 0;
        window.App.liveMatch.scoreB = 0;
        window.App.liveMatch.isPlaying = false;
        window.App.liveMatch.tournamentMatchId = `livre_${Date.now().toString(36)}`;
      }
    } else if (isMataMataDireto) {
      const knockoutMatches = window.TournamentEngine.generateDirectKnockoutMatches(drawnTeams);
      const isFinalDirect = knockoutMatches.length === 1 && knockoutMatches[0].fase === 'final';
      tState = {
        modo: modoAtual,
        formato: 'mata_mata_direto',
        turno: 'ida',
        fase: isFinalDirect ? 'finais' : 'mata_mata',
        teams: drawnTeams,
        matches: [],
        currentIndex: 0,
        standings: [],
        knockoutMatches: isFinalDirect ? [] : knockoutMatches,
        finalsMatches: isFinalDirect ? knockoutMatches : [],
        podium: null
      };

      const firstMatch = isFinalDirect ? tState.finalsMatches[0] : tState.knockoutMatches[0];
      if (firstMatch) {
        window.App.liveMatch.teamA = firstMatch.teamA;
        window.App.liveMatch.teamB = firstMatch.teamB;
        window.App.liveMatch.scoreA = 0;
        window.App.liveMatch.scoreB = 0;
        window.App.liveMatch.isPlaying = false;
        window.App.liveMatch.tournamentMatchId = firstMatch.id;
      }
    } else {
      const matches = window.TournamentEngine.generateGroupSchedule(drawnTeams, turnoAtual);
      const standings = window.TournamentEngine.calculateStandings(drawnTeams, matches);
      tState = {
        modo: modoAtual,
        formato: isPontosCorridos ? 'pontos_corridos' : 'mata_mata',
        turno: turnoAtual,
        fase: 'grupo',
        teams: drawnTeams,
        matches: matches,
        currentIndex: 0,
        standings: standings,
        knockoutMatches: [],
        finalsMatches: [],
        podium: null
      };

      if (matches.length > 0) {
        window.App.liveMatch.teamA = matches[0].teamA;
        window.App.liveMatch.teamB = matches[0].teamB;
        window.App.liveMatch.scoreA = 0;
        window.App.liveMatch.scoreB = 0;
        window.App.liveMatch.isPlaying = false;
        window.App.liveMatch.tournamentMatchId = matches[0].id;
      }
    }

    window.App.liveMatch.tournamentState = tState;
    try { localStorage.setItem("tournamentState", JSON.stringify(tState)); } catch(e) {}
    if (peladaId) {
      try { localStorage.setItem(`tournamentState_${peladaId}`, JSON.stringify(tState)); } catch(e) {}
    }
  } else {
    // Modo Pelada Normal
    window.App.liveMatch.tournamentState = null;
    try { localStorage.removeItem("tournamentState"); } catch(e) {}
    if (peladaId) {
      try { localStorage.removeItem(`tournamentState_${peladaId}`); } catch(e) {}
    }
    // Carregar os 2 primeiros times na partida ativa
    if (drawnTeams.length >= 2) {
      window.App.liveMatch.teamA = drawnTeams[0].nome;
      window.App.liveMatch.teamB = drawnTeams[1].nome;
      window.App.liveMatch.scoreA = 0;
      window.App.liveMatch.scoreB = 0;
      window.App.liveMatch.isPlaying = false;
    }
  }

  const teamAEl = document.getElementById("match-control-team-a");
  const teamBEl = document.getElementById("match-control-team-b");
  const scoreAEl = document.getElementById("match-control-score-a");
  const scoreBEl = document.getElementById("match-control-score-b");

  if (teamAEl) teamAEl.textContent = window.App.liveMatch.teamA;
  if (teamBEl) teamBEl.textContent = window.App.liveMatch.teamB;
  if (scoreAEl) scoreAEl.textContent = "0";
  if (scoreBEl) scoreBEl.textContent = "0";

  // Persiste imediatamente a fila, o jogo ao vivo e os times sorteados no localStorage e no servidor
  if (window.App && window.App.safeLocalStorageSetItem) {
    window.App.safeLocalStorageSetItem("liveMatch", JSON.stringify(window.App.liveMatch));
    window.App.safeLocalStorageSetItem("waitingQueue", JSON.stringify(window.App.waitingQueue));
  } else {
    try { localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch)); } catch (e) { }
    try { localStorage.setItem("waitingQueue", JSON.stringify(window.App.waitingQueue)); } catch (e) { }
  }

  if (peladaId && window.App && window.App.syncDrawnTeamsToCloud) {
    // Dispara o sync com a versão leve (sem fotos) já salva no localStorage
    window.App.syncDrawnTeamsToCloud(false);
  }

  let toastMsg = "Equipes geradas!";
  if (isTorneioLivre) toastMsg = "📋 Torneio Livre (Confrontos Manuais) gerado com sucesso!";
  else if (isMataMataDireto) toastMsg = "⚡ Mini Torneio (Mata-Mata Direto) gerado com sucesso!";
  else if (isPontosCorridos) toastMsg = "🏅 Mini Torneio (Pontos Corridos) gerado com sucesso!";
  else if (modoAtual === 'torneio') toastMsg = "🏆 Mini Torneio (Misto) gerado com sucesso!";
  window.App.showToast(toastMsg);
  window.App.renderDrawnTeams();
  window.App.updateAcompanhamentoUI();
}

function getColoName(idx) {
  const names = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
  return names[idx] || `${idx + 1}`;
}

function balanceDrawnTeams(drawnTeams) {
  let attempts = 0;
  const getAverage = (team) => {
    if (team.players.length === 0) return 0;
    return team.players.reduce((sum, p) => sum + p.autoavaliacao, 0) / team.players.length;
  };

  while (attempts < 15) {
    let minTeam = drawnTeams[0];
    let maxTeam = drawnTeams[0];

    drawnTeams.forEach(t => {
      if (getAverage(t) < getAverage(minTeam)) minTeam = t;
      if (getAverage(t) > getAverage(maxTeam)) maxTeam = t;
    });

    const diff = getAverage(maxTeam) - getAverage(minTeam);
    if (diff <= 0.5) break;

    let swapped = false;
    const maxPlayers = maxTeam.players.filter(p => !p.goleiro);
    const minPlayers = minTeam.players.filter(p => !p.goleiro);

    for (let pMax of maxPlayers) {
      for (let pMin of minPlayers) {
        if (pMax.autoavaliacao > pMin.autoavaliacao) {
          const idxMax = maxTeam.players.indexOf(pMax);
          const idxMin = minTeam.players.indexOf(pMin);

          maxTeam.players[idxMax] = pMin;
          minTeam.players[idxMin] = pMax;

          const newDiff = getAverage(maxTeam) - getAverage(minTeam);
          if (newDiff < diff) {
            swapped = true;
            break;
          } else {
            maxTeam.players[idxMax] = pMax;
            minTeam.players[idxMin] = pMin;
          }
        }
      }
      if (swapped) break;
    }

    if (!swapped) break;
    attempts++;
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
