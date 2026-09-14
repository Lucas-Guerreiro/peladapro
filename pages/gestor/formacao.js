// ==========================================================================
// PÁGINA: GESTOR - FORMAÇÃO E SORTEIO (formacao.js)
// ==========================================================================

// ===== FUNÇÃO AUXILIAR PARA PEGAR A CHAVE CORRETA DOS TIMES =====
function getTeamsKey() {
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  return peladaId ? `teams_${peladaId}` : "teams";
}

// Salva de forma segura no localStorage com proteção contra QuotaExceededError
function safeSetStorage(key, value) {
  const strVal = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    localStorage.setItem(key, strVal);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
      console.warn(`[Storage] Cota excedida ao salvar '${key}'. Limpando cópias descartáveis...`);
      try {
        localStorage.removeItem("teams");
        localStorage.removeItem("groupEmblems");
        localStorage.removeItem("performanceData");
        localStorage.setItem(key, strVal);
        return true;
      } catch (err2) {
        console.warn(`[Storage] Cota cheia para '${key}'. Mantido em memória.`, err2);
        if (window.App && window.App.showToast && !window._storageToastShown) {
          window._storageToastShown = true;
          window.App.showToast("Armazenamento do navegador cheio. Dados mantidos nesta sessão.", "warning");
          setTimeout(() => { window._storageToastShown = false; }, 10000);
        }
        return false;
      }
    }
    console.warn(`[Storage] Erro ao salvar '${key}':`, e);
    return false;
  }
}

// Remove fotos base64 pesadas de jogadores antes de persistir no storage, preservando emblemas dos times
function enxugarTimesParaStorage(teams) {
  if (!Array.isArray(teams)) return teams;
  return teams.map(t => {
    const copia = { ...t };
    if (Array.isArray(t.players)) {
      copia.players = t.players.map(p => {
        const leve = { ...p };
        delete leve.foto;
        return leve;
      });
    }
    return copia;
  });
}

// Remove chaves de peladas antigas/finalizadas e órfãs para liberar espaço
function limparDadosAntigosLocalStorage(peladasList) {
  if (!Array.isArray(peladasList) || peladasList.length === 0) return;
  try {
    const activeIds = new Set(peladasList.map(p => String(p.id)));
    const finalizedIds = new Set(peladasList.filter(p => p.status === 'finalizada').map(p => String(p.id)));
    const curActiveId = window.App.activePelada ? String(window.App.activePelada.id) : null;
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const match = k.match(/^(teams|tournamentState|liveMatch|waitingQueue)_(\d+)$/);
      if (match) {
        const pId = match[2];
        if (!activeIds.has(pId) || (finalizedIds.has(pId) && pId !== curActiveId)) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) { }
    });
    if (curActiveId && localStorage.getItem(`teams_${curActiveId}`)) {
      try { localStorage.removeItem("teams"); } catch (e) { }
    }
  } catch (err) {
    console.warn("[Storage] Limpeza não-bloqueante falhou:", err);
  }
}

window.App.initFormacao = async function () {
  if (!window.App.activePelada) {
    try {
      const savedPelada = JSON.parse(localStorage.getItem("activePelada") || "null");
      if (savedPelada && (savedPelada.id || savedPelada.pelada_id)) {
        window.App.activePelada = savedPelada;
      }
    } catch (e) { }
  }
  const peladaId = window.App.activePelada ? (window.App.activePelada.id || window.App.activePelada.pelada_id) : null;
  // O carregamento do estado e times da pelada ativa é delegado ao renderManagerCheckin
  await renderManagerCheckin(peladaId);
  const group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  const groupId = group ? group.id : null;
  const token = localStorage.getItem("token");
  if (groupId && token) {
    fetch(`/api/formacao/emblemas/grupo/${groupId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    }).then(res => res.json()).then(data => {
      if (Array.isArray(data)) {
        window._groupEmblemsList = data;
        localStorage.setItem("groupEmblems", JSON.stringify(data));
      }
    }).catch(e => { });
  }
  await window.App.renderDrawnTeams();
  // Inicializa a alternancia entre as abas Formacao dos Times e Modo de Jogo
  setupFormacaoSubtabs();

  // Escutas
  const btnDraw = document.getElementById("btn-draw-teams");
  if (btnDraw) {
    btnDraw.onclick = () => window.App.openModal("sorteio");
  }
  const btnNomesTimes = document.getElementById("btn-cadastrar-nomes-times");
  if (btnNomesTimes) {
    btnNomesTimes.onclick = () => window.App.abrirModalNomesTimes();
  }


  const btnExportWhatsapp = document.getElementById("btn-export-teams-whatsapp");
  if (btnExportWhatsapp) {
    btnExportWhatsapp.onclick = () => window.App.exportTeamsWhatsApp();
  }
  const btnSyncCloud = document.getElementById("btn-sync-teams-cloud");
  if (btnSyncCloud) {
    btnSyncCloud.onclick = async () => {
      await syncDrawnTeamsToCloud(true);
    };
  }
  const btnClearTeams = document.getElementById("btn-clear-teams");
  if (btnClearTeams) {
    btnClearTeams.onclick = async () => {
      const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
      if (!peladaId) { window.App.showToast("Selecione uma pelada primeiro.", "warning"); return; }
      if (!confirm("Tem certeza que deseja apagar a formação de times deste dia localmente e na nuvem?")) return;
      try {
        const teamsKey = getTeamsKey();
        // 1. Limpa localStorage
        localStorage.removeItem(teamsKey);
        localStorage.removeItem(`teams_${peladaId}`);
        localStorage.removeItem("teams");
        localStorage.removeItem("waitingQueue");
        localStorage.removeItem(`waitingQueue_${peladaId}`);
        localStorage.removeItem("tournamentState");
        localStorage.removeItem(`tournamentState_${peladaId}`);
        localStorage.removeItem("liveMatch");
        localStorage.removeItem(`liveMatch_${peladaId}`);

        // 2. Reseta memória
        window.App.teams = [];
        window.App.waitingQueue = [];
        window.App.liveMatch = { teamA: 'Time A', teamB: 'Time B', scoreA: 0, scoreB: 0, timerSeconds: 0, isPlaying: false, consecutiveWinsA: 0, consecutiveWinsB: 0, goals: [] };

        // 3. Limpa na nuvem (isReset = true)
        if (window.Api && window.Api.atualizarLiveState) {
          await window.Api.atualizarLiveState(peladaId, window.App.liveMatch, [], [], true);
        }

        window.App.showToast("Formação de times apagada com sucesso!", "success");
        window.App.renderDrawnTeams();
        if (window.App.updateAcompanhamentoUI) window.App.updateAcompanhamentoUI();
      } catch (err) {
        console.error("[LimparTimes]", err);
        window.App.showToast("Erro ao apagar times na nuvem.", "error");
      }
    };

  }
  const btnAddTeam = document.getElementById("btn-add-team-manual");
  if (btnAddTeam) {
    btnAddTeam.onclick = criarTimeManual;
  }
  window.App.openAddPresenceModal = function () {
    const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
    if (!peladaId) {
      window.App.showToast("Selecione uma data para adicionar presença.", "warning");
      return;
    }
    window.App.openModal("adicionar_presenca", { peladaId: peladaId });
  };
  const btnOpenAddPresence = document.getElementById("btn-open-add-presence-modal");
  if (btnOpenAddPresence) {
    btnOpenAddPresence.onclick = window.App.openAddPresenceModal;
  }
  const btnCopyList = document.getElementById("btn-copy-presence-list");
  if (btnCopyList) {
    btnCopyList.onclick = copiarListaPresencaWhatsApp;
  }
  const btnExportExcel = document.getElementById("btn-export-presence-excel");
  if (btnExportExcel) {
    btnExportExcel.onclick = exportConvocadosExcel;
  }
  const selectStatus = document.getElementById("select-pelada-status");
  if (selectStatus) {
    let _updatingStatus = false;
    selectStatus.onchange = async (e) => {
      if (_updatingStatus) return; // Evita loop de reentrância
      const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
      if (!peladaId) return;
      const novoStatus = e.target.value; // 'agendada' | 'finalizada'
      const descStatus = novoStatus === 'finalizada' ? 'REALIZADA (Encerrada)' : 'AGENDADA (Ativa)';
      const confirmChange = confirm(`Deseja alterar o status desta rodada para ${descStatus}?`);
      if (!confirmChange) {
        _updatingStatus = true;
        selectStatus.value = window.App.activePelada.status || "agendada";
        _updatingStatus = false;
        return;
      }
      try {
        const res = await Api.atualizarStatusPelada(peladaId, novoStatus);
        console.log('[select-pelada-status] Resposta da API:', res);
        if (res && res.error) {
          window.App.showToast(res.error, "error");
          _updatingStatus = true;
          selectStatus.value = window.App.activePelada.status || "agendada";
          _updatingStatus = false;
          return;
        }
        window.App.activePelada.status = novoStatus;
        // Se mudou para realizada, limpa localStorage dos controles ativos da partida
        if (novoStatus === "finalizada") {
          const teamsKey = getTeamsKey();
          localStorage.removeItem(teamsKey);
          localStorage.removeItem("liveMatch");
          localStorage.removeItem("waitingQueue");
          window.App.liveMatch = {
            teamA: 'Time A', teamB: 'Time B',
            scoreA: 0, scoreB: 0,
            timerSeconds: 0, isPlaying: false,
            consecutiveWinsA: 0, consecutiveWinsB: 0
          };
          window.App.waitingQueue = [];
        }
        window.App.showToast(`Status da rodada atualizado para ${descStatus}!`, "success");
        // Recarrega os dados e a listagem (redesenha select e checks)
        await renderManagerCheckin(peladaId);
        window.App.renderDrawnTeams();
        window.App.updateAcompanhamentoUI();
      } catch (err) {
        console.error("[select-pelada-status]", err);
        window.App.showToast("Erro ao atualizar status da rodada.", "error");
        _updatingStatus = true;
        selectStatus.value = window.App.activePelada.status || "agendada";
        _updatingStatus = false;
      }
    };
  }
  // Setup Drag & Drop Handlers para trocas manuais de jogadores nos times
  window.drag = drag;
  window.allowDrop = allowDrop;
  window.dragLeave = dragLeave;
  window.drop = drop;
  window.renameTeam = renameTeam;
  window.togglePresenter = togglePresenter;
  window.desconvocarAtleta = desconvocarAtleta;
  window.estornarSaldoAtleta = estornarSaldoAtleta;
  window.App.updateCheckinPlayersList = updateCheckinPlayersList;
};
// Vinculado dinamicamente para compartilhar presenças
window.App.presentPlayers = [];
// Formatação robusta de datas para evitar "Invalid Date"
function formatarDataPelada(dataStr) {
  if (!dataStr) return "Data indefinida";
  // Extrai apenas YYYY-MM-DD se for ISO completo
  const rawDate = dataStr.includes("T") ? dataStr.split("T")[0] : dataStr;
  const parts = rawDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // Retorna DD/MM/YYYY
  }
  return dataStr;
}

// Alternancia de abas do fluxo de formacao vs modo de jogo
function setupFormacaoSubtabs() {
  const btnTimes = document.getElementById("btn-tab-formacao-times");
  const btnModo = document.getElementById("btn-tab-modo-jogo");
  const tabTimes = document.getElementById("tab-content-formacao-times");
  const tabModo = document.getElementById("tab-content-modo-jogo");
  if (!btnTimes || !btnModo || !tabTimes || !tabModo) return;

  btnTimes.onclick = () => {
    btnTimes.style.background = "#E0F2FE";
    btnTimes.style.color = "#0284C7";
    btnTimes.style.borderColor = "#7DD3FC";
    btnModo.style.background = "#F8FAFC";
    btnModo.style.color = "#64748B";
    btnModo.style.borderColor = "#CBD5E1";
    tabTimes.style.display = "block";
    tabModo.style.display = "none";
    const selPelada = document.getElementById("select-manager-pelada");
    if (selPelada && (selPelada.options.length === 0 || (selPelada.options.length === 1 && !selPelada.value))) {
      renderManagerCheckin();
    }
    if (window.feather) feather.replace();
  };

    btnModo.onclick = () => {
    btnModo.style.background = "#E0F2FE";
    btnModo.style.color = "#0284C7";
    btnModo.style.borderColor = "#7DD3FC";
    btnTimes.style.background = "#F8FAFC";
    btnTimes.style.color = "#64748B";
    btnTimes.style.borderColor = "#CBD5E1";
    tabTimes.style.display = "none";
    tabModo.style.display = "block";

    // Garante que o select de data da aba 2 esteja populado e sincronizado
    const selModoData = document.getElementById("select-modo-pelada-data");
    const peladasList = window.App.activeGroupPeladas || [];
    if (selModoData && peladasList.length > 0) {
      const curId = window.App.activePelada ? String(window.App.activePelada.id) : "";
      selModoData.innerHTML = "";
      peladasList.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        const dateFormatted = formatarDataPelada(p.data);
        const statusLabel = p.status === "finalizada" ? "Realizada" : "Agendada";
        opt.textContent = `${dateFormatted} às ${p.horario || ""} (${statusLabel})`;
        if (String(p.id) === curId) opt.selected = true;
        selModoData.appendChild(opt);
      });
      if (curId) selModoData.value = curId;
    }

    updateModoInfoCard();
    renderConfrontosDatasUI();
    if (window.feather) feather.replace();
  };
}

// Renderiza o agendador de datas por confronto e sincroniza a data base
function renderConfrontosDatasUI() {
  const container = document.getElementById("lista-confrontos-datas-container");
  const badgeTotal = document.getElementById("badge-total-confrontos");
  const selectDataBase = document.getElementById("select-pelada-data-base");
  if (!container) return;

  const peladaAtiva = window.App.activePelada || {};
  const liveMatch = window.App.liveMatch || {};
  let tState = (liveMatch && liveMatch.tournamentState) || (peladaAtiva.id ? JSON.parse(localStorage.getItem(`tournamentState_${peladaAtiva.id}`) || 'null') : null);

  const peladasList = window.App.activeGroupPeladas || [];

  // Popula o select de Data Base Geral
  if (selectDataBase) {
    const currentBaseVal = selectDataBase.value;
    selectDataBase.innerHTML = `<option value="">📅 Data da Pelada Atual (${formatarDataPelada(peladaAtiva.data)})</option>`;
    peladasList.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.data || p.id;
      const dataFmt = formatarDataPelada(p.data);
      const statusLabel = p.status === "finalizada" ? "Realizada" : "Agendada";
      opt.textContent = `${dataFmt} às ${p.horario || ""} (${statusLabel})`;
      selectDataBase.appendChild(opt);
    });
    if (currentBaseVal) selectDataBase.value = currentBaseVal;

    selectDataBase.onchange = (e) => {
      const selectedVal = e.target.value;
      if (tState && Array.isArray(tState.matches) && tState.matches.length > 0) {
        tState.matches.forEach(m => {
          m.dataJogo = selectedVal || peladaAtiva.data || null;
        });
        if (peladaAtiva.id) {
          try { localStorage.setItem(`tournamentState_${peladaAtiva.id}`, JSON.stringify(tState)); } catch(err){}
        }
        try { localStorage.setItem('tournamentState', JSON.stringify(tState)); } catch(err){}
        if (window.App.liveMatch) window.App.liveMatch.tournamentState = tState;
        renderConfrontosDatasUI();
        if (window.App.renderFormacaoTournamentUI) window.App.renderFormacaoTournamentUI();
        window.App.showToast("Data base aplicada a todas as partidas!", "success");
      }
    };
  }

  // Se não houver partidas geradas ainda
  if (!tState || !Array.isArray(tState.matches) || tState.matches.length === 0) {
    if (badgeTotal) badgeTotal.textContent = "0 JOGOS";
    container.innerHTML = `
      <div style="text-align: center; padding: 24px 16px; background: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 12px; color: #64748B;">
        <span style="font-size: 24px; display: block; margin-bottom: 6px;">📋</span>
        <strong style="font-size: 14px; color: #334155; display: block; margin-bottom: 4px;">Nenhum confronto gerado ainda</strong>
        <p style="font-size: 12px; margin: 0;">Sorteie as equipes na aba <strong>Formação dos Times</strong> para gerar a tabela e agendar as datas de cada confronto.</p>
      </div>
    `;
    return;
  }

  let allMatches = tState.matches;
  if (badgeTotal) badgeTotal.textContent = `${allMatches.length} JOGOS`;

  let teamsList = [];
  try { teamsList = JSON.parse(localStorage.getItem(getTeamsKey())) || window.App.teams || []; } catch(e){}

  container.innerHTML = allMatches.map((m, idx) => {
    const numJogo = m.numeroJogo || (idx + 1);
    const turnoLabel = m.turno === 'volta' ? 'Returno' : 'Ida';
    const rodadaLabel = m.rodada ? ` • Rodada ${m.rodada}` : '';

    let embA = '', embB = '';
    if (window.TeamEmblems && teamsList.length > 0) {
      const tA = teamsList.find(t => (t.nome || t.name || '').toLowerCase().trim() === (m.teamA || '').toLowerCase().trim());
      const tB = teamsList.find(t => (t.nome || t.name || '').toLowerCase().trim() === (m.teamB || '').toLowerCase().trim());
      if (tA) embA = `<span style="display:inline-block; width:16px; height:18px; vertical-align:middle; margin-right:4px;">${window.TeamEmblems.forTeam(tA)}</span>`;
      if (tB) embB = `<span style="display:inline-block; width:16px; height:18px; vertical-align:middle; margin-left:4px;">${window.TeamEmblems.forTeam(tB)}</span>`;
    }

    const currentDateVal = m.dataJogo || "";
    let optionsHtml = `<option value="">📅 Data Padrão (${formatarDataPelada(peladaAtiva.data)})</option>`;
    peladasList.forEach(p => {
      const pVal = p.data || p.id;
      const isSelected = (currentDateVal && (currentDateVal === pVal || currentDateVal === p.data)) ? "selected" : "";
      const dataFmt = formatarDataPelada(p.data);
      const statusLabel = p.status === "finalizada" ? "Realizada" : "Agendada";
      optionsHtml += `<option value="${p.data || pVal}" ${isSelected}>${dataFmt} às ${p.horario || ""} (${statusLabel})</option>`;
    });

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <div style="min-width: 140px; flex: 1.2;">
          <div style="font-size: 10px; font-weight: 800; color: #0284C7; text-transform: uppercase; margin-bottom: 2px;">
            Jogo #${numJogo} (${turnoLabel}${rodadaLabel})
          </div>
          <div style="font-size: 13px; font-weight: 700; color: #0F172A; display: flex; align-items: center; gap: 4px;">
            <span>${embA}${m.teamA}</span>
            <span style="font-size: 11px; color: #94A3B8; font-weight: 600;">x</span>
            <span>${m.teamB}${embB}</span>
          </div>
        </div>

        <div style="flex: 1; min-width: 180px; max-width: 260px;">
          <select class="form-control select-match-date-picker" data-match-id="${m.id}" style="font-size: 12px; font-weight: 600; padding: 6px 10px; height: 36px; border-radius: 6px; border: 1.5px solid #CBD5E1; background: #F8FAFC;">
            ${optionsHtml}
          </select>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll(".select-match-date-picker").forEach(sel => {
    sel.onchange = (e) => {
      const matchId = e.target.dataset.matchId;
      const newDate = e.target.value;
      const targetMatch = tState.matches.find(m => m.id === matchId);
      if (targetMatch) {
        targetMatch.dataJogo = newDate || peladaAtiva.data || null;
        if (peladaAtiva.id) {
          try { localStorage.setItem(`tournamentState_${peladaAtiva.id}`, JSON.stringify(tState)); } catch(err){}
        }
        try { localStorage.setItem('tournamentState', JSON.stringify(tState)); } catch(err){}
        if (window.App.liveMatch) window.App.liveMatch.tournamentState = tState;
        if (window.App.renderFormacaoTournamentUI) window.App.renderFormacaoTournamentUI();
        window.App.showToast(`Data do Jogo #${targetMatch.numeroJogo || ''} definida com sucesso!`, "success");
      }
    };
  });
}
window.App.renderConfrontosDatasUI = renderConfrontosDatasUI;

