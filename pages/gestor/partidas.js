// ==========================================================================
// PÁGINA: GESTOR - PARTIDAS E JOGO AO VIVO (partidas.js)
// ==========================================================================

var timerInterval = null;

// --- Helpers de Armazenamento Seguro contra QuotaExceededError ---
function safeLocalStorageSetItem(key, value) {
  try {
    let stringVal = typeof value === 'string' ? value : JSON.stringify(value);

    // Remove imagens pesadas em Base64 se presentes para economizar espaço
    if (typeof value === 'object' && value !== null) {
      const sanitized = JSON.parse(JSON.stringify(value, (k, v) => {
        if (typeof v === 'string' && (v.startsWith('data:image/') || v.length > 100000)) return undefined;
        return v;
      }));
      stringVal = JSON.stringify(sanitized);
    }

    // Não grava se o payload exceder 4MB
    if (stringVal.length > 4 * 1024 * 1024) {
      console.warn(`[Storage] Payload para ${key} excede 4MB. Ignorando escrita no localStorage.`);
      return false;
    }

    localStorage.setItem(key, stringVal);
    return true;
  } catch (e) {
    console.warn(`[Storage] QuotaExceededError ou erro ao gravar ${key}:`, e);
    return false;
  }
}

function safeLocalStorageGetItem(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[Storage] Erro ao ler/parsear ${key} do localStorage:`, e);
    return fallback;
  }
}

function getTournamentActiveMatch(tState, currentMatchId) {
  if (!tState) return null;

  const fase = tState.fase || 'grupo';
  let phaseList = [];
  if (fase === 'grupo') phaseList = tState.matches || [];
  else if (fase === 'quartas' || fase === 'mata_mata') phaseList = tState.knockoutMatches || [];
  else if (fase === 'finais') phaseList = tState.finalsMatches || [];

  // 1. Busca por ID exato na lista da fase ativa
  if (currentMatchId) {
    const match = phaseList.find(m => m.id === currentMatchId);
    if (match) return match;
  }

  // 2. Busca a primeira partida não encerrada da fase ativa
  const activeInPhase = phaseList.find(m => m.status !== 'encerrado');
  if (activeInPhase) return activeInPhase;

  // 3. Se todas da fase atual estiverem encerradas e a fase precisar transicionar:
  if (fase === 'grupo') {
    const allGroupDone = (tState.matches || []).length > 0 && tState.matches.every(m => m.status === 'encerrado');
    if (allGroupDone) {
      if (window.TournamentEngine && tState.standings) {
        const knockoutMatches = window.TournamentEngine.generateKnockoutMatches(tState.standings);
        const firstPhase = (knockoutMatches[0] && knockoutMatches[0].fase) || 'semifinal';
        if (firstPhase === 'quartas') {
          tState.fase = 'quartas';
          tState.knockoutMatches = knockoutMatches;
        } else if (firstPhase === 'final') {
          tState.fase = 'finais';
          tState.finalsMatches = knockoutMatches;
        } else {
          tState.fase = 'mata_mata';
          tState.knockoutMatches = knockoutMatches;
        }
      }
      const targetList = (tState.fase === 'finais' ? tState.finalsMatches : tState.knockoutMatches) || [];
      return targetList.find(m => m.status !== 'encerrado') || targetList[0];
    }
  } else if (fase === 'quartas') {
    const allQfDone = (tState.knockoutMatches || []).length > 0 && tState.knockoutMatches.every(m => m.status === 'encerrado');
    if (allQfDone) {
      tState.fase = 'mata_mata';
      if (window.TournamentEngine) {
        tState.knockoutMatches = window.TournamentEngine.generateSemifinalsFromQuartas(tState.knockoutMatches, tState.standings || tState.teams);
      }
      return (tState.knockoutMatches || []).find(m => m.status !== 'encerrado') || (tState.knockoutMatches || [])[0];
    }
  } else if (fase === 'mata_mata') {
    const allKnockoutDone = (tState.knockoutMatches || []).length > 0 && tState.knockoutMatches.every(m => m.status === 'encerrado');
    if (allKnockoutDone) {
      tState.fase = 'finais';
      if ((!tState.finalsMatches || tState.finalsMatches.length === 0) && window.TournamentEngine) {
        tState.finalsMatches = window.TournamentEngine.generateFinalsMatches(tState.knockoutMatches, tState.standings || tState.teams);
      }
      return (tState.finalsMatches || []).find(m => m.status !== 'encerrado') || (tState.finalsMatches || [])[0];
    }
  }

  return null;
}

function limparCachesAntigos() {
  try {
    const currentPeladaId = (window.App && window.App.activePelada) ? String(window.App.activePelada.id) : null;
    if (!currentPeladaId) return;

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Remove apenas chaves temporárias antigas de liveMatch que não pertencem à pelada ativa (NUNCA remove times sorteados)
      if (key.startsWith("liveMatch_") && !key.endsWith("_" + currentPeladaId)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) { }
    });

    if (keysToRemove.length > 0) {
      console.log(`🧹 [Storage] Limpeza preventiva executada. Removidas ${keysToRemove.length} chaves de liveMatch antigas.`);
    }
  } catch (e) {
    console.warn("[Storage] Erro em limparCachesAntigos:", e);
  }
}

// Centraliza a criação do loop de contagem regressiva.
// Garante que jamais coexistam dois intervalos ao mesmo tempo.
function startTimerLoop() {
  // Mata qualquer intervalo anterior antes de criar um novo
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const btn = document.getElementById("btn-timer-toggle");

  timerInterval = setInterval(() => {
    if (!window.App.liveMatch.isPlaying) {
      // Se o estado mudou para pausado (ex: resetLiveTimer chamou clearInterval mas
      // algum tick já estava enfileirado), simplesmente ignora.
      return;
    }

    if (window.App.liveMatch.timerSeconds > 0) {
      window.App.liveMatch.timerSeconds--;
      saveLiveMatchState();
      updateTimerDisplay();
    } else {
      // Tempo esgotado
      clearInterval(timerInterval);
      timerInterval = null;
      window.App.liveMatch.isPlaying = false;

      // Restaura o tempo configurado para a próxima partida
      const groupConfigs = window.Api.getConfigs() || [];
      const currentGrp = window.Auth.currentGroup;
      const grpCfg = currentGrp ? groupConfigs.find(c => c.grupo_id === currentGrp.id) : null;
      const durationMin = grpCfg ? (grpCfg.tempo_partida || 8) : 8;
      window.App.liveMatch.timerSeconds = durationMin * 60;

      if (btn) {
        btn.textContent = "Iniciar";
        btn.className = "btn btn-sm btn-primary";
      }

      playAlarmSound();
      saveLiveMatchState();
      updateTimerDisplay();
      renderLiveMatchUI();
      window.App.showToast("Tempo Encerrado!", "success");
    }
  }, 1000);
}

window.App.initPartidas = async function () {
  limparCachesAntigos();
  await initPartidasPeladaSelect();

  // Resolve a pelada ativa imediatamente se estiver nula
  let peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (!peladaId) {
    try {
      const raw = localStorage.getItem("activePelada");
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.id) {
          peladaId = obj.id;
          window.App.activePelada = obj;
        }
      }
    } catch (e) { }
  }
  if (!peladaId) {
    const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    if (currentGroup && currentGroup.id && window.Api && window.Api.listarDatasDoGrupo) {
      try {
        const peladas = await window.Api.listarDatasDoGrupo(currentGroup.id);
        if (Array.isArray(peladas) && peladas.length > 0) {
          const activeP = peladas.find(p => p.status !== 'finalizada') || peladas[0];
          if (activeP) {
            peladaId = activeP.id;
            window.App.activePelada = activeP;
            localStorage.setItem("activePelada", JSON.stringify(activeP));
          }
        }
      } catch (e) { }
    }
  }

  // Busca imediatamente o liveState do servidor para obter a fila de espera antes de renderizar
  if (peladaId) {
    await carregarLiveStateDaPelada(peladaId);
  }

  applyAthleteTeamStyleToPartidasCards();

  const activePelada = window.App.activePelada || {};
  const isFinished = activePelada.status === "finalizada";

  const timerContainer = document.getElementById('gestor-timer-container');
  const scoreboardContainer = document.getElementById('gestor-scoreboard-container');
  const statusBadge = document.getElementById('match-live-status-badge');
  const queueCard = document.getElementById('gestor-queue-card');
  let finishedBanner = document.getElementById('gestor-finished-banner');

  // Se a pelada estiver finalizada, oculta controles de jogo ao vivo mas preserva o seletor de datas
  if (isFinished) {
    if (timerContainer) timerContainer.style.display = 'none';
    if (scoreboardContainer) scoreboardContainer.style.display = 'none';
    if (statusBadge) {
      statusBadge.textContent = 'FINALIZADA';
      statusBadge.style.background = '#D1FAE5';
      statusBadge.style.color = '#065F46';
    }
    if (queueCard) queueCard.style.display = 'none';

    if (!finishedBanner) {
      finishedBanner = document.createElement('div');
      finishedBanner.id = 'gestor-finished-banner';
      finishedBanner.style.cssText = 'background-color: #10B981; color: #FFF; border-radius: 12px; padding: 24px; text-align: center; margin-top: 14px;';
      finishedBanner.innerHTML = `
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">🏁</span>
        <h3 style="color: #FFF; margin-bottom: 6px; font-size: 18px;">Rodada Finalizada</h3>
        <p class="text-inter" style="font-size: 13px; opacity: 0.95; margin: 0;">Esta rodada de pelada foi concluída e encerrada. Selecione outra data no menu acima ou confira o histórico abaixo.</p>
      `;
      const liveCol = document.querySelector('.gestor-score-card');
      if (liveCol) liveCol.appendChild(finishedBanner);
    } else {
      finishedBanner.style.display = 'block';
    }
  } else {
    if (finishedBanner) finishedBanner.style.display = 'none';
    if (timerContainer) timerContainer.style.display = 'block';
    if (scoreboardContainer) scoreboardContainer.style.display = 'block';
    if (queueCard) queueCard.style.display = 'block';

    // Escutas dos controles de Cronômetro e Jogo
    const btnToggle = document.getElementById("btn-timer-toggle");
    if (btnToggle) btnToggle.onclick = toggleLiveTimer;

    const btnReset = document.getElementById("btn-timer-reset");
    if (btnReset) btnReset.onclick = resetLiveTimer;

    const btnFinish = document.getElementById("btn-finish-match");
    if (btnFinish) btnFinish.onclick = handleFinishMatch;
  }

    const btnFinishDay = document.getElementById("btn-finish-pelada-day");
    if (btnFinishDay) btnFinishDay.onclick = handleFinishPeladaDay;

    // Configuração dos botões de ajuste de minutos (+1 / -1)
    const btnTimerMinus = document.getElementById("btn-timer-minus");
    const btnTimerPlus = document.getElementById("btn-timer-plus");

    // Inicialização de segurança do tempo da partida se estiver zerado
    if (!window.App.liveMatch.isPlaying && window.App.liveMatch.timerSeconds === 0) {
      const groupConfigs = window.Api.getConfigs() || [];
      const currentGrp = window.Auth.currentGroup;
      const grpConfig = currentGrp ? groupConfigs.find(c => c.grupo_id === currentGrp.id) : null;
      const durationMin = grpConfig ? (grpConfig.tempo_partida || 8) : 8;
      window.App.liveMatch.timerSeconds = durationMin * 60;
    }

    if (btnTimerMinus) {
      btnTimerMinus.onclick = () => {
        window.App.liveMatch.timerSeconds = Math.max(0, (window.App.liveMatch.timerSeconds || 0) - 60);
        saveLiveMatchState();
        updateTimerDisplay();
        renderLiveMatchUI();
        window.App.showToast("Subtraído 1 minuto do jogo.", "info");
      };
    }

    if (btnTimerPlus) {
      btnTimerPlus.onclick = () => {
        window.App.liveMatch.timerSeconds = (window.App.liveMatch.timerSeconds || 0) + 60;
        saveLiveMatchState();
        updateTimerDisplay();
        renderLiveMatchUI();
        window.App.showToast("Adicionado 1 minuto ao jogo.", "info");
      };
    }

    // Restaura o loop de contagem regressiva se a partida estava rodando ao sair da página
    if (window.App.liveMatch.isPlaying) {
      if (btnToggle) {
        btnToggle.textContent = "Pausar";
        btnToggle.className = "btn btn-sm btn-outline-secondary";
      }
      startTimerLoop(); // usa a função centralizada para evitar duplo interval
    }

    const adjustButtons = document.querySelectorAll(".btn-score-adjust");
    adjustButtons.forEach(btn => {
      btn.onclick = () => {
        const team = btn.getAttribute("data-team");
        const diff = parseInt(btn.getAttribute("data-diff"));
        updateLiveScore(team, diff);
      };
    });

    // Botão Zerar Testes da Pelada
    const btnZerar = document.getElementById("btn-zerar-dados-pelada");
    if (btnZerar) {
      btnZerar.onclick = () => {
        window.App.zerarDadosPelada();
      };
    }

    // Botões de Visualização do Time (Olho)
    const btnViewA = document.getElementById("btn-view-team-a");
    if (btnViewA) {
      btnViewA.onclick = () => {
        const teams = JSON.parse(localStorage.getItem("teams")) || [];
        const teamObj = teams.find(t => t.nome === window.App.liveMatch.teamA) || { nome: window.App.liveMatch.teamA, players: [] };
        window.App.openModal("ver_time", { teamName: teamObj.nome, players: teamObj.players });
      };
    }

    const btnViewB = document.getElementById("btn-view-team-b");
    if (btnViewB) {
      btnViewB.onclick = () => {
        const teams = JSON.parse(localStorage.getItem("teams")) || [];
        const teamObj = teams.find(t => t.nome === window.App.liveMatch.teamB) || { nome: window.App.liveMatch.teamB, players: [] };
        window.App.openModal("ver_time", { teamName: teamObj.nome, players: teamObj.players });
      };
    }

    // Botões de Lançamento de Gol
    const btnGoalA = document.getElementById("btn-goal-team-a");
    if (btnGoalA) {
      btnGoalA.onclick = () => {
        const teams = JSON.parse(localStorage.getItem("teams")) || [];
        const teamObj = teams.find(t => t.nome === window.App.liveMatch.teamA) || { nome: window.App.liveMatch.teamA, players: [] };
        window.App.openModal("lancar_gol", { teamName: teamObj.nome, teamKey: "a", players: teamObj.players });
      };
    }

    const btnGoalB = document.getElementById("btn-goal-team-b");
    if (btnGoalB) {
      btnGoalB.onclick = () => {
        const teams = JSON.parse(localStorage.getItem("teams")) || [];
        const teamObj = teams.find(t => t.nome === window.App.liveMatch.teamB) || { nome: window.App.liveMatch.teamB, players: [] };
        window.App.openModal("lancar_gol", { teamName: teamObj.nome, teamKey: "b", players: teamObj.players });
      };
    }

  setTimeout(() => {
    if (window.App && window.App.applyModoNoturnoGlobal) {
      window.App.applyModoNoturnoGlobal();
    }
  }, 50);

  window.App.updateAcompanhamentoUI = async function () {
    const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
    if (peladaId && window.Api && window.Api.atualizarLiveState) {
      let teams = [];
      try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }
      await window.Api.atualizarLiveState(peladaId, window.App.liveMatch, window.App.waitingQueue, teams);
    }
    renderLiveMatchUI();
    renderWaitingQueue();
    await renderRecentMatches();
  };

  renderLiveMatchUI();
  renderWaitingQueue();
  renderRecentMatches(); // Carrega o histórico de minijogos salvos do banco de dados

  // Inicia polling e escuta de eventos em tempo real
  startGestorPolling();

  // Inicializar ícones Feather
  if (window.feather) feather.replace();

  // Renderizar anúncio Google AdSense (se ativado pelo gestor)
  if (window.AdSenseManager) {
    window.AdSenseManager.renderAdContainer('adsense-partidas-banner');
  }
};

var gestorPollingInterval = null;

function startGestorPolling() {
  if (window.App.gestorPollingInterval) {
    clearTimeout(window.App.gestorPollingInterval);
    window.App.gestorPollingInterval = null;
  }

  // Polling inteligente e econômico (8s ao vivo, 30s inativo)
  const getIntervalTime = () => {
    var match = window.App.liveMatch;
    return (match && match.isPlaying) ? 8000 : 30000;
  };

  const runGestorPolling = async () => {
    if (!window.App || window.App.gestorPollingInterval === null) return;

    if (window.App.isFinishingMatch) {

      if (window.App.gestorPollingInterval !== null) {
        window.App.gestorPollingInterval = setTimeout(runGestorPolling, getIntervalTime());
      }
      return;
    }

    // Se a pelada ativa estiver finalizada, oculta a interface ao vivo sem apagar o histórico local
    const peladaAtivaPoll = window.App.activePelada || {};
    if (peladaAtivaPoll.status === "finalizada") {
      renderLiveMatchUI();
      renderWaitingQueue();
      if (window.App.gestorPollingInterval !== null) {
        window.App.gestorPollingInterval = setTimeout(runGestorPolling, getIntervalTime());
      }
      return;
    }

    let peladaId = window.App.activePelada ? window.App.activePelada.id : null;
    if (!peladaId) {
      try {
        const raw = localStorage.getItem("activePelada");
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && obj.id) peladaId = obj.id;
        }
      } catch (e) { }
    }

    if (peladaId && window.Api && window.Api.obterLiveState) {
      try {
        const res = await window.Api.obterLiveState(peladaId);
        if (res && res.state && !window.App.isFinishingMatch) {
          if (res.state.liveMatch) {
            const serverMatch = res.state.liveMatch;
            const localMatch = window.App.liveMatch || {};
            const serverTime = parseInt(serverMatch.updatedAt || 0);
            const localTime = parseInt(localMatch.updatedAt || 0);

            // Atualiza local se o servidor estiver mais recente ou se local estiver sem times
            if (serverTime >= localTime || !localMatch.teamA) {
              window.App.liveMatch = serverMatch;
              localStorage.setItem("liveMatch", JSON.stringify(serverMatch));
            }
          }
          if (res.state.teams) {
            localStorage.setItem("teams", JSON.stringify(res.state.teams));
          }

          let currentQueue = res.state.waitingQueue || [];
          let currentTeams = res.state.teams || [];
          if (!currentTeams || currentTeams.length === 0) {
            try { currentTeams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }
          }

          if ((!currentQueue || currentQueue.length === 0) && Array.isArray(currentTeams) && currentTeams.length > 2) {
            const tA = (res.state.liveMatch && res.state.liveMatch.teamA) ? String(res.state.liveMatch.teamA).toLowerCase().trim() : '';
            const tB = (res.state.liveMatch && res.state.liveMatch.teamB) ? String(res.state.liveMatch.teamB).toLowerCase().trim() : '';
            currentQueue = currentTeams
              .map(t => t.nome || t.name)
              .filter(n => {
                if (!n) return false;
                const low = String(n).toLowerCase().trim();
                return low !== tA && low !== tB;
              });
          }

          window.App.waitingQueue = currentQueue;
          localStorage.setItem("waitingQueue", JSON.stringify(currentQueue));
        }
      } catch (err) { }
    }

    if (!window.App.isFinishingMatch) {
      renderLiveMatchUI();
      renderWaitingQueue();
      renderRecentMatches();
    }

    if (window.App.gestorPollingInterval !== null) {
      window.App.gestorPollingInterval = setTimeout(runGestorPolling, getIntervalTime());
    }
  };

  window.App.gestorPollingInterval = setTimeout(runGestorPolling, getIntervalTime());

  window.removeEventListener('storage', onGestorStorageChange);
  window.addEventListener('storage', onGestorStorageChange);
}

function onGestorStorageChange(e) {
  if (e.key === 'liveMatch' || e.key === 'waitingQueue' || e.key === 'teams' || e.key === 'activePelada') {
    try {
      if (e.key === 'liveMatch' && e.newValue) window.App.liveMatch = JSON.parse(e.newValue);
      if (e.key === 'waitingQueue' && e.newValue) window.App.waitingQueue = JSON.parse(e.newValue);
      if (e.key === 'activePelada' && e.newValue) window.App.activePelada = JSON.parse(e.newValue);
    } catch (err) { }
    renderLiveMatchUI();
    renderWaitingQueue();
    renderRecentMatches();
  }
}

function getMatchPhaseInfo(liveMatch, peladaAtiva) {
  const tState = liveMatch ? (liveMatch.tournamentState || null) : null;
  const isTorneio = (peladaAtiva && (peladaAtiva.modo === 'torneio' || peladaAtiva.modo === 'pontos_corridos' || peladaAtiva.modo === 'torneio_pontos_corridos' || peladaAtiva.modo === 'mata_mata_direto' || peladaAtiva.modo === 'torneio_livre')) || !!tState;

  if (isTorneio && tState) {
    const currentMatchId = liveMatch ? liveMatch.tournamentMatchId : null;

    if (tState.fase === 'livre' || (peladaAtiva && peladaAtiva.modo === 'torneio_livre')) {
      const matchCount = (tState.matches || []).length;
      return {
        title: `📋 TORNEIO LIVRE — CONFRONTO ${matchCount + 1}`,
        sub: 'Confrontos Definidos Livremente pelo Gestor',
        bg: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
        color: '#0369A1',
        border: '1px solid #0284C7'
      };
    } else if (tState.fase === 'grupo') {
      const matchesList = tState.matches || [];
      let matchIndex = matchesList.findIndex(m => m.id === currentMatchId || m.status === 'em_andamento');
      if (matchIndex < 0) {
        matchIndex = matchesList.findIndex(m => m.status !== 'encerrado');
      }
      const gameNum = matchIndex >= 0 ? (matchIndex + 1) : 1;
      const totalGames = matchesList.length;
      const turnoTxt = tState.turno === 'ida_volta' ? 'Turno e Returno (Ida e Volta)' : 'Turno Único (Somente Ida)';

      return {
        title: `⚽ FASE DE GRUPOS — JOGO ${gameNum} DE ${totalGames}`,
        sub: `Tabela Mista • ${turnoTxt}`,
        bg: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
        color: '#78350F',
        border: '1px solid #F59E0B'
      };
    } else if (tState.fase === 'mata_mata') {
      const matchesList = tState.knockoutMatches || [];
      let matchObj = matchesList.find(m => m.id === currentMatchId || m.status === 'em_andamento') || matchesList.find(m => m.status !== 'encerrado');
      const phaseName = matchObj && matchObj.faseNome ? matchObj.faseNome.toUpperCase() : 'SEMIFINAL (MATA-MATA)';

      return {
        title: `🔥 MATA-MATA — ${phaseName}`,
        sub: 'Eliminatória Direta (Jogo Único)',
        bg: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
        color: '#075985',
        border: '1px solid #0284C7'
      };
    } else if (tState.fase === 'finais') {
      const matchesList = tState.finalsMatches || [];
      let matchObj = matchesList.find(m => m.id === currentMatchId || m.status === 'em_andamento') || matchesList.find(m => m.status !== 'encerrado');
      const phaseName = matchObj && matchObj.faseNome ? matchObj.faseNome.toUpperCase() : 'GRANDE FINAL';
      const is3rd = phaseName.includes('3º') || phaseName.includes('TERCEIRO');

      return {
        title: is3rd ? `🥉 DISPUTA DE 3º LUGAR` : `🏆 GRANDE FINAL DO TORNEIO`,
        sub: is3rd ? 'Decisão da Medalha de Bronze' : 'Decisão do Grande Campeão do Torneio',
        bg: is3rd 
          ? 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)'
          : 'linear-gradient(135deg, #FEF3C7 0%, #D1FAE5 100%)',
        color: is3rd ? '#831843' : '#065F46',
        border: is3rd ? '1px solid #EC4899' : '1px solid #10B981'
      };
    } else if (tState.fase === 'finalizado') {
      return {
        title: `🎉 MINI TORNEIO FINALIZADO`,
        sub: 'Confira o Pódio dos Campeões!',
        bg: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
        color: '#065F46',
        border: '1px solid #10B981'
      };
    }
  }

  return {
    title: `⚽ PELADA NORMAL — REINA CAMPO`,
    sub: `Revezamento de Equipes`,
    bg: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
    color: '#1E293B',
    border: '1px solid #94A3B8'
  };
}

function applyAthleteTeamStyleToPartidasCards() {
  const user = (window.Auth && window.Auth.currentUser) || JSON.parse(localStorage.getItem('currentUser') || 'null');
  let teamName = user ? user.time_coracao : null;
  if (!teamName) {
    try {
      const stored = JSON.parse(localStorage.getItem('usuario'));
      if (stored && stored.time_coracao) teamName = stored.time_coracao;
    } catch(e) {}
  }

  let theme = null;
  if (teamName && window.App && window.App.getTeamThemeGlobal) {
    theme = window.App.getTeamThemeGlobal(teamName);
  } else if (teamName && window.Dashboard && window.Dashboard.getTeamTheme) {
    theme = window.Dashboard.getTeamTheme(teamName);
  }

  // Se não houver time_coracao individual do atleta, resgata a paleta dos times sorteados da partida
  let teams = window.App.teams || [];
  if (!teams || teams.length === 0) {
    try { teams = JSON.parse(localStorage.getItem('teams')) || []; } catch(e) {}
  }

  if (!theme && teams && teams.length > 0) {
    const t0 = teams[0];
    if (t0 && window.TeamEmblems && window.TeamEmblems.getTheme) {
      const embT = window.TeamEmblems.getTheme(t0.emblema !== undefined ? t0.emblema : 0);
      if (embT) {
        theme = {
          gradient: `linear-gradient(135deg, ${embT.bg} 0%, #0F172A 100%)`,
          border: embT.border || embT.accent,
          borderGlow: embT.bg + '66',
          accent: embT.accent || '#F5D270',
          badgeBg: embT.bg,
          badgeText: embT.accent || '#FFFFFF'
        };
      }
    }
  }

  if (!theme) return;

  // Aplica o tema visual do time em todos os cards da tela Partida ao Vivo e no Cabeçalho
  const cards = document.querySelectorAll('.gestor-score-card, .gestor-card-clear, #gestor-queue-card, #gestor-no-teams-card, #gestor-timer-container, #gestor-scoreboard-container, #gestor-finish-container, #gestor-tournament-card, #gestor-recent-matches-card, .gestor-header-unified-card, .gestor-header-mobile-unified');
  cards.forEach(card => {
    if (!card) return;
    card.classList.add('has-team-theme');
    card.style.setProperty('background', theme.gradient || theme.bg, 'important');
    card.style.setProperty('border', `1.5px solid ${theme.border}`, 'important');
    if (theme.borderGlow) {
      card.style.setProperty('box-shadow', `0 8px 24px ${theme.borderGlow}`, 'important');
    }

    const headers = card.querySelectorAll('h1, h2, h3, h4, h5, .card-title, .title');
    headers.forEach(h => {
      h.style.setProperty('color', '#FFFFFF', 'important');
      h.style.setProperty('text-shadow', '0 2px 4px rgba(0,0,0,0.5)', 'important');
    });

    // Garante contraste das labels e subtextos
    const subtitles = card.querySelectorAll('p, span, label, .sub, .text-muted, .text-slate');
    subtitles.forEach(p => {
      if (!p.classList.contains('badge') && !p.classList.contains('btn') && !p.id.includes('score') && !p.classList.contains('btn-adjust-score') && !p.classList.contains('gestor-badge-role')) {
        p.style.setProperty('color', 'rgba(255,255,255,0.92)', 'important');
      }
    });
  });

  // Estiliza a estrutura da página (fundo, cabeçalho e badge "Painel Gestor")
  const webBody = document.querySelector('.gestor-web-body');
  if (webBody) {
    webBody.style.setProperty('background', 'linear-gradient(135deg, #0B0F19 0%, #111827 100%)', 'important');
  }

  const roleBadges = document.querySelectorAll('.gestor-badge-role');
  roleBadges.forEach(b => {
    b.style.setProperty('background', 'rgba(254, 243, 199, 0.25)', 'important');
    b.style.setProperty('color', '#FDE68A', 'important');
    b.style.setProperty('border', '1px solid #F59E0B', 'important');
  });

  const logos = document.querySelectorAll('.gestor-logo-clear');
  logos.forEach(l => {
    l.style.setProperty('color', '#FFFFFF', 'important');
  });

  const userNames = document.querySelectorAll('.gestor-user-name-clear');
  userNames.forEach(n => {
    n.style.setProperty('color', 'rgba(255, 255, 255, 0.9)', 'important');
  });

  // Estilização Individual dos Cards dos Times no Placar (Time A e Time B)
  if (teams && teams.length >= 2) {
    const tA = teams[0];
    const tB = teams[1];
    const cardA = document.getElementById("acomp-team-a");
    const cardB = document.getElementById("acomp-team-b");

    if (tA && window.TeamEmblems && cardA) {
      const themeA = window.TeamEmblems.getTheme(tA.emblema !== undefined ? tA.emblema : 0);
      if (themeA) {
        cardA.style.setProperty('background', `linear-gradient(135deg, ${themeA.bg} 0%, #1E293B 100%)`, 'important');
        cardA.style.setProperty('border', `1.5px solid ${themeA.border || themeA.accent}`, 'important');
        cardA.style.setProperty('border-radius', '12px', 'important');
        cardA.style.setProperty('padding', '8px 12px', 'important');
      }
    }

    if (tB && window.TeamEmblems && cardB) {
      const themeB = window.TeamEmblems.getTheme(tB.emblema !== undefined ? tB.emblema : 1);
      if (themeB) {
        cardB.style.setProperty('background', `linear-gradient(135deg, ${themeB.bg} 0%, #1E293B 100%)`, 'important');
        cardB.style.setProperty('border', `1.5px solid ${themeB.border || themeB.accent}`, 'important');
        cardB.style.setProperty('border-radius', '12px', 'important');
        cardB.style.setProperty('padding', '8px 12px', 'important');
      }
    }
  }

  // Estilização do Banner da Fase da Partida (ex: ⚽ FASE DE GRUPOS — JOGO 1 DE 2)
  const phaseBanner = document.getElementById("gestor-phase-header-banner");
  const phaseTitle = document.getElementById("gestor-phase-header-title");
  const phaseSub = document.getElementById("gestor-phase-header-sub");

  if (phaseBanner) {
    phaseBanner.style.setProperty('background', 'rgba(255, 255, 255, 0.15)', 'important');
    phaseBanner.style.setProperty('border', `1.5px solid ${theme.border || '#F59E0B'}`, 'important');
    phaseBanner.style.setProperty('backdrop-filter', 'blur(10px)', 'important');
    phaseBanner.style.setProperty('box-shadow', '0 4px 14px rgba(0,0,0,0.2)', 'important');
  }
  if (phaseTitle) {
    phaseTitle.style.setProperty('color', '#FFFFFF', 'important');
    phaseTitle.style.setProperty('text-shadow', '0 2px 4px rgba(0,0,0,0.5)', 'important');
  }
  if (phaseSub) {
    phaseSub.style.setProperty('color', theme.accent || '#FDE68A', 'important');
    phaseSub.style.setProperty('text-shadow', '0 1px 2px rgba(0,0,0,0.5)', 'important');
  }

  // Estilização do Badge de Status "EM ANDAMENTO" / "AGUARDANDO SORTEIO" (No mesmo estilo de "A JOGAR")
  const badgeEl = document.getElementById("match-live-status-badge");
  if (badgeEl) {
    badgeEl.style.setProperty('background', 'rgba(255, 255, 255, 0.2)', 'important');
    badgeEl.style.setProperty('color', '#FFFFFF', 'important');
    badgeEl.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.3)', 'important');
    badgeEl.style.setProperty('font-weight', '600', 'important');
  }
}

