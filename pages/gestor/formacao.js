// ==========================================================================
// PÁGINA: GESTOR - FORMAÇÃO E SORTEIO (formacao.js)
// ==========================================================================

window.App.initFormacao = function() {
  renderManagerCheckin();
  window.App.renderDrawnTeams();

  // Escutas
  const btnDraw = document.getElementById("btn-draw-teams");
  if (btnDraw) {
    btnDraw.onclick = () => window.App.openModal("sorteio");
  }

  const btnSyncCloud = document.getElementById("btn-sync-teams-cloud");
  if (btnSyncCloud) {
    btnSyncCloud.onclick = async () => {
      await syncDrawnTeamsToCloud(true);
    };
  }

  const btnAddTeam = document.getElementById("btn-add-team-manual");
  if (btnAddTeam) {
    btnAddTeam.onclick = criarTimeManual;
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
          localStorage.removeItem("teams");
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

    // Sincroniza o select de status da rodada
    if (selectStatus) {
      selectStatus.value = activePelada.status || "agendada";
    }

    // Puxa a lista de convocados da data selecionada
    await updateCheckinPlayersList(activePelada.id);

    select.onchange = async (e) => {
      if (e.target.value) {
        const sel = peladas.find(p => String(p.id) === String(e.target.value));
        window.App.activePelada = sel;
        if (selectStatus) selectStatus.value = sel.status || "agendada";
        await updateCheckinPlayersList(e.target.value);
        window.App.updateAcompanhamentoUI();
      }
    };
  } catch (err) {
    console.error("[Formacao] Erro ao listar datas para checkin:", err);
    select.innerHTML = "<option value=''>Erro ao carregar</option>";
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
      document.getElementById("checkin-count").textContent = "0 Presentes";
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

      if (!pLocal.foto && c.foto) pLocal.foto = c.foto;

      // Adiciona na lista de presentes na memória se estiver marcado como presente no banco
      if (c.presenca) {
        window.App.presentPlayers.push(c.id);
      }

      const div = document.createElement("div");
      div.style.display = "flex";
      div.style.justifyContent = "space-between";
      div.style.alignItems = "center";
      div.style.padding = "10px 12px";
      div.style.backgroundColor = "var(--background)";
      div.style.borderRadius = "10px";
      div.style.marginBottom = "8px";

      const nameStr = c.apelido || c.nome || 'Atleta';
      const fotoUrl = c.foto || (pLocal && pLocal.foto) || null;
      const initial = nameStr.charAt(0).toUpperCase();

      const avatarHtml = fotoUrl
        ? `<img src="${fotoUrl}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2.5px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;" alt="${nameStr}">`
        : `<div style="width: 48px; height: 48px; border-radius: 50%; background: #0284C7; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; border: 2.5px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;">${initial}</div>`;

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
          <button title="Desconvocar atleta" onclick="desconvocarAtleta('${c.id}', '${nameStr}')" style="background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 16px; padding: 0 2px; line-height: 1;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">✕</button>
        </div>
      `;
      container.appendChild(div);
    });

    localStorage.setItem("players", JSON.stringify(playersLocais));
    document.getElementById("checkin-count").textContent = `${window.App.presentPlayers.length} Presentes`;

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
          } catch(e) { /* ignora erros individuais */ }
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
          } catch(e) { /* ignora erros individuais */ }
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

    document.getElementById("checkin-count").textContent = `${window.App.presentPlayers.length} Presentes`;
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
    const res = await fetch("http://localhost:3000/api/convocacoes/desconvocar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        pelada_id: parseInt(peladaId),
        usuario_id: parseInt(atletaId)
      })
    });
    const data = await res.json();
    if (!res.ok) {
      window.App.showToast(data.error || "Erro ao desconvocar atleta.", "error");
      return;
    }
    window.App.showToast(`${atletaNome} desconvocado com sucesso.`, "success");
    await updateCheckinPlayersList(peladaId);
  } catch (err) {
    console.error("[desconvocarAtleta]", err);
    window.App.showToast("Erro ao conectar no servidor.", "error");
  }
}

window.App.renderDrawnTeams = async function() {
  const container = document.getElementById("drawn-teams-container");
  if (!container) return;
  container.innerHTML = "";

  let teams = [];
  try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch(e) {}

  if (!teams || teams.length === 0) {
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
        } catch(e) {}
      }
    }

    if (peladaId && window.Api && window.Api.obterLiveState) {
      try {
        const liveRes = await window.Api.obterLiveState(peladaId);
        if (liveRes && liveRes.state && Array.isArray(liveRes.state.teams) && liveRes.state.teams.length > 0) {
          teams = liveRes.state.teams;
          localStorage.setItem("teams", JSON.stringify(teams));
        }
      } catch(e) {}
    }
  }

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
    const avg = validPlayers.length ? (validPlayers.reduce((s,p) => s + (parseInt(p.autoavaliacao) || 3), 0) / validPlayers.length).toFixed(1) : "0.0";
    
    const card = document.createElement("div");
    card.className = "team-draft-card";
    card.id = `card-team-${team.id}`;
    card.setAttribute("ondragover", "allowDrop(event)");
    card.setAttribute("ondragleave", "dragLeave(event)");
    card.setAttribute("ondrop", `drop(event, '${team.id}')`);

    card.innerHTML = `
      <div class="team-draft-header" style="border-top: 4px solid ${team.cor || '#777'};">
        <input type="text" class="team-draft-title-input" value="${team.nome}" onchange="renameTeam('${team.id}', this.value)">
        <span style="font-size:11px; font-weight:bold; color:var(--text-caption);">Média: ⭐${avg}</span>
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
        ? `<img src="${fotoUrl}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2.5px solid ${team.cor || '#0284C7'}; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" alt="${nameStr}">`
        : `<div style="width: 44px; height: 44px; border-radius: 50%; background: ${team.cor || '#0284C7'}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; border: 2.5px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${initial}</div>`;

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
    localStorage.setItem("teams", JSON.stringify(teams));
  }

  // Tenta salvar/sincronizar no banco em segundo plano se houver times locais
  if (teams.length > 0) {
    syncDrawnTeamsToCloud(false);
  }
};