// Atualiza o resumo visual de regras e estimativa de jogos da aba Modo de Jogo
function updateModoInfoCard() {
  const selectModo = document.getElementById("select-pelada-modo");
  const selectTurno = document.getElementById("select-pelada-turno");
  const badgeEl = document.getElementById("modo-info-badge");
  const bodyEl = document.getElementById("modo-info-body");
  const estEl = document.getElementById("lbl-turno-partidas-estimadas");
  if (!selectModo || !bodyEl) return;

  const modo = selectModo.value || "normal";
  const turno = selectTurno ? selectTurno.value : "ida_volta";
  let teams = window.App.teams || [];
  try { if (!teams || teams.length === 0) teams = JSON.parse(localStorage.getItem(getTeamsKey())) || []; } catch (e) { }
  const nTeams = teams.length >= 2 ? teams.length : 4;
  const nJogosIda = Math.floor((nTeams * (nTeams - 1)) / 2);
  const nJogosTotal = turno === 'ida_volta' ? nJogosIda * 2 : nJogosIda;

  if (estEl) {
    estEl.textContent = `📊 ${nTeams} equipes: ${nJogosTotal} partidas (${turno === 'ida_volta' ? `${nJogosIda} Ida + ${nJogosIda} Volta` : `${nJogosIda} Turno Único`})`;
  }

  const dataEl = document.getElementById("lbl-modo-pelada-data");
  if (dataEl && window.App.activePelada) {
    const dStr = window.App.activePelada.data ? (window.Utils ? window.Utils.formatDate(window.App.activePelada.data) : window.App.activePelada.data) : "";
    dataEl.textContent = dStr ? `📅 Pelada: ${dStr}` : "";
  }

  if (modo === 'pontos_corridos') {
    if (badgeEl) badgeEl.textContent = "PONTOS CORRIDOS";
    bodyEl.innerHTML = `
      <p style="margin: 0 0 8px 0;"><strong>🏆 Mini Torneio (Pontos Corridos)</strong></p>
      <p style="margin: 0 0 8px 0;">Todas as equipes disputam uma tabela única por pontos corridos (Vitória: 3, Empate: 1, Derrota: 0).</p>
      <p style="margin: 0 0 8px 0;"><strong>Turno:</strong> ${turno === 'ida_volta' ? '🔄 <strong>Ida e Volta (Turno e Returno)</strong>' : '🔁 <strong>Somente Ida (Turno Único)</strong>'}.</p>
      <p style="margin: 0; color: #0284C7;">Com ${nTeams} times, serão disputadas <strong>${nJogosTotal} partidas</strong>. ${turno === 'ida_volta' ? 'O returno é disputado integralmente antes do encerramento final.' : 'Termina ao fim do turno único.'}</p>
    `;
  } else if (modo === 'torneio') {
    if (badgeEl) badgeEl.textContent = "MISTO: TABELA + MATA-MATA";
    bodyEl.innerHTML = `
      <p style="margin: 0 0 8px 0;"><strong>🏆 Mini Torneio Misto</strong></p>
      <p style="margin: 0 0 8px 0;">Fase de grupos com pontuação seguida de semifinais e finais eliminatórias.</p>
      <p style="margin: 0; color: #0284C7;">Turno de grupos: ${turno === 'ida_volta' ? '🔄 Ida e Volta' : '🔁 Somente Ida'}.</p>
    `;
  } else if (modo === 'mata_mata_direto') {
    if (badgeEl) badgeEl.textContent = "MATA-MATA DIRETO";
    bodyEl.innerHTML = `
      <p style="margin: 0 0 8px 0;"><strong>⚡ Mata-Mata Direto</strong></p>
      <p style="margin: 0;">Confrontos eliminatórios diretos sem fase de grupos prévia.</p>
    `;
  } else if (modo === 'torneio_livre') {
    if (badgeEl) badgeEl.textContent = "TORNEIO LIVRE";
    bodyEl.innerHTML = `
      <p style="margin: 0 0 8px 0;"><strong>📋 Torneio Livre</strong></p>
      <p style="margin: 0;">Confrontos manuais definidos a cada rodada com tabela acumulada.</p>
    `;
  } else {
    if (badgeEl) badgeEl.textContent = "PELADA NORMAL";
    bodyEl.innerHTML = `
      <p style="margin: 0 0 8px 0;"><strong>⚽ Pelada Normal (Reina Campo)</strong></p>
      <p style="margin: 0;">Partidas avulsas contínuas com regra de vitórias consecutivas e fila de espera tradicional.</p>
    `;
  }
}

