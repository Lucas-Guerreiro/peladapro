// ==========================================================================
// PÁGINA: GESTOR - PARTIDAS E JOGO AO VIVO (partidas.js)
// ==========================================================================

var timerInterval = null;

window.App.initPartidas = function() {
  const activePelada = window.App.activePelada || {};
  const isFinished = activePelada.status === "finalizada";

  // Se a pelada estiver finalizada, oculta controles de jogo ao vivo e fila
  if (isFinished) {
    const liveCol = document.querySelector('.grid-3 > div:first-child');
    const queueCard = document.getElementById('wait-queue-container')?.closest('.card');
    
    if (liveCol) {
      liveCol.innerHTML = `
        <div class="card" style="background-color: var(--success); color: #FFF; border: none; padding: 28px; text-align: center;">
          <span style="font-size: 40px; display: block; margin-bottom: 12px;">🏁</span>
          <h3 style="color: #FFF; margin-bottom: 8px;">Rodada Finalizada</h3>
          <p class="text-inter" style="font-size: 14px; opacity: 0.9; margin: 0;">Esta rodada de pelada já foi concluída e encerrada pelo gestor. Veja abaixo o histórico de partidas.</p>
        </div>
      `;
    }
    if (queueCard) {
      queueCard.style.display = "none";
    }
  } else {
    // Escutas dos controles de Cronômetro e Jogo
    const btnToggle = document.getElementById("btn-timer-toggle");
    if (btnToggle) btnToggle.onclick = toggleLiveTimer;

    const btnReset = document.getElementById("btn-timer-reset");
    if (btnReset) btnReset.onclick = resetLiveTimer;

    const btnFinish = document.getElementById("btn-finish-match");
    if (btnFinish) btnFinish.onclick = handleFinishMatch;

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

    // Restaura o loop de contagem regressiva se a partida estiver ativamente rodando no estado global
    if (window.App.liveMatch.isPlaying) {
      if (timerInterval) clearInterval(timerInterval);
      
      if (btnToggle) {
        btnToggle.textContent = "Pausar";
        btnToggle.className = "btn btn-sm btn-outline-secondary";
      }

      timerInterval = setInterval(() => {
        if (window.App.liveMatch.timerSeconds > 0) {
          window.App.liveMatch.timerSeconds--;
          saveLiveMatchState(); // Persiste os segundos restantes no banco
          updateTimerDisplay();
        } else {
          window.App.liveMatch.timerSeconds = 0;
          clearInterval(timerInterval);
          window.App.liveMatch.isPlaying = false;
          
          if (btnToggle) {
            btnToggle.textContent = "Iniciar";
            btnToggle.className = "btn btn-sm btn-primary";
          }
          
          playAlarmSound(); // Soa o alarme do apito final
          saveLiveMatchState();
          renderLiveMatchUI();
          window.App.showToast("Tempo Encerrado!", "success");
        }
      }, 1000);
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

  renderLiveMatchUI();
  renderWaitingQueue();
  renderRecentMatches(); // Carrega o histórico de minijogos salvos do banco de dados

  // Inicializar ícones Feather
  if (window.feather) feather.replace();
};

function renderLiveMatchUI() {
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
}

function renderWaitingQueue() {
  const container = document.getElementById("wait-queue-container");
  const counterEl = document.getElementById("queue-count");
  if (!container) return;

  container.innerHTML = "";
  const queue = window.App.waitingQueue || [];

  if (counterEl) {
    counterEl.textContent = `${queue.length} Time${queue.length !== 1 ? 's' : ''}`;
  }

  if (queue.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-caption);" class="text-inter">
        <span style="font-size: 28px; display: block; margin-bottom: 8px;">📋</span>
        Sem times na fila de espera.
      </div>
    `;
    return;
  }

  queue.forEach((teamName, index) => {
    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.padding = "10px 14px";
    item.style.backgroundColor = "var(--background)";
    item.style.borderRadius = "10px";
    item.style.borderLeft = "4px solid var(--primary)";
    
    // Cores alternativas de posição
    const posColors = ["var(--secondary)", "var(--text-caption)", "var(--border-color)"];
    const posBg = posColors[index] || "var(--border-color)";
    const posColor = index === 0 ? "var(--primary)" : "var(--text-caption)";

    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="text-inter" style="font-size: 11px; font-weight: bold; background: ${posBg}; color: ${posColor}; padding: 2px 8px; border-radius: 6px;">
          ${index + 1}º
        </span>
        <strong class="text-inter" style="font-size: 14px; color: var(--text-heading); font-family: 'Bebas Neue'; letter-spacing: 0.5px;">${teamName}</strong>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-sm btn-outline-secondary btn-view-queue-team" data-team="${teamName}" style="padding: 4px; border:none; background:transparent; display:flex; align-items:center; justify-content:center; cursor:pointer;">
          <i data-feather="eye" style="width:14px; height:14px; color:var(--text-heading);"></i>
        </button>
        <span class="text-inter" style="font-size: 11px; color: var(--text-caption);">Aguardando</span>
      </div>
    `;
    container.appendChild(item);
  });

  // Inicializar ícones Feather da fila de espera
  if (window.feather) feather.replace();

  // Configura cliques nos botões de olho da fila de espera
  const viewQueueButtons = container.querySelectorAll(".btn-view-queue-team");
  viewQueueButtons.forEach(btn => {
    btn.onclick = () => {
      const tName = btn.getAttribute("data-team");
      const teams = JSON.parse(localStorage.getItem("teams")) || [];
      const teamObj = teams.find(t => t.nome === tName) || { nome: tName, players: [] };
      window.App.openModal("ver_time", { teamName: teamObj.nome, players: teamObj.players });
    };
  });
}