async function syncDrawnTeamsToCloud(showToastMessage) {
  let teams = [];
  try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch(e) {}

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
      } catch(e) {}
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
    } catch(e) {
      console.error("[syncDrawnTeamsToCloud]", e);
      if (showToastMessage) window.App.showToast("Erro ao conectar ao servidor para salvar os times.", "error");
    }
  } else if (showToastMessage) {
    window.App.showToast("Nenhum time montado para salvar.", "warning");
  }
}

window.App.syncDrawnTeamsToCloud = syncDrawnTeamsToCloud;

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

  const teams = JSON.parse(localStorage.getItem("teams")) || [];
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

  localStorage.setItem("teams", JSON.stringify(teams));
  window.App.renderDrawnTeams();
  window.App.showToast(`${player.nome} movido para ${targetTeam.nome}!`);
}

function renameTeam(teamId, newName) {
  const teams = JSON.parse(localStorage.getItem("teams")) || [];
  const team = teams.find(t => t.id === teamId);
  if (team && newName.trim()) {
    const oldName = team.nome;
    team.nome = newName.trim();
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
  const teams = JSON.parse(localStorage.getItem("teams")) || [];
  
  // Cores premium da paleta
  const CORES_PALETA = ["#00E676", "#FFD600", "#FF1744", "#2979FF", "#AA00FF", "#00E5FF", "#FF9100", "#F50057"];
  const novaCor = CORES_PALETA[teams.length % CORES_PALETA.length];

  // Gera uma letra para o time (A, B, C, D, E, F...)
  const letraTime = String.fromCharCode(65 + teams.length);
  const nomePadrao = `Time ${letraTime}`;

  const novoTime = {
    id: Date.now(), // ID numérico único baseado no tempo
    nome: nomePadrao,
    cor: novaCor,
    players: []
  };

  // 1. Adiciona nos times do localStorage
  teams.push(novoTime);
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