async function renderManagerCheckin(selectedPeladaId = null) {
  const select = document.getElementById("select-manager-pelada");
  const selectStatus = document.getElementById("select-pelada-status");
  if (!select) return;
  select.innerHTML = "<option>Carregando partidas...</option>";
  if (!window.App.currentGroup || (!window.App.currentGroup.id && !window.App.currentGroup.grupo_id)) {
    let savedGroup = (window.Auth && window.Auth.currentGroup) || JSON.parse(localStorage.getItem('currentGroup') || 'null');
    if (savedGroup && (savedGroup.id || savedGroup.grupo_id)) {
      if (!savedGroup.id) savedGroup.id = savedGroup.grupo_id;
      window.App.currentGroup = savedGroup;
      if (window.Auth) window.Auth.currentGroup = savedGroup;
    } else if (window.Api && window.Api.getGruposDoGestor) {
      try {
        const grupos = await Api.getGruposDoGestor();
        if (Array.isArray(grupos) && grupos.length > 0) {
          const g = grupos[0];
          if (!g.id && g.grupo_id) g.id = g.grupo_id;
          window.App.currentGroup = g;
          if (window.Auth) window.Auth.currentGroup = g;
          localStorage.setItem('currentGroup', JSON.stringify(g));
        }
      } catch (e) { }
    }
  }

  const currentGroupId = window.App.currentGroup ? (window.App.currentGroup.id || window.App.currentGroup.grupo_id) : null;
  if (!currentGroupId) {
    select.innerHTML = "<option value=''>Selecione um grupo primeiro</option>";
    const checkinContainer = document.getElementById("checkin-list-container");
    if (checkinContainer) {
      checkinContainer.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Selecione um grupo primeiro nas configurações para carregar as peladas.</p>`;
    }
    return;
  }
  try {
    // Busca TODAS as datas do grupo (agendadas e realizadas)
    const peladas = await Api.listarDatasDoGrupo(currentGroupId);
    const peladasList = Array.isArray(peladas) ? peladas : [];
    select.innerHTML = "";
    if (peladasList.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Nenhuma pelada cadastrada";
      select.appendChild(opt);
      const checkinContainer = document.getElementById("checkin-list-container");
      if (checkinContainer) {
        checkinContainer.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Sem partidas agendadas.</p>`;
      }
      return;
    }
    peladasList.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      const dateFormatted = formatarDataPelada(p.data);
      const statusLabel = p.status === "finalizada" ? "Realizada" : "Agendada";
      opt.textContent = `${dateFormatted} às ${p.horario || ""} (${statusLabel})`;
      select.appendChild(opt);
    });
    window.App.activeGroupPeladas = peladasList;
    // Limpeza proativa de peladas antigas e órfãs para garantir cota livre no localStorage
    limparDadosAntigosLocalStorage(peladasList);
    // Define qual pelada está ativa
    let activePelada = peladasList[0];
    if (selectedPeladaId) {
      activePelada = peladasList.find(p => String(p.id) === String(selectedPeladaId)) || peladasList[0];
    } else if (window.App.activePelada && window.App.activePelada.id) {
      activePelada = peladasList.find(p => String(p.id) === String(window.App.activePelada.id)) || peladasList[0];
    } else {
      activePelada = peladasList.find(p => p.status !== "finalizada") || peladasList[0];
    }
    window.App.activePelada = activePelada;
    safeSetStorage("activePelada", activePelada);
    select.value = activePelada.id;
    // Inicializa o estado de times da pelada ativa
    window.App.teams = [];
    window.App.liveMatch = null;
    window.App.waitingQueue = [];
    try { localStorage.removeItem("teams"); } catch (e) { }
    try { localStorage.removeItem("liveMatch"); } catch (e) { }
    try { localStorage.removeItem("waitingQueue"); } catch (e) { }
    try { localStorage.removeItem("tournamentState"); } catch (e) { }
    // Servidor como autoridade: o estado e carregado por carregarTimesDoServidor
    const selectModo = document.getElementById("select-pelada-modo");
    const containerTurno = document.getElementById("container-turno-torneio");
    const selectTurno = document.getElementById("select-pelada-turno");

    function updateTurnoVisibility(modoVal) {
      if (containerTurno) {
        const hasTurno = modoVal === 'torneio' || modoVal === 'pontos_corridos' || modoVal === 'torneio_pontos_corridos';
        containerTurno.style.display = hasTurno ? 'block' : 'none';
      }
    }

    if (selectModo) {
      selectModo.innerHTML = `
        <option value="normal">Pelada Normal (Reina Campo)</option>
        <option value="torneio">Mini Torneio (Misto: Tabela + Mata-Mata)</option>
        <option value="pontos_corridos">Mini Torneio (Pontos Corridos)</option>
        <option value="mata_mata_direto">Mini Torneio (Mata-Mata Direto)</option>
        <option value="torneio_livre">Torneio Livre (Confrontos Manuais)</option>
      `;
      selectModo.value = activePelada.modo || "normal";
      console.log("🏆 [DIAGNÓSTICO FORMATO DO DIA] Opções carregadas no select:", selectModo.options.length, Array.from(selectModo.options).map(o => o.value));
      updateTurnoVisibility(selectModo.value);
      updateModoInfoCard();

      selectModo.onchange = async (e) => {
        const newModo = e.target.value;
        const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
        updateTurnoVisibility(newModo);
        updateModoInfoCard();
        if (!peladaId) return;
        try {
          const res = await Api.atualizarConfigPartida(peladaId, { modo: newModo });
          if (res && res.error) {
            window.App.showToast(res.error, "error");
            selectModo.value = window.App.activePelada.modo || "normal";
            updateTurnoVisibility(selectModo.value);
            updateModoInfoCard();
            return;
          }
          window.App.activePelada.modo = newModo;
          safeSetStorage("activePelada", window.App.activePelada);
          let desc = "⚽ Modo Pelada Normal ativado!";
          if (newModo === 'torneio_livre') desc = "📋 Modo Torneio Livre (Confrontos Manuais) ativado para esta data!";
          else if (newModo === 'mata_mata_direto') desc = "⚡ Modo Mini Torneio (Mata-Mata Direto) ativado para esta data!";
          else if (newModo === 'pontos_corridos' || newModo === 'torneio_pontos_corridos') desc = "🏅 Modo Mini Torneio (Pontos Corridos) ativado para esta data!";
          else if (newModo === 'torneio') desc = "🏆 Modo Mini Torneio (Misto: Tabela + Mata-Mata) ativado!";
          window.App.showToast(desc, "success");
          renderFormacaoTournamentUI();
          updateModoInfoCard();
          renderConfrontosDatasUI();
        } catch (err) {
          console.error("[selectModo]", err);
          window.App.showToast("Erro ao atualizar formato da pelada.", "error");
        }
      };
    }

    if (selectTurno) {
      selectTurno.value = activePelada.turno_torneio || "ida_volta";
      selectTurno.onchange = async (e) => {
        const newTurno = e.target.value;
        const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
        updateModoInfoCard();
        if (!peladaId) return;
        try {
          const res = await Api.atualizarConfigPartida(peladaId, { turno_torneio: newTurno });
          if (res && res.error) {
            window.App.showToast(res.error, "error");
            selectTurno.value = window.App.activePelada.turno_torneio || "ida_volta";
            updateModoInfoCard();
            return;
          }
          window.App.activePelada.turno_torneio = newTurno;
          safeSetStorage("activePelada", window.App.activePelada);

          // Se já existirem times sorteados daquela pelada e um torneio ativo, atualiza a tabela
          const specificTeamsKey = `teams_${peladaId}`;
          let teams = [];
          try { teams = JSON.parse(localStorage.getItem(specificTeamsKey) || 'null') || []; } catch (e) { }
          let tState = peladaId ? JSON.parse(localStorage.getItem(`tournamentState_${peladaId}`) || 'null') : null;

          if (teams && teams.length > 0 && window.TournamentEngine && tState) {
            let liveMatch = window.App.liveMatch || {};
            tState.turno = newTurno;
            // Regenera a tabela mista com o novo turno
            const newMatches = window.TournamentEngine.generateGroupSchedule(teams, newTurno);

            // Preserva o placar de partidas que já haviam sido finalizadas e datas personalizadas
            if (Array.isArray(tState.matches)) {
              tState.matches.forEach(oldM => {
                const matchInNew = newMatches.find(nm => nm.teamA === oldM.teamA && nm.teamB === oldM.teamB && nm.turno === oldM.turno);
                if (matchInNew) {
                  if (oldM.dataJogo) matchInNew.dataJogo = oldM.dataJogo;
                  if (oldM.status === 'encerrado') {
                    matchInNew.golsA = oldM.golsA;
                    matchInNew.golsB = oldM.golsB;
                    matchInNew.status = 'encerrado';
                    matchInNew.vencedor = oldM.vencedor;
                  }
                }
              });
            }

            tState.matches = newMatches;
            tState.standings = window.TournamentEngine.calculateStandings(teams, newMatches);
            liveMatch.tournamentState = tState;
            window.App.liveMatch = liveMatch;

            safeSetStorage(`tournamentState_${peladaId}`, tState);
            safeSetStorage("liveMatch", liveMatch);

            if (window.Api && window.Api.atualizarLiveState) {
              await window.Api.atualizarLiveState(peladaId, liveMatch, window.App.waitingQueue || [], teams);
            }
          }

          const desc = newTurno === 'ida_volta'
            ? "🔄 Fase de Grupos definida como Ida e Volta (Turno e Returno) — 12 partidas geradas!"
            : "🔁 Fase de Grupos definida como Somente Ida — 6 partidas geradas!";
          window.App.showToast(desc, "success");
          updateModoInfoCard();
          renderConfrontosDatasUI();
        } catch (err) {
          console.error("[selectTurno]", err);
          window.App.showToast("Erro ao atualizar turno do torneio.", "error");
        }
      };
    }
    // Sincroniza e preenche o seletor de data da Aba 2 (Modo de Jogo)
    const selectModoData = document.getElementById("select-modo-pelada-data");
    if (selectModoData) {
      selectModoData.innerHTML = "";
      peladasList.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        const dateFormatted = formatarDataPelada(p.data);
        const statusLabel = p.status === "finalizada" ? "Realizada" : "Agendada";
        opt.textContent = `${dateFormatted} às ${p.horario || ""} (${statusLabel})`;
        if (String(p.id) === String(activePelada.id)) opt.selected = true;
        selectModoData.appendChild(opt);
      });
      selectModoData.value = activePelada.id;

      selectModoData.onchange = async (e) => {
        if (e.target.value) {
          select.value = e.target.value;
          if (typeof select.onchange === 'function') {
            await select.onchange({ target: { value: e.target.value } });
          }
        }
      };
    }

    // Botão explícito para Salvar Configurações da Disputa (Modo, Turno e Status)
    const btnSalvarModo = document.getElementById("btn-salvar-modo-jogo");
    if (btnSalvarModo) {
      btnSalvarModo.onclick = async () => {
        const curPeladaId = window.App.activePelada ? window.App.activePelada.id : null;
        if (!curPeladaId) {
          window.App.showToast("Selecione uma pelada para salvar as configurações.", "warning");
          return;
        }
        const modoVal = selectModo ? selectModo.value : "normal";
        const turnoVal = selectTurno ? selectTurno.value : "ida_volta";
        const statusVal = selectStatus ? selectStatus.value : "agendada";

        try {
          btnSalvarModo.disabled = true;
          btnSalvarModo.innerHTML = `<i data-feather="loader" class="spin"></i> Salvando...`;

          const payload = { modo: modoVal, turno_torneio: turnoVal, status: statusVal };
          const res = await Api.atualizarConfigPartida(curPeladaId, payload);
          if (res && res.error) {
            window.App.showToast(res.error, "error");
            return;
          }

          window.App.activePelada.modo = modoVal;
          window.App.activePelada.turno_torneio = turnoVal;
          window.App.activePelada.status = statusVal;
          safeSetStorage("activePelada", window.App.activePelada);

          // Atualiza torneio e partidas caso já existam times gerados para ESTA pelada
          const specificTeamsKey = `teams_${curPeladaId}`;
          let teams = [];
          try { teams = JSON.parse(localStorage.getItem(specificTeamsKey) || 'null') || []; } catch (e) { }
          let tState = curPeladaId ? JSON.parse(localStorage.getItem(`tournamentState_${curPeladaId}`) || 'null') : null;

          if (teams && teams.length > 0 && window.TournamentEngine && tState) {
            let liveMatch = window.App.liveMatch || {};
            tState.turno = turnoVal;
            const newMatches = window.TournamentEngine.generateGroupSchedule(teams, turnoVal);
            if (Array.isArray(tState.matches)) {
              tState.matches.forEach(oldM => {
                const matchInNew = newMatches.find(nm => nm.teamA === oldM.teamA && nm.teamB === oldM.teamB && nm.turno === oldM.turno);
                if (matchInNew) {
                  if (oldM.dataJogo) matchInNew.dataJogo = oldM.dataJogo;
                  if (oldM.status === 'encerrado') {
                    matchInNew.golsA = oldM.golsA;
                    matchInNew.golsB = oldM.golsB;
                    matchInNew.status = 'encerrado';
                    matchInNew.vencedor = oldM.vencedor;
                  }
                }
              });
            }
            tState.matches = newMatches;
            tState.standings = window.TournamentEngine.calculateStandings(teams, newMatches);
            liveMatch.tournamentState = tState;
            window.App.liveMatch = liveMatch;
            safeSetStorage(`tournamentState_${curPeladaId}`, tState);
            safeSetStorage("liveMatch", liveMatch);

            if (window.Api && window.Api.atualizarLiveState) {
              await window.Api.atualizarLiveState(curPeladaId, liveMatch, window.App.waitingQueue || [], teams);
            }
          }

          window.App.showToast("Configurações da disputa salvas com sucesso!", "success");
          updateModoInfoCard();
          renderConfrontosDatasUI();
        } catch (err) {
          console.error("[btnSalvarModo]", err);
          window.App.showToast("Erro ao salvar configurações da disputa.", "error");
        } finally {
          btnSalvarModo.disabled = false;
          btnSalvarModo.innerHTML = `<i data-feather="save" style="width: 18px; height: 18px;"></i> Salvar Configurações da Disputa`;
          if (window.feather) feather.replace();
        }
      };
    }

    // Puxa a lista de convocados da data selecionada
    await updateCheckinPlayersList(activePelada.id);
    // Carrega os times salvos na nuvem (sincroniza entre dispositivos)
    if (window.App.carregarTimesDoServidor) {
      await window.App.carregarTimesDoServidor(activePelada.id);
    }
    renderFormacaoTournamentUI();
    renderConfrontosDatasUI();
    select.onchange = async (e) => {
      if (e.target.value) {
        const sel = peladasList.find(p => String(p.id) === String(e.target.value));
        window.App.activePelada = sel;
        safeSetStorage("activePelada", sel);
        if (selectStatus) selectStatus.value = sel.status || "agendada";
        if (selectModo) selectModo.value = sel.modo || "normal";
        if (selectTurno) selectTurno.value = sel.turno_torneio || "ida_volta";
        if (selectModoData) selectModoData.value = sel.id;
        updateTurnoVisibility(sel.modo || "normal");
        // Reset total do estado global ao trocar de data
        window.App.teams = [];
        window.App.liveMatch = null;
        window.App.waitingQueue = [];
        try { localStorage.removeItem("teams"); } catch (e) { }
        try { localStorage.removeItem("liveMatch"); } catch (e) { }
        try { localStorage.removeItem("waitingQueue"); } catch (e) { }
        try { localStorage.removeItem("tournamentState"); } catch (e) { }
        // Servidor como autoridade: o estado e carregado por carregarTimesDoServidor
        updateModoInfoCard();
        await updateCheckinPlayersList(e.target.value);
        if (window.App.carregarTimesDoServidor) {
          await window.App.carregarTimesDoServidor(e.target.value);
        }
        renderFormacaoTournamentUI();
        renderConfrontosDatasUI();
        if (window.App.renderDrawnTeams) window.App.renderDrawnTeams();
        if (window.App.updateAcompanhamentoUI) window.App.updateAcompanhamentoUI();
      }
    };
  } catch (err) {
    console.error("[Formacao] Erro ao listar datas para checkin:", err);
    if (!select.value && select.options.length === 0) {
      select.innerHTML = "<option value=''>Erro ao carregar</option>";
    }
    if (window.App && window.App.showToast) {
      window.App.showToast("Aviso: Falha ao sincronizar dados da pelada.", "warning");
    }
  }
}
window.App.renderManagerCheckin = renderManagerCheckin;
function atualizarContadorPresencas() {
  const total = (window.App.confirmadosList || []).length;
  const presentes = (window.App.presentPlayers || []).length;
  const aConfirmar = Math.max(0, total - presentes);
  const countEl = document.getElementById("checkin-count");
  if (countEl) {
    if (aConfirmar > 0) {
      countEl.textContent = `${presentes} Presentes (${aConfirmar} a Confirmar)`;
    } else {
      countEl.textContent = `${presentes} Presentes`;
    }
  }
}

