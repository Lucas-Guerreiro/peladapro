// ==========================================================================
// PÁGINA: GESTOR - PARTIDAS E JOGO AO VIVO (partidas.js)
// ==========================================================================

var timerInterval = null;

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
  }

  setTimeout(() => {
    if (window.App && window.App.applyModoNoturnoGlobal) {
      window.App.applyModoNoturnoGlobal();
    }
  }, 50);
};

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

    // Se a pelada ativa estiver finalizada, limpa o estado e NÃO recarrega confronto/fila
    const peladaAtivaPoll = window.App.activePelada || {};
    if (peladaAtivaPoll.status === "finalizada") {
      limparEstadoPartida();
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
  const isTorneio = (peladaAtiva && peladaAtiva.modo === 'torneio') || !!tState;

  if (isTorneio && tState) {
    const currentMatchId = liveMatch ? liveMatch.tournamentMatchId : null;

    if (tState.fase === 'grupo') {
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
    teamsList = (window.App && window.App.teams && window.App.teams.length > 0)
      ? window.App.teams
      : JSON.parse(localStorage.getItem("teams")) || [];
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
    if (queueCard) queueCard.style.display = "none";

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
    return;
  }

  // Se houver times sorteados, exibir os elementos normalmente e ocultar o infoCard
  if (timerCont) timerCont.style.display = "block";
  if (scoreCont) scoreCont.style.display = "block";
  if (finishCont) finishCont.style.display = "flex";
  if (queueCard) queueCard.style.display = "block";
  if (infoCard) infoCard.style.display = "none";

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
    phaseBanner.style.background = pInfo.bg;
    phaseBanner.style.color = pInfo.color;
    phaseBanner.style.border = pInfo.border;
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
    if (window.App.liveMatch.isPlaying) {
      badgeEl.textContent = "EM ANDAMENTO";
      badgeEl.style.background = "var(--success)";
      badgeEl.style.color = "#FFF";
    } else if (window.App.liveMatch.timerSeconds > 0) {
      badgeEl.textContent = "PAUSADO";
      badgeEl.style.background = "var(--warning)";
      badgeEl.style.color = "var(--primary)";
    } else {
      badgeEl.textContent = "PRONTO PARA INICIAR";
      badgeEl.style.background = "var(--secondary)";
      badgeEl.style.color = "var(--primary)";
    }
  }

  updateTimerDisplay();
  renderTournamentUI();
}

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
  let queue = (window.App.waitingQueue && Array.isArray(window.App.waitingQueue) && window.App.waitingQueue.length > 0)
    ? window.App.waitingQueue
    : [];

  if (!queue || queue.length === 0) {
    try { queue = JSON.parse(localStorage.getItem("waitingQueue")) || []; } catch (e) { }
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

      let currentMatchObj = null;
      const currentMatchId = window.App.liveMatch ? window.App.liveMatch.tournamentMatchId : null;

      let searchList = [];
      if (tState.fase === 'grupo') searchList = tState.matches || [];
      else if (tState.fase === 'mata_mata') searchList = tState.knockoutMatches || [];
      else if (tState.fase === 'finais') searchList = tState.finalsMatches || [];

      if (currentMatchId) {
        currentMatchObj = searchList.find(m => m.id === currentMatchId);
      }
      if (!currentMatchObj) {
        currentMatchObj = searchList.find(m => m.status !== 'encerrado');
      }

      if (currentMatchObj) {
        currentMatchObj.golsA = scoreA;
        currentMatchObj.golsB = scoreB;
        currentMatchObj.status = 'encerrado';
        currentMatchObj.vencedor = scoreA > scoreB ? teamAName : (scoreB > scoreA ? teamBName : (currentMatchObj.teamA));
      }

      // 2. Recalcula classificação se estiver na fase de grupos
      if (tState.fase === 'grupo') {
        tState.standings = window.TournamentEngine.calculateStandings(tState.teams, tState.matches);

        // Verifica se TODOS os jogos da fase de grupos terminaram
        const allGroupDone = (tState.matches || []).length > 0 && tState.matches.every(m => m.status === 'encerrado');
        if (allGroupDone) {
          tState.fase = 'mata_mata';
          tState.knockoutMatches = window.TournamentEngine.generateKnockoutMatches(tState.standings);
          window.App.showToast("🏆 Fase de Grupos encerrada! Semifinais geradas!", "success");
        }
      }

      if (tState.fase === 'mata_mata') {
        const allKnockoutDone = (tState.knockoutMatches || []).length > 0 && tState.knockoutMatches.every(m => m.status === 'encerrado');
        if (allKnockoutDone) {
          tState.fase = 'finais';
          tState.finalsMatches = window.TournamentEngine.generateFinalsMatches(tState.knockoutMatches, tState.standings);
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

      // 3. Define a PRÓXIMA partida a ser jogada no liveMatch
      let nextMatchObj = null;
      if (tState.fase === 'grupo') {
        nextMatchObj = (tState.matches || []).find(m => m.status !== 'encerrado');
      } else if (tState.fase === 'mata_mata') {
        nextMatchObj = (tState.knockoutMatches || []).find(m => m.status !== 'encerrado');
      } else if (tState.fase === 'finais') {
        nextMatchObj = (tState.finalsMatches || []).find(m => m.status !== 'encerrado');
      }

      if (nextMatchObj) {
        nextMatchObj.status = 'em_andamento';
        window.App.liveMatch.teamA = nextMatchObj.teamA;
        window.App.liveMatch.teamB = nextMatchObj.teamB;
        window.App.liveMatch.tournamentMatchId = nextMatchObj.id;
      } else if (tState.podium) {
        window.App.liveMatch.teamA = tState.podium.primeiro || "Campeão";
        window.App.liveMatch.teamB = tState.podium.segundo || "Vice";
      }

      window.App.liveMatch.tournamentState = tState;
      try { localStorage.setItem("tournamentState", JSON.stringify(tState)); } catch (e) { }
      if (peladaId) {
        try { localStorage.setItem(`tournamentState_${peladaId}`, JSON.stringify(tState)); } catch (e) { }
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

    displayPartidas.forEach(p => {
      const isOpen = !!window.App.openGoalPanels[p.id];
      const tA = (teams || []).find(t => (t.nome || t.name) === p.time_a_nome) || { nome: p.time_a_nome, emblema: 0 };
      const tB = (teams || []).find(t => (t.nome || t.name) === p.time_b_nome) || { nome: p.time_b_nome, emblema: 1 };
      const embA = window.TeamEmblems ? window.TeamEmblems.forTeam(tA) : '';
      const embB = window.TeamEmblems ? window.TeamEmblems.forTeam(tB) : '';

      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.flexDirection = "column";
      item.style.backgroundColor = "var(--background)";
      item.style.borderRadius = "8px";
      item.style.borderLeft = "4px solid var(--success)";
      item.style.marginBottom = "8px";
      item.style.padding = "10px 14px";

      const dateObj = new Date(p.created_at);
      const timeStr = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      let goalsList = [];
      if (p.autores_gols) {
        try {
          goalsList = typeof p.autores_gols === 'string' ? JSON.parse(p.autores_gols) : p.autores_gols;
        } catch (e) { }
      }

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size: 11px; background: rgba(0,200,83,0.1); color: var(--success); padding: 2px 8px; border-radius: 6px; font-weight: bold;">FIM</span>
            <div style="display:inline-flex; align-items:center; gap:6px;">
              <div style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${embA}</div>
              <strong class="text-inter" style="font-size:14px; font-family: 'Inter', sans-serif;">${p.time_a_nome}</strong>
              <span style="color:var(--secondary); font-size:16px; font-weight:800; margin:0 4px;">${p.gols_time_a}</span>
              <span style="color:#64748B; font-weight:700;">x</span>
              <span style="color:var(--accent); font-size:16px; font-weight:800; margin:0 4px;">${p.gols_time_b}</span>
              <strong class="text-inter" style="font-size:14px; font-family: 'Inter', sans-serif;">${p.time_b_nome}</strong>
              <div style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">${embB}</div>
            </div>
            <button class="btn btn-sm btn-toggle-goals" data-id="${p.id}" title="Ver quem fez os gols da partida" style="padding: 2px 8px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05); color: var(--text-heading); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">⚽ Gols</button>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-sm btn-edit-match" data-partida='${JSON.stringify(p)}' title="Editar" style="padding: 4px; border:none; background:transparent; cursor:pointer;">✏️</button>
            <button class="btn btn-sm btn-delete-match" data-id="${p.id}" title="Excluir" style="padding: 4px; border:none; background:transparent; cursor:pointer;">🗑️</button>
            <span class="text-inter" style="font-size:11px; color:var(--text-caption); margin-left: 4px;">${timeStr}</span>
          </div>
        </div>
        <div id="match-goals-list-${p.id}" style="display: ${isOpen ? 'block' : 'none'}; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color); font-size: 12px; color: var(--text-heading);">
          ${goalsList.length > 0
          ? `<div style="display:flex; flex-wrap:wrap; gap:6px;">${goalsList.map(g => `<span style="background:rgba(16,185,129,0.1); color:#10B981; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">⚽ ${g.autorNome || 'Jogador'}${g.assistNome ? ` <span style="color:#0F172A; font-weight:600;">(Ass: ${g.assistNome} 👟)</span>` : ''} <span style="color:var(--text-caption); font-size:10px;">(${g.teamName || ''})</span></span>`).join('')}</div>`
          : `<span style="font-size:11px; color:var(--text-caption);">Placar final: ${p.time_a_nome} ${p.gols_time_a} x ${p.gols_time_b} ${p.time_b_nome}</span>`
        }
        </div>
      `;
      container.appendChild(item);
    });

    setupHistoryActions(); // Vincula cliques nos botões recém-gerados
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
  if (window.App.liveMatch) {
    window.App.liveMatch.updatedAt = Date.now();
  }
  localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
  localStorage.setItem("waitingQueue", JSON.stringify(window.App.waitingQueue));
  if (window.App.activePelada) {
    localStorage.setItem("activePelada", JSON.stringify(window.App.activePelada));
  }

  // Envia atualização em tempo real para a API do backend
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (peladaId && window.Api && window.Api.atualizarLiveState) {
    let teams = [];
    try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }
    await window.Api.atualizarLiveState(peladaId, window.App.liveMatch, window.App.waitingQueue, teams);
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
  // Se a pelada ativa NÃO estiver em andamento (ex: 'agendada' para o futuro ou 'finalizada'), limpa confronto/fila
  const peladaAtiva = window.App.activePelada || {};
  if (peladaAtiva.status !== "ativa" && peladaAtiva.status !== "em_andamento") {
    limparEstadoPartida();
    return;
  }

  const groupConfigs = window.Api.getConfigs() || [];
  const currentGrp = window.Auth.currentGroup;
  const grpCfg = currentGrp ? groupConfigs.find(c => c.grupo_id === currentGrp.id) : null;
  const durationMin = grpCfg ? (grpCfg.tempo_partida || 8) : 8;

  let stateCarregado = false;

  if (window.Api && window.Api.obterLiveState) {
    try {
      const res = await window.Api.obterLiveState(peladaId);
      if (res && res.state) {
        if (res.state.liveMatch) {
          window.App.liveMatch = res.state.liveMatch;
          localStorage.setItem("liveMatch", JSON.stringify(res.state.liveMatch));
        } else {
          window.App.liveMatch = {
            teamA: "Time A",
            teamB: "Time B",
            scoreA: 0,
            scoreB: 0,
            isPlaying: false,
            timerRunning: false,
            timerSeconds: durationMin * 60,
            goals: []
          };
          localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
        }

        if (res.state.teams && res.state.teams.length > 0) {
          localStorage.setItem("teams", JSON.stringify(res.state.teams));
          window.App.teams = res.state.teams;
        } else {
          localStorage.removeItem("teams");
          window.App.teams = [];
        }

        if (res.state.waitingQueue) {
          window.App.waitingQueue = res.state.waitingQueue;
          localStorage.setItem("waitingQueue", JSON.stringify(res.state.waitingQueue));
        } else {
          window.App.waitingQueue = [];
          localStorage.setItem("waitingQueue", "[]");
        }
        stateCarregado = true;
      }
    } catch (e) {
      console.error("[Partidas] Erro ao obter live state da pelada:", e);
    }
  }

  if (!stateCarregado) {
    window.App.liveMatch = {
      teamA: "Time A",
      teamB: "Time B",
      scoreA: 0,
      scoreB: 0,
      isPlaying: false,
      timerRunning: false,
      timerSeconds: durationMin * 60,
      goals: []
    };
    localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
    localStorage.removeItem("teams");
    window.App.teams = [];
    window.App.waitingQueue = [];
    localStorage.setItem("waitingQueue", "[]");
  }
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
    const peladas = (window.Api && window.Api.listarDatasDoGrupo) ? await window.Api.listarDatasDoGrupo(groupId) : [];
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

    await carregarLiveStateDaPelada(activePelada.id);
    await renderRecentMatches();

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
  }
}

function renderTournamentUI() {
  const tournamentCard = document.getElementById("gestor-tournament-card");
  const queueCard = document.getElementById("gestor-queue-card");
  if (!tournamentCard) return;

  const peladaAtiva = window.App.activePelada || {};
  const liveMatch = window.App.liveMatch || {};
  const tState = liveMatch.tournamentState || (peladaAtiva.id ? JSON.parse(localStorage.getItem(`tournamentState_${peladaAtiva.id}`) || 'null') : null);

  const isTorneio = (peladaAtiva.modo === 'torneio') || !!tState;

  if (!isTorneio || !tState) {
    tournamentCard.style.display = "none";
    if (queueCard) queueCard.style.display = "block";
    return;
  }

  // Se for torneio: exibe card de torneio e oculta a fila simples
  tournamentCard.style.display = "block";
  if (queueCard) queueCard.style.display = "none";

  // Badge da Fase
  const badgeEl = document.getElementById("tournament-phase-badge");
  if (badgeEl) {
    if (tState.fase === 'grupo') {
      badgeEl.textContent = "FASE DE GRUPOS (TABELA MISTA)";
      badgeEl.style.background = "#FEF3C7"; badgeEl.style.color = "#B45309";
    } else if (tState.fase === 'mata_mata') {
      badgeEl.textContent = "SEMIFINAIS (MATA-MATA)";
      badgeEl.style.background = "#E0F2FE"; badgeEl.style.color = "#0369A1";
    } else if (tState.fase === 'finais') {
      badgeEl.textContent = "FINAIS & DISPUTA DE 3º LUGAR";
      badgeEl.style.background = "#FCE7F3"; badgeEl.style.color = "#9D174D";
    } else if (tState.fase === 'finalizado') {
      badgeEl.textContent = "🏆 TORNEIO FINALIZADO";
      badgeEl.style.background = "#D1FAE5"; badgeEl.style.color = "#065F46";
    }
  }

  // 1. Tabela de Classificação
  const standingsBody = document.getElementById("tournament-standings-body");
  if (standingsBody) {
    const standings = tState.standings || [];
    if (standings.length === 0) {
      standingsBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:12px; color:#64748B;">Nenhum time sorteado ainda.</td></tr>`;
    } else {
      let html = '';
      standings.forEach((st, idx) => {
        const medal = idx === 0 ? '🥇 ' : (idx === 1 ? '🥈 ' : (idx === 2 ? '🥉 ' : ''));
        html += `
          <tr style="${idx === 0 ? 'font-weight:700; background:rgba(254,243,199,0.3);' : ''}">
            <td style="text-align:center; font-weight:700;">${idx + 1}</td>
            <td style="font-weight:700; color:#0F172A;">${medal}${st.nome}</td>
            <td style="text-align:center;">${st.jogos}</td>
            <td style="text-align:center;">${st.vitorias}</td>
            <td style="text-align:center;">${st.empates}</td>
            <td style="text-align:center;">${st.derrotas}</td>
            <td style="text-align:center;">${st.golsPro}</td>
            <td style="text-align:center;">${st.golsContra}</td>
            <td style="text-align:center;">${st.saldoGols > 0 ? '+' + st.saldoGols : st.saldoGols}</td>
            <td style="text-align:center; font-weight:800; color:#D97706; font-size:13px;">${st.pontos}</td>
          </tr>
        `;
      });
      standingsBody.innerHTML = html;
    }
  }

  // 2. Lista de Jogos do Torneio
  const matchesList = document.getElementById("tournament-matches-list");
  if (matchesList) {
    let allMatches = [];
    if (Array.isArray(tState.matches)) allMatches.push(...tState.matches);
    if (Array.isArray(tState.knockoutMatches)) allMatches.push(...tState.knockoutMatches);
    if (Array.isArray(tState.finalsMatches)) allMatches.push(...tState.finalsMatches);

    if (allMatches.length === 0) {
      matchesList.innerHTML = `<div style="text-align:center; padding:12px; color:#64748B;">Nenhum jogo gerado.</div>`;
    } else {
      let html = '';
      allMatches.forEach((m, idx) => {
        const isCurrent = m.id === (liveMatch.tournamentMatchId) || (m.status === 'em_andamento');
        const isDone = m.status === 'encerrado';

        const statusTag = isDone
          ? `<span style="font-size:10px; background:#D1FAE5; color:#065F46; padding:2px 6px; border-radius:4px; font-weight:700;">✅ ${m.golsA} x ${m.golsB}</span>`
          : (isCurrent
            ? `<span style="font-size:10px; background:#FEF3C7; color:#B45309; padding:2px 6px; border-radius:4px; font-weight:700;">⚽ EM ANDAMENTO</span>`
            : `<span style="font-size:10px; background:#F1F5F9; color:#64748B; padding:2px 6px; border-radius:4px; font-weight:600;">⏳ A JOGAR</span>`);

        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:${isCurrent ? '#FFFBEB' : '#F8FAFC'}; border:1px solid ${isCurrent ? '#FCD34D' : '#E2E8F0'}; border-radius:8px; font-size:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:700; color:#64748B; font-size:11px;">${m.faseNome || 'Jogo ' + (idx + 1)}:</span>
              <strong style="color:#0F172A;">${m.teamA}</strong>
              <span style="color:#94A3B8; font-size:11px;">vs</span>
              <strong style="color:#0F172A;">${m.teamB}</strong>
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
      podiumCards.innerHTML = `
        <div style="background:#FFF; padding:10px; border-radius:8px; border:1px solid #FCD34D; flex:1; min-width:110px;">
          <div style="font-size:24px;">🥇</div>
          <div style="font-size:10px; color:#B45309; font-weight:700;">CAMPEÃO</div>
          <strong style="font-size:13px; color:#0F172A;">${pod.primeiro || '—'}</strong>
        </div>
        <div style="background:#FFF; padding:10px; border-radius:8px; border:1px solid #CBD5E1; flex:1; min-width:110px;">
          <div style="font-size:24px;">🥈</div>
          <div style="font-size:10px; color:#475569; font-weight:700;">VICE-CAMPEÃO</div>
          <strong style="font-size:13px; color:#0F172A;">${pod.segundo || '—'}</strong>
        </div>
        <div style="background:#FFF; padding:10px; border-radius:8px; border:1px solid #FDBA74; flex:1; min-width:110px;">
          <div style="font-size:24px;">🥉</div>
          <div style="font-size:10px; color:#C2410C; font-weight:700;">3º LUGAR</div>
          <strong style="font-size:13px; color:#0F172A;">${pod.terceiro || '—'}</strong>
        </div>
        <div style="background:#FFF; padding:10px; border-radius:8px; border:1px solid #E2E8F0; flex:1; min-width:110px;">
          <div style="font-size:24px;">4️⃣</div>
          <div style="font-size:10px; color:#64748B; font-weight:700;">4º LUGAR</div>
          <strong style="font-size:13px; color:#0F172A;">${pod.quarto || '—'}</strong>
        </div>
      `;
    } else {
      podiumCont.style.display = "none";
    }
  }
}