function renderLiveMatchUI() {
  // Se a pelada ativa estiver finalizada, não renderiza o confronto ao vivo
  const activePelada = window.App.activePelada || {};
  if (activePelada.status === "finalizada") {
    const timerCont = document.getElementById("gestor-timer-container");
    const scoreCont = document.getElementById("gestor-scoreboard-container");
    const finishCont = document.getElementById("gestor-finish-container");
    const queueCard = document.getElementById("gestor-queue-card");
    if (timerCont) timerCont.style.display = "none";
    if (scoreCont) scoreCont.style.display = "none";
    if (finishCont) finishCont.style.display = "none";
    if (queueCard) queueCard.style.display = "none";
    return;
  }
  // Verificar se existem times sorteados
  let teamsList = [];
  try {
    const activePId = window.App.activePelada ? window.App.activePelada.id : null;
    teamsList = (window.App && window.App.teams && window.App.teams.length > 0)
      ? window.App.teams
      : (JSON.parse(localStorage.getItem("teams")) || (activePId ? JSON.parse(localStorage.getItem("teams_" + activePId)) : null) || []);
  } catch (e) { }

  const timerCont = document.getElementById("gestor-timer-container");
  const scoreCont = document.getElementById("gestor-scoreboard-container");
  const finishCont = document.getElementById("gestor-finish-container");
  const queueCard = document.getElementById("gestor-queue-card");
  let infoCard = document.getElementById("gestor-no-teams-card");

  if (!teamsList || teamsList.length < 2) {
    if (timerCont) timerCont.style.display = "none";
    if (scoreCont) scoreCont.style.display = "none";
    if (finishCont) finishCont.style.display = "none";
    const badgeEl = document.getElementById("match-live-status-badge");
    if (badgeEl) {
      badgeEl.textContent = "AGUARDANDO SORTEIO";
      badgeEl.style.background = "#FEF3C7";
      badgeEl.style.color = "#D97706";
    }

    if (!infoCard) {
      infoCard = document.createElement("div");
      infoCard.id = "gestor-no-teams-card";
      infoCard.className = "gestor-card-clear";
      infoCard.style.textAlign = "center";
      infoCard.style.padding = "32px 20px";
      infoCard.style.display = "flex";
      infoCard.style.flexDirection = "column";
      infoCard.style.alignItems = "center";
      infoCard.style.justifyContent = "center";
      infoCard.style.gap = "16px";
      infoCard.style.background = "#FFFFFF";
      infoCard.style.borderRadius = "16px";
      infoCard.style.border = "1px solid rgba(0, 0, 0, 0.04)";
      infoCard.style.boxShadow = "0 4px 14px rgba(30, 41, 59, 0.03)";
      infoCard.style.width = "100%";
      infoCard.style.boxSizing = "border-box";

      infoCard.innerHTML = `
        <div style="font-size: 40px; line-height: 1;">📋</div>
        <h4 class="text-inter" style="font-size: 16px; font-weight: 700; color: #0F172A; margin: 0;">Nenhum Time Sorteado</h4>
        <p class="text-inter" style="font-size: 13px; color: #64748B; margin: 0; max-width: 340px; line-height: 1.5;">
          Para iniciar o controle da partida ao vivo e da fila de espera, é necessário sortear os times primeiro.
        </p>
        <button class="btn" style="background: #0284C7; color: #FFF; font-weight: 700; font-size: 13px; border-radius: 8px; padding: 10px 20px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;" onclick="Router.navigate('#/gestor/formacao')">
          ⚡ Sortear Times Agora
        </button>
      `;

      const parent = document.getElementById("manager-tab-content-container") || (timerCont ? timerCont.parentElement.parentElement : null);
      if (parent) {
        // Insere antes do histórico de partidas (que é o último card do container)
        const cards = parent.querySelectorAll(".gestor-card-clear");
        const lastCard = cards[cards.length - 1];
        if (lastCard && lastCard !== infoCard) {
          parent.insertBefore(infoCard, lastCard);
        } else {
          parent.appendChild(infoCard);
        }
      }
    } else {
      infoCard.style.display = "flex";
    }
    renderTournamentUI();
    return;
  }

  // Se houver times sorteados, exibir os elementos normalmente e ocultar o infoCard
  if (timerCont) timerCont.style.display = "block";
  if (scoreCont) scoreCont.style.display = "block";
  if (finishCont) finishCont.style.display = "flex";
  if (queueCard) queueCard.style.display = "block";
  if (infoCard) infoCard.style.display = "none";

  // Sincronização automática em modo Torneio com a partida agendada na tabela respeitando a fase
  const peladaAct = window.App.activePelada || {};
  const tStateSync = (window.App.liveMatch ? window.App.liveMatch.tournamentState : null) || (peladaAct.id ? JSON.parse(localStorage.getItem(`tournamentState_${peladaAct.id}`) || 'null') : null) || JSON.parse(localStorage.getItem('tournamentState') || 'null');
  if (tStateSync && tStateSync.fase !== 'finalizado') {
    let currentMatch = getTournamentActiveMatch(tStateSync, window.App.liveMatch ? window.App.liveMatch.tournamentMatchId : null);
    if (currentMatch && !window.App.liveMatch.isPlaying && (window.App.liveMatch.scoreA || 0) === 0 && (window.App.liveMatch.scoreB || 0) === 0) {
      window.App.liveMatch.teamA = currentMatch.teamA;
      window.App.liveMatch.teamB = currentMatch.teamB;
      window.App.liveMatch.tournamentMatchId = currentMatch.id;
    }
  }

  const teamA = window.App.liveMatch.teamA || "Time A";
  const teamB = window.App.liveMatch.teamB || "Time B";
  const scoreA = window.App.liveMatch.scoreA || 0;
  const scoreB = window.App.liveMatch.scoreB || 0;

  const teamAEl = document.getElementById("match-control-team-a");
  const teamBEl = document.getElementById("match-control-team-b");
  const scoreAEl = document.getElementById("match-control-score-a");
  const scoreBEl = document.getElementById("match-control-score-b");
  const badgeEl = document.getElementById("match-live-status-badge");

  if (teamAEl) teamAEl.textContent = teamA;
  if (teamBEl) teamBEl.textContent = teamB;
  if (scoreAEl) scoreAEl.textContent = scoreA;
  if (scoreBEl) scoreBEl.textContent = scoreB;

  // Renderiza Banner da Fase da Partida acima do Placar
  const phaseBanner = document.getElementById("gestor-phase-header-banner");
  const phaseTitle = document.getElementById("gestor-phase-header-title");
  const phaseSub = document.getElementById("gestor-phase-header-sub");

  if (phaseBanner && phaseTitle) {
    const pInfo = getMatchPhaseInfo(window.App.liveMatch, window.App.activePelada);
    phaseTitle.textContent = pInfo.title;
    if (phaseSub) phaseSub.textContent = pInfo.sub;

    const isTeamTheme = document.querySelector('.gestor-score-card')?.classList.contains('has-team-theme');
    if (isTeamTheme) {
      phaseBanner.style.background = "rgba(255, 255, 255, 0.15)";
      phaseBanner.style.backdropFilter = "blur(10px)";
      phaseBanner.style.border = "1.5px solid rgba(255, 255, 255, 0.25)";
      phaseTitle.style.color = "#FFFFFF";
      phaseTitle.style.textShadow = "0 2px 4px rgba(0,0,0,0.5)";
      if (phaseSub) {
        phaseSub.style.color = "#FDE68A";
        phaseSub.style.textShadow = "0 1px 2px rgba(0,0,0,0.5)";
      }
    } else {
      phaseBanner.style.background = pInfo.bg;
      phaseBanner.style.color = pInfo.color;
      phaseBanner.style.border = pInfo.border;
    }
    phaseBanner.style.display = "block";
  }

  // Renderiza emblemas dos times (busca no localStorage)
  if (window.TeamEmblems) {
    let teams = [];
    try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }
    const tA = teams.find(t => (t.nome || t.name || '').toLowerCase().trim() === (teamA || '').toLowerCase().trim()) || teams[0];
    const tB = teams.find(t => (t.nome || t.name || '').toLowerCase().trim() === (teamB || '').toLowerCase().trim()) || teams[1];

    const emblemAEl = document.getElementById("emblem-team-a");
    const emblemBEl = document.getElementById("emblem-team-b");
    if (emblemAEl) emblemAEl.innerHTML = window.TeamEmblems.forTeam(tA || { emblema: 0 });
    if (emblemBEl) emblemBEl.innerHTML = window.TeamEmblems.forTeam(tB || { emblema: 1 });
  }

  // Lógica do Seletor Livre de Confrontos (Modo Torneio Livre)
  const containerLivre = document.getElementById("container-confronto-livre");
  const livePelada = window.App.activePelada || {};
  const liveTState = window.App.liveMatch ? window.App.liveMatch.tournamentState : null;
  const isModoLivre = (livePelada.modo === 'torneio_livre') || (liveTState && liveTState.modo === 'torneio_livre');

  if (containerLivre) {
    if (isModoLivre) {
      containerLivre.style.display = "flex";
      const selectFreeA = document.getElementById("select-free-team-a");
      const selectFreeB = document.getElementById("select-free-team-b");
      
      let drawnTeams = [];
      try { drawnTeams = JSON.parse(localStorage.getItem("teams")) || []; } catch(e) {}
      if ((!drawnTeams || drawnTeams.length === 0) && liveTState && liveTState.teams) drawnTeams = liveTState.teams;

      if (selectFreeA && selectFreeB && drawnTeams.length >= 2) {
        const buildOptions = (currentVal) => {
          return drawnTeams.map((t, idx) => {
            const name = t.nome || t.name || `Time ${idx + 1}`;
            return `<option value="${name}" ${name === currentVal ? 'selected' : ''}>${name}</option>`;
          }).join('');
        };

        const currentA = window.App.liveMatch.teamA || drawnTeams[0].nome;
        const currentB = window.App.liveMatch.teamB || drawnTeams[1].nome;

        selectFreeA.innerHTML = buildOptions(currentA);
        selectFreeB.innerHTML = buildOptions(currentB);

        selectFreeA.onchange = (e) => {
          const newA = e.target.value;
          window.App.liveMatch.teamA = newA;
          window.App.liveMatch.scoreA = 0;
          renderLiveMatchUI();
        };

        selectFreeB.onchange = (e) => {
          const newB = e.target.value;
          window.App.liveMatch.teamB = newB;
          window.App.liveMatch.scoreB = 0;
          renderLiveMatchUI();
        };
      }
    } else {
      containerLivre.style.display = "none";
    }
  }

  // Lógica de alerta visual de limite de vitórias seguidas
  const peladaAtiva = window.App.activePelada || {};
  const grupoAtivo = window.App.currentGroup || {};
  const winsLimit = parseInt(peladaAtiva.vitorias_para_sair) || parseInt(grupoAtivo.vitorias_para_sair) || 2;

  const winsA = window.App.liveMatch.consecutiveWinsA || 0;
  const winsB = window.App.liveMatch.consecutiveWinsB || 0;

  const statusAEl = document.getElementById("match-control-team-a-status");
  const statusBEl = document.getElementById("match-control-team-b-status");

  if (statusAEl) {
    statusAEl.innerHTML = "";
    if (winsA === winsLimit - 1 && winsA > 0) {
      statusAEl.innerHTML = `
        <span style="font-size: 10px; background: rgba(255, 145, 0, 0.15); color: var(--warning); padding: 2px 8px; border-radius: 6px; font-weight: bold; animation: pulse 1.5s infinite; display: inline-block;">
          ⚠️ PRÓXIMA VITÓRIA REVEZA
        </span>`;
    } else if (winsA > 0) {
      statusAEl.innerHTML = `
        <span style="font-size: 10px; background: rgba(0, 230, 118, 0.1); color: var(--secondary); padding: 2px 8px; border-radius: 6px; font-weight: bold; display: inline-block;">
          🔥 ${winsA} ${winsA === 1 ? 'Vitória' : 'Vitórias'}
        </span>`;
    }
  }

  if (statusBEl) {
    statusBEl.innerHTML = "";
    if (winsB === winsLimit - 1 && winsB > 0) {
      statusBEl.innerHTML = `
        <span style="font-size: 10px; background: rgba(255, 145, 0, 0.15); color: var(--warning); padding: 2px 8px; border-radius: 6px; font-weight: bold; animation: pulse 1.5s infinite; display: inline-block;">
          ⚠️ PRÓXIMA VITÓRIA REVEZA
        </span>`;
    } else if (winsB > 0) {
      statusBEl.innerHTML = `
        <span style="font-size: 10px; background: rgba(0, 230, 118, 0.1); color: var(--secondary); padding: 2px 8px; border-radius: 6px; font-weight: bold; display: inline-block;">
          🔥 ${winsB} ${winsB === 1 ? 'Vitória' : 'Vitórias'}
        </span>`;
    }
  }

  // Renderiza autores dos gols do Time A (alinhado à direita, com assistência 👟 e botão ✕ para excluir gol acidental)
  const goalsAEl = document.getElementById("match-control-team-a-goals");
  if (goalsAEl) {
    const goalsA = (window.App.liveMatch.goals || []).filter(g => g.teamKey === 'a' || (g.teamName && teamA && g.teamName.toLowerCase() === teamA.toLowerCase()));

    if (goalsA.length === 0) {
      goalsAEl.innerHTML = "";
    } else {
      goalsAEl.innerHTML = goalsA.map((g, idx) => `
        <div style="display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-bottom: 2px; flex-wrap: wrap;">
          ${g.assistNome ? `<span style="font-size:11px; color:#64748B; font-weight:600;">(${g.assistNome} 👟)</span>` : ''}
          <span>${g.autorNome || 'Jogador'}</span>
          <span style="color:#34D399;">⚽</span>
          <button class="btn-delete-live-goal" data-goal-id="${g.id || idx}" data-team-key="a" title="Excluir este gol lançado por acidente" style="border:none; background:rgba(239,68,68,0.2); color:#EF4444; border-radius:4px; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; font-weight:bold;">✕</button>
        </div>
      `).join('');
    }
  }

  // Renderiza autores dos gols do Time B (alinhado à esquerda, com assistência 👟 e botão ✕ para excluir gol acidental)
  const goalsBEl = document.getElementById("match-control-team-b-goals");
  if (goalsBEl) {
    const goalsB = (window.App.liveMatch.goals || []).filter(g => g.teamKey === 'b' || (g.teamName && teamB && g.teamName.toLowerCase() === teamB.toLowerCase()));

    if (goalsB.length === 0) {
      goalsBEl.innerHTML = "";
    } else {
      goalsBEl.innerHTML = goalsB.map((g, idx) => `
        <div style="display:flex; align-items:center; justify-content:flex-start; gap:4px; margin-bottom: 2px; flex-wrap: wrap;">
          <button class="btn-delete-live-goal" data-goal-id="${g.id || idx}" data-team-key="b" title="Excluir este gol lançado por acidente" style="border:none; background:rgba(239,68,68,0.2); color:#EF4444; border-radius:4px; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; font-weight:bold;">✕</button>
          <span style="color:#34D399;">⚽</span>
          <span>${g.autorNome || 'Jogador'}</span>
          ${g.assistNome ? `<span style="font-size:11px; color:#64748B; font-weight:600;">(${g.assistNome} 👟)</span>` : ''}
        </div>
      `).join('');
    }
  }

  // Bind dos cliques nos botões ✕ para excluir gol lançado acidentalmente
  document.querySelectorAll(".btn-delete-live-goal").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const goalId = btn.getAttribute("data-goal-id");
      const teamKey = btn.getAttribute("data-team-key");

      let goals = window.App.liveMatch.goals || [];
      const matchIdx = goals.findIndex(g => String(g.id || '') === String(goalId));
      if (matchIdx !== -1) {
        goals.splice(matchIdx, 1);
      } else {
        const teamGoals = goals.filter(g => g.teamKey === teamKey);
        const gToRemove = teamGoals[parseInt(goalId)];
        if (gToRemove) {
          goals = goals.filter(g => g !== gToRemove);
        }
      }

      window.App.liveMatch.goals = goals;
      if (teamKey === 'a') {
        window.App.liveMatch.scoreA = Math.max(0, (window.App.liveMatch.scoreA || 0) - 1);
      } else {
        window.App.liveMatch.scoreB = Math.max(0, (window.App.liveMatch.scoreB || 0) - 1);
      }

      if (window.App.updateAcompanhamentoUI) {
        window.App.updateAcompanhamentoUI();
      }
      renderLiveMatchUI();
    };
  });

  if (badgeEl) {
    const isTeamTheme = document.querySelector('.gestor-score-card')?.classList.contains('has-team-theme');
    badgeEl.style.background = isTeamTheme ? "rgba(255, 255, 255, 0.2)" : "#F1F5F9";
    badgeEl.style.color = isTeamTheme ? "#FFFFFF" : "#64748B";
    badgeEl.style.border = isTeamTheme ? "1px solid rgba(255, 255, 255, 0.3)" : "none";
    badgeEl.style.fontWeight = "600";

    if (window.App.liveMatch.isPlaying) {
      badgeEl.textContent = "EM ANDAMENTO";
    } else if (window.App.liveMatch.timerSeconds > 0) {
      badgeEl.textContent = "PAUSADO";
    } else {
      badgeEl.textContent = "PRONTO PARA INICIAR";
    }
  }

  updateTimerDisplay();
  renderTournamentUI();
  applyAthleteTeamStyleToPartidasCards();
}