async function updateCheckinPlayersList(peladaId) {
  const container = document.getElementById("checkin-list-container");
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding:12px; font-size:13px; color:var(--text-caption);" class="text-inter">Carregando convocados...</div>`;
  window.App.presentPlayers = [];
  try {
    // Busca convocados em tempo real da API do backend
    const convocados = await Api.listarConvocados(peladaId);
    // Filtra apenas jogadores confirmados
    const confirmados = convocados.filter(c => c.status === "confirmado");
    container.innerHTML = "";
    if (confirmados.length === 0) {
      container.innerHTML = `<p style="font-size: 13px; text-align: center; color:var(--text-caption); padding: 12px 0;">Sem confirmados nesta partida.</p>`;
      window.App.confirmadosList = [];
      atualizarContadorPresencas();
      return;
    }
    window.App.confirmadosList = confirmados;
    // Sincroniza jogadores com o localStorage local para o Sorteio Técnico
    const playersLocais = JSON.parse(localStorage.getItem("players")) || [];
    confirmados.forEach(c => {
      // Garante que o jogador está na tabela 'players' local para o sorteio usar
      const idStr = String(c.id);
      let pLocal = playersLocais.find(x => String(x.id) === idStr);
      if (!pLocal) {
        pLocal = {
          id: c.id,
          nome: c.nome,
          apelido: c.apelido || c.nome,
          goleiro: !!c.goleiro,
          autoavaliacao: parseInt(c.autoavaliacao) || 3,
          ativo: true
        };
        playersLocais.push(pLocal);
      } else {
        // Atualiza campos
        pLocal.nome = c.nome;
        pLocal.apelido = c.apelido || c.nome;
        pLocal.goleiro = !!c.goleiro;
        pLocal.autoavaliacao = parseInt(c.autoavaliacao) || 3;
      }
      if (!pLocal.foto && c.foto && c.foto.startsWith("http")) pLocal.foto = c.foto;
      // Adiciona na lista de presentes na memória se estiver marcado como presente no banco
      if (c.presenca) {
        window.App.presentPlayers.push(c.id);
      }

      const div = document.createElement("div");
      div.className = "checkin-athlete-card";
      div.style.display = "flex";
      div.style.justifyContent = "space-between";
      div.style.alignItems = "center";
      div.style.padding = "10px 12px";
      div.style.borderRadius = "10px";
      div.style.marginBottom = "8px";
      const nameStr = c.apelido || c.nome || 'Atleta';
      const fotoUrl = c.foto || (pLocal && pLocal.foto) || null;
      const initial = nameStr.charAt(0).toUpperCase();
      const avatarHtml = fotoUrl
        ? `<img src="${fotoUrl}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;" alt="${nameStr}">`
        : `<div style="width: 64px; height: 64px; border-radius: 50%; background: #0284C7; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 24px; border: 3px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;">${initial}</div>`;
      div.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px; flex:1;">
          ${avatarHtml}
          <div style="display:flex; flex-direction:column;">
            <span style="font-size:15px; font-weight:700; color:var(--text-heading);">${nameStr} ${c.goleiro ? '🧤' : ''}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <label class="toggle-switch">
            <input type="checkbox" class="toggle-input" ${c.presenca ? 'checked' : ''} onchange="togglePresenter('${c.id}', this)">
            <span class="toggle-label"></span>
          </label>
          ${(!c.presenca && c.forma_pagamento === 'saldo' && !c.saldo_estornado)
          ? `<button title="Estornar saldo" onclick="estornarSaldoAtleta('${c.id}', '${nameStr}')" style="background:#f0fdf4; border:1px solid #86efac; border-radius:6px; cursor:pointer; color:#16a34a; font-size:12px; padding:3px 7px; font-weight:700; white-space:nowrap; line-height:1.4;" onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">💰 Estornar</button>`
          : (c.saldo_estornado ? `<span style="background:#f0fdf4; border:1px solid #86efac; border-radius:6px; color:#16a34a; font-size:11px; padding:3px 7px; font-weight:700;">✓ Estornado</span>` : '')
        }
          <button title="Desconvocar atleta" onclick="desconvocarAtleta('${c.id}', '${nameStr}')" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 16px; padding: 0 2px; line-height: 1;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">✕</button>
        </div>
      `;
      container.appendChild(div);
    });

    try {
      localStorage.setItem("players", JSON.stringify(playersLocais));
    } catch (e) { }
    atualizarContadorPresencas();

    // Renderizar Fila de Espera para o Gestor
    const waitlistContainer = document.getElementById("manager-waitlist-container");
    const waitlistCountEl = document.getElementById("manager-waitlist-count");
    const waitlistListEl = document.getElementById("manager-waitlist-list");

    const emEspera = (convocados || []).filter(c => c.status === "espera" || c.status === "fila_espera").sort((a, b) => (a.posicao_fila || 99) - (b.posicao_fila || 99));

    if (waitlistContainer && waitlistListEl) {
      if (emEspera.length > 0) {
        waitlistContainer.style.display = "block";
        if (waitlistCountEl) waitlistCountEl.textContent = emEspera.length;

        let waitHtml = "";
        emEspera.forEach((c, idx) => {
          const posFila = c.posicao_fila || (idx + 1);
          const nameStr = c.apelido || c.nome || 'Atleta';
          const initial = nameStr.charAt(0).toUpperCase();
          const avatarHtml = c.foto
            ? `<img src="${c.foto}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid #F59E0B; flex-shrink: 0;" alt="${nameStr}">`
            : `<div style="width: 36px; height: 36px; border-radius: 50%; background: #D97706; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; flex-shrink: 0;">${initial}</div>`;

          waitHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #FFFFFF; border-radius: 8px; margin-bottom: 6px; border: 1px solid #FDE68A;">
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                <span style="font-weight: 800; font-size: 12px; color: #D97706; min-width: 24px;">#${posFila}</span>
                ${avatarHtml}
                <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
                  <span style="font-size: 13px; font-weight: 700; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${nameStr} ${c.goleiro ? '🧤' : ''}</span>
                  <span style="font-size: 10px; color: #D97706; font-weight: 600;">⏳ Fila de Espera</span>
                </div>
              </div>
              <button title="Remover da Fila de Espera" onclick="removerDaFilaGestor('${peladaId}', '${c.id}', '${nameStr.replace(/'/g, "\\'")}')" style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 6px; cursor: pointer; color: #EF4444; font-size: 12px; padding: 4px 8px; font-weight: 700; white-space: nowrap;" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='#FEF2F2'">
                ✕ Remover
              </button>
            </div>
          `;
        });
        waitlistListEl.innerHTML = waitHtml;
      } else {
        waitlistContainer.style.display = "none";
      }
    }
    // Wiring dos botões de lote
    const btnAll = document.getElementById("btn-presence-all");
    const btnNone = document.getElementById("btn-presence-none");
    if (btnAll) {
      btnAll.onclick = async () => {
        const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
        if (!peladaId) { window.App.showToast("Selecione uma pelada primeiro.", "error"); return; }
        btnAll.disabled = true;
        btnAll.textContent = "Aguarde...";
        let ok = 0;
        for (const c of confirmados) {
          try {
            const res = await Api.atualizarPresenca(peladaId, c.id, true);
            if (!res.error) ok++;
          } catch (e) { /* ignora erros individuais */ }
        }
        window.App.showToast(`Presença confirmada para ${ok} atleta(s)!`, "success");
        await updateCheckinPlayersList(peladaId);
      };
    }
    if (btnNone) {
      btnNone.onclick = async () => {
        const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
        if (!peladaId) { window.App.showToast("Selecione uma pelada primeiro.", "error"); return; }
        btnNone.disabled = true;
        btnNone.textContent = "Aguarde...";
        let ok = 0;
        for (const c of confirmados) {
          try {
            const res = await Api.atualizarPresenca(peladaId, c.id, false);
            if (!res.error) ok++;
          } catch (e) { /* ignora erros individuais */ }
        }
        window.App.showToast(`Presença limpa para ${ok} atleta(s).`, "info");
        await updateCheckinPlayersList(peladaId);
      };
    }
  } catch (err) {
    console.error("[Formacao] Erro ao carregar convocados da pelada:", err);
    container.innerHTML = `<p style="font-size: 13px; text-align: center; color:var(--danger); padding: 12px 0;">Erro ao carregar confirmados.</p>`;
  }
}
async function togglePresenter(playerId, checkbox) {
  // Convertemos para número se o ID do banco for numérico para coincidir tipos
  const idToFind = isNaN(playerId) ? playerId : parseInt(playerId);
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (!peladaId) {
    window.App.showToast("Pelada de referência não selecionada.", "error");
    checkbox.checked = !checkbox.checked;
    return;
  }
  // Desabilita temporariamente para evitar cliques duplos
  checkbox.disabled = true;
  try {
    // 1. Grava no banco de dados local via API do backend
    const res = await Api.atualizarPresenca(peladaId, idToFind, checkbox.checked);
    if (res.error) {
      window.App.showToast(res.error, "error");
      checkbox.checked = !checkbox.checked; // desfaz a seleção
      checkbox.disabled = false;
      return;
    }
    // 2. Atualiza a lista na memória global
    if (checkbox.checked) {
      if (!window.App.presentPlayers.includes(idToFind)) window.App.presentPlayers.push(idToFind);
    } else {
      window.App.presentPlayers = window.App.presentPlayers.filter(id => id !== idToFind);
    }
    atualizarContadorPresencas();
    window.App.showToast(checkbox.checked ? "Presença registrada!" : "Presença cancelada.");
  } catch (err) {
    console.error("[togglePresenter]", err);
    window.App.showToast("Erro ao registrar presença no banco.", "error");
    checkbox.checked = !checkbox.checked; // desfaz a seleção
  } finally {
    checkbox.disabled = false;
  }
}
async function desconvocarAtleta(atletaId, atletaNome) {
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (!peladaId) { window.App.showToast("Selecione uma pelada primeiro.", "error"); return; }
  if (!confirm(`Desconvocar ${atletaNome} desta pelada?\nEle sairá da lista e não participará do sorteio.`)) return;
  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/convocacoes/desconvocar", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        pelada_id: parseInt(peladaId),
        usuario_id: parseInt(atletaId)
      })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[desconvocarAtleta] Erro backend:", data);
      const msg = data.detail ? `${data.error || 'Erro'} (${data.detail})` : (data.error || "Erro ao desconvocar atleta.");
      window.App.showToast(msg, "error");
      return;
    }
    window.App.showToast(`${atletaNome} desconvocado com sucesso.`, "success");
    await updateCheckinPlayersList(peladaId);
  } catch (err) {
    console.error("[desconvocarAtleta]", err);
    window.App.showToast("Erro ao conectar no servidor.", "error");
  }
}
async function estornarSaldoAtleta(atletaId, atletaNome) {
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (!peladaId) { window.App.showToast("Selecione uma pelada primeiro.", "error"); return; }
  if (!confirm(`Devolver o saldo de ${atletaNome}?\nO valor da pelada será creditado de volta na carteira do atleta.`)) return;
  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/convocacoes/estornar-saldo", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        pelada_id: parseInt(peladaId),
        usuario_id: parseInt(atletaId)
      })
    });
    const data = await res.json();
    if (!res.ok) {
      window.App.showToast(data.error || "Erro ao estornar saldo.", "error");
      return;
    }
    const valorFmt = data.valor ? `R$ ${parseFloat(data.valor).toFixed(2).replace('.', ',')}` : '';
    window.App.showToast(`Saldo de ${atletaNome} estornado! ${valorFmt} devolvidos.`, "success");
    await updateCheckinPlayersList(peladaId);
  } catch (err) {
    console.error("[estornarSaldoAtleta]", err);
    window.App.showToast("Erro ao conectar no servidor.", "error");
  }
}
window.App.renderDrawnTeams = async function () {
  const container = document.getElementById("drawn-teams-container");
  if (!container) return;
  container.innerHTML = "";
  const activePelada = window.App.activePelada;
  if (activePelada) {
    const lastActivePeladaId = localStorage.getItem("lastActivePeladaId");
    if (lastActivePeladaId !== String(activePelada.id)) {
      localStorage.setItem("lastActivePeladaId", String(activePelada.id));
      const specificTeams = localStorage.getItem(`teams_${activePelada.id}`);
      if (specificTeams) {
        localStorage.setItem("teams", specificTeams);
      } else {
        localStorage.removeItem("teams");
      }
    }
  }
  // Se a pelada selecionada estiver finalizada, limpa os times sorteados
  if (activePelada && activePelada.status === "finalizada") {
    window.App.teams = [];
    localStorage.removeItem("teams");
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 32px 16px; text-align: center;">
        <i data-feather="check-circle" style="width: 48px; height: 48px; display: block; margin: 0 auto 12px auto; color: var(--secondary);"></i>
        <h4 class="text-inter" style="font-size: 16px; font-weight: 700; color: var(--text-heading); margin-bottom: 4px;">Rodada Encerrada 🏁</h4>
        <p class="text-inter" style="font-size: 13px; color: var(--text-caption);">Os jogos desta data já foram finalizados. Agende uma nova data ou selecione uma rodada ativa para um novo sorteio.</p>
      </div>
    `;
    if (window.feather) feather.replace();
    return;
  }

  // Busca os times específicos desta pelada
  const teamsKey = getTeamsKey();
  let teams = [];
  try { teams = JSON.parse(localStorage.getItem(teamsKey)) || []; } catch (e) { }
  if (!teams || teams.length === 0) {
    window.App.teams = [];
    localStorage.removeItem("teams");
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-feather="shuffle" style="width: 48px; height: 48px; display: block; margin: 0 auto 12px auto; color: var(--text-caption);"></i>
        <p class="text-inter">Realize o sorteio inteligente ao lado para montar as equipes.</p>
      </div>
    `;
    if (window.feather) feather.replace();
    return;
  }
  window.App.teams = teams;
  let teamsModificados = false;
  const allPlayersLocais = JSON.parse(localStorage.getItem("players")) || [];
  teams.forEach((team) => {
    // Remove qualquer jogador nulo ou inválido que possa ter entrado por falha anterior do drag/drop
    const originalCount = team.players.length;
    team.players = team.players.filter(p => p !== null && p !== undefined && p.id !== undefined);
    if (team.players.length !== originalCount) {
      teamsModificados = true;
    }
    const validPlayers = team.players;
    const avg = validPlayers.length ? (validPlayers.reduce((s, p) => s + (parseInt(p.autoavaliacao) || 3), 0) / validPlayers.length).toFixed(1) : "0.0";
    const card = document.createElement("div");
    card.className = "team-draft-card";
    card.id = `card-team-${team.id}`;
    card.setAttribute("ondragover", "allowDrop(event)");
    card.setAttribute("ondragleave", "dragLeave(event)");
    card.setAttribute("ondrop", `drop(event, '${team.id}')`);
    const emblemaIdx = (team.emblema !== undefined && team.emblema !== null) ? team.emblema : 0;
    // Se o time veio do sorteio sem emblema embutido, resolve da galeria do grupo
    if (!team.emblema_url && !team.emblemaUrl) {
      const embItem = (window._groupEmblemsList || [])[emblemaIdx];
      if (embItem && embItem.imagem_url) {
        team.emblema_url = embItem.imagem_url;
        team.emblemaUrl = embItem.imagem_url;
      }
    }
    const emblemaSVG = (window.TeamEmblems) ? window.TeamEmblems.forTeam(team) : '';
    card.innerHTML = `
      <div class="team-draft-header" style="border-top: 4px solid ${team.cor || '#777'}; flex-direction: column; gap: 6px; padding-bottom: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <input type="text" class="team-draft-title-input" value="${team.nome}" onchange="renameTeam('${team.id}', this.value)">
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div 
            id="emblem-${team.id}"
            title="Clique para trocar o emblema do time"
            onclick="openEmblemSelector('${team.id}', ${emblemaIdx})"
            style="width: 56px; height: 62px; cursor: pointer; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25)); transition: transform 0.15s; border-radius: 4px; overflow: hidden;"
            onmouseover="this.style.transform='scale(1.08)'"
            onmouseout="this.style.transform='scale(1)'"
          >${emblemaSVG}</div>
          <div>
            <div style="font-size: 12px; color: var(--text-caption); font-weight: 500;">🛡️ Emblema do Time</div>
            <div style="font-size: 11px; color: #94A3B8;">Clique no escudo para alterar</div>
          </div>
        </div>
      </div>
      <div class="team-draft-players" id="players-list-${team.id}">
        <!-- Jogadores -->
      </div>
    `;
    const playersList = card.querySelector(`#players-list-${team.id}`);
    validPlayers.forEach(p => {
      const pDiv = document.createElement("div");
      pDiv.className = "player-draft-item";
      pDiv.draggable = true;
      pDiv.setAttribute("ondragstart", `drag(event, '${p.id}', '${team.id}')`);
      const matchingPlayer = allPlayersLocais.find(pl => String(pl.id) === String(p.id)) || p;
      const fotoUrl = p.foto || matchingPlayer.foto || null;
      const nameStr = p.apelido || p.nome || 'Atleta';
      const initial = nameStr.charAt(0).toUpperCase();
      const avatarHtml = fotoUrl
        ? `<img src="${fotoUrl}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 3px solid ${team.cor || '#0284C7'}; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" alt="${nameStr}">`
        : `<div style="width: 60px; height: 60px; border-radius: 50%; background: ${team.cor || '#0284C7'}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22px; border: 3px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${initial}</div>`;
      pDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          ${avatarHtml}
          <span class="player-draft-name" style="font-weight: 600;">
            ${nameStr} ${p.goleiro ? '🧤' : ''}
          </span>
        </div>
      `;
      playersList.appendChild(pDiv);
    });
    container.appendChild(card);
  });
  if (teamsModificados) {
    const enxutos = enxugarTimesParaStorage(teams);
    safeSetStorage(teamsKey, enxutos);
    safeSetStorage("teams", enxutos);
    window.App.teams = teams;
  }
};
async function syncDrawnTeamsToCloud(showToastMessage) {
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (!peladaId) {
    if (showToastMessage) window.App.showToast("Nenhuma pelada selecionada para salvar.", "warning");
    return;
  }
  const teamsKey = `teams_${peladaId}`;
  let teams = [];
  try { teams = JSON.parse(localStorage.getItem(teamsKey)) || []; } catch (e) { }
  if (!teams || teams.length === 0) teams = window.App.teams || [];

  if (teams && teams.length > 0 && window.Api && window.Api.atualizarLiveState) {
    try {
      const res = await window.Api.atualizarLiveState(peladaId, window.App.liveMatch, window.App.waitingQueue || [], teams, false, true);
      if (showToastMessage) {
        if (res && res.error) {
          window.App.showToast(res.error, "error");
        } else {
          window.App.showToast("☁️ Times salvos e sincronizados no banco de dados com sucesso!", "success");
        }
      }
    } catch (e) {
      console.error("[syncDrawnTeamsToCloud]", e);
      if (showToastMessage) window.App.showToast("Erro ao conectar ao servidor para salvar os times.", "error");
    }
  } else if (showToastMessage) {
    window.App.showToast("Nenhum time montado para salvar.", "warning");
  }
}
window.App.syncDrawnTeamsToCloud = syncDrawnTeamsToCloud;
// Carrega os times salvos na nuvem para esta pelada (sincroniza entre dispositivos)
window.App.carregarTimesDoServidor = async function (peladaId) {
  try {
    if (!window.Api || !window.Api.obterLiveState) return;
    const res = await window.Api.obterLiveState(peladaId);
    const state = res && res.state ? res.state : null;
    const teamsKey = `teams_${peladaId}`;

    const teamsServidor = (state && Array.isArray(state.teams)) ? state.teams : [];

    if (teamsServidor.length === 0) {
      window.App.teams = [];
      window.App.liveMatch = null;
      window.App.waitingQueue = [];
      try { localStorage.removeItem(teamsKey); } catch (e) { }
      try { localStorage.removeItem("teams"); } catch (e) { }
      try { localStorage.removeItem(`tournamentState_${peladaId}`); } catch (e) { }
      try { localStorage.removeItem("tournamentState"); } catch (e) { }
      try { localStorage.removeItem("liveMatch"); } catch (e) { }
      try { localStorage.removeItem("waitingQueue"); } catch (e) { }
      window.App.renderDrawnTeams();
      return;
    }

    const enxutos = enxugarTimesParaStorage(teamsServidor);
    safeSetStorage(teamsKey, enxutos);
    safeSetStorage("teams", enxutos);
    window.App.teams = teamsServidor;

    window.App.liveMatch = (state && state.liveMatch) ? { ...state.liveMatch } : null;
    window.App.waitingQueue = (state && Array.isArray(state.waitingQueue)) ? state.waitingQueue : [];
    if (state && state.liveMatch && state.liveMatch.tournamentState) {
      safeSetStorage(`tournamentState_${peladaId}`, state.liveMatch.tournamentState);
    }
    window.App.renderDrawnTeams();
    if (window.App.updateAcompanhamentoUI) window.App.updateAcompanhamentoUI();
  } catch (e) {
    console.warn("[carregarTimesDoServidor]", e);
    const teamsKey = `teams_${peladaId}`;
    let localTeams = [];
    try { localTeams = JSON.parse(localStorage.getItem(teamsKey) || '[]'); } catch (err) { }
    window.App.teams = Array.isArray(localTeams) ? localTeams : [];
    if (window.App.renderDrawnTeams) window.App.renderDrawnTeams();
  }
};
function drag(ev, playerId, teamId) {
  draggedPlayerId = playerId;
  draggedFromTeamId = teamId;
  ev.dataTransfer.setData("text", playerId);
}
function allowDrop(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.add("dragover");
}
function dragLeave(ev) {
  ev.currentTarget.classList.remove("dragover");
}
function drop(ev, targetTeamId) {
  ev.preventDefault();
  ev.currentTarget.classList.remove("dragover");
  if (String(targetTeamId) === String(draggedFromTeamId)) return;
  // ===== CORREÇÃO: usa a chave com ID da pelada =====
  const teamsKey = getTeamsKey();
  const teams = JSON.parse(localStorage.getItem(teamsKey)) || [];
  const sourceTeam = teams.find(t => String(t.id) === String(draggedFromTeamId));
  const targetTeam = teams.find(t => String(t.id) === String(targetTeamId));
  if (!sourceTeam || !targetTeam) {
    console.warn("[DragDrop] Time de origem ou destino não encontrado.");
    return;
  }
  const player = sourceTeam.players.find(p => String(p.id) === String(draggedPlayerId));
  if (!player) {
    console.warn("[DragDrop] Jogador não encontrado no time de origem.");
    return;
  }
  sourceTeam.players = sourceTeam.players.filter(p => String(p.id) !== String(draggedPlayerId));
  targetTeam.players.push(player);
  const enxutosDrop = enxugarTimesParaStorage(teams);
  safeSetStorage(teamsKey, enxutosDrop);
  safeSetStorage("teams", enxutosDrop);
  window.App.teams = teams;
  window.App.renderDrawnTeams();
  window.App.showToast(`${player.nome} movido para ${targetTeam.nome}!`);
}
function renameTeam(teamId, newName) {
  // ===== CORREÇÃO: usa a chave com ID da pelada =====
  const teamsKey = getTeamsKey();
  const teams = JSON.parse(localStorage.getItem(teamsKey)) || [];
  const team = teams.find(t => String(t.id) === String(teamId));
  const trimmed = (newName || '').trim();
  if (team && trimmed) {
    const isDuplicate = teams.some(t => String(t.id) !== String(teamId) && (t.nome || t.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      window.App.showToast(`⚠️ Já existe um time com o nome "${trimmed}". Os nomes dos times devem ser únicos!`, "warning");
      window.App.renderDrawnTeams();
      return;
    }
    const oldName = team.nome;
    team.nome = trimmed;
    team.name = trimmed;
    const enxutosRename = enxugarTimesParaStorage(teams);
    safeSetStorage(teamsKey, enxutosRename);
    safeSetStorage("teams", enxutosRename);
    window.App.teams = teams;
    if (window.App.waitingQueue.includes(oldName)) {
      window.App.waitingQueue[window.App.waitingQueue.indexOf(oldName)] = team.nome;
    }
    if (window.App.liveMatch.teamA === oldName) {
      window.App.liveMatch.teamA = team.nome;
    }
    if (window.App.liveMatch.teamB === oldName) {
      window.App.liveMatch.teamB = team.nome;
    }
    safeSetStorage("liveMatch", window.App.liveMatch);
    safeSetStorage("waitingQueue", window.App.waitingQueue);
    window.App.updateAcompanhamentoUI();
    window.App.renderDrawnTeams();
    window.App.showToast(`Time renomeado para ${team.nome}`);
  }
}
var draggedPlayerId = null;
var draggedFromTeamId = null;
function criarTimeManual() {
  // ===== CORREÇÃO: usa a chave com ID da pelada =====
  const teamsKey = getTeamsKey();
  const teams = JSON.parse(localStorage.getItem(teamsKey)) || [];
  // Cores premium da paleta
  const CORES_PALETA = ["#00E676", "#FFD600", "#FF1744", "#2979FF", "#AA00FF", "#00E5FF", "#FF9100", "#F50057"];
  const novaCor = CORES_PALETA[teams.length % CORES_PALETA.length];

  // Garante que o nome gerado seja único (sem repetir nomes já existentes)
  const existingNames = new Set(teams.map(t => (t.nome || t.name || '').trim().toLowerCase()));
  let idx = 0;
  let nomePadrao = `Time ${String.fromCharCode(65 + idx)}`;
  while (existingNames.has(nomePadrao.toLowerCase())) {
    idx++;
    nomePadrao = `Time ${String.fromCharCode(65 + idx)}`;
  }

  const novoTime = {
    id: Date.now(), // ID numérico único baseado no tempo
    nome: nomePadrao,
    cor: novaCor,
    players: []
  };
  // 1. Adiciona nos times do localStorage
  teams.push(novoTime);
  const enxutosManual = enxugarTimesParaStorage(teams);
  safeSetStorage(teamsKey, enxutosManual);
  safeSetStorage("teams", enxutosManual);
  window.App.teams = teams;
  // 2. Adiciona o time à fila de espera das partidas do dia
  // Se já temos pelo menos 2 times na partida ao vivo, os novos times criados entram na fila de espera!
  // Se não temos times ativos no liveMatch, alimentamos a partida ativa primeiro!
  if (teams.length === 1) {
    window.App.liveMatch.teamA = novoTime.nome;
    window.App.liveMatch.scoreA = 0;
  } else if (teams.length === 2) {
    window.App.liveMatch.teamB = novoTime.nome;
    window.App.liveMatch.scoreB = 0;
  } else {
    window.App.waitingQueue.push(novoTime.nome);
  }
  // 3. Persiste o estado do jogo ao vivo e fila no localStorage e servidor
  safeSetStorage("liveMatch", window.App.liveMatch);
  safeSetStorage("waitingQueue", window.App.waitingQueue);
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (peladaId && window.Api && window.Api.atualizarLiveState) {
    window.Api.atualizarLiveState(peladaId, window.App.liveMatch, window.App.waitingQueue, teams);
  }
  // 4. Atualiza a UI
  window.App.renderDrawnTeams();
  window.App.updateAcompanhamentoUI();
  window.App.showToast(`Time ${novoTime.nome} criado com sucesso!`);
}
// ============================================================
// SELETOR DE EMBLEMA DOS TIMES
// ============================================================
window._emblemTargetTeamId = null;
window._groupEmblemsList = [];
window.openEmblemSelector = async function (teamId, currentIndex) {
  window._emblemTargetTeamId = teamId;
  if (!window.TeamEmblems) {
    window.App.showToast("Módulo de emblemas não carregado.", "error");
    return;
  }
  const group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  const groupId = group ? group.id : null;
  const token = localStorage.getItem("token");
  // Carrega a galeria do grupo no banco de dados
  if (groupId && token) {
    try {
      const res = await fetch(`/api/formacao/emblemas/grupo/${groupId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        window._groupEmblemsList = await res.json();
      }
    } catch (e) {
      console.warn("[Emblemas Galeria] Erro ao carregar do grupo:", e);
    }
  }
  // Encontra o time selecionado
  // ===== CORREÇÃO: usa a chave com ID da pelada =====
  const teamsKey = getTeamsKey();
  let teams = [];
  try { teams = JSON.parse(localStorage.getItem(teamsKey)) || []; } catch (e) { }
  const targetTeam = teams.find(t => String(t.id) === String(teamId)) || { emblema: currentIndex };
  // Remove seletor anterior se existir
  var existing = document.getElementById("emblem-selector-popup");
  if (existing) existing.remove();
  var popup = document.createElement("div");
  popup.id = "emblem-selector-popup";
  popup.style.cssText = [
    "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);",
    "background: #FFFFFF; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);",
    "z-index: 9999; width: 360px; max-width: 92vw; overflow: hidden;"
  ].join("");
  popup.innerHTML =
    "<div style=\"background: #0F172A; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;\">" +
    "<span style=\"color: #FFFFFF; font-weight: 700; font-size: 15px; font-family: 'Inter', sans-serif;\">🛡️ Galeria de Emblemas</span>" +
    "<button onclick=\"document.getElementById('emblem-selector-popup').remove(); var o=document.getElementById('emblem-selector-overlay'); if(o)o.remove();\" " +
    "style=\"background: rgba(255,255,255,0.15); border: none; color: #FFF; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;\">✕</button>" +
    "</div>" +
    "<div style=\"padding: 16px; max-height: 80vh; overflow-y: auto;\">" +
    window.TeamEmblems.renderSelector(
      targetTeam,
      "selectEmblem",
      "handleCustomEmblemUpload",
      window._groupEmblemsList,
      "selectCustomEmblemFromLibrary",
      "deleteCustomEmblemFromLibrary"
    ) +
    "</div>";
  // Overlay
  var overlay = document.getElementById("emblem-selector-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "emblem-selector-overlay";
    overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9998;";
    overlay.onclick = function () {
      popup.remove();
      overlay.remove();
    };
    document.body.appendChild(overlay);
  }
  document.body.appendChild(popup);
};
window.selectEmblem = function (emblemaIdx) {
  var teamId = window._emblemTargetTeamId;
  if (teamId === null || teamId === undefined) return;
  // ===== CORREÇÃO: usa a chave com ID da pelada =====
  const teamsKey = getTeamsKey();
  var teams = [];
  try { teams = JSON.parse(localStorage.getItem(teamsKey)) || []; } catch (e) { }
  var team = teams.find(function (t) { return String(t.id) === String(teamId); });
  if (team) {
    team.emblema = emblemaIdx;
    delete team.emblema_url;
    delete team.emblemaUrl;
    safeSetStorage(teamsKey, enxugarTimesParaStorage(teams));
    safeSetStorage("teams", enxugarTimesParaStorage(teams));
    window.App.teams = teams;
    syncDrawnTeamsToCloud(false);
  }
  var token = localStorage.getItem("token");
  if (token && team && team.db_id) {
    fetch("/api/formacao/times/" + team.db_id + "/emblema", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ emblema: emblemaIdx })
    }).catch(function (e) { console.warn("[Emblema] Erro ao salvar no banco:", e); });
  }
  var popup = document.getElementById("emblem-selector-popup");
  var overlay = document.getElementById("emblem-selector-overlay");
  if (popup) popup.remove();
  if (overlay) overlay.remove();
  var emblemEl = document.getElementById("emblem-" + teamId);
  if (emblemEl && window.TeamEmblems) {
    emblemEl.innerHTML = window.TeamEmblems.forTeam(team || { emblema: emblemaIdx });
    emblemEl.setAttribute("onclick", "openEmblemSelector('" + teamId + "', " + emblemaIdx + ")");
  }
  if (window.App.updateAcompanhamentoUI) window.App.updateAcompanhamentoUI();
  window.App.showToast("Emblema atualizado!");
};
window.selectCustomEmblemFromLibrary = function (emblemaId) {
  var teamId = window._emblemTargetTeamId;
  if (teamId === null || teamId === undefined) return;
  var item = (window._groupEmblemsList || []).find(x => String(x.id) === String(emblemaId));
  if (!item) return;
  // ===== CORREÇÃO: usa a chave com ID da pelada =====
  const teamsKey = getTeamsKey();
  var teams = [];
  try { teams = JSON.parse(localStorage.getItem(teamsKey)) || []; } catch (e) { }
  var team = teams.find(function (t) { return String(t.id) === String(teamId); });
  if (team) {
    team.emblema_url = item.imagem_url;
    team.emblemaUrl = item.imagem_url;
    safeSetStorage(teamsKey, enxugarTimesParaStorage(teams));
    safeSetStorage("teams", enxugarTimesParaStorage(teams));
    window.App.teams = teams;
    syncDrawnTeamsToCloud(false);
  }
  var token = localStorage.getItem("token");
  if (token && team && team.db_id) {
    fetch("/api/formacao/times/" + team.db_id + "/emblema", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ emblemaUrl: item.imagem_url })
    }).catch(function (e) { console.warn("[Emblema Library] Erro ao salvar no banco:", e); });
  }
  var popup = document.getElementById("emblem-selector-popup");
  var overlay = document.getElementById("emblem-selector-overlay");
  if (popup) popup.remove();
  if (overlay) overlay.remove();
  var emblemEl = document.getElementById("emblem-" + teamId);
  if (emblemEl && window.TeamEmblems) {
    emblemEl.innerHTML = window.TeamEmblems.forTeam(team || { emblema_url: item.imagem_url });
  }
  if (window.App.updateAcompanhamentoUI) window.App.updateAcompanhamentoUI();
  window.App.showToast("Emblema gravado selecionado com sucesso!");
};
window.deleteCustomEmblemFromLibrary = async function (emblemaId) {
  if (!confirm("Deseja remover este emblema da galeria do grupo?")) return;
  const token = localStorage.getItem("token");
  if (token) {
    try {
      await fetch(`/api/formacao/emblemas/${emblemaId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch (e) { }
  }
  window._groupEmblemsList = (window._groupEmblemsList || []).filter(x => String(x.id) !== String(emblemaId));
  window.App.showToast("Emblema removido da galeria.");
  // Re-renderiza popup
  window.openEmblemSelector(window._emblemTargetTeamId, 0);
};
window.handleCustomEmblemUpload = function (event) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;
  var teamId = window._emblemTargetTeamId;
  if (teamId === null || teamId === undefined) return;
  var group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  var groupId = group ? group.id : null;
  window.App.showToast("Gravando novo emblema no sistema...");
  window.TeamEmblems.compressImage(file, function (base64) {
    // 1. Salva no banco de dados na galeria do grupo
    var token = localStorage.getItem("token");
    if (groupId && token) {
      fetch(`/api/formacao/emblemas/grupo/${groupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ nome: file.name || "Emblema Personalizado", imagemUrl: base64 })
      }).then(res => res.json()).then(data => {
        if (data && data.emblema) {
          window._groupEmblemsList.push(data.emblema);
        }
      }).catch(e => console.warn("[Salvar Galeria] Erro:", e));
    }
    // 2. Associa ao time atual
    // ===== CORREÇÃO: usa a chave com ID da pelada =====
    const teamsKey = getTeamsKey();
    var teams = [];
    try { teams = JSON.parse(localStorage.getItem(teamsKey)) || []; } catch (e) { }
    var team = teams.find(function (t) { return String(t.id) === String(teamId); });
    if (team) {
      team.emblema_url = base64;
      team.emblemaUrl = base64;
      safeSetStorage(teamsKey, enxugarTimesParaStorage(teams));
      safeSetStorage("teams", enxugarTimesParaStorage(teams));
      window.App.teams = teams;
      syncDrawnTeamsToCloud(false);
    }
    if (token && team && team.db_id) {
      fetch("/api/formacao/times/" + team.db_id + "/emblema", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ emblemaUrl: base64 })
      }).catch(function (e) { console.warn("[Emblema Custom] Erro ao salvar no banco:", e); });
    }
    // 3. Fecha modal e atualiza UI
    var popup = document.getElementById("emblem-selector-popup");
    var overlay = document.getElementById("emblem-selector-overlay");
    if (popup) popup.remove();
    if (overlay) overlay.remove();
    var emblemEl = document.getElementById("emblem-" + teamId);
    if (emblemEl && window.TeamEmblems) {
      emblemEl.innerHTML = window.TeamEmblems.forTeam(team || { emblema_url: base64 });
    }
    if (window.App.updateAcompanhamentoUI) window.App.updateAcompanhamentoUI();
    window.App.showToast("Novo emblema gravado no sistema e aplicado ao time! 🛡️");
  });
};

