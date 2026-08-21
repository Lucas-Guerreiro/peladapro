// ==========================================================================
// PÁGINA: GESTOR - FORMAÇÃO E SORTEIO (formacao.js)
// ==========================================================================

// ===== FUNÇÃO AUXILIAR PARA PEGAR A CHAVE CORRETA DOS TIMES =====
function getTeamsKey() {
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  return peladaId ? `teams_${peladaId}` : "teams";
}

window.App.initFormacao = async function () {
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (peladaId && window.Api && window.Api.obterLiveState) {
    try {
      const res = await window.Api.obterLiveState(peladaId);
      if (res && res.state && res.state.teams && Array.isArray(res.state.teams) && res.state.teams.length > 0) {
        window.App.teams = res.state.teams;
        const teamsKey = `teams_${peladaId}`;
        localStorage.setItem(teamsKey, JSON.stringify(res.state.teams));
        localStorage.setItem("teams", JSON.stringify(res.state.teams));
      }
    } catch(e) {}
  }
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

  // Escutas
  const btnDraw = document.getElementById("btn-draw-teams");
  if (btnDraw) {
    btnDraw.onclick = () => window.App.openModal("sorteio");
  }
  const btnNomesTimes = document.getElementById("btn-cadastrar-nomes-times");
  if (btnNomesTimes) {
    btnNomesTimes.onclick = () => window.App.abrirModalNomesTimes();
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
      if (!peladaId) {
        window.App.showToast("Selecione uma pelada primeiro.", "warning");
        return;
      }
      const confirmClear = confirm("Tem certeza que deseja apagar a formação de times deste dia localmente e na nuvem?");
      if (!confirmClear) return;
      try {
        const token = localStorage.getItem("token");
        // Limpa no localStorage usando a chave com ID da pelada
        const teamsKey = getTeamsKey();
        localStorage.removeItem(teamsKey);
        localStorage.removeItem(`teams_${peladaId}`);
        localStorage.removeItem("teams");
        window.App.teams = [];
        // Salva estado vazio na nuvem
        if (window.Api && window.Api.atualizarLiveState) {
          await window.Api.atualizarLiveState(peladaId, window.App.liveMatch, window.App.waitingQueue, []);
        }
        window.App.showToast("Formação de times apagada com sucesso!", "success");
        window.App.renderDrawnTeams();
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
  const btnOpenAddPresence = document.getElementById("btn-open-add-presence-modal");
  if (btnOpenAddPresence) {
    btnOpenAddPresence.onclick = () => {
      const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
      if (!peladaId) {
        window.App.showToast("Selecione uma data para adicionar presença.", "warning");
        return;
      }
      window.App.openModal("add_presence", { peladaId: peladaId });
    };
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
async function renderManagerCheckin(selectedPeladaId = null) {
  const select = document.getElementById("select-manager-pelada");
  const selectStatus = document.getElementById("select-pelada-status");
  if (!select) return;
  select.innerHTML = "<option>Carregando partidas...</option>";
  if (!window.App.currentGroup || !window.App.currentGroup.id) {
    const savedGroup = (window.Auth && window.Auth.currentGroup) || JSON.parse(localStorage.getItem('currentGroup') || 'null');
    if (savedGroup && savedGroup.id) {
      window.App.currentGroup = savedGroup;
    } else if (window.Api && window.Api.getGruposDoGestor) {
      try {
        const grupos = await Api.getGruposDoGestor();
        if (Array.isArray(grupos) && grupos.length > 0) {
          window.App.currentGroup = grupos[0];
          if (window.Auth) window.Auth.currentGroup = grupos[0];
          localStorage.setItem('currentGroup', JSON.stringify(grupos[0]));
        }
      } catch (e) { }
    }
  }

  if (!window.App.currentGroup || !window.App.currentGroup.id) {
    select.innerHTML = "<option value=''>Selecione uma pelada</option>";
    document.getElementById("checkin-list-container").innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Selecione um grupo primeiro nas configurações.</p>`;
    return;
  }
  try {
    // Busca TODAS as datas do grupo (agendadas e realizadas)
    const peladas = await Api.listarDatasDoGrupo(window.App.currentGroup.id);
    select.innerHTML = "";
    if (peladas.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Nenhuma pelada cadastrada";
      select.appendChild(opt);
      document.getElementById("checkin-list-container").innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Sem partidas agendadas.</p>`;
      return;
    }
    peladas.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      const dateFormatted = formatarDataPelada(p.data);
      const statusLabel = p.status === "finalizada" ? "Realizada" : "Agendada";
      opt.textContent = `${dateFormatted} às ${p.horario || ""} (${statusLabel})`;
      select.appendChild(opt);
    });
    window.App.activeGroupPeladas = peladas;
    // Define qual pelada está ativa
    let activePelada = peladas[0];
    if (selectedPeladaId) {
      activePelada = peladas.find(p => String(p.id) === String(selectedPeladaId)) || peladas[0];
    } else if (window.App.activePelada) {
      activePelada = peladas.find(p => String(p.id) === String(window.App.activePelada.id)) || peladas[0];
    }
    window.App.activePelada = activePelada;
    localStorage.setItem("activePelada", JSON.stringify(activePelada));
    select.value = activePelada.id;
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

      selectModo.onchange = async (e) => {
        const newModo = e.target.value;
        const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
        updateTurnoVisibility(newModo);
        if (!peladaId) return;
        try {
          const res = await Api.atualizarConfigPartida(peladaId, { modo: newModo });
          if (res && res.error) {
            window.App.showToast(res.error, "error");
            selectModo.value = window.App.activePelada.modo || "normal";
            updateTurnoVisibility(selectModo.value);
            return;
          }
          window.App.activePelada.modo = newModo;
          localStorage.setItem("activePelada", JSON.stringify(window.App.activePelada));
          let desc = "⚽ Modo Pelada Normal ativado!";
          if (newModo === 'torneio_livre') desc = "📋 Modo Torneio Livre (Confrontos Manuais) ativado para esta data!";
          else if (newModo === 'mata_mata_direto') desc = "⚡ Modo Mini Torneio (Mata-Mata Direto) ativado para esta data!";
          else if (newModo === 'pontos_corridos' || newModo === 'torneio_pontos_corridos') desc = "🏅 Modo Mini Torneio (Pontos Corridos) ativado para esta data!";
          else if (newModo === 'torneio') desc = "🏆 Modo Mini Torneio (Misto: Tabela + Mata-Mata) ativado!";
          window.App.showToast(desc, "success");
          renderFormacaoTournamentUI();
        } catch (err) {
          console.error("[selectModo]", err);
          window.App.showToast("Erro ao atualizar formato da pelada.", "error");
        }
      };
    }

    if (selectTurno) {
      selectTurno.value = activePelada.turno_torneio || "ida";
      selectTurno.onchange = async (e) => {
        const newTurno = e.target.value;
        const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
        if (!peladaId) return;
        try {
          const res = await Api.atualizarConfigPartida(peladaId, { turno_torneio: newTurno });
          if (res && res.error) {
            window.App.showToast(res.error, "error");
            selectTurno.value = window.App.activePelada.turno_torneio || "ida";
            return;
          }
          window.App.activePelada.turno_torneio = newTurno;
          localStorage.setItem("activePelada", JSON.stringify(window.App.activePelada));

          // Se já existirem times sorteados e um torneio ativo em andamento, atualiza a tabela de jogos com o novo turno!
          let liveMatch = window.App.liveMatch || {};
          let tState = liveMatch.tournamentState || (peladaId ? JSON.parse(localStorage.getItem(`tournamentState_${peladaId}`) || 'null') : null);
          let teams = window.App.teams || [];
          try { if (!teams || teams.length === 0) teams = JSON.parse(localStorage.getItem("teams")) || []; } catch(e){}

          if (teams && teams.length > 0 && window.TournamentEngine && tState) {
            tState.turno = newTurno;
            // Regenera a tabela mista com o novo turno
            const newMatches = window.TournamentEngine.generateGroupSchedule(teams, newTurno);
            
            // Preserva o placar de partidas que já haviam sido finalizadas
            if (Array.isArray(tState.matches)) {
              tState.matches.forEach(oldM => {
                if (oldM.status === 'encerrado') {
                  const matchInNew = newMatches.find(nm => nm.teamA === oldM.teamA && nm.teamB === oldM.teamB && nm.turno === oldM.turno);
                  if (matchInNew) {
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
            
            localStorage.setItem("tournamentState", JSON.stringify(tState));
            localStorage.setItem(`tournamentState_${peladaId}`, JSON.stringify(tState));
            localStorage.setItem("liveMatch", JSON.stringify(liveMatch));

            if (window.Api && window.Api.atualizarLiveState) {
              await window.Api.atualizarLiveState(peladaId, liveMatch, window.App.waitingQueue || [], teams);
            }
          }

          const desc = newTurno === 'ida_volta' 
            ? "🔄 Fase de Grupos definida como Ida e Volta (Turno e Returno) — 12 partidas geradas!" 
            : "🔁 Fase de Grupos definida como Somente Ida — 6 partidas geradas!";
          window.App.showToast(desc, "success");
        } catch (err) {
          console.error("[selectTurno]", err);
          window.App.showToast("Erro ao atualizar turno do torneio.", "error");
        }
      };
    }
    // Puxa a lista de convocados da data selecionada
    await updateCheckinPlayersList(activePelada.id);
    // Carrega os times salvos na nuvem (sincroniza entre dispositivos)
    window.App.carregarTimesDoServidor(activePelada.id);
    renderFormacaoTournamentUI();
    select.onchange = async (e) => {
      if (e.target.value) {
        const sel = peladas.find(p => String(p.id) === String(e.target.value));
        window.App.activePelada = sel;
        if (selectStatus) selectStatus.value = sel.status || "agendada";
        if (selectModo) selectModo.value = sel.modo || "normal";
        // Limpa o cache local de times da data anterior para atualizar os cards
        localStorage.removeItem("teams");
        await updateCheckinPlayersList(e.target.value);
        await window.App.carregarTimesDoServidor(e.target.value);
        renderFormacaoTournamentUI();
        window.App.renderDrawnTeams();
        window.App.updateAcompanhamentoUI();
      }
    };
  } catch (err) {
    console.error("[Formacao] Erro ao listar datas para checkin:", err);
    select.innerHTML = "<option value=''>Erro ao carregar</option>";
  }
}
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
    // Sincroniza jogadores com o localStorage local para retrocompatibilidade do Sorteio Técnico
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
            <span style="color:var(--warning); font-size:12px;">${'★'.repeat(parseInt(c.autoavaliacao) || 3)}</span>
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
    localStorage.setItem("players", JSON.stringify(playersLocais));
    window.App.confirmadosList = confirmados;
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
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-feather="shuffle" style="width: 48px; height: 48px; display: block; margin: 0 auto 12px auto; color: var(--text-caption);"></i>
        <p class="text-inter">Realize o sorteio inteligente ao lado para montar as equipes.</p>
      </div>
    `;
    if (window.feather) feather.replace();
    return;
  }
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
          <span style="font-size:11px; font-weight:bold; color:var(--text-caption);">⭐${avg}</span>
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
        <span class="player-draft-stars">${"★".repeat(parseInt(p.autoavaliacao) || 3)}</span>
      `;
      playersList.appendChild(pDiv);
    });
    container.appendChild(card);
  });
  if (teamsModificados) {
    // ===== CORREÇÃO: salva na chave com ID da pelada =====
    localStorage.setItem(teamsKey, JSON.stringify(teams));
  }
  // Sincroniza o localStorage "teams_${peladaId}" com os times atuais
  if (activePelada) {
    const currentTeams = localStorage.getItem(teamsKey);
    if (currentTeams) {
      localStorage.setItem(`teams_${activePelada.id}`, currentTeams);
    } else {
      localStorage.removeItem(`teams_${activePelada.id}`);
    }
  }
  // Tenta salvar/sincronizar no banco em segundo plano se houver times locais
  if (teams.length > 0) {
    syncDrawnTeamsToCloud(false);
  }
};
async function syncDrawnTeamsToCloud(showToastMessage) {
  // ===== CORREÇÃO: usa a chave com ID da pelada =====
  const teamsKey = getTeamsKey();
  let teams = [];
  try { teams = JSON.parse(localStorage.getItem(teamsKey)) || []; } catch (e) { }
  let peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  if (!peladaId) {
    const group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    if (group && group.id && window.Api && window.Api.listarDatasDoGrupo) {
      try {
        const peladas = await window.Api.listarDatasDoGrupo(group.id);
        if (Array.isArray(peladas) && peladas.length > 0) {
          const activeP = peladas.find(p => p.status !== 'finalizada') || peladas[0];
          if (activeP) {
            peladaId = activeP.id;
            window.App.activePelada = activeP;
          }
        }
      } catch (e) { }
    }
  }
  if (!peladaId) {
    if (showToastMessage) window.App.showToast("Nenhuma pelada de referência encontrada para salvar.", "warning");
    return;
  }
  if (teams && teams.length > 0 && window.Api && window.Api.atualizarLiveState) {
    try {
      const res = await window.Api.atualizarLiveState(peladaId, window.App.liveMatch, window.App.waitingQueue, teams);
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
    if (!state) return;

    const teamsServidor = Array.isArray(state.teams) ? state.teams : [];
    if (teamsServidor.length === 0) return;

    // Só sobrescreve o local se o local estiver vazio (o gestor pode estar editando)
    const teamsKey = `teams_${peladaId}`;
    let localTeams = [];
    try { localTeams = JSON.parse(localStorage.getItem(teamsKey)) || []; } catch (e) { }

    if (localTeams.length === 0 && teamsServidor.length > 0) {
      localStorage.setItem(teamsKey, JSON.stringify(teamsServidor));
      localStorage.setItem("teams", JSON.stringify(teamsServidor));
      // Restaura também o jogo ao vivo e a fila
      if (state.liveMatch && window.App.liveMatch) {
        window.App.liveMatch = { ...window.App.liveMatch, ...state.liveMatch };
      }
      if (Array.isArray(state.waitingQueue)) {
        window.App.waitingQueue = state.waitingQueue;
      }
      window.App.renderDrawnTeams();
      window.App.updateAcompanhamentoUI();
    }
  } catch (e) {
    console.warn("[carregarTimesDoServidor]", e);
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
  // ===== CORREÇÃO: salva na chave com ID da pelada =====
  localStorage.setItem(teamsKey, JSON.stringify(teams));
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
    // ===== CORREÇÃO: salva na chave com ID da pelada =====
    localStorage.setItem(teamsKey, JSON.stringify(teams));
    localStorage.setItem("teams", JSON.stringify(teams));
    if (window.App.waitingQueue.includes(oldName)) {
      window.App.waitingQueue[window.App.waitingQueue.indexOf(oldName)] = team.nome;
    }
    if (window.App.liveMatch.teamA === oldName) {
      window.App.liveMatch.teamA = team.nome;
    }
    if (window.App.liveMatch.teamB === oldName) {
      window.App.liveMatch.teamB = team.nome;
    }
    localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
    localStorage.setItem("waitingQueue", JSON.stringify(window.App.waitingQueue));
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
  // ===== CORREÇÃO: salva na chave com ID da pelada =====
  localStorage.setItem(teamsKey, JSON.stringify(teams));
  localStorage.setItem("teams", JSON.stringify(teams));
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
  localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
  localStorage.setItem("waitingQueue", JSON.stringify(window.App.waitingQueue));
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
    // ===== CORREÇÃO: salva na chave com ID da pelada =====
    localStorage.setItem(teamsKey, JSON.stringify(teams));
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
    // ===== CORREÇÃO: salva na chave com ID da pelada =====
    localStorage.setItem(teamsKey, JSON.stringify(teams));
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
      // ===== CORREÇÃO: salva na chave com ID da pelada =====
      localStorage.setItem(teamsKey, JSON.stringify(teams));
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
    window.App.showToast("Novo emblema gravado no sistema e aplicado ao time! 🛡️");
  });
};

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