window.App.zerarDadosPelada = async function(peladaId) {
  const activePelada = window.App.activePelada || {};
  const pId = peladaId || (activePelada ? String(activePelada.id) : null);

  if (!pId) {
    if (window.App.showToast) window.App.showToast("Nenhuma pelada selecionada para zerar.", "warning");
    return;
  }

  const dataFmt = activePelada.data ? (window.Utils ? window.Utils.formatDate(activePelada.data) : activePelada.data) : "17/08/2026";
  const confirmed = confirm(`Tem certeza que deseja zerar o histórico de partidas, placares e gols da pelada do dia ${dataFmt}?\n\nNota: A formação e os times sorteados serão MANTIDOS intactos.`);
  if (!confirmed) return;

  try {
    // 1. Resgata e preserva os times sorteados atuais
    let currentTeams = window.App.teams || [];
    if (!currentTeams || currentTeams.length === 0) {
      currentTeams = safeLocalStorageGetItem(`teams_${pId}`) || safeLocalStorageGetItem("teams") || [];
    }

    // 2. Limpa dados de confrontos e histórico, mas MANTÉM os times
    const keysToRemove = [
      "liveMatch", `liveMatch_${pId}`,
      "recentMatches", `recentMatches_${pId}`,
      "tournamentState", `tournamentState_${pId}`
    ];
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch(e) {}
    });

    const teamAName = (currentTeams && currentTeams[0]) ? (currentTeams[0].nome || currentTeams[0].name) : "Time A";
    const teamBName = (currentTeams && currentTeams[1]) ? (currentTeams[1].nome || currentTeams[1].name) : "Time B";
    const queueNames = (currentTeams && currentTeams.length > 2) ? currentTeams.slice(2).map(t => t.nome || t.name) : [];

    window.App.teams = currentTeams;
    window.App.waitingQueue = queueNames;
    window.App.liveMatch = {
      teamA: teamAName,
      teamB: teamBName,
      scoreA: 0,
      scoreB: 0,
      isPlaying: false,
      timerSeconds: 480,
      goals: []
    };

    safeLocalStorageSetItem(`teams_${pId}`, currentTeams);
    safeLocalStorageSetItem("teams", currentTeams);
    safeLocalStorageSetItem(`waitingQueue_${pId}`, queueNames);
    safeLocalStorageSetItem("waitingQueue", queueNames);
    safeLocalStorageSetItem(`liveMatch_${pId}`, window.App.liveMatch);
    safeLocalStorageSetItem("liveMatch", window.App.liveMatch);

    // 3. Limpa histórico de jogos e gols do banco de dados (Supabase & API Backend)
    if (window.Api && window.Api.zerarPartidasDaPelada) {
      try {
        await window.Api.zerarPartidasDaPelada(pId);
      } catch(e) {}
    }

    if (window.supabase) {
      try {
        await window.supabase.from('gols').delete().eq('pelada_id', pId);
        await window.supabase.from('partidas').delete().eq('pelada_id', pId);
        await window.supabase.from('peladas').update({
          live_state: {
            liveMatch: window.App.liveMatch,
            waitingQueue: queueNames,
            teams: currentTeams
          }
        }).eq('id', pId);
      } catch(eSupabase) {
        console.warn("[zerarDadosPelada] Supabase clear:", eSupabase);
      }
    }

    if (window.Api && window.Api.atualizarLiveState) {
      try {
        await window.Api.atualizarLiveState(pId, window.App.liveMatch, queueNames, currentTeams);
      } catch(e) {}
    }

    // 4. Se for modo torneio, reinicializa a tabela do torneio com os times preservados e ESTATÍSTICAS ZERADAS (0 vitorias, 0 gols, 0 pontos)
    if (window.TournamentEngine && currentTeams.length >= 2) {
      const matches = window.TournamentEngine.generateGroupSchedule(currentTeams, 'ida_volta');
      // Força o status 'a_jogar' em todas as partidas da agenda
      matches.forEach(m => {
        m.status = 'a_jogar';
        m.golsA = null;
        m.golsB = null;
      });
      const standings = window.TournamentEngine.calculateStandings(currentTeams, matches);
      // Garante que a tabela exiba TODOS OS CAMPOS ZERADOS
      standings.forEach(st => {
        st.jogos = 0;
        st.vitorias = 0;
        st.empates = 0;
        st.derrotas = 0;
        st.golsPro = 0;
        st.golsContra = 0;
        st.saldoGols = 0;
        st.pontos = 0;
      });

      const newTState = {
        modo: 'torneio',
        fase: 'grupo',
        turno: 'ida_volta',
        teams: currentTeams,
        matches: matches,
        standings: standings,
        knockoutMatches: [],
        finalsMatches: []
      };

      // Define a primeira partida agendada no torneio para o placar ao vivo!
      if (matches.length > 0) {
        window.App.liveMatch.teamA = matches[0].teamA;
        window.App.liveMatch.teamB = matches[0].teamB;
        window.App.liveMatch.tournamentMatchId = matches[0].id;
      }

      safeLocalStorageSetItem(`tournamentState_${pId}`, newTState);
      safeLocalStorageSetItem('tournamentState', newTState);
      window.App.liveMatch.tournamentState = newTState;
    }

    renderLiveMatchUI();
    renderWaitingQueue();
    renderTournamentUI();
    await renderRecentMatches();

    if (window.App.showToast) window.App.showToast(`Histórico de jogos e gols zerados! A formação dos times foi mantida.`, "success");
  } catch (err) {
    console.error("[zerarDadosPelada]", err);
    if (window.App.showToast) window.App.showToast("Erro ao zerar histórico.", "error");
  }
};