async function copiarListaPresencaWhatsApp() {
  const selectPelada = document.getElementById("select-manager-pelada");
  const peladaId = (selectPelada && selectPelada.value) || (window.App.activePelada ? window.App.activePelada.id : null);

  if (!peladaId) {
    window.App.showToast("Selecione uma pelada para copiar a lista.", "warning");
    return;
  }

  try {
    const convocados = await Api.listarConvocados(peladaId);
    if (!convocados || convocados.length === 0) {
      window.App.showToast("Nenhum atleta convocado para esta data.", "warning");
      return;
    }

    const confirmados = convocados.filter(c => c.status === "confirmado");
    const emEspera = convocados.filter(c => c.status === "fila_espera" || c.status === "espera")
      .sort((a, b) => (a.posicao_fila || 99) - (b.posicao_fila || 99));

    if (confirmados.length === 0 && emEspera.length === 0) {
      window.App.showToast("Nenhum atleta confirmado ou na fila de espera nesta data.", "warning");
      return;
    }

    const group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup || {};
    const groupName = group.nome || "PeladaPro";
    const peladaData = window.App.activePelada ? (window.App.activePelada.data || "") : "";
    const rawDate = peladaData ? String(peladaData).split("T")[0] : "";
    const dataFmt = window.Utils ? window.Utils.formatDate(rawDate || peladaData) : (rawDate || "Data");
    const horarioFmt = window.App.activePelada && window.App.activePelada.horario ? ` às ${window.App.activePelada.horario}` : "";
    const localFmt = window.App.activePelada && window.App.activePelada.local ? `\n📍 *Local:* ${window.App.activePelada.local}` : "";

    const goleiros = confirmados.filter(c => c.goleiro);
    const linha = confirmados.filter(c => !c.goleiro);

    let texto = `⚽ *LISTA DE CONVOCADOS — ${groupName.toUpperCase()}*\n`;
    texto += `📅 *Data:* ${dataFmt}${horarioFmt}${localFmt}\n`;
    texto += `👥 *Total de Confirmados:* ${confirmados.length} atleta(s)\n\n`;

    if (goleiros.length > 0) {
      texto += `🧤 *GOLEIROS:*\n`;
      goleiros.forEach((g, idx) => {
        const nomeStr = g.apelido || g.nome || 'Atleta';
        const check = g.presenca ? " ✅" : "";
        texto += `${idx + 1}. ${nomeStr}${check}\n`;
      });
      texto += `\n`;
    }

    if (linha.length > 0) {
      texto += `🏃 *JOGADORES DE LINHA:*\n`;
      linha.forEach((l, idx) => {
        const nomeStr = l.apelido || l.nome || 'Atleta';
        const check = l.presenca ? " ✅" : "";
        texto += `${idx + 1}. ${nomeStr}${check}\n`;
      });
    }

    // Fila de espera (se houver)
    if (emEspera.length > 0) {
      texto += `\n⏳ *FILA DE ESPERA (${emEspera.length}):*\n`;
      emEspera.forEach((e, idx) => {
        const nomeStr = e.apelido || e.nome || 'Atleta';
        const luva = e.goleiro ? " 🧤" : "";
        const pos = e.posicao_fila || (idx + 1);
        texto += `${pos}. ${nomeStr}${luva}\n`;
      });
    }

    texto += `\n_Gerado por PeladaPro 📱_`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
    } else {
      const tempTextArea = document.createElement("textarea");
      tempTextArea.value = texto;
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      document.execCommand("copy");
      document.body.removeChild(tempTextArea);
    }

    window.App.showToast("📋 Lista copiada com sucesso! Pronta para colar no WhatsApp.", "success");
  } catch (err) {
    console.error("[copiarListaPresencaWhatsApp]", err);
    window.App.showToast("Erro ao copiar lista para a área de transferência.", "error");
  }
}

