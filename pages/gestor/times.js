// ==========================================================================
// PÁGINA: GERENCIAMENTO DE TIMES (pages/gestor/times.js)
// ==========================================================================

window.App.initTimes = async function () {
  const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
  const teamsKey = peladaId ? `teams_${peladaId}` : "teams";

  const gridEl = document.getElementById("manager-teams-grid");
  const summaryTotalEl = document.getElementById("summary-teams-total");
  const summaryAthletesEl = document.getElementById("summary-teams-athletes");
  const summaryAvgEl = document.getElementById("summary-teams-avg");

  const btnAddTeam = document.getElementById("btn-add-new-team-page");
  const btnSort = document.getElementById("btn-open-sorteio-from-times");

  if (btnSort) {
    btnSort.onclick = () => window.App.openModal("sorteio");
  }

  // 1. Carregar times locais com fallback resiliente
  let teams = [];
  try { teams = JSON.parse(localStorage.getItem(teamsKey)) || []; } catch (e) { }
  if (!teams || teams.length === 0) {
    try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }
  }
  if (!teams || teams.length === 0) {
    teams = window.App.teams || [];
  }

  // Se ainda não houver times e houver pelada ativa, busca no backend liveState
  if ((!teams || teams.length === 0) && peladaId && window.Api && window.Api.obterLiveState) {
    try {
      const serverState = await window.Api.obterLiveState(peladaId);
      if (serverState && Array.isArray(serverState.teams) && serverState.teams.length > 0) {
        teams = serverState.teams;
        localStorage.setItem(teamsKey, JSON.stringify(teams));
        localStorage.setItem("teams", JSON.stringify(teams));
      }
    } catch (e) {
      console.warn("[Gerenciar Times] Erro ao carregar liveState do servidor:", e);
    }
  }

  // 2. Renderizar Resumos
  const totalTeams = teams.length;
  let totalAthletes = 0;
  teams.forEach(t => {
    totalAthletes += Array.isArray(t.players) ? t.players.length : (Array.isArray(t.jogadores) ? t.jogadores.length : 0);
  });
  const avgAthletes = totalTeams > 0 ? (totalAthletes / totalTeams).toFixed(1) : "0";

  if (summaryTotalEl) summaryTotalEl.textContent = totalTeams;
  if (summaryAthletesEl) summaryAthletesEl.textContent = totalAthletes;
  if (summaryAvgEl) summaryAvgEl.textContent = avgAthletes;

  // Function to Save & Sync
  const saveTeamsAndSync = (showToast = true, toastMsg = "Times atualizados!") => {
    localStorage.setItem(teamsKey, JSON.stringify(teams));
    localStorage.setItem("teams", JSON.stringify(teams));
    window.App.teams = teams;

    // Se houver activePelada e Api, sincroniza no servidor
    if (peladaId && window.Api && window.Api.atualizarLiveState) {
      window.Api.atualizarLiveState(peladaId, window.App.liveMatch || {}, window.App.waitingQueue || [], teams);
    }

    if (showToast && window.App.showToast) {
      window.App.showToast(toastMsg, "success");
    }
    window.App.initTimes();
  };

  // 3. Botão Criar Novo Time
  if (btnAddTeam) {
    btnAddTeam.onclick = () => {
      const CORES_PALETA = ["#00E676", "#FFD600", "#FF1744", "#2979FF", "#AA00FF", "#00E5FF", "#FF9100", "#F50057"];
      const novaCor = CORES_PALETA[teams.length % CORES_PALETA.length];

      // Garante nome estritamente único
      const existingNames = new Set(teams.map(t => (t.nome || t.name || '').trim().toLowerCase()));
      let idx = 0;
      let nomePadrao = `Time ${String.fromCharCode(65 + idx)}`;
      while (existingNames.has(nomePadrao.toLowerCase())) {
        idx++;
        nomePadrao = `Time ${String.fromCharCode(65 + idx)}`;
      }

      const novoTime = {
        id: Date.now(),
        nome: nomePadrao,
        cor: novaCor,
        emblema: teams.length % 10,
        players: []
      };

      teams.push(novoTime);
      saveTeamsAndSync(true, `Time ${novoTime.nome} criado com sucesso!`);
    };
  }

  // 4. Renderizar Cards de Times
  if (!gridEl) return;

  if (teams.length === 0) {
    gridEl.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 12px;">🛡️</div>
        <h4 style="font-weight: 800; color: var(--text-heading); font-size: 18px; margin-bottom: 8px;">Nenhum time cadastrado</h4>
        <p style="font-size: 14px; color: var(--text-caption); margin-bottom: 20px; max-width: 420px; margin-left: auto; margin-right: auto;">
          Realize o sorteio do elenco ou crie os times manualmente para iniciar as partidas da pelada.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button onclick="window.App.openModal('sorteio')" class="btn btn-primary" style="font-weight: 800;">⚡ Realizar Sorteio</button>
          <button id="btn-create-first-team" class="btn btn-outline" style="font-weight: 700;">➕ Criar 1º Time</button>
        </div>
      </div>
    `;
    const btnFirst = document.getElementById("btn-create-first-team");
    if (btnFirst && btnAddTeam) btnFirst.onclick = btnAddTeam.onclick;
    return;
  }

  gridEl.innerHTML = teams.map((team, idx) => {
    const playersList = Array.isArray(team.players) ? team.players : (Array.isArray(team.jogadores) ? team.jogadores : []);
    const teamCor = team.cor || "#0284C7";
    const teamNome = team.nome || team.name || `Time ${idx + 1}`;

    let emblemSvg = '';
    if (window.TeamEmblems) {
      emblemSvg = window.TeamEmblems.forTeam(team);
    } else {
      emblemSvg = `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${teamCor}; color: #FFF; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px;">${teamNome.charAt(0)}</div>`;
    }

    return `
      <div class="card" style="border-top: 5px solid ${teamCor}; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 16px;">
        <div>
          <!-- Header do Time -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
              <div style="width: 40px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                ${emblemSvg}
              </div>
              <div style="flex: 1; min-width: 0;">
                <label style="font-size: 10px; font-weight: 700; color: var(--text-caption); text-transform: uppercase; display: block; margin-bottom: 2px;">Nome do Time</label>
                <input 
                  type="text" 
                  class="form-control team-name-input-field" 
                  data-team-id="${team.id}"
                  value="${teamNome}" 
                  style="font-weight: 800; font-size: 15px; color: var(--text-heading); padding: 6px 10px; border-radius: 8px; width: 100%;"
                >
              </div>
            </div>
            
            <button 
              type="button" 
              class="btn btn-sm btn-outline btn-change-emblem" 
              data-team-id="${team.id}" 
              data-emblem-idx="${team.emblema || idx}"
              title="Alterar Emblema Oficial"
              style="padding: 6px 8px; border-radius: 8px; border-color: #E2E8F0;"
            >
              🎨 Emblema
            </button>
          </div>

          <!-- Seletor de Cor do Time -->
          <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-body, #F8FAFC); padding: 10px 14px; border-radius: 10px; margin-bottom: 16px; border: 1px solid var(--border-color, #E2E8F0);">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-caption);">Cor da Camisa / Card:</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="width: 14px; height: 14px; border-radius: 50%; background: ${teamCor}; display: inline-block; border: 1px solid rgba(0,0,0,0.2);"></span>
              <input 
                type="color" 
                class="team-color-picker-input" 
                data-team-id="${team.id}" 
                value="${teamCor}" 
                style="width: 32px; height: 28px; border: none; cursor: pointer; background: transparent;"
              >
            </div>
          </div>

          <!-- Elenco de Atletas -->
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: var(--text-heading);">
                👥 Atletas Escalados (${playersList.length})
              </span>
              <button 
                type="button" 
                class="btn-view-team-modal" 
                data-team-id="${team.id}" 
                style="background: none; border: none; font-size: 11px; font-weight: 700; color: #0284C7; cursor: pointer; padding: 0;"
              >
                Ver Detalhes ➔
              </button>
            </div>

            ${playersList.length === 0 ? `
              <div style="font-size: 12px; color: var(--text-caption); font-style: italic; background: #F1F5F9; padding: 10px; border-radius: 8px; text-align: center;">
                Nenhum atleta escalado neste time ainda.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto; padding-right: 4px;">
                ${playersList.map(p => `
                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; background: var(--bg-body, #F8FAFC); padding: 6px 10px; border-radius: 6px;">
                    <span style="font-weight: 600; color: var(--text-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">
                      ${p.nome || p.name || 'Atleta'} ${p.goleiro ? '🧤' : ''}
                    </span>
                    <span style="font-size: 10px; color: #F59E0B; font-weight: 700;">
                      ${"★".repeat(parseInt(p.autoavaliacao) || 3)}
                    </span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Ações do Card -->
        <div style="display: flex; gap: 8px; border-top: 1px solid var(--border-color, #E2E8F0); padding-top: 12px; margin-top: 4px;">
          <button 
            type="button" 
            class="btn btn-sm btn-outline btn-view-team-modal" 
            data-team-id="${team.id}"
            style="flex: 1; font-weight: 700; font-size: 12px; border-color: #0284C7; color: #0284C7;"
          >
            👁️ Ver Time
          </button>
          
          ${teams.length > 2 ? `
            <button 
              type="button" 
              class="btn btn-sm btn-danger btn-delete-team" 
              data-team-id="${team.id}"
              style="font-weight: 700; font-size: 12px; padding: 6px 12px;"
              title="Excluir Time"
            >
              🗑️ Excluir
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // 5. Event Listeners dos Cards
  gridEl.querySelectorAll(".team-name-input-field").forEach(input => {
    input.onblur = (e) => {
      const tId = e.target.dataset.teamId;
      const targetTeam = teams.find(t => String(t.id) === String(tId));
      const newName = (e.target.value || '').trim();

      if (!targetTeam || !newName) return;
      if (targetTeam.nome === newName) return;

      // Valida unicidade de nome
      const isDup = teams.some(t => String(t.id) !== String(tId) && (t.nome || t.name || '').trim().toLowerCase() === newName.toLowerCase());
      if (isDup) {
        if (window.App.showToast) window.App.showToast(`⚠️ Já existe um time chamado "${newName}". Nomes devem ser únicos!`, "warning");
        e.target.value = targetTeam.nome;
        return;
      }

      const oldName = targetTeam.nome;
      targetTeam.nome = newName;
      targetTeam.name = newName;

      // Atualiza fila e liveMatch se necessário
      if (window.App.waitingQueue && window.App.waitingQueue.includes(oldName)) {
        window.App.waitingQueue[window.App.waitingQueue.indexOf(oldName)] = newName;
      }
      if (window.App.liveMatch && window.App.liveMatch.teamA === oldName) window.App.liveMatch.teamA = newName;
      if (window.App.liveMatch && window.App.liveMatch.teamB === oldName) window.App.liveMatch.teamB = newName;

      saveTeamsAndSync(true, `Time renomeado para ${newName}`);
    };
  });

  gridEl.querySelectorAll(".team-color-picker-input").forEach(input => {
    input.onchange = (e) => {
      const tId = e.target.dataset.teamId;
      const targetTeam = teams.find(t => String(t.id) === String(tId));
      if (targetTeam) {
        targetTeam.cor = e.target.value;
        saveTeamsAndSync(true, `Cor do ${targetTeam.nome} atualizada!`);
      }
    };
  });

  gridEl.querySelectorAll(".btn-change-emblem").forEach(btn => {
    btn.onclick = (e) => {
      const tId = e.currentTarget.dataset.teamId;
      const idx = e.currentTarget.dataset.emblemIdx;
      if (typeof window.openEmblemSelector === 'function') {
        window.openEmblemSelector(tId, parseInt(idx) || 0);
      } else {
        if (window.App.showToast) window.App.showToast("Seletor de emblemas indisponível no momento.", "warning");
      }
    };
  });

  gridEl.querySelectorAll(".btn-view-team-modal").forEach(btn => {
    btn.onclick = (e) => {
      const tId = e.currentTarget.dataset.teamId;
      const targetTeam = teams.find(t => String(t.id) === String(tId));
      if (targetTeam) {
        const playersList = Array.isArray(targetTeam.players) ? targetTeam.players : (Array.isArray(targetTeam.jogadores) ? targetTeam.jogadores : []);
        window.App.openModal("ver_time", { teamName: targetTeam.nome, players: playersList });
      }
    };
  });

  gridEl.querySelectorAll(".btn-delete-team").forEach(btn => {
    btn.onclick = (e) => {
      const tId = e.currentTarget.dataset.teamId;
      const targetTeam = teams.find(t => String(t.id) === String(tId));
      if (!targetTeam) return;

      if (confirm(`Tem certeza que deseja excluir o ${targetTeam.nome}?`)) {
        teams = teams.filter(t => String(t.id) !== String(tId));
        saveTeamsAndSync(true, `Time ${targetTeam.nome} removido!`);
      }
    };
  });
};