function limparEstadoPartida() {
  window.App.liveMatch = { teamA: "Time A", teamB: "Time B", scoreA: 0, scoreB: 0, isPlaying: false, timerSeconds: 0, goals: [] };
  window.App.waitingQueue = [];
  window.App.teams = [];
  localStorage.removeItem("teams");
  localStorage.setItem("waitingQueue", "[]");
  localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
  console.log("🧹 [LIMPAR] Estado da partida limpo (sem confronto/fila).");
}

function renderWaitingQueue() {
  const activePelada = window.App.activePelada || {};
  if (activePelada.status === "finalizada") {
    const queueCard = document.getElementById("gestor-queue-card");
    if (queueCard) queueCard.style.display = "none";
    return;
  }

  const container = document.getElementById("wait-queue-container");
  const counterEl = document.getElementById("queue-count");

  console.log("🔍 [DIAGNÓSTICO FILA DE ESPERA] Chamado renderWaitingQueue", {
    containerExiste: !!container,
    counterExiste: !!counterEl,
    windowAppWaitingQueue: window.App ? window.App.waitingQueue : null,
    localStorageWaitingQueue: localStorage.getItem("waitingQueue"),
    localStorageTeams: localStorage.getItem("teams"),
    liveMatch: window.App ? window.App.liveMatch : null
  });

  if (!container) {
    console.warn("⚠️ [DIAGNÓSTICO FILA DE ESPERA] Elemento #wait-queue-container não encontrado no DOM.");
    return;
  }

  container.innerHTML = "";

  // 1. Obtém a fila de espera do estado global ou do localStorage
  const activePIdQueue = window.App.activePelada ? window.App.activePelada.id : null;
  let queue = (window.App.waitingQueue && Array.isArray(window.App.waitingQueue) && window.App.waitingQueue.length > 0)
    ? window.App.waitingQueue
    : [];

  if (!queue || queue.length === 0) {
    try {
      queue = JSON.parse(localStorage.getItem("waitingQueue")) || (activePIdQueue ? JSON.parse(localStorage.getItem("waitingQueue_" + activePIdQueue)) : null) || [];
    } catch (e) { }
  }

  // 2. Obtém os times sorteados/cadastrados de todas as fontes possíveis
  let teams = (window.App.teams && Array.isArray(window.App.teams) && window.App.teams.length > 0)
    ? window.App.teams
    : ((window.App.drawnTeams && Array.isArray(window.App.drawnTeams) && window.App.drawnTeams.length > 0) ? window.App.drawnTeams : []);

  if (!teams || teams.length === 0) {
    try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }
  }
  if (!teams || teams.length === 0) {
    try { teams = Api.getTeams() || []; } catch (e) { }
  }

  // 3. Failsafe: se a fila estiver vazia mas houver mais de 2 times sorteados, reconstrói a fila
  if ((!queue || queue.length === 0) && Array.isArray(teams) && teams.length > 2) {
    const tA = (window.App.liveMatch && window.App.liveMatch.teamA) ? String(window.App.liveMatch.teamA).toLowerCase().trim() : '';
    const tB = (window.App.liveMatch && window.App.liveMatch.teamB) ? String(window.App.liveMatch.teamB).toLowerCase().trim() : '';
    queue = teams
      .map(t => t.nome || t.name)
      .filter(n => {
        if (!n) return false;
        const low = String(n).toLowerCase().trim();
        return low !== tA && low !== tB;
      });

    console.log("🛠️ [DIAGNÓSTICO FILA DE ESPERA] Fila reconstruída dinamicamente dos times:", queue);

    if (queue.length > 0) {
      window.App.waitingQueue = queue;
      try { localStorage.setItem("waitingQueue", JSON.stringify(queue)); } catch (e) { }
    }
  }

  console.log("📊 [DIAGNÓSTICO FILA DE ESPERA] Fila final para renderização:", queue);

  if (counterEl) {
    counterEl.textContent = `${queue.length} Time${queue.length !== 1 ? 's' : ''}`;
  }

  if (queue.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #64748B;" class="text-inter">
        <span style="font-size: 28px; display: block; margin-bottom: 6px;">📋</span>
        Sem times na fila de espera.
      </div>
    `;
    return;
  }

  queue.forEach((teamName, index) => {
    const teamObj = (teams || []).find(t => (t.nome || t.name) === teamName) || { nome: teamName, emblema: index % 10 };
    const emblemSvg = window.TeamEmblems ? window.TeamEmblems.forTeam(teamObj) : '';

    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.padding = "10px 14px";
    item.style.backgroundColor = "#F8FAFC";
    item.style.borderRadius = "10px";
    item.style.border = "1px solid #E2E8F0";
    item.style.borderLeft = index === 0 ? "4px solid #0284C7" : "4px solid #94A3B8";

    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 12px; font-weight: 800; background: ${index === 0 ? '#E0F2FE' : '#F1F5F9'}; color: ${index === 0 ? '#0369A1' : '#475569'}; padding: 3px 10px; border-radius: 6px;">
          ${index + 1}º
        </span>
        <div style="width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${emblemSvg}
        </div>
        <strong style="font-size: 15px; color: #0F172A; font-weight: 700; font-family: 'Inter', sans-serif;">${teamName}</strong>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <button class="btn-view-queue-team" data-team="${teamName}" style="border: 1px solid #CBD5E1; background: #FFFFFF; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: #334155;" title="Ver escalação do ${teamName}">
          👁️ Ver Escalação
        </button>
        ${index === 0 ? '<span style="font-size: 11px; font-weight: 800; color: #0284C7; background: #E0F2FE; padding: 3px 8px; border-radius: 6px;">PRÓXIMO ➜</span>' : '<span style="font-size: 11px; color: #64748B; font-weight: 600;">Aguardando</span>'}
      </div>
    `;
    container.appendChild(item);
  });

  // Configura cliques nos botões de visualização de escalação
  const viewQueueButtons = container.querySelectorAll(".btn-view-queue-team");
  viewQueueButtons.forEach(btn => {
    btn.onclick = () => {
      const tName = btn.getAttribute("data-team");
      let allTeams = (window.App.teams && window.App.teams.length > 0) ? window.App.teams : [];
      if (!allTeams || allTeams.length === 0) {
        try { allTeams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }
      }
      const teamObj = allTeams.find(t => (t.nome || t.name) === tName) || { nome: tName, players: [] };
      window.App.openModal("ver_time", { teamName: teamObj.nome || tName, players: teamObj.players || teamObj.jogadores || [] });
    };
  });

  applyAthleteTeamStyleToPartidasCards();
}

function toggleLiveTimer() {
  const btn = document.getElementById("btn-timer-toggle");
  if (!btn) return;

  if (window.App.liveMatch.isPlaying) {
    // --- PAUSAR ---
    clearInterval(timerInterval);
    timerInterval = null;
    window.App.liveMatch.isPlaying = false;
    btn.textContent = "Retomar";
    btn.className = "btn btn-sm btn-primary";
    saveLiveMatchState();
    renderLiveMatchUI();
    window.App.showToast("Jogo Pausado!");
  } else {
    // --- INICIAR / RETOMAR ---
    // Se o tempo acabou, recarrega o tempo padrão
    if (window.App.liveMatch.timerSeconds <= 0) {
      const groupConfigs = window.Api.getConfigs() || [];
      const currentGrp = window.Auth.currentGroup;
      const grpConfig = currentGrp ? groupConfigs.find(c => c.grupo_id === currentGrp.id) : null;
      const durationMin = grpConfig ? (grpConfig.tempo_partida || 8) : 8;
      window.App.liveMatch.timerSeconds = durationMin * 60;
    }

    window.App.liveMatch.isPlaying = true;
    btn.textContent = "Pausar";
    btn.className = "btn btn-sm btn-outline-secondary";

    startTimerLoop(); // usa a função centralizada — nunca duplica intervalos

    saveLiveMatchState();
    renderLiveMatchUI();
    window.App.showToast("Jogo Iniciado!");
  }
}

function resetLiveTimer(silent = false) {
  clearInterval(timerInterval);
  timerInterval = null;
  window.App.liveMatch.isPlaying = false;

  // Reseta para o tempo padrão configurado para o grupo
  const groupConfigs = window.Api.getConfigs() || [];
  const currentGrp = window.Auth.currentGroup;
  const grpConfig = currentGrp ? groupConfigs.find(c => c.grupo_id === currentGrp.id) : null;
  const durationMin = grpConfig ? (grpConfig.tempo_partida || 8) : 8;
  window.App.liveMatch.timerSeconds = durationMin * 60;

  const btnToggle = document.getElementById("btn-timer-toggle");
  if (btnToggle) {
    btnToggle.textContent = "Iniciar";
    btnToggle.className = "btn btn-sm btn-primary";
  }

  saveLiveMatchState();
  updateTimerDisplay();
  renderLiveMatchUI();
  if (!silent) window.App.showToast("Cronômetro resetado.");
}

function updateTimerDisplay() {
  const s = (window.App && window.App.liveMatch && window.App.liveMatch.timerSeconds !== undefined) ? window.App.liveMatch.timerSeconds : 480;
  const min = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  const text = `${min}:${sec}`;

  const controlTimer = document.getElementById("match-control-timer");
  if (controlTimer) controlTimer.textContent = text;

  // Atualiza barra de progresso e badges de status do gestor (unificado com o atleta)
  const group = (window.Auth && window.Auth.currentGroup) || (window.App && window.App.currentGroup);
  const configs = (window.Api && window.Api.getConfigs) ? window.Api.getConfigs() : [];
  const config = group ? configs.find(c => c.grupo_id === group.id) : null;
  const totalSecs = (config && config.tempo_partida) ? config.tempo_partida * 60 : 480;

  const elapsed = Math.max(0, totalSecs - s);
  const progressBar = document.getElementById("gestor-timer-progress");
  if (progressBar) {
    progressBar.style.width = `${Math.min(100, Math.max(0, (elapsed / totalSecs) * 100))}%`;
  }

  const timerDot = document.getElementById("gestor-timer-dot");
  const timerStatusText = document.getElementById("gestor-timer-status-text");
  if (timerStatusText) {
    if (window.App && window.App.liveMatch && window.App.liveMatch.isPlaying) {
      timerStatusText.textContent = "EM ANDAMENTO";
      if (timerDot) timerDot.className = "gestor-pulse-dot";
    } else if (s > 0 && s < totalSecs) {
      timerStatusText.textContent = "PAUSADO";
      if (timerDot) timerDot.className = "gestor-pulse-dot paused";
    } else {
      timerStatusText.textContent = "PRONTO PARA INICIAR";
      if (timerDot) timerDot.className = "gestor-pulse-dot paused";
    }
  }
}

function updateLiveScore(team, diff) {
  if (team === "a") {
    window.App.liveMatch.scoreA = Math.max(0, window.App.liveMatch.scoreA + diff);
    const scoreAEl = document.getElementById("match-control-score-a");
    if (scoreAEl) scoreAEl.textContent = window.App.liveMatch.scoreA;
  } else {
    window.App.liveMatch.scoreB = Math.max(0, window.App.liveMatch.scoreB + diff);
    const scoreBEl = document.getElementById("match-control-score-b");
    if (scoreBEl) scoreBEl.textContent = window.App.liveMatch.scoreB;
  }
  window.App.updateAcompanhamentoUI();
}