function toggleLiveTimer() {
  const btn = document.getElementById("btn-timer-toggle");
  if (!btn) return;
  
  if (window.App.liveMatch.isPlaying) {
    clearInterval(timerInterval);
    window.App.liveMatch.isPlaying = false;
    btn.textContent = "Retomar";
    btn.className = "btn btn-sm btn-primary";
    window.App.showToast("Jogo Pausado!");
  } else {
    // Se o tempo estiver zerado ou abaixo, recomeça com o tempo padrão configurado para o grupo
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
    
    timerInterval = setInterval(() => {
      if (window.App.liveMatch.timerSeconds > 0) {
        window.App.liveMatch.timerSeconds--;
        saveLiveMatchState(); // Persiste os segundos em tempo real no banco
        updateTimerDisplay();
      } else {
        // Tempo esgotado: para o intervalo e reseta para o tempo padrão
        clearInterval(timerInterval);
        timerInterval = null;
        window.App.liveMatch.isPlaying = false;

        // Recarrega o tempo configurado para a próxima partida
        const groupConfigs = window.Api.getConfigs() || [];
        const currentGrp = window.Auth.currentGroup;
        const grpConfig = currentGrp ? groupConfigs.find(c => c.grupo_id === currentGrp.id) : null;
        const durationMin = grpConfig ? (grpConfig.tempo_partida || 8) : 8;
        window.App.liveMatch.timerSeconds = durationMin * 60;

        btn.textContent = "Iniciar";
        btn.className = "btn btn-sm btn-primary";
        
        playAlarmSound(); // Soa o alarme sonoro
        saveLiveMatchState();
        updateTimerDisplay();
        renderLiveMatchUI();
        window.App.showToast("Tempo Encerrado!", "success");
      }
    }, 1000);
    window.App.showToast("Jogo Iniciado!");
  }

  saveLiveMatchState();
  renderLiveMatchUI();
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
  const min = Math.floor(window.App.liveMatch.timerSeconds / 60).toString().padStart(2, "0");
  const sec = (window.App.liveMatch.timerSeconds % 60).toString().padStart(2, "0");
  const text = `${min}:${sec}`;

  const controlTimer = document.getElementById("match-control-timer");
  if (controlTimer) controlTimer.textContent = text;
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
  const teams = JSON.parse(localStorage.getItem("teams")) || [];
  if (teams.length < 2) {
    window.App.showToast("Sorteie os times antes de finalizar partidas.", "error");
    return;
  }

  const scoreA = window.App.liveMatch.scoreA;
  const scoreB = window.App.liveMatch.scoreB;
  const teamAName = window.App.liveMatch.teamA;
  const teamBName = window.App.liveMatch.teamB;
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;

  if (!peladaId) {
    window.App.showToast("Nenhuma pelada selecionada.", "error");
    return;
  }

  window.App.showToast(`Fim de Jogo! ${teamAName} ${scoreA} x ${scoreB} ${teamBName}`);

  // 1. Gravar a partida finalizada no banco de dados
  try {
    const res = await Api.lancarPartida(peladaId, teamAName, teamBName, scoreA, scoreB);
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

  if (isTie) {
    // Em caso de empate, zera o contador do time que sair
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
      // Time B (ou o que estava desafiando) sai, o que estava na fila entra no lugar dele
      window.App.liveMatch.consecutiveWinsB = 0;
      if (window.App.waitingQueue.length > 0) {
        const next = window.App.waitingQueue.shift();
        window.App.waitingQueue.push(teamBName);
        window.App.liveMatch.teamB = next;
      }
    }
  } else {
    // Incrementa o contador do vencedor e zera o do perdedor
    if (winner === teamAName) {
      window.App.liveMatch.consecutiveWinsA++;
      window.App.liveMatch.consecutiveWinsB = 0;
    } else {
      window.App.liveMatch.consecutiveWinsB++;
      window.App.liveMatch.consecutiveWinsA = 0;
    }

    const currentWins = winner === teamAName ? window.App.liveMatch.consecutiveWinsA : window.App.liveMatch.consecutiveWinsB;

    // Se o vencedor bateu o limite de vitórias permitidas seguidas
    if (currentWins >= winsLimit) {
      window.App.showToast(`O ${winner} atingiu o limite de ${winsLimit} vitórias consecutivas e vai sair para revezamento!`, "info");
      
      // Zera o contador do vencedor que está saindo
      if (winner === teamAName) {
        window.App.liveMatch.consecutiveWinsA = 0;
      } else {
        window.App.liveMatch.consecutiveWinsB = 0;
      }

      // Ambos os times saem de campo!
      if (window.App.waitingQueue.length >= 2) {
        const nextA = window.App.waitingQueue.shift();
        const nextB = window.App.waitingQueue.shift();

        // 1. O derrotado sempre vai para o final da fila de espera
        window.App.waitingQueue.push(loser);

        // 2. O vencedor limitado depende da regra_saida ('fora_1_jogo' ou 'final_fila')
        if (exitRule === "fora_1_jogo") {
          // Vai para a primeira fila (início da fila) para entrar no próximo jogo
          window.App.waitingQueue.unshift(winner);
        } else {
          // Vai para o final da fila
          window.App.waitingQueue.push(winner);
        }

        window.App.liveMatch.teamA = nextA;
        window.App.liveMatch.teamB = nextB;
      } else if (window.App.waitingQueue.length === 1) {
        // Se só tem 1 time na fila de espera, ele entra no lugar do derrotado. O vencedor (limite) e perdedor saem.
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
      // Fluxo normal de vitória: Vencedor continua, perdedor sai
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

  // Para o cronômetro, reseta placar e volta ao tempo configurado (silent = sem toast extra)
  window.App.liveMatch.scoreA = 0;
  window.App.liveMatch.scoreB = 0;
  resetLiveTimer(true);

  // Persiste a fila e o estado ao vivo no localStorage
  saveLiveMatchState();

  renderLiveMatchUI();
  renderWaitingQueue();
  await renderRecentMatches(); // Atualiza o histórico na tela gestor

  window.App.updateAcompanhamentoUI();
}

async function renderRecentMatches() {
  const container = document.getElementById("recent-matches-container");
  if (!container) return;

  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (!peladaId) {
    container.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Selecione uma pelada de referência.</p>`;
    return;
  }

  try {
    const partidas = await Api.listarPartidas(peladaId);
    container.innerHTML = "";

    if (partidas.length === 0) {
      container.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Nenhuma partida finalizada nesta pelada ainda.</p>`;
      return;
    }

    partidas.forEach(p => {
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.justifyContent = "space-between";
      item.style.alignItems = "center";
      item.style.padding = "10px 14px";
      item.style.backgroundColor = "var(--background)";
      item.style.borderRadius = "8px";
      item.style.borderLeft = "4px solid var(--success)";
      item.style.marginBottom = "8px";

      const dateObj = new Date(p.created_at);
      const timeStr = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size: 11px; background: rgba(0,200,83,0.1); color: var(--success); padding: 2px 8px; border-radius: 6px; font-weight: bold;">FIM</span>
          <strong class="text-inter" style="font-size:14px; font-family: 'Bebas Neue'; letter-spacing: 0.5px; text-transform: uppercase;">
            ${p.time_a_nome} <span style="color:var(--secondary); font-size:16px;">${p.gols_time_a}</span> 
            x 
            <span style="color:var(--accent); font-size:16px;">${p.gols_time_b}</span> ${p.time_b_nome}
          </strong>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn btn-sm btn-edit-match" data-partida='${JSON.stringify(p)}' title="Editar" style="padding: 4px; border:none; background:transparent; cursor:pointer;">✏️</button>
          <button class="btn btn-sm btn-delete-match" data-id="${p.id}" title="Excluir" style="padding: 4px; border:none; background:transparent; cursor:pointer;">🗑️</button>
          <span class="text-inter" style="font-size:11px; color:var(--text-caption); margin-left: 4px;">${timeStr}</span>
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
  // Configura cliques de Edição
  const editButtons = document.querySelectorAll(".btn-edit-match");
  editButtons.forEach(btn => {
    btn.onclick = () => {
      const partidaData = JSON.parse(btn.getAttribute("data-partida"));
      window.App.openModal("editar_partida", { partida: partidaData });
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

function saveLiveMatchState() {
  localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
  localStorage.setItem("waitingQueue", JSON.stringify(window.App.waitingQueue));
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

    // 5. Reinicializa a tela de partidas para aplicar a UI de concluída
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