window.App.abrirModalNomesTimes = function() {
  const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  const groupId = currentGroup ? currentGroup.id : null;
  
  let currentCustom = [];
  try {
    currentCustom = JSON.parse(localStorage.getItem(`customTeamNames_${groupId}`)) || JSON.parse(localStorage.getItem('customTeamNames')) || [];
  } catch(e) {}

  const rawInput = prompt(
    `Cadastre os nomes personalizados dos times da pelada (separados por vírgula):\n\nExemplo: Flamengo, Vasco, Corinthians, Palmeiras\n\n(Deixe em branco para voltar aos nomes padrão: Time A, Time B...)`,
    (currentCustom && currentCustom.length > 0) ? currentCustom.join(', ') : ''
  );

  if (rawInput === null) return; // Gestor cancelou o prompt

  const newNames = rawInput.split(',').map(s => s.trim()).filter(Boolean);
  try {
    if (groupId) localStorage.setItem(`customTeamNames_${groupId}`, JSON.stringify(newNames));
    localStorage.setItem('customTeamNames', JSON.stringify(newNames));
  } catch(e) {}

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
    try {
      localStorage.setItem(teamsKey, JSON.stringify(drawnTeams));
      localStorage.setItem('teams', JSON.stringify(drawnTeams));
    } catch(e) {}

    // Sincroniza tState do torneio ativo com os novos nomes
    const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
    let tState = (window.App.liveMatch ? window.App.liveMatch.tournamentState : null) || (peladaId ? JSON.parse(localStorage.getItem(`tournamentState_${peladaId}`) || 'null') : null) || JSON.parse(localStorage.getItem('tournamentState') || 'null');
    if (tState && window.TournamentEngine) {
      tState.teams = drawnTeams;
      if (Array.isArray(tState.matches)) {
        tState.matches.forEach(m => {
          m.teamA = window.App.resolveOfficialTeamName(m.teamA, drawnTeams);
          m.teamB = window.App.resolveOfficialTeamName(m.teamB, drawnTeams);
        });
      }
      tState.standings = window.TournamentEngine.calculateStandings(drawnTeams, tState.matches);
      if (peladaId) localStorage.setItem(`tournamentState_${peladaId}`, JSON.stringify(tState));
      localStorage.setItem('tournamentState', JSON.stringify(tState));
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

function renderFormacaoTournamentUI() {
  const card = document.getElementById("formacao-tournament-card");
  if (!card) return;

  const peladaAtiva = window.App.activePelada || {};
  const liveMatch = window.App.liveMatch || {};
  let tState = liveMatch.tournamentState || (peladaAtiva.id ? JSON.parse(localStorage.getItem(`tournamentState_${peladaAtiva.id}`) || 'null') : null) || JSON.parse(localStorage.getItem('tournamentState') || 'null');

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
    try { teamsList = JSON.parse(localStorage.getItem("teams")) || window.App.teams || []; } catch(e){}

    if (matches.length === 0) {
      matchesList.innerHTML = `<div style="text-align:center; padding: 12px; color:${isNight ? '#CBD5E1' : '#64748B'}; font-size:12px;">Nenhum confronto gerado ainda.</div>`;
    } else {
      matchesList.innerHTML = matches.map((m, idx) => {
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

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: ${itemBg}; border: ${itemBorder}; border-radius: 8px; font-size: 12px; margin-bottom: 4px; backdrop-filter: blur(8px);">
            <span style="font-weight: 700; width: 40%; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${textColor}; display: flex; align-items: center; justify-content: flex-end;">${embA}${nameA}</span>
            <span style="padding: 3px 10px; background: ${badgeBg}; color: ${badgeColor}; font-weight: 800; border-radius: 6px; font-size: 11px; margin: 0 8px; ${isNight ? 'border: 1px solid rgba(255, 255, 255, 0.2);' : ''}">${scoreText}</span>
            <span style="font-weight: 700; width: 40%; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${textColor}; display: flex; align-items: center; justify-content: flex-start;">${nameB}${embB}</span>
          </div>
        `;
      }).join('');
    }
  }
}

window.App.renderFormacaoTournamentUI = renderFormacaoTournamentUI;