async function handleFinishMatch() {
  window.App.isFinishingMatch = true;
  try {
    const teams = JSON.parse(localStorage.getItem("teams")) || [];
    if (teams.length < 2) {
      window.App.showToast("Sorteie os times antes de finalizar partidas.", "error");
      window.App.isFinishingMatch = false;
      return;
    }

    const scoreA = window.App.liveMatch.scoreA;
    const scoreB = window.App.liveMatch.scoreB;
    const teamAName = window.App.liveMatch.teamA;
    const teamBName = window.App.liveMatch.teamB;
    const peladaId = window.App.activePelada ? window.App.activePelada.id : null;

    if (!peladaId) {
      window.App.showToast("Nenhuma pelada selecionada.", "error");
      window.App.isFinishingMatch = false;
      return;
    }

    window.App.showToast(`Fim de Jogo! ${teamAName} ${scoreA} x ${scoreB} ${teamBName}`);

    // 1. Gravar a partida finalizada no banco de dados
    try {
      const goalsDetails = window.App.liveMatch ? (window.App.liveMatch.goals || []) : [];
      const res = await Api.lancarPartida(peladaId, teamAName, teamBName, scoreA, scoreB, goalsDetails);
      if (res.error) {
        console.error("Erro ao salvar partida:", res.error);
      }
    } catch (err) {
      console.error("Erro na requisição de salvar partida:", err);
    }

    // Busca as configurações da pelada ativa
    const peladaAtiva = window.App.activePelada || {};
    const grupoAtivo = window.App.currentGroup || {};
    const winsLimit = parseInt(peladaAtiva.vitorias_para_sair) || parseInt(grupoAtivo.vitorias_para_sair) || 2;
    const exitRule = peladaAtiva.regra_saida || grupoAtivo.regra_saida || "final_fila";
    const tieRule = peladaAtiva.criterio_empate || grupoAtivo.criterio_empate || "ambos_permanecem";

    let isTie = scoreA === scoreB;
    let winner = isTie ? null : (scoreA > scoreB ? teamAName : teamBName);
    let loser = isTie ? null : (scoreA > scoreB ? teamBName : teamAName);

    // Inicializa vitórias consecutivas caso não existam
    window.App.liveMatch.consecutiveWinsA = window.App.liveMatch.consecutiveWinsA || 0;
    window.App.liveMatch.consecutiveWinsB = window.App.liveMatch.consecutiveWinsB || 0;

    // =========================================================================
    // LÓGICA DE AVANÇO DE PARTIDA: MODO TORNEIO VS PELADA NORMAL
    // =========================================================================
    const tState = window.App.liveMatch.tournamentState || (peladaId ? JSON.parse(localStorage.getItem(`tournamentState_${peladaId}`) || 'null') : null);

    if ((peladaAtiva.modo === 'torneio' || tState) && window.TournamentEngine && tState) {
      if (tState.fase === 'finalizado') {
        window.App.showToast("🏆 O Mini Torneio já foi finalizado! Sortear novos times para iniciar outro torneio.", "info");
        window.App.isFinishingMatch = false;
        return;
      }

      const currentMatchId = window.App.liveMatch ? window.App.liveMatch.tournamentMatchId : null;
      let currentMatchObj = getTournamentActiveMatch(tState, currentMatchId);

      if (currentMatchObj && currentMatchObj.status !== 'encerrado') {
        currentMatchObj.golsA = scoreA;
        currentMatchObj.golsB = scoreB;
        currentMatchObj.status = 'encerrado';
        currentMatchObj.vencedor = scoreA > scoreB ? teamAName : (scoreB > scoreA ? teamBName : currentMatchObj.teamA);
      }

      // 2. Recalcula classificação se estiver na fase de grupos ou torneio livre
      if (tState.fase === 'livre' || (peladaAtiva && peladaAtiva.modo === 'torneio_livre')) {
        const freeMatch = {
          id: `torneio_l_${Date.now().toString(36)}`,
          fase: 'livre',
          faseNome: 'Confronto Livre',
          teamA: teamAName,
          teamB: teamBName,
          golsA: scoreA,
          golsB: scoreB,
          status: 'encerrado',
          vencedor: scoreA > scoreB ? teamAName : (scoreB > scoreA ? teamBName : teamAName)
        };
        tState.matches = tState.matches || [];
        tState.matches.push(freeMatch);

        let drawnTeams = tState.teams || [];
        if (!drawnTeams || drawnTeams.length === 0) {
          try { drawnTeams = JSON.parse(localStorage.getItem("teams")) || []; } catch(e) {}
        }
        tState.standings = window.TournamentEngine.calculateStandings(drawnTeams, tState.matches);
        window.App.showToast(`📋 Partida registrada no Torneio Livre! ${teamAName} ${scoreA} x ${scoreB} ${teamBName}`, "success");
      } else if (tState.fase === 'grupo') {
        tState.standings = window.TournamentEngine.calculateStandings(tState.teams, tState.matches);

        // Verifica se TODOS os jogos da fase de grupos terminaram
        const allGroupDone = (tState.matches || []).length > 0 && tState.matches.every(m => m.status === 'encerrado');
        if (allGroupDone) {
          const isPontosCorridos = (peladaAtiva && (peladaAtiva.modo === 'pontos_corridos' || peladaAtiva.modo === 'torneio_pontos_corridos')) || (tState && (tState.modo === 'pontos_corridos' || tState.formato === 'pontos_corridos'));
          if (isPontosCorridos) {
            tState.fase = 'finalizado';
            tState.podium = window.TournamentEngine.determinePodiumPontosCorridos(tState.standings);
            window.App.showToast("🏅 MINI TORNEIO (PONTOS CORRIDOS) FINALIZADO! Confira o Campeão na Tabela!", "success");
          } else {
            const knockoutMatches = window.TournamentEngine.generateKnockoutMatches(tState.standings);
            const firstPhase = (knockoutMatches[0] && knockoutMatches[0].fase) || 'semifinal';
            if (firstPhase === 'quartas') {
              tState.fase = 'quartas';
              tState.knockoutMatches = knockoutMatches;
              window.App.showToast("🏆 Fase de Grupos encerrada! Quartas de Final geradas!", "success");
            } else if (firstPhase === 'final') {
              tState.fase = 'finais';
              tState.finalsMatches = knockoutMatches;
              window.App.showToast("🏆 Fase de Grupos encerrada! Grande Final gerada!", "success");
            } else {
              tState.fase = 'mata_mata';
              tState.knockoutMatches = knockoutMatches;
              window.App.showToast("🏆 Fase de Grupos encerrada! Semifinais geradas!", "success");
            }
          }
        }
      }

      if (tState.fase === 'quartas') {
        const allQfDone = (tState.knockoutMatches || []).length > 0 && tState.knockoutMatches.every(m => m.status === 'encerrado');
        if (allQfDone) {
          tState.fase = 'mata_mata';
          tState.knockoutMatches = window.TournamentEngine.generateSemifinalsFromQuartas(tState.knockoutMatches, tState.standings || tState.teams);
          window.App.showToast("🔥 Quartas de Final encerradas! Semifinais geradas!", "success");
        }
      }

      if (tState.fase === 'mata_mata') {
        const allKnockoutDone = (tState.knockoutMatches || []).length > 0 && tState.knockoutMatches.every(m => m.status === 'encerrado');
        if (allKnockoutDone) {
          tState.fase = 'finais';
          tState.finalsMatches = window.TournamentEngine.generateFinalsMatches(tState.knockoutMatches, tState.standings || tState.teams);
          window.App.showToast("🔥 Semifinais encerradas! Disputa de 3º Lugar e Grande Final geradas!", "success");
        }
      }

      if (tState.fase === 'finais') {
        const allFinalsDone = (tState.finalsMatches || []).length > 0 && tState.finalsMatches.every(m => m.status === 'encerrado');
        if (allFinalsDone) {
          tState.fase = 'finalizado';
          tState.podium = window.TournamentEngine.determinePodium(tState.finalsMatches, tState.standings);
          window.App.showToast("🎉 MINI TORNEIO FINALIZADO! Confira os Campeões!", "success");
        }
      }

      // 3. Define a PRÓXIMA partida a ser jogada no liveMatch respeitando a fase
      let nextMatchObj = getTournamentActiveMatch(tState, null);

      if (nextMatchObj && tState.fase !== 'finalizado') {
        nextMatchObj.status = 'em_andamento';
        window.App.liveMatch.teamA = nextMatchObj.teamA;
        window.App.liveMatch.teamB = nextMatchObj.teamB;
        window.App.liveMatch.tournamentMatchId = nextMatchObj.id;
      } else if (tState.podium) {
        window.App.liveMatch.teamA = tState.podium.primeiro || "Campeão";
        window.App.liveMatch.teamB = tState.podium.segundo || "Vice";
      }

      window.App.liveMatch.tournamentState = tState;
      safeLocalStorageSetItem('tournamentState', tState);
      if (peladaId) {
        safeLocalStorageSetItem(`tournamentState_${peladaId}`, tState);
      }
    } else {
      // -----------------------------------------------------------------------
      // LÓGICA DE REVEZAMENTO PELADA NORMAL (REINA CAMPO)
      // -----------------------------------------------------------------------
      if (isTie) {
        if (tieRule === "saem_ambos") {
          window.App.liveMatch.consecutiveWinsA = 0;
          window.App.liveMatch.consecutiveWinsB = 0;

          if (window.App.waitingQueue.length >= 2) {
            const nextA = window.App.waitingQueue.shift();
            const nextB = window.App.waitingQueue.shift();
            window.App.waitingQueue.push(teamAName, teamBName);
            window.App.liveMatch.teamA = nextA;
            window.App.liveMatch.teamB = nextB;
          }
        } else if (tieRule === "time_entrando") {
          window.App.liveMatch.consecutiveWinsB = 0;
          if (window.App.waitingQueue.length > 0) {
            const next = window.App.waitingQueue.shift();
            window.App.waitingQueue.push(teamBName);
            window.App.liveMatch.teamB = next;
          }
        }
      } else {
        if (winner === teamAName) {
          window.App.liveMatch.consecutiveWinsA++;
          window.App.liveMatch.consecutiveWinsB = 0;
        } else {
          window.App.liveMatch.consecutiveWinsB++;
          window.App.liveMatch.consecutiveWinsA = 0;
        }

        const currentWins = winner === teamAName ? window.App.liveMatch.consecutiveWinsA : window.App.liveMatch.consecutiveWinsB;

        if (currentWins >= winsLimit) {
          window.App.showToast(`O ${winner} atingiu o limite de ${winsLimit} vitórias consecutivas e vai sair para revezamento!`, "info");

          if (winner === teamAName) {
            window.App.liveMatch.consecutiveWinsA = 0;
          } else {
            window.App.liveMatch.consecutiveWinsB = 0;
          }

          if (window.App.waitingQueue.length >= 2) {
            const nextA = window.App.waitingQueue.shift();
            const nextB = window.App.waitingQueue.shift();
            window.App.waitingQueue.push(loser);

            if (exitRule === "fora_1_jogo") {
              window.App.waitingQueue.unshift(winner);
            } else {
              window.App.waitingQueue.push(winner);
            }

            window.App.liveMatch.teamA = nextA;
            window.App.liveMatch.teamB = nextB;
          } else if (window.App.waitingQueue.length === 1) {
            const next = window.App.waitingQueue.shift();
            window.App.waitingQueue.push(loser);

            if (exitRule === "fora_1_jogo") {
              window.App.waitingQueue.unshift(winner);
            } else {
              window.App.waitingQueue.push(winner);
            }

            if (winner === teamAName) {
              window.App.liveMatch.teamB = next;
            } else {
              window.App.liveMatch.teamA = next;
            }
          }
        } else {
          if (window.App.waitingQueue.length > 0) {
            const nextTeam = window.App.waitingQueue.shift();
            window.App.waitingQueue.push(loser);
            if (winner === teamAName) {
              window.App.liveMatch.teamB = nextTeam;
            } else {
              window.App.liveMatch.teamA = nextTeam;
            }
          }
        }
      }
    }


    // Para o cronômetro, reseta placar e autores de gols e volta ao tempo configurado
    window.App.liveMatch.scoreA = 0;
    window.App.liveMatch.scoreB = 0;
    window.App.liveMatch.goals = [];
    resetLiveTimer(true);

    // Persiste a fila e o estado ao vivo no localStorage e no servidor
    await saveLiveMatchState();

    // Re-renderiza a interface do Gestor imediatamente
    renderLiveMatchUI();
    renderWaitingQueue();

    // Sincroniza o novo estado no banco de dados e atualiza histórico recente
    if (window.App.updateAcompanhamentoUI) {
      await window.App.updateAcompanhamentoUI();
    } else {
      await renderRecentMatches();
    }
  } catch (err) {
    console.error("[handleFinishMatch] Erro ao concluir partida:", err);
  } finally {
    window.App.isFinishingMatch = false;
  }
}