async function exportConvocadosExcel() {
  const selectPelada = document.getElementById("select-manager-pelada");
  const peladaId = (selectPelada && selectPelada.value) || (window.App.activePelada ? window.App.activePelada.id : null);

  if (!peladaId) {
    window.App.showToast("Selecione uma pelada para exportar a lista.", "warning");
    return;
  }

  try {
    window.App.showToast("Gerando planilha de confirmados da data...", "info");
    const convocados = await Api.listarConvocados(peladaId);
    if (!convocados || convocados.length === 0) {
      window.App.showToast("Nenhum atleta convocado para esta data.", "warning");
      return;
    }

    // Filtrar ESTRITAMENTE os atletas confirmados para a data da convocação selecionada
    const confirmados = convocados.filter(c => c.status === "confirmado");

    if (confirmados.length === 0) {
      window.App.showToast("Nenhum atleta confirmado nesta data.", "warning");
      return;
    }

    const peladaData = window.App.activePelada ? (window.App.activePelada.data || "") : "";
    const rawDate = peladaData ? String(peladaData).split("T")[0] : "";
    const dataFmt = window.Utils ? window.Utils.formatDate(rawDate || peladaData) : (rawDate || "Data");

    // Cabeçalho e dados em formato CSV UTF-8 com BOM para abertura perfeita no Microsoft Excel
    let csv = "\uFEFF";
    csv += "Nº;Nome Completo;Apelido;Posição;Autoavaliação (Estrelas);Status Convocação;Presença (Check-in);Forma de Pagamento;Data da Convocação\n";

    confirmados.forEach((c, index) => {
      const num = index + 1;
      const nome = `"${(c.nome || '').replace(/"/g, '""')}"`;
      const apelido = `"${(c.apelido || c.nome || '').replace(/"/g, '""')}"`;
      const pos = c.goleiro ? "Goleiro 🧤" : "Linha";
      const estrelas = `${c.autoavaliacao || 3} ★`;
      const statusStr = "Confirmado";
      const presencaStr = c.presenca ? "Presente (Check-in ✅)" : "Ausente";
      const pagto = c.forma_pagamento ? c.forma_pagamento.toUpperCase() : "Não informado";
      const dataConv = c.data_convocacao ? new Date(c.data_convocacao).toLocaleString("pt-BR") : "";

      csv += `${num};${nome};${apelido};${pos};${estrelas};${statusStr};${presencaStr};${pagto};${dataConv}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `Confirmados_Pelada_${dataFmt.replace(/\//g, "-")}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.App.showToast("Lista de confirmados da data exportada com sucesso! 📊", "success");
  } catch (err) {
    console.error("[exportConvocadosExcel]", err);
    window.App.showToast("Erro ao exportar lista para Excel.", "error");
  }
}

async function desconvocarAtleta(usuarioId, atletaNome) {
  const selectPelada = document.getElementById("select-manager-pelada");
  const peladaId = (selectPelada && selectPelada.value) || (window.App.activePelada ? window.App.activePelada.id : null);
  if (!peladaId) {
    window.App.showToast("Selecione uma pelada primeiro.", "warning");
    return;
  }

  if (!confirm(`Tem certeza que deseja desconvocar ${atletaNome} desta pelada?`)) return;

  try {
    window.App.showToast(`Desconvocando ${atletaNome}...`, "info");
    const token = localStorage.getItem("token");
    const res = await fetch("/api/convocacoes/desconvocar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ pelada_id: peladaId, usuario_id: usuarioId })
    });

    const data = await res.json();
    if (!res.ok) {
      window.App.showToast(data.error || "Erro ao desconvocar atleta.", "error");
      return;
    }

    window.App.showToast(`${atletaNome} desconvocado com sucesso!`, "success");
    await updateCheckinPlayersList(peladaId);
  } catch (err) {
    console.error("[desconvocarAtleta]", err);
    window.App.showToast("Erro ao conectar com o servidor.", "error");
  }
}

async function removerDaFilaGestor(peladaId, usuarioId, atletaNome) {
  if (!confirm(`Tem certeza que deseja remover ${atletaNome} da Fila de Espera?`)) return;

  try {
    window.App.showToast(`Removendo ${atletaNome} da fila de espera...`, "info");
    const token = localStorage.getItem("token");
    const res = await fetch("/api/convocacoes/desconvocar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ pelada_id: peladaId, usuario_id: usuarioId })
    });

    const data = await res.json();
    if (!res.ok) {
      window.App.showToast(data.error || "Erro ao remover atleta da fila.", "error");
      return;
    }

    window.App.showToast(`${atletaNome} removido da fila de espera com sucesso! ⏳`, "success");
    await updateCheckinPlayersList(peladaId);
  } catch (err) {
    console.error("[removerDaFilaGestor]", err);
    window.App.showToast("Erro ao conectar com o servidor.", "error");
  }
}

window.App.abrirModalNomesTimes = function () {
  const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  const groupId = currentGroup ? currentGroup.id : null;

  let currentCustom = [];
  try {
    currentCustom = JSON.parse(localStorage.getItem(`customTeamNames_${groupId}`)) || JSON.parse(localStorage.getItem('customTeamNames')) || [];
  } catch (e) { }

  const rawInput = prompt(
    `Cadastre os nomes personalizados dos times da pelada (separados por vírgula):\n\nExemplo: Flamengo, Vasco, Corinthians, Palmeiras\n\n(Deixe em branco para voltar aos nomes padrão: Time A, Time B...)`,
    (currentCustom && currentCustom.length > 0) ? currentCustom.join(', ') : ''
  );

  if (rawInput === null) return; // Gestor cancelou o prompt

  const newNames = rawInput.split(',').map(s => s.trim()).filter(Boolean);
  try {
    if (groupId) safeSetStorage(`customTeamNames_${groupId}`, newNames);
    safeSetStorage('customTeamNames', newNames);
  } catch (e) { }

  // Se já existirem times sorteados na tela, atualiza o nome de cada time!
  const drawnTeams = window.App.teams || [];
  if (Array.isArray(drawnTeams) && drawnTeams.length > 0) {
    drawnTeams.forEach((t, idx) => {
      if (newNames[idx]) {
        t.nome = newNames[idx];
        t.name = newNames[idx];
      }
    });
    const teamsKey = getTeamsKey();
    const enxutosDrawn = enxugarTimesParaStorage(drawnTeams);
    safeSetStorage(teamsKey, enxutosDrawn);
    safeSetStorage('teams', enxutosDrawn);

    // Sincroniza tState do torneio ativo com os novos nomes
    const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
    let tState = (window.App.liveMatch ? window.App.liveMatch.tournamentState : null) || (peladaId ? JSON.parse(localStorage.getItem(`tournamentState_${peladaId}`) || 'null') : null);
    if (tState && window.TournamentEngine) {
      tState.teams = drawnTeams;
      if (Array.isArray(tState.matches)) {
        tState.matches.forEach(m => {
          m.teamA = window.App.resolveOfficialTeamName(m.teamA, drawnTeams);
          m.teamB = window.App.resolveOfficialTeamName(m.teamB, drawnTeams);
        });
      }
      tState.standings = window.TournamentEngine.calculateStandings(drawnTeams, tState.matches);
      if (peladaId) safeSetStorage(`tournamentState_${peladaId}`, tState);
      if (window.App.liveMatch) window.App.liveMatch.tournamentState = tState;
    }

    if (window.App.renderDrawnTeams) window.App.renderDrawnTeams();
    renderFormacaoTournamentUI();
  }

  if (window.App.showToast) {
    if (newNames.length > 0) {
      window.App.showToast(`Nomes dos times cadastrados com sucesso: ${newNames.join(', ')}`, "success");
    } else {
      window.App.showToast("Nomes dos times restaurados para o padrão.", "info");
    }
  }
};

window.desconvocarAtleta = desconvocarAtleta;
window.removerDaFilaGestor = removerDaFilaGestor;
window.exportConvocadosExcel = exportConvocadosExcel;
window.copiarListaPresencaWhatsApp = copiarListaPresencaWhatsApp;

function renderFormacaoTournamentUI() {
  const card = document.getElementById("formacao-tournament-card");
  if (!card) return;

  const peladaAtiva = window.App.activePelada || {};
  const liveMatch = window.App.liveMatch || {};
  let tState = (liveMatch && liveMatch.tournamentState) || (peladaAtiva.id ? JSON.parse(localStorage.getItem(`tournamentState_${peladaAtiva.id}`) || 'null') : null);

  const isTorneio = (peladaAtiva && (peladaAtiva.modo === 'torneio' || peladaAtiva.modo === 'pontos_corridos' || peladaAtiva.modo === 'torneio_pontos_corridos' || peladaAtiva.modo === 'mata_mata_direto' || peladaAtiva.modo === 'torneio_livre')) || !!tState;

  if (!isTorneio) {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";

  let modoDesc = "Mini Torneio";
  if (peladaAtiva.modo === 'pontos_corridos') modoDesc = "Mini Torneio (Pontos Corridos)";
  else if (peladaAtiva.modo === 'mata_mata_direto') modoDesc = "Mini Torneio (Mata-Mata Direto)";
  else if (peladaAtiva.modo === 'torneio_livre') modoDesc = "Torneio Livre (Confrontos Manuais)";
  else if (peladaAtiva.modo === 'torneio') modoDesc = "Mini Torneio (Misto: Tabela + Mata-Mata)";

  const badgeEl = document.getElementById("formacao-tournament-phase-badge");
  if (badgeEl) badgeEl.textContent = modoDesc.toUpperCase();

  const standingsBody = document.getElementById("formacao-tournament-standings-body");
  const matchesList = document.getElementById("formacao-tournament-matches-list");

  if (!tState || !tState.standings || tState.standings.length === 0) {
    if (standingsBody) {
      standingsBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 18px; color: #64748B;">🏆 <strong>Formato Ativo: ${modoDesc}</strong><br><span style="font-size:12px;">Clique no botão 'Sorteio Inteligente' para gerar a tabela de jogos e classificação!</span></td></tr>`;
    }
    if (matchesList) {
      matchesList.innerHTML = `<div style="text-align:center; padding: 14px; color: #64748B; font-size: 13px;">Aguardando sorteio das equipes...</div>`;
    }
    return;
  }

  if (standingsBody) {
    standingsBody.innerHTML = tState.standings.map((s, idx) => {
      const teamName = s.nome || s.name || `Time ${idx + 1}`;
      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="text-align: center; font-weight: bold;">${idx + 1}º</td>
          <td style="font-weight: 700; color: var(--text-heading);">${teamName}</td>
          <td style="text-align: center;">${s.j || 0}</td>
          <td style="text-align: center; color: #10B981; font-weight: bold;">${s.v || 0}</td>
          <td style="text-align: center;">${s.e || 0}</td>
          <td style="text-align: center; color: #EF4444;">${s.d || 0}</td>
          <td style="text-align: center;">${s.gp || 0}</td>
          <td style="text-align: center;">${s.gc || 0}</td>
          <td style="text-align: center; font-weight: bold;">${(s.sg > 0 ? '+' : '') + (s.sg || 0)}</td>
          <td style="text-align: center; font-weight: 800; color: #D97706; font-size: 14px;">${s.pts || 0}</td>
        </tr>
      `;
    }).join('');
  }

  if (matchesList) {
    let matches = tState.matches || [];
    if (window.TournamentEngine && window.TournamentEngine.optimizeMatchSequence) {
      matches = window.TournamentEngine.optimizeMatchSequence(matches);
    }

    const isNight = document.body.classList.contains('modo-noturno-ativo');
    let teamsList = [];
    try { teamsList = JSON.parse(localStorage.getItem(getTeamsKey())) || window.App.teams || []; } catch (e) { }

    if (matches.length === 0) {
      matchesList.innerHTML = `<div style="text-align:center; padding: 12px; color:${isNight ? '#CBD5E1' : '#64748B'}; font-size:12px;">Nenhum confronto gerado ainda.</div>`;
    } else {
      matchesList.innerHTML = matches.map((m, idx) => {
        const isEncerrado = m.status === 'encerrado' || (m.golsA !== null && m.golsA !== undefined);
        const hasPenalties = (m.penaltisA !== null && m.penaltisB !== null && m.penaltisA !== undefined && m.penaltisB !== undefined);
        const scoreText = isEncerrado
          ? (hasPenalties ? `${m.golsA} x ${m.golsB} (${m.penaltisA}x${m.penaltisB} 🎯)` : `${m.golsA} x ${m.golsB}`)
          : 'vs';
        const badgeBg = isNight
          ? (isEncerrado ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.18)')
          : (isEncerrado ? '#D1FAE5' : '#F1F5F9');
        const badgeColor = isNight
          ? (isEncerrado ? '#A7F3D0' : '#E2E8F0')
          : (isEncerrado ? '#065F46' : '#475569');
        const itemBg = isNight ? 'rgba(255, 255, 255, 0.12)' : 'var(--background)';
        const itemBorder = isNight ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border-color)';
        const textColor = isNight ? '#FFFFFF' : 'var(--text-heading)';

        const resolveName = window.App.resolveOfficialTeamName || ((s) => s);
        const nameA = resolveName(m.teamA);
        const nameB = resolveName(m.teamB);

        let embA = '', embB = '';
        if (window.TeamEmblems && teamsList.length > 0) {
          const tA = teamsList.find(t => (t.nome || t.name || '').toLowerCase().trim() === (m.teamA || '').toLowerCase().trim());
          const tB = teamsList.find(t => (t.nome || t.name || '').toLowerCase().trim() === (m.teamB || '').toLowerCase().trim());
          if (tA) embA = `<span style="display:inline-block; width:16px; height:18px; vertical-align:middle; margin-right:4px;">${window.TeamEmblems.forTeam(tA)}</span>`;
          if (tB) embB = `<span style="display:inline-block; width:16px; height:18px; vertical-align:middle; margin-left:4px;">${window.TeamEmblems.forTeam(tB)}</span>`;
        }

        const dateRaw = m.dataJogo || peladaAtiva.data || '';
        const dateFormatted = dateRaw ? formatarDataPelada(dateRaw) : '';
        const dateBadge = dateFormatted ? `<span style="font-size: 10px; font-weight: 700; color: ${isNight ? '#93C5FD' : '#0284C7'}; display: block; margin-top: 2px;">📅 ${dateFormatted}</span>` : '';

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: ${itemBg}; border: ${itemBorder}; border-radius: 8px; font-size: 12px; margin-bottom: 4px; backdrop-filter: blur(8px);">
            <span style="font-weight: 700; width: 35%; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${textColor}; display: flex; align-items: center; justify-content: flex-end;">${embA}${nameA}</span>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <span style="padding: 3px 10px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 800; border-radius: 6px; font-size: 11px; margin: 0 4px; ${isNight ? 'border: 1px solid rgba(255, 255, 255, 0.2);' : ''}">${scoreText}</span>
              ${dateBadge}
            </div>
            <span style="font-weight: 700; width: 35%; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${textColor}; display: flex; align-items: center; justify-content: flex-start;">${nameB}${embB}</span>
          </div>
        `;
      }).join('');
    }
  }
}

window.App.renderFormacaoTournamentUI = renderFormacaoTournamentUI;

window.App.exportTeamsWhatsApp = function () {
  const teamsKey = getTeamsKey();
  const drawnTeams = JSON.parse(localStorage.getItem(teamsKey)) || window.App.teams || [];

  if (!drawnTeams || drawnTeams.length === 0) {
    window.App.showToast("Nenhum time sorteado para exportar.", "warning");
    return;
  }

  const TEAM_EMOJIS = ["🟡", "🔵", "🟢", "🟣", "🟠", "🔴", "⚪", "⚫"];
  let texto = `⚽ *PELADA PRO - TIMES ESCALADOS* ⚽\n\n`;

  drawnTeams.forEach((team, idx) => {
    const emoji = TEAM_EMOJIS[idx % TEAM_EMOJIS.length];
    const nomeTime = (team.nome || `Time ${String.fromCharCode(65 + idx)}`).trim();

    const players = team.players || [];
    let soma = 0;
    players.forEach(p => soma += (parseInt(p.autoavaliacao || p.habilidade || 3)));
    const media = players.length > 0 ? (soma / players.length).toFixed(1) : "0.0";

    texto += `${emoji} *${nomeTime.toUpperCase()}* (Média: ${media}★)\n`;

    const goleiro = players.find(p => p.goleiro || String(p.posicao || '').toLowerCase().includes('goleiro'));
    const linha = players.filter(p => !p.goleiro && !String(p.posicao || '').toLowerCase().includes('goleiro'));

    if (goleiro) {
      const nomeGk = goleiro.apelido || goleiro.nome;
      const fotoGk = goleiro.foto_url || goleiro.foto || goleiro.avatar_url;
      const infoFoto = fotoGk ? ` 🖼️ (Foto: ${fotoGk})` : '';
      texto += `🧤 *${nomeGk}* (Goleiro)${infoFoto}\n`;
    }

    linha.forEach(p => {
      const nomeP = p.apelido || p.nome;
      const fotoP = p.foto_url || p.foto || p.avatar_url;
      const infoFoto = fotoP ? ` 🖼️ (Foto: ${fotoP})` : '';
      texto += `• ${nomeP}${infoFoto}\n`;
    });

    texto += `\n`;
  });

  texto += `Organizado pelo *Pelada Pro* 🏆`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(() => {
      window.App.showToast("Escalação dos times com fotos copiada para a área de transferência! Abrindo WhatsApp...", "success");
    }).catch(() => { });
  }

  const encoded = encodeURIComponent(texto);
  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
};

// ==========================================================================
// NOTIFICAÇÃO DOS ATLETAS CONVOCADOS SOBRE SEUS RESPECTIVOS TIMES
// ==========================================================================
window.App.notificarAtletasSorteados = async function (drawnTeams) {
  if (!Array.isArray(drawnTeams) || drawnTeams.length === 0) return;

  const token = localStorage.getItem("token");
  let countNotificados = 0;

  for (let idx = 0; idx < drawnTeams.length; idx++) {
    const team = drawnTeams[idx];
    const nomeTime = (team.nome || `Time ${String.fromCharCode(65 + idx)}`).trim();
    const players = team.players || team.jogadores || [];

    for (let p of players) {
      const nomeAtleta = p.apelido || p.nome || 'Atleta';
      const usuarioId = p.id;

      const titulo = '⚽ Sorteio de Times Realizado!';
      const mensagem = `Olá, ${nomeAtleta}! O sorteio foi concluído e você jogará no *${nomeTime}*!`;

      // 1. Notificação In-App Persistida no LocalStorage do Atleta
      try {
        const keyNotif = `notificacoes_user_${usuarioId}`;
        const prev = JSON.parse(localStorage.getItem(keyNotif)) || [];
        const nova = {
          id: `sorteio_${Date.now()}_${usuarioId}`,
          titulo,
          mensagem,
          tipo: 'sorteio_time',
          time: nomeTime,
          lida: false,
          data: new Date().toISOString()
        };
        localStorage.setItem(keyNotif, JSON.stringify([nova, ...prev].slice(0, 20)));
      } catch (e) { }

      // 2. Envio de Push Notification via backend API
      try {
        fetch('/api/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            title: titulo,
            body: mensagem,
            usuarioId: usuarioId,
            url: '/#/jogador/formacao',
            payload: { type: 'sorteio_realizado', team: nomeTime }
          })
        }).catch(() => { });
      } catch (e) { }

      countNotificados++;
    }
  }

  if (window.App && window.App.showToast && countNotificados > 0) {
    window.App.showToast(`🔔 ${countNotificados} atletas convocados foram notificados de suas equipes!`, 'success');
  }
};