async function renderRecentMatches() {
  window.App.renderRecentMatches = renderRecentMatches;
  const container = document.getElementById("recent-matches-container");
  if (!container) return;

  // 1. Tenta pegar de window.App.activePelada
  let peladaId = window.App.activePelada ? window.App.activePelada.id : null;

  // 2. Se nulo, tenta pegar do valor do select de data da pelada na tela
  if (!peladaId) {
    const select = document.getElementById("partidas-select-pelada-date");
    if (select && select.value) {
      peladaId = select.value;
    }
  }

  // 3. Se nulo, tenta pegar do localStorage
  if (!peladaId) {
    try {
      const raw = localStorage.getItem("activePelada");
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.id) peladaId = obj.id;
      }
    } catch (e) { }
  }

  // 4. Se ainda nulo, busca a pelada ativa do grupo via API
  if (!peladaId) {
    const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    if (currentGroup && currentGroup.id && window.Api && window.Api.listarDatasDoGrupo) {
      try {
        const peladas = await Api.listarDatasDoGrupo(currentGroup.id);
        if (Array.isArray(peladas) && peladas.length > 0) {
          const active = peladas.find(p => p.status !== 'finalizada') || peladas[0];
          if (active) {
            peladaId = active.id;
            window.App.activePelada = active;
            localStorage.setItem("activePelada", JSON.stringify(active));
          }
        }
      } catch (e) { }
    }
  }

  if (!peladaId) {
    container.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Selecione uma pelada de referência.</p>`;
    return;
  }

  try {
    const partidas = await Api.listarPartidas(peladaId);
    container.innerHTML = "";

    if (!partidas || !Array.isArray(partidas) || partidas.length === 0) {
      container.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Nenhuma partida finalizada nesta pelada ainda.</p>`;
      return;
    }

    // Ordena do jogo mais recente (#N) para o mais antigo (#1)
    partidas.sort((a, b) => (b.numero_jogo || b.id || 0) - (a.numero_jogo || a.id || 0));

    window.App.openGoalPanels = window.App.openGoalPanels || {};

    let teams = [];
    try { teams = (window.App && window.App.teams) || JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }

    // Popular seletor de filtro por time
    const filterSelect = document.getElementById("recent-matches-filter-team");
    let selectedTeam = "TODOS";
    if (filterSelect) {
      selectedTeam = filterSelect.value || "TODOS";

      const uniqueTeams = new Set();
      (teams || []).forEach(t => { if (t.nome || t.name) uniqueTeams.add(t.nome || t.name); });
      (partidas || []).forEach(p => {
        if (p.time_a_nome) uniqueTeams.add(p.time_a_nome);
        if (p.time_b_nome) uniqueTeams.add(p.time_b_nome);
      });

      let optionsHtml = `<option value="TODOS">🔍 Todos os Times (${partidas.length})</option>`;
      uniqueTeams.forEach(tName => {
        const count = partidas.filter(p => p.time_a_nome === tName || p.time_b_nome === tName).length;
        optionsHtml += `<option value="${tName}">${tName} (${count})</option>`;
      });
      filterSelect.innerHTML = optionsHtml;
      filterSelect.value = uniqueTeams.has(selectedTeam) || selectedTeam === "TODOS" ? selectedTeam : "TODOS";

      filterSelect.onchange = () => {
        renderRecentMatches();
      };
    }

    // Filtragem por time selecionado
    let displayPartidas = partidas;
    if (selectedTeam && selectedTeam !== "TODOS") {
      displayPartidas = partidas.filter(p => p.time_a_nome === selectedTeam || p.time_b_nome === selectedTeam);
    }

    if (displayPartidas.length === 0) {
      container.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 16px 0;">Nenhuma partida encontrada para o <strong>${selectedTeam}</strong> nesta pelada.</p>`;
      return;
    }

    const recentCard = document.getElementById("gestor-recent-matches-card");
    const isRecentDark = recentCard ? recentCard.classList.contains("has-team-theme") : false;

    displayPartidas.forEach(p => {
      const isOpen = !!window.App.openGoalPanels[p.id];
      const tA = (teams || []).find(t => (t.nome || t.name) === p.time_a_nome) || { nome: p.time_a_nome, emblema: 0 };
      const tB = (teams || []).find(t => (t.nome || t.name) === p.time_b_nome) || { nome: p.time_b_nome, emblema: 1 };
      const embA = window.TeamEmblems ? window.TeamEmblems.forTeam(tA) : '';
      const embB = window.TeamEmblems ? window.TeamEmblems.forTeam(tB) : '';

      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.flexDirection = "column";
      item.style.backgroundColor = isRecentDark ? "rgba(255, 255, 255, 0.12)" : "var(--background)";
      item.style.border = isRecentDark ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid var(--border-color)";
      item.style.borderRadius = "10px";
      item.style.borderLeft = "4px solid #10B981";
      item.style.marginBottom = "8px";
      item.style.padding = "10px 14px";
      if (isRecentDark) item.style.backdropFilter = "blur(8px)";

      const dateObj = new Date(p.created_at);
      const timeStr = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      let goalsList = [];
      if (p.autores_gols) {
        try {
          goalsList = typeof p.autores_gols === 'string' ? JSON.parse(p.autores_gols) : p.autores_gols;
        } catch (e) { }
      }

      const textColor = isRecentDark ? "#FFFFFF" : "var(--text-heading)";
      const subTextColor = isRecentDark ? "rgba(255, 255, 255, 0.8)" : "var(--text-caption)";
      const scoreColor = isRecentDark ? "#FDE68A" : "var(--secondary)";

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size: 11px; background: rgba(16, 185, 129, 0.2); color: #10B981; padding: 2px 8px; border-radius: 6px; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.4);">FIM</span>
            <div style="display:inline-flex; align-items:center; gap:6px;">
              <div style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${embA}</div>
              <strong class="text-inter" style="font-size:14px; color:${textColor}; font-family: 'Inter', sans-serif; font-weight:700;">${p.time_a_nome}</strong>
              <span style="color:${scoreColor}; font-size:16px; font-weight:800; margin:0 4px;">${p.gols_time_a}</span>
              <span style="color:${subTextColor}; font-weight:700;">x</span>
              <span style="color:${scoreColor}; font-size:16px; font-weight:800; margin:0 4px;">${p.gols_time_b}</span>
              <strong class="text-inter" style="font-size:14px; color:${textColor}; font-family: 'Inter', sans-serif; font-weight:700;">${p.time_b_nome}</strong>
              <div style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${embB}</div>
            </div>
            <button class="btn btn-sm btn-toggle-goals" data-id="${p.id}" title="Ver quem fez os gols da partida" style="padding: 2px 8px; font-size: 11px; border-radius: 6px; border: 1px solid ${isRecentDark ? 'rgba(255,255,255,0.3)' : 'var(--border-color)'}; background: ${isRecentDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.03)'}; color: ${textColor}; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">⚽ Gols</button>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-sm btn-edit-match" data-partida='${JSON.stringify(p)}' title="Editar" style="padding: 4px; border:none; background:transparent; cursor:pointer;">✏️</button>
            <button class="btn btn-sm btn-delete-match" data-id="${p.id}" title="Excluir" style="padding: 4px; border:none; background:transparent; cursor:pointer;">🗑️</button>
            <span class="text-inter" style="font-size:11px; color:${subTextColor}; margin-left: 4px;">${timeStr}</span>
          </div>
        </div>
        <div id="match-goals-list-${p.id}" style="display: ${isOpen ? 'block' : 'none'}; margin-top: 8px; padding-top: 8px; border-top: 1px dashed ${isRecentDark ? 'rgba(255,255,255,0.2)' : 'var(--border-color)'}; font-size: 12px; color: ${textColor};">
          ${goalsList.length > 0
          ? `<div style="display:flex; flex-wrap:wrap; gap:6px;">${goalsList.map(g => `<span style="background:rgba(16,185,129,0.2); color:#10B981; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; border:1px solid rgba(16,185,129,0.3);">⚽ ${g.autorNome || 'Jogador'}${g.assistNome ? ` <span style="color:${textColor}; font-weight:600;">(Ass: ${g.assistNome} 👟)</span>` : ''} <span style="color:${subTextColor}; font-size:10px;">(${g.teamName || ''})</span></span>`).join('')}</div>`
          : `<span style="font-size:11px; color:${subTextColor};">Placar final: ${p.time_a_nome} ${p.gols_time_a} x ${p.gols_time_b} ${p.time_b_nome}</span>`
        }
        </div>
      `;
      container.appendChild(item);
    });

    setupHistoryActions(); // Vincula cliques nos botões recém-gerados
    applyAthleteTeamStyleToPartidasCards();
    if (window.feather) feather.replace();
  } catch (err) {
    console.error("[renderRecentMatches]", err);
    container.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--danger); padding: 12px 0;">Erro ao carregar histórico de partidas.</p>`;
  }
}

function setupHistoryActions() {
  // Configura cliques no botão ⚽ Gols com persistência no estado openGoalPanels
  const goalButtons = document.querySelectorAll(".btn-toggle-goals");
  goalButtons.forEach(btn => {
    btn.onclick = () => {
      const matchId = btn.getAttribute("data-id");
      window.App.openGoalPanels = window.App.openGoalPanels || {};
      window.App.openGoalPanels[matchId] = !window.App.openGoalPanels[matchId];

      const targetDiv = document.getElementById(`match-goals-list-${matchId}`);
      if (targetDiv) {
        targetDiv.style.display = window.App.openGoalPanels[matchId] ? "block" : "none";
      }
    };
  });
  // Configura cliques de Edição
  const editButtons = document.querySelectorAll(".btn-edit-match");
  editButtons.forEach(btn => {
    btn.onclick = async () => {
      const partidaData = JSON.parse(btn.getAttribute("data-partida"));

      let teams = [];
      try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }

      const peladaId = partidaData.pelada_id || (window.App.activePelada ? window.App.activePelada.id : null);
      let allPartidas = [];

      if (peladaId && window.Api) {
        if (window.Api.listarPartidas) {
          try { allPartidas = await window.Api.listarPartidas(peladaId); } catch (e) { }
        }
        if ((!teams || teams.length === 0) && window.Api.obterLiveState) {
          try {
            const liveRes = await window.Api.obterLiveState(peladaId);
            if (liveRes && liveRes.state && Array.isArray(liveRes.state.teams)) {
              teams = liveRes.state.teams;
              localStorage.setItem("teams", JSON.stringify(teams));
            }
          } catch (e) { }
        }
      }

      window.App.openModal("editar_partida", { partida: partidaData, teams: teams, allPartidas: allPartidas });
    };
  });

  // Configura cliques de Exclusão
  const deleteButtons = document.querySelectorAll(".btn-delete-match");
  deleteButtons.forEach(btn => {
    btn.onclick = async () => {
      const partidaId = btn.getAttribute("data-id");
      const confirmDelete = confirm("Deseja realmente excluir este minijogo do histórico? Esta ação é definitiva.");
      if (!confirmDelete) return;

      try {
        const res = await Api.excluirPartida(partidaId);
        if (res.error) {
          window.App.showToast(res.error, "error");
          return;
        }
        window.App.showToast("Partida removida do histórico com sucesso!");
        await renderRecentMatches(); // Atualiza a lista na tela
      } catch (err) {
        console.error("[setupHistoryActions - Delete]", err);
        window.App.showToast("Erro ao excluir partida do histórico.", "error");
      }
    };
  });
}

async function saveLiveMatchState() {
  const peladaId = window.App.activePelada ? String(window.App.activePelada.id) : null;
  if (window.App.liveMatch) {
    window.App.liveMatch.updatedAt = Date.now();
  }

  safeLocalStorageSetItem("liveMatch", window.App.liveMatch);
  if (peladaId) safeLocalStorageSetItem(`liveMatch_${peladaId}`, window.App.liveMatch);

  safeLocalStorageSetItem("waitingQueue", window.App.waitingQueue);
  if (peladaId) safeLocalStorageSetItem(`waitingQueue_${peladaId}`, window.App.waitingQueue);

  if (window.App.activePelada) {
    safeLocalStorageSetItem("activePelada", window.App.activePelada);
  }

  // Envia atualização em tempo real para a API do backend somente se houver pelada e times sorteados
  if (peladaId && window.Api && window.Api.atualizarLiveState && window.App.teams && window.App.teams.length >= 2) {
    await window.Api.atualizarLiveState(peladaId, window.App.liveMatch, window.App.waitingQueue, window.App.teams);
  }
}

async function handleFinishPeladaDay() {
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (!peladaId) {
    window.App.showToast("Nenhuma pelada selecionada.", "error");
    return;
  }

  const confirmEnd = confirm("Deseja realmente ENCERRAR esta rodada de pelada? Essa ação salvará os dados finais e desativará os controles ativos de jogo e fila do dia.");
  if (!confirmEnd) return;

  try {
    // 1. Atualiza status da pelada para 'finalizada' no banco de dados local
    const res = await Api.atualizarStatusPelada(peladaId, "finalizada");
    if (res.error) {
      window.App.showToast(res.error, "error");
      return;
    }

    // 2. Limpa o localStorage das configurações da partida ativa do dia
    localStorage.removeItem("teams");
    localStorage.removeItem("liveMatch");
    localStorage.removeItem("waitingQueue");

    // 3. Reseta o estado global na memória volátil
    window.App.liveMatch = {
      teamA: 'Time A', teamB: 'Time B',
      scoreA: 0, scoreB: 0,
      timerSeconds: 0, isPlaying: false
    };
    window.App.waitingQueue = [];

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // 4. Atualiza a pelada selecionada para refletir o status
    window.App.activePelada.status = "finalizada";

    // 5. Dispara Notificação Push para os Atletas conferirem o Ranking & Desempenho
    fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "🏆 Pelada Encerrada & Ranking Atualizado!",
        body: "A pelada de hoje foi encerrada! Acesse o app para conferir seu desempenho, gols marcados e a tabela do ranking.",
        url: "/#/jogador/ranking"
      })
    }).catch(e => console.warn("[Push] Erro ao disparar notificação de encerramento:", e));

    // 6. Reinicializa a tela de partidas para aplicar a UI de concluída
    window.App.initPartidas();
    window.App.showToast("Rodada encerrada com sucesso!", "success");

  } catch (err) {
    console.error("[handleFinishPeladaDay]", err);
    window.App.showToast("Erro ao encerrar rodada no banco.", "error");
  }
}

// Soa um alarme sonoro eletrônico (3 bips de apito) usando a Web Audio API nativa
function playAlarmSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Toca 3 bips eletrônicos em sequência rápida
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine'; // Tom limpo senoidal
      osc.frequency.setValueAtTime(800, now + (i * 0.4)); // Frequência do bip (Nota Sol 5)

      gainNode.gain.setValueAtTime(0, now + (i * 0.4));
      gainNode.gain.linearRampToValueAtTime(0.8, now + (i * 0.4) + 0.05); // Fade in rápido
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + (i * 0.4) + 0.35); // Fade out suave

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + (i * 0.4));
      osc.stop(now + (i * 0.4) + 0.35);
    }
  } catch (e) {
    console.warn("[playAlarmSound] Falha ao reproduzir áudio do alarme:", e);
  }
}

async function carregarLiveStateDaPelada(peladaId) {
  if (!peladaId) return;

  const strPeladaId = String(peladaId);
  const liveMatchKey = `liveMatch_${strPeladaId}`;
  const teamsKey = `teams_${strPeladaId}`;
  const queueKey = `waitingQueue_${strPeladaId}`;
  const tStateKey = `tournamentState_${strPeladaId}`;

  const groupConfigs = window.Api ? (window.Api.getConfigs() || []) : [];
  const currentGrp = (window.Auth && window.Auth.currentGroup) || (window.App && window.App.currentGroup);
  const grpCfg = currentGrp ? groupConfigs.find(c => c.grupo_id === currentGrp.id) : null;
  const durationMin = grpCfg ? (grpCfg.tempo_partida || 8) : 8;

  const sanitizeTeamName = (nameStr, idx) => {
    if (!nameStr) return `Time ${String.fromCharCode(65 + (idx || 0))}`;
    const low = String(nameStr).trim().toLowerCase();
    if (low === "azul" || low === "time azul") return "Time A";
    if (low === "preto" || low === "time preto") return "Time B";
    if (low === "vermelho" || low === "time vermelho") return "Time C";
    if (low === "branco" || low === "time branco") return "Time D";
    return nameStr;
  };

  // 1. CARREGAMENTO INICIAL INSTANTÂNEO DO LOCALSTORAGE (Para resposta visual em 0ms)
  let localTeams = safeLocalStorageGetItem(teamsKey) || safeLocalStorageGetItem("teams") || window.App.teams || [];
  let localQueue = safeLocalStorageGetItem(queueKey) || safeLocalStorageGetItem("waitingQueue") || window.App.waitingQueue || [];
  let localLiveMatch = safeLocalStorageGetItem(liveMatchKey) || safeLocalStorageGetItem("liveMatch") || window.App.liveMatch;

  if (Array.isArray(localTeams)) {
    localTeams.forEach((t, i) => {
      t.nome = sanitizeTeamName(t.nome || t.name, i);
      t.name = t.nome;
    });
  }

  window.App.teams = localTeams;
  window.App.waitingQueue = localQueue;
  if (localLiveMatch) window.App.liveMatch = localLiveMatch;

  renderLiveMatchUI();
  renderWaitingQueue();

  // 2. BUSCA DA FONTE DA VERDADE NO SERVIDOR (POSTGRESQL / API) E SOBRESCRITA DO CACHE LOCAL
  let serverTeams = null;
  let serverLiveMatch = null;
  let serverQueue = null;

  if (window.Api && window.Api.obterLiveState) {
    try {
      const res = await window.Api.obterLiveState(peladaId);
      if (res && res.state) {
        if (res.state.liveMatch) serverLiveMatch = res.state.liveMatch;
        if (res.state.teams && Array.isArray(res.state.teams) && res.state.teams.length > 0) serverTeams = res.state.teams;
        if (res.state.waitingQueue && Array.isArray(res.state.waitingQueue)) serverQueue = res.state.waitingQueue;
      }
    } catch (e) {
      console.warn("[Partidas] Erro/Timeout ao obter live state no backend:", e);
    }
  }

  // 3. SOBRESCREVE E PURGA OS DADOS LOCAIS COM OS DADOS FRESCOS DO BANCO DE DADOS
  let finalTeams = (serverTeams && serverTeams.length > 0) ? serverTeams : localTeams;
  let finalQueue = (serverQueue && serverQueue.length >= 0) ? serverQueue : localQueue;
  let finalLiveMatch = serverLiveMatch || localLiveMatch || window.App.liveMatch;

  if (Array.isArray(finalTeams) && finalTeams.length > 0) {
    finalTeams.forEach((t, i) => {
      t.nome = sanitizeTeamName(t.nome || t.name, i);
      t.name = t.nome;
    });
  }

  if (Array.isArray(finalQueue)) {
    finalQueue = finalQueue.map((q, i) => sanitizeTeamName(q, i));
  }

  if (finalLiveMatch && typeof finalLiveMatch === 'object') {
    if (finalLiveMatch.teamA) finalLiveMatch.teamA = sanitizeTeamName(finalLiveMatch.teamA, 0);
    if (finalLiveMatch.teamB) finalLiveMatch.teamB = sanitizeTeamName(finalLiveMatch.teamB, 1);

    if (finalLiveMatch.tournamentState) {
      const tSt = finalLiveMatch.tournamentState;
      if (Array.isArray(tSt.teams)) {
        tSt.teams.forEach((t, i) => { t.nome = sanitizeTeamName(t.nome || t.name, i); t.name = t.nome; });
      }
      if (Array.isArray(tSt.matches)) {
        tSt.matches.forEach(m => {
          m.teamA = sanitizeTeamName(m.teamA, 0);
          m.teamB = sanitizeTeamName(m.teamB, 1);
        });
      }
      safeLocalStorageSetItem(tStateKey, tSt);
      safeLocalStorageSetItem("tournamentState", tSt);
    }
  }

  window.App.teams = finalTeams;
  window.App.waitingQueue = finalQueue;
  window.App.liveMatch = finalLiveMatch;

  if (finalTeams && finalTeams.length > 0) {
    safeLocalStorageSetItem(teamsKey, finalTeams);
    safeLocalStorageSetItem("teams", finalTeams);
  }

  safeLocalStorageSetItem(queueKey, finalQueue);
  safeLocalStorageSetItem("waitingQueue", finalQueue);

  if (finalLiveMatch) {
    safeLocalStorageSetItem(liveMatchKey, finalLiveMatch);
    safeLocalStorageSetItem("liveMatch", finalLiveMatch);
  }

  // 4. Se houverem pelo menos 2 times no sorteio:
  if (finalTeams && finalTeams.length >= 2) {
    const tStateCheck = (window.App.liveMatch ? window.App.liveMatch.tournamentState : null) || (strPeladaId ? JSON.parse(localStorage.getItem(`tournamentState_${strPeladaId}`) || 'null') : null) || JSON.parse(localStorage.getItem('tournamentState') || 'null');
    
    let tA = finalTeams[0].nome || finalTeams[0].name || "Time A";
    let tB = finalTeams[1].nome || finalTeams[1].name || "Time B";
    let tourneyMatchId = null;

    if (tStateCheck && tStateCheck.fase !== 'finalizado') {
      let currentMatch = getTournamentActiveMatch(tStateCheck, window.App.liveMatch ? window.App.liveMatch.tournamentMatchId : null);
      if (currentMatch) {
        tA = currentMatch.teamA;
        tB = currentMatch.teamB;
        tourneyMatchId = currentMatch.id;
      }
    }

    if (!window.App.liveMatch || !window.App.liveMatch.teamA || window.App.liveMatch.teamA === "Time A") {
      window.App.liveMatch = window.App.liveMatch || {};
      window.App.liveMatch.teamA = tA;
      window.App.liveMatch.teamB = tB;
      if (tourneyMatchId) window.App.liveMatch.tournamentMatchId = tourneyMatchId;
      window.App.liveMatch.scoreA = window.App.liveMatch.scoreA || 0;
      window.App.liveMatch.scoreB = window.App.liveMatch.scoreB || 0;
      window.App.liveMatch.isPlaying = false;
      window.App.liveMatch.timerSeconds = window.App.liveMatch.timerSeconds || (durationMin * 60);
      window.App.liveMatch.goals = window.App.liveMatch.goals || [];
    }

    if ((!window.App.waitingQueue || window.App.waitingQueue.length === 0) && finalTeams.length > 2) {
      window.App.waitingQueue = finalTeams.slice(2).map(t => t.nome || t.name);
      safeLocalStorageSetItem(queueKey, window.App.waitingQueue);
      safeLocalStorageSetItem("waitingQueue", window.App.waitingQueue);
    }
  }

  // 5. RE-RENDERIZA A INTERFACE COM OS DADOS FRESCOS DO BANCO DE DADOS
  renderLiveMatchUI();
  renderWaitingQueue();
  renderTournamentUI();
}

async function initPartidasPeladaSelect() {
  const select = document.getElementById("partidas-select-pelada-date");
  if (!select) return;

  let currentGroup = (window.Auth && window.Auth.currentGroup) || (window.App && window.App.currentGroup) || JSON.parse(localStorage.getItem('currentGroup') || 'null');
  let groupId = currentGroup ? currentGroup.id : null;

  if (!groupId) {
    try {
      const grupos = (window.Api && window.Api.listarGrupos) ? await window.Api.listarGrupos() : ((window.Api && window.Api.getGruposDoGestor) ? await window.Api.getGruposDoGestor() : []);
      if (Array.isArray(grupos) && grupos.length > 0) {
        currentGroup = grupos[0];
        groupId = currentGroup.id;
        if (window.Auth && !window.Auth.currentGroup) window.Auth.currentGroup = currentGroup;
        if (window.App) window.App.currentGroup = currentGroup;
        localStorage.setItem('currentGroup', JSON.stringify(currentGroup));
      }
    } catch(e) {
      console.warn('[initPartidasPeladaSelect] Erro ao buscar grupo ativo:', e);
    }
  }

  if (!groupId) {
    select.innerHTML = `<option value="">Nenhum grupo ativo</option>`;
    return;
  }

  try {
    let peladas = (window.Api && window.Api.listarDatasDoGrupo) ? await window.Api.listarDatasDoGrupo(groupId) : [];
    if ((!peladas || peladas.length === 0) && window.supabase) {
      try {
        const { data: dbP } = await window.supabase.from('peladas').select('*').order('data', { ascending: false });
        if (dbP && dbP.length > 0) peladas = dbP;
      } catch (e) {}
    }

    if (!peladas || peladas.length === 0) {
      select.innerHTML = `<option value="">Nenhuma pelada agendada</option>`;
      return;
    }

    select.innerHTML = peladas.map(p => {
      const rawDate = p.data ? String(p.data).split('T')[0] : '';
      const dataFmt = window.Utils ? window.Utils.formatDate(rawDate || p.data) : (p.data || '');
      const label = `📅 ${dataFmt} ${p.horario ? '· ' + p.horario : ''} (${p.status === 'finalizada' ? 'Finalizada' : (p.status === 'ativa' ? 'Ao Vivo' : 'Agendada')})`;
      return `<option value="${p.id}">${label}</option>`;
    }).join('');

    let activePelada = peladas[0];
    if (window.App.activePelada) {
      const found = peladas.find(p => String(p.id) === String(window.App.activePelada.id));
      if (found) activePelada = found;
    }

    window.App.activePelada = activePelada;
    localStorage.setItem("activePelada", JSON.stringify(activePelada));
    select.value = activePelada.id;

    // Sincroniza seletor de modo/formato de torneio
    const selectModo = document.getElementById("partidas-select-pelada-modo");
    if (selectModo && activePelada) {
      selectModo.innerHTML = `
        <option value="normal">Pelada Normal (Reina Campo)</option>
        <option value="torneio">Mini Torneio (Misto: Tabela + Mata-Mata)</option>
        <option value="pontos_corridos">Mini Torneio (Pontos Corridos)</option>
        <option value="mata_mata_direto">Mini Torneio (Mata-Mata Direto)</option>
        <option value="torneio_livre">Torneio Livre (Confrontos Manuais)</option>
      `;
      selectModo.value = activePelada.modo || "normal";
      selectModo.onchange = async (e) => {
        const newModo = e.target.value;
        const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
        if (!peladaId) return;
        try {
          const res = await Api.atualizarConfigPartida(peladaId, { modo: newModo });
          if (res && res.error) {
            window.App.showToast(res.error, "error");
            selectModo.value = window.App.activePelada.modo || "normal";
            return;
          }
          window.App.activePelada.modo = newModo;
          localStorage.setItem("activePelada", JSON.stringify(window.App.activePelada));
          
          let desc = "⚽ Modo Pelada Normal ativado!";
          if (newModo === 'torneio_livre') desc = "📋 Modo Torneio Livre (Confrontos Manuais) ativado!";
          else if (newModo === 'mata_mata_direto') desc = "⚡ Modo Mini Torneio (Mata-Mata Direto) ativado!";
          else if (newModo === 'pontos_corridos' || newModo === 'torneio_pontos_corridos') desc = "🏅 Modo Mini Torneio (Pontos Corridos) ativado!";
          else if (newModo === 'torneio') desc = "🏆 Modo Mini Torneio (Misto: Tabela + Mata-Mata) ativado!";
          
          window.App.showToast(desc, "success");
          renderTournamentUI();
        } catch (err) {
          console.error("[partidasSelectModo]", err);
          window.App.showToast("Erro ao atualizar formato da pelada.", "error");
        }
      };
    }

    await carregarLiveStateDaPelada(activePelada.id);
    await renderRecentMatches();

    const btnCorrigir = document.getElementById("btn-corrigir-jogos-excedentes");
    if (btnCorrigir) {
      btnCorrigir.onclick = async () => {
        const confirmCorrigir = confirm("Deseja remover as partidas excedentes de testes e recalcular a Tabela de Classificação com os 12 jogos reais da Fase de Grupos?");
        if (confirmCorrigir) {
          await window.App.corrigirEJogosExcedentes(activePelada.id);
        }
      };
    }

    select.onchange = async () => {
      const selectedId = select.value;
      const found = peladas.find(p => String(p.id) === String(selectedId));
      if (found) {
        window.App.activePelada = found;
        // Só limpa se a pelada estiver explicitamente 'finalizada'
        if (found.status === "finalizada") {
          limparEstadoPartida();
        }
        localStorage.setItem("activePelada", JSON.stringify(found));

        await carregarLiveStateDaPelada(found.id);

        renderLiveMatchUI();
        renderWaitingQueue();
        await renderRecentMatches();
        window.App.showToast(`Pelada selecionada: ${window.Utils ? window.Utils.formatDate(found.data) : found.data}`);
      }
    };
  } catch (err) {
    console.error("[initPartidasPeladaSelect]", err);
    if (select && select.options.length <= 1 && select.value === "") {
      select.innerHTML = `<option value="">Nenhuma pelada agendada</option>`;
    }
  }
}

function renderTournamentUI() {
  const tournamentCard = document.getElementById("gestor-tournament-card");
  const queueCard = document.getElementById("gestor-queue-card");
  if (!tournamentCard) return;

  const peladaAtiva = window.App.activePelada || {};
  const liveMatch = window.App.liveMatch || {};
  let tState = liveMatch.tournamentState || (peladaAtiva.id ? JSON.parse(localStorage.getItem(`tournamentState_${peladaAtiva.id}`) || 'null') : null) || JSON.parse(localStorage.getItem('tournamentState') || 'null');

  const drawnTeams = window.App.teams || [];
  
  const resolveOfficialTeamName = (nameStr) => {
    if (!nameStr) return nameStr;
    const str = String(nameStr).trim();
    const low = str.toLowerCase();

    if (low === "azul" || low === "time azul" || low === "time a" || low === "time 1" || low === "team 1") {
      return (drawnTeams[0] && (drawnTeams[0].nome || drawnTeams[0].name)) || "Time A";
    }
    if (low === "preto" || low === "time preto" || low === "time b" || low === "time 2" || low === "team 2") {
      return (drawnTeams[1] && (drawnTeams[1].nome || drawnTeams[1].name)) || "Time B";
    }
    if (low === "vermelho" || low === "time vermelho" || low === "time c" || low === "time 3" || low === "team 3") {
      return (drawnTeams[2] && (drawnTeams[2].nome || drawnTeams[2].name)) || "Time C";
    }
    if (low === "branco" || low === "time branco" || low === "time d" || low === "time 4" || low === "team 4") {
      return (drawnTeams[3] && (drawnTeams[3].nome || drawnTeams[3].name)) || "Time D";
    }

    const found = drawnTeams.find(t => (t.nome || t.name || '').trim().toLowerCase() === low);
    return found ? (found.nome || found.name) : str;
  };
  
  // Se existirem times sorteados e tState tiver número diferente de times, sincroniza/recalcula tState com TODOS OS TIMES!
  if (drawnTeams.length >= 2 && window.TournamentEngine) {
    if (!tState || !tState.teams || tState.teams.length !== drawnTeams.length) {
      const turnoAtual = (tState && tState.turno) || 'ida_volta';
      const matches = window.TournamentEngine.generateGroupSchedule(drawnTeams, turnoAtual);
      const standings = window.TournamentEngine.calculateStandings(drawnTeams, matches);
      tState = {
        modo: 'torneio',
        fase: 'grupo',
        turno: turnoAtual,
        teams: drawnTeams,
        matches: matches,
        standings: standings,
        knockoutMatches: (tState && tState.knockoutMatches) || [],
        finalsMatches: (tState && tState.finalsMatches) || []
      };
      if (peladaAtiva.id) {
        safeLocalStorageSetItem(`tournamentState_${peladaAtiva.id}`, tState);
      }
      safeLocalStorageSetItem('tournamentState', tState);
      if (window.App.liveMatch) {
        window.App.liveMatch.tournamentState = tState;
      }
    }
  }

  const isTorneio = (peladaAtiva && (peladaAtiva.modo === 'torneio' || peladaAtiva.modo === 'pontos_corridos' || peladaAtiva.modo === 'torneio_pontos_corridos' || peladaAtiva.modo === 'mata_mata_direto' || peladaAtiva.modo === 'torneio_livre')) || !!tState;

  if (!isTorneio) {
    tournamentCard.style.display = "none";
    if (queueCard) queueCard.style.display = "block";
    return;
  }

  // Se o modo torneio estiver ativo mas tState ainda não existe (sem sorteio realizado)
  if (!tState) {
    tournamentCard.style.display = "block";
    if (queueCard) queueCard.style.display = "none";

    let modoDesc = "Mini Torneio";
    if (peladaAtiva.modo === 'pontos_corridos') modoDesc = "Mini Torneio (Pontos Corridos)";
    else if (peladaAtiva.modo === 'mata_mata_direto') modoDesc = "Mini Torneio (Mata-Mata Direto)";
    else if (peladaAtiva.modo === 'torneio_livre') modoDesc = "Torneio Livre (Confrontos Manuais)";
    else if (peladaAtiva.modo === 'torneio') modoDesc = "Mini Torneio (Misto: Tabela + Mata-Mata)";

    const standingsBody = document.getElementById("tournament-standings-body");
    const matchesList = document.getElementById("tournament-matches-list");
    if (standingsBody) {
      standingsBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 18px; color: #64748B;">🏆 <strong>Formato Ativo: ${modoDesc}</strong><br><span style="font-size:12px;">Realize o sorteio das equipes para gerar a tabela de jogos e classificação!</span></td></tr>`;
    }
    if (matchesList) {
      matchesList.innerHTML = `<div style="text-align:center; padding: 14px;"><button id="btn-quick-open-sorteio" class="btn btn-sm btn-accent" style="font-weight: 700; padding: 8px 18px; border-radius: 8px; cursor: pointer;">🎲 Realizar Sorteio do Torneio</button></div>`;
      setTimeout(() => {
        const btnS = document.getElementById("btn-quick-open-sorteio");
        if (btnS) btnS.onclick = () => window.App.openModal("sorteio");
      }, 50);
    }
    return;
  }

  // Se for torneio com tState: exibe card de torneio e oculta a fila simples
  tournamentCard.style.display = "block";
  if (queueCard) queueCard.style.display = "none";

  const isTeamTheme = tournamentCard.classList.contains("has-team-theme");
  const isPontosCorridos = (peladaAtiva && (peladaAtiva.modo === 'pontos_corridos' || peladaAtiva.modo === 'torneio_pontos_corridos')) || (tState && (tState.modo === 'pontos_corridos' || tState.formato === 'pontos_corridos'));
  const isMataMataDireto = (peladaAtiva && peladaAtiva.modo === 'mata_mata_direto') || (tState && (tState.modo === 'mata_mata_direto' || tState.formato === 'mata_mata_direto'));
  const isTorneioLivre = (peladaAtiva && peladaAtiva.modo === 'torneio_livre') || (tState && (tState.modo === 'torneio_livre' || tState.formato === 'livre'));

  // Badge da Fase
  const badgeEl = document.getElementById("tournament-phase-badge");
  if (badgeEl) {
    if (tState.fase === 'livre' || isTorneioLivre) {
      badgeEl.textContent = "📋 TORNEIO LIVRE (CONFRONTOS MANUAIS)";
      badgeEl.style.background = isTeamTheme ? "rgba(224, 242, 254, 0.25)" : "#E0F2FE";
      badgeEl.style.color = isTeamTheme ? "#BAE6FD" : "#0369A1";
      badgeEl.style.border = "1px solid #0284C7";
    } else if (tState.fase === 'grupo') {
      badgeEl.textContent = isPontosCorridos ? "CLASSIFICAÇÃO (PONTOS CORRIDOS)" : "FASE DE GRUPOS (TABELA MISTA)";
      badgeEl.style.background = isTeamTheme ? "rgba(254, 243, 199, 0.25)" : "#FEF3C7";
      badgeEl.style.color = isTeamTheme ? "#FDE68A" : "#B45309";
      badgeEl.style.border = "1px solid #F59E0B";
    } else if (tState.fase === 'quartas') {
      badgeEl.textContent = isMataMataDireto ? "QUARTAS DE FINAL (MATA-MATA DIRETO)" : "QUARTAS DE FINAL (ELIMINATÓRIA)";
      badgeEl.style.background = isTeamTheme ? "rgba(224, 242, 254, 0.25)" : "#E0F2FE";
      badgeEl.style.color = isTeamTheme ? "#BAE6FD" : "#0369A1";
      badgeEl.style.border = "1px solid #0284C7";
    } else if (tState.fase === 'mata_mata') {
      badgeEl.textContent = isMataMataDireto ? "SEMIFINAIS (MATA-MATA DIRETO)" : "SEMIFINAIS (MATA-MATA)";
      badgeEl.style.background = isTeamTheme ? "rgba(224, 242, 254, 0.25)" : "#E0F2FE";
      badgeEl.style.color = isTeamTheme ? "#BAE6FD" : "#0369A1";
      badgeEl.style.border = "1px solid #0284C7";
    } else if (tState.fase === 'finais') {
      badgeEl.textContent = "FINAIS & DISPUTA DE 3º LUGAR";
      badgeEl.style.background = isTeamTheme ? "rgba(252, 231, 243, 0.25)" : "#FCE7F3";
      badgeEl.style.color = isTeamTheme ? "#FBCFE8" : "#9D174D";
      badgeEl.style.border = "1px solid #EC4899";
    } else if (tState.fase === 'finalizado') {
      badgeEl.textContent = isMataMataDireto ? "⚡ MATA-MATA DIRETO FINALIZADO" : (isPontosCorridos ? "🏅 PONTOS CORRIDOS FINALIZADO" : "🏆 TORNEIO FINALIZADO");
      badgeEl.style.background = isTeamTheme ? "rgba(209, 250, 229, 0.25)" : "#D1FAE5";
      badgeEl.style.color = isTeamTheme ? "#A7F3D0" : "#065F46";
      badgeEl.style.border = "1px solid #10B981";
    }
  }

  // 1. Tabela de Classificação
  const standingsBody = document.getElementById("tournament-standings-body");
  if (standingsBody) {
    const standings = tState.standings || [];
    if (standings.length === 0) {
      standingsBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:12px; color:${isTeamTheme ? '#CBD5E1' : '#64748B'};">Nenhum time sorteado ainda.</td></tr>`;
    } else {
      let html = '';
      standings.forEach((st, idx) => {
        const medal = '';
        const rowBg = isTeamTheme 
          ? (idx === 0 ? 'background: rgba(254, 243, 199, 0.25);' : 'background: rgba(255, 255, 255, 0.08);')
          : (idx === 0 ? 'background: rgba(254, 243, 199, 0.5);' : '');
        const textColor = isTeamTheme ? '#FFFFFF' : '#0F172A';
        const ptsColor = isTeamTheme ? '#FDE68A' : '#D97706';

        html += `
          <tr style="${rowBg} border-bottom: 1px solid ${isTeamTheme ? 'rgba(255,255,255,0.15)' : '#E2E8F0'};">
            <td style="text-align:center; font-weight:700; color:${textColor};">${idx + 1}</td>
            <td style="font-weight:700; color:${textColor};">${medal}${resolveOfficialTeamName(st.nome)}</td>
            <td style="text-align:center; color:${textColor};">${st.jogos}</td>
            <td style="text-align:center; color:${textColor};">${st.vitorias}</td>
            <td style="text-align:center; color:${textColor};">${st.empates}</td>
            <td style="text-align:center; color:${textColor};">${st.derrotas}</td>
            <td style="text-align:center; color:${textColor};">${st.golsPro}</td>
            <td style="text-align:center; color:${textColor};">${st.golsContra}</td>
            <td style="text-align:center; color:${textColor};">${st.saldoGols > 0 ? '+' + st.saldoGols : st.saldoGols}</td>
            <td style="text-align:center; font-weight:800; color:${ptsColor}; font-size:13px;">${st.pontos}</td>
          </tr>
        `;
      });
      standingsBody.innerHTML = html;
    }
  }

  // 2. Lista de Jogos (Agenda do Torneio)
  const matchesList = document.getElementById("tournament-matches-list");
  if (matchesList) {
    let allMatches = [];
    if (Array.isArray(tState.matches)) {
      const optGroup = (window.TournamentEngine && window.TournamentEngine.optimizeMatchSequence)
        ? window.TournamentEngine.optimizeMatchSequence(tState.matches)
        : tState.matches;
      allMatches.push(...optGroup);
    }
    if (Array.isArray(tState.knockoutMatches)) allMatches.push(...tState.knockoutMatches);
    if (Array.isArray(tState.finalsMatches)) allMatches.push(...tState.finalsMatches);

    if (allMatches.length === 0) {
      matchesList.innerHTML = `<div style="text-align:center; padding:12px; color:${isTeamTheme ? '#CBD5E1' : '#64748B'};">Nenhum jogo gerado.</div>`;
    } else {
      let html = '';
      allMatches.forEach((m, idx) => {
        const isCurrent = m.id === (liveMatch.tournamentMatchId) || (m.status === 'em_andamento');
        const isDone = m.status === 'encerrado';

        const statusTag = isDone
          ? `<span style="font-size:10px; background:${isTeamTheme ? 'rgba(16, 185, 129, 0.25)' : '#D1FAE5'}; color:${isTeamTheme ? '#A7F3D0' : '#065F46'}; padding:2px 6px; border-radius:4px; font-weight:700;">✅ ${m.golsA} x ${m.golsB}</span>`
          : (isCurrent
            ? `<span style="font-size:10px; background:${isTeamTheme ? 'rgba(255, 255, 255, 0.2)' : '#F1F5F9'}; color:${isTeamTheme ? '#FFFFFF' : '#64748B'}; padding:2px 6px; border-radius:4px; font-weight:600; border:${isTeamTheme ? '1px solid rgba(255, 255, 255, 0.3)' : 'none'};">⚽ EM ANDAMENTO</span>`
            : `<span style="font-size:10px; background:${isTeamTheme ? 'rgba(255, 255, 255, 0.2)' : '#F1F5F9'}; color:${isTeamTheme ? '#FFFFFF' : '#64748B'}; padding:2px 6px; border-radius:4px; font-weight:600; border:${isTeamTheme ? '1px solid rgba(255, 255, 255, 0.3)' : 'none'};">⏳ A JOGAR</span>`);

        const rowBg = isTeamTheme 
          ? (isCurrent ? 'rgba(254, 243, 199, 0.25)' : 'rgba(255, 255, 255, 0.12)')
          : (isCurrent ? '#FFFBEB' : '#F8FAFC');

        const rowBorder = isTeamTheme
          ? (isCurrent ? '#FCD34D' : 'rgba(255, 255, 255, 0.2)')
          : (isCurrent ? '#FCD34D' : '#E2E8F0');

        const textColor = isTeamTheme ? '#FFFFFF' : '#0F172A';
        const subTextColor = isTeamTheme ? 'rgba(255, 255, 255, 0.85)' : '#64748B';

        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:${rowBg}; border:1px solid ${rowBorder}; border-radius:10px; font-size:12px; margin-bottom: 6px; backdrop-filter: blur(8px);">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:700; color:${subTextColor}; font-size:11px;">${m.faseNome || 'Jogo ' + (idx + 1)}:</span>
              <strong style="color:${textColor}; font-weight:700;">${resolveOfficialTeamName(m.teamA)}</strong>
              <span style="color:${subTextColor}; font-size:11px;">vs</span>
              <strong style="color:${textColor}; font-weight:700;">${resolveOfficialTeamName(m.teamB)}</strong>
            </div>
            <div>${statusTag}</div>
          </div>
        `;
      });
      matchesList.innerHTML = html;
    }
  }

  // 3. Pódio do Torneio
  const podiumCont = document.getElementById("tournament-podium-container");
  const podiumCards = document.getElementById("tournament-podium-cards");
  if (podiumCont && podiumCards) {
    if (tState.podium || tState.fase === 'finalizado') {
      const pod = tState.podium || (window.TournamentEngine ? window.TournamentEngine.determinePodium(tState.finalsMatches, tState.standings) : {});
      podiumCont.style.display = "block";
      podiumCont.style.background = isTeamTheme ? "rgba(0,0,0,0.3)" : "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)";
      podiumCont.style.border = "1.5px solid #FCD34D";

      const cardBg = isTeamTheme ? "rgba(255, 255, 255, 0.18)" : "#FFF";
      const cardText = isTeamTheme ? "#FFFFFF" : "#0F172A";

      podiumCards.innerHTML = `
        <div style="background:${cardBg}; padding:10px; border-radius:8px; border:1px solid #FCD34D; flex:1; min-width:110px;">
          <div style="font-size:24px;">🥇</div>
          <div style="font-size:10px; color:#FDE68A; font-weight:700;">CAMPEÃO</div>
          <strong style="font-size:13px; color:${cardText};">${pod.primeiro || '—'}</strong>
        </div>
        <div style="background:${cardBg}; padding:10px; border-radius:8px; border:1px solid #CBD5E1; flex:1; min-width:110px;">
          <div style="font-size:24px;">🥈</div>
          <div style="font-size:10px; color:#E2E8F0; font-weight:700;">VICE-CAMPEÃO</div>
          <strong style="font-size:13px; color:${cardText};">${pod.segundo || '—'}</strong>
        </div>
        <div style="background:${cardBg}; padding:10px; border-radius:8px; border:1px solid #FDBA74; flex:1; min-width:110px;">
          <div style="font-size:24px;">🥉</div>
          <div style="font-size:10px; color:#FFEDD5; font-weight:700;">3º LUGAR</div>
          <strong style="font-size:13px; color:${cardText};">${pod.terceiro || '—'}</strong>
        </div>
        <div style="background:${cardBg}; padding:10px; border-radius:8px; border:1px solid #E2E8F0; flex:1; min-width:110px;">
          <div style="font-size:24px;">4️⃣</div>
          <div style="font-size:10px; color:#CBD5E1; font-weight:700;">4º LUGAR</div>
          <strong style="font-size:13px; color:${cardText};">${pod.quarto || '—'}</strong>
        </div>
      `;
    } else {
      podiumCont.style.display = "none";
    }
  }

  // Garante a aplicação do estilo do time em todo o card de torneio e seus filhos
  applyAthleteTeamStyleToPartidasCards();
}

window.App.corrigirEJogosExcedentes = async function(peladaId) {
  const activePelada = window.App.activePelada || {};
  const pId = peladaId || (activePelada ? String(activePelada.id) : null);
  if (!pId) return;

  try {
    let partidas = await Api.listarPartidas(pId);
    if (!Array.isArray(partidas) || partidas.length === 0) {
      if (window.App.showToast) window.App.showToast("Nenhuma partida encontrada nesta pelada.", "info");
      return;
    }

    // Ordena as partidas por ID para separar os 12 jogos reais iniciais da fase de grupos
    partidas.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

    const reaisMatches = partidas.slice(0, 12);
    const excedentesMatches = partidas.slice(12);
    const idsParaRemover = excedentesMatches.map(m => parseInt(m.id)).filter(id => !isNaN(id) && id > 0);

    if (idsParaRemover.length > 0) {
      if (window.Api && window.Api.deletarPartidasPorIds) {
        await window.Api.deletarPartidasPorIds(idsParaRemover);
      }
      if (window.supabase) {
        try {
          await window.supabase.from('gols').delete().in('partida_id', idsParaRemover);
          await window.supabase.from('partidas').delete().in('id', idsParaRemover);
        } catch(e) {}
      }
    }

    await recalcularEEstabelecerTorneio(pId, reaisMatches);

    if (window.App.showToast) {
      window.App.showToast(`Limpeza concluída! ${idsParaRemover.length} partidas excedentes removidas. Tabela recalculada com os 12 jogos reais!`, "success");
    }
  } catch(err) {
    console.error("[corrigirEJogosExcedentes]", err);
    if (window.App.showToast) window.App.showToast("Erro ao corrigir jogos excedentes.", "error");
  }
};

async function recalcularEEstabelecerTorneio(pId, reaisMatches) {
  const peladaAtiva = window.App.activePelada || {};
  let tState = window.App.liveMatch ? window.App.liveMatch.tournamentState : null;
  if (!tState) {
    tState = safeLocalStorageGetItem(`tournamentState_${pId}`) || safeLocalStorageGetItem("tournamentState");
  }

  let drawnTeams = window.App.teams || [];
  if (!drawnTeams || drawnTeams.length === 0) {
    drawnTeams = safeLocalStorageGetItem(`teams_${pId}`) || safeLocalStorageGetItem("teams") || [];
  }
  if ((!drawnTeams || drawnTeams.length === 0) && tState && tState.teams) {
    drawnTeams = tState.teams;
  }

  if (!drawnTeams || drawnTeams.length < 2 || !window.TournamentEngine) return;

  // Substitui estritamente se for nome de cor pura antiga (Azul, Branco, Preto, Laranja) sem sobrescrever os nomes do sorteio
  drawnTeams.forEach((t, idx) => {
    const raw = (t.nome || t.name || '').trim().toLowerCase();
    if (raw === "azul" || raw === "time azul") { t.nome = "Time A"; t.name = "Time A"; }
    else if (raw === "preto" || raw === "time preto") { t.nome = "Time B"; t.name = "Time B"; }
    else if (raw === "vermelho" || raw === "time vermelho") { t.nome = "Time C"; t.name = "Time C"; }
    else if (raw === "branco" || raw === "time branco") { t.nome = "Time D"; t.name = "Time D"; }
  });

  window.App.teams = drawnTeams;
  safeLocalStorageSetItem("teams", drawnTeams);
  if (pId) safeLocalStorageSetItem(`teams_${pId}`, drawnTeams);

  const resolveOfficialTeamName = (nameStr) => {
    if (!nameStr) return nameStr;
    const str = String(nameStr).trim();
    const low = str.toLowerCase();
    if (low === "azul" || low === "time azul" || low === "time a" || low === "time 1" || low === "team 1") return "Time A";
    if (low === "preto" || low === "time preto" || low === "time b" || low === "time 2" || low === "team 2") return "Time B";
    if (low === "vermelho" || low === "time vermelho" || low === "time c" || low === "time 3" || low === "team 3") return "Time C";
    if (low === "branco" || low === "time branco" || low === "time d" || low === "time 4" || low === "team 4") return "Time D";
    const found = drawnTeams.find(t => (t.nome || t.name || '').trim().toLowerCase() === low);
    return found ? (found.nome || found.name) : str;
  };

  const turnoAtual = (tState && tState.turno) || 'ida_volta';
  const matches = window.TournamentEngine.generateGroupSchedule(drawnTeams, turnoAtual);

  // Preenche as 12 partidas da fase de grupos com o resultado dos 12 jogos reais
  matches.forEach((m, idx) => {
    let real = (reaisMatches || [])[idx];
    if (!real && reaisMatches) {
      real = reaisMatches.find(r => {
        const rA = resolveOfficialTeamName(r.time_a_nome).toLowerCase();
        const rB = resolveOfficialTeamName(r.time_b_nome).toLowerCase();
        const mA = (m.teamA || '').toLowerCase();
        const mB = (m.teamB || '').toLowerCase();
        return (rA === mA && rB === mB) || (rA === mB && rB === mA);
      });
    }

    if (real) {
      m.golsA = parseInt(real.gols_time_a) || 0;
      m.golsB = parseInt(real.gols_time_b) || 0;
      m.status = 'encerrado';
      m.vencedor = m.golsA > m.golsB ? m.teamA : (m.golsB > m.golsA ? m.teamB : m.teamA);
    }
  });

  // Recalcula a Tabela de Classificação usando APENAS as 12 partidas reais mantidas
  const standings = window.TournamentEngine.calculateStandings(drawnTeams, matches);

  // Gera as Semifinais (Mata-Mata) oficiais a partir da classificação real
  const knockoutMatches = window.TournamentEngine.generateKnockoutMatches(standings);

  const newTState = {
    modo: 'torneio',
    fase: 'mata_mata',
    turno: turnoAtual,
    teams: drawnTeams,
    matches: matches,
    standings: standings,
    knockoutMatches: knockoutMatches,
    finalsMatches: [],
    podium: null
  };

  // Carrega a primeira Semifinal no placar ao vivo (0 x 0)
  if (knockoutMatches && knockoutMatches.length > 0) {
    knockoutMatches[0].status = 'em_andamento';
    window.App.liveMatch = window.App.liveMatch || {};
    window.App.liveMatch.teamA = knockoutMatches[0].teamA;
    window.App.liveMatch.teamB = knockoutMatches[0].teamB;
    window.App.liveMatch.tournamentMatchId = knockoutMatches[0].id;
    window.App.liveMatch.scoreA = 0;
    window.App.liveMatch.scoreB = 0;
    window.App.liveMatch.goals = [];
  }

  window.App.liveMatch.tournamentState = newTState;
  safeLocalStorageSetItem(`tournamentState_${pId}`, newTState);
  safeLocalStorageSetItem('tournamentState', newTState);
  safeLocalStorageSetItem(`liveMatch_${pId}`, window.App.liveMatch);
  safeLocalStorageSetItem('liveMatch', window.App.liveMatch);

  if (window.Api && window.Api.atualizarLiveState) {
    await window.Api.atualizarLiveState(pId, window.App.liveMatch, window.App.waitingQueue || [], drawnTeams);
  }

  renderLiveMatchUI();
  renderTournamentUI();
  await renderRecentMatches();
}
