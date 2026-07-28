// ==========================================================================
// MODAL: EDITAR PARTIDA (editar_partida.js)
// ==========================================================================

window.App.initModalEditar_partida = function(data) {
  const partida = data.partida || {};
  
  const teamASelect = document.getElementById("edit-match-team-a");
  const teamBSelect = document.getElementById("edit-match-team-b");
  const scoreAEl = document.getElementById("edit-match-score-a");
  const scoreBEl = document.getElementById("edit-match-score-b");
  const goalsContainer = document.getElementById("edit-match-goals-list");
  const btnAddGoal = document.getElementById("btn-add-edit-goal");

  // 1. Carregar lista de times disponíveis (sorteados / cadastrados)
  let teams = [];
  try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch(e) {}
  if (!teams || teams.length === 0) teams = Api.getTeams() || [];

  // Nomes de times conhecidos
  let teamNamesSet = new Set(["Time A", "Time B", "Time C", "Time D", "Time E", "Time F"]);
  teams.forEach(t => {
    const n = t.nome || t.name;
    if (n) teamNamesSet.add(n.trim());
  });
  if (partida.time_a_nome) teamNamesSet.add(partida.time_a_nome.trim());
  if (partida.time_b_nome) teamNamesSet.add(partida.time_b_nome.trim());

  const teamNamesList = Array.from(teamNamesSet);

  if (teamASelect) {
    teamASelect.innerHTML = teamNamesList.map(n => `<option value="${n}">${n}</option>`).join('');
    teamASelect.value = partida.time_a_nome || teamNamesList[0] || 'Time A';
  }

  if (teamBSelect) {
    teamBSelect.innerHTML = teamNamesList.map(n => `<option value="${n}">${n}</option>`).join('');
    teamBSelect.value = partida.time_b_nome || teamNamesList[1] || 'Time B';
  }

  if (scoreAEl) scoreAEl.value = partida.gols_time_a !== undefined ? partida.gols_time_a : 0;
  if (scoreBEl) scoreBEl.value = partida.gols_time_b !== undefined ? partida.gols_time_b : 0;

  // 2. Carregar lista de atletas disponíveis
  let players = Api.getPlayers() || [];
  if (!players || players.length === 0) {
    try { players = JSON.parse(localStorage.getItem("players")) || []; } catch(e) {}
  }
  const activePlayers = (players || []).filter(p => p.ativo !== false && !p.goleiro);

  // Helper para filtrar os atletas que pertencem a um determinado time
  function getPlayersForTeam(teamName) {
    if (!teamName) return activePlayers;
    const targetName = String(teamName).toLowerCase().trim();
    const targetClean = targetName.replace(/^time\s+/, '').trim();

    const teamObj = (teams || []).find(t => {
      if (!t || (!t.nome && !t.name)) return false;
      const n = String(t.nome || t.name).toLowerCase().trim();
      const nClean = n.replace(/^time\s+/, '').trim();
      return n === targetName || nClean === targetClean || n === targetClean || nClean === target;
    });

    if (teamObj) {
      const roster = teamObj.jogadores || teamObj.players || [];
      if (Array.isArray(roster) && roster.length > 0) {
        const rosterIds = new Set(roster.map(p => String(p.id)));
        const rosterNames = new Set(roster.map(p => (p.apelido || p.nome || '').toLowerCase().trim()));

        const filtered = activePlayers.filter(p => {
          const pName = (p.apelido || p.nome || '').toLowerCase().trim();
          return rosterIds.has(String(p.id)) || rosterNames.has(pName);
        });

        if (filtered.length > 0) return filtered;
      }
    }

    return activePlayers;
  }

  // Array de gols em edição
  let goalsInEdit = [];
  if (partida.autores_gols) {
    try {
      goalsInEdit = typeof partida.autores_gols === 'string' ? JSON.parse(partida.autores_gols) : partida.autores_gols;
    } catch(e) {
      goalsInEdit = [];
    }
  }
  if (!Array.isArray(goalsInEdit)) goalsInEdit = [];

  // Função para renderizar os itens de gols dentro da modal
  function renderEditGoalsList() {
    if (!goalsContainer) return;
    goalsContainer.innerHTML = "";

    if (goalsInEdit.length === 0) {
      goalsContainer.innerHTML = `<span style="font-size: 11px; color: var(--text-caption); text-align: center; padding: 12px 0;">Nenhum autor de gol registrado nesta partida.</span>`;
      return;
    }

    goalsInEdit.forEach((g, index) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.flexDirection = "column";
      row.style.gap = "6px";
      row.style.padding = "10px";
      row.style.background = "var(--surface)";
      row.style.borderRadius = "8px";
      row.style.border = "1px solid var(--border-color)";

      const currentTeamA = teamASelect ? teamASelect.value : (partida.time_a_nome || 'Time A');
      const currentTeamB = teamBSelect ? teamBSelect.value : (partida.time_b_nome || 'Time B');

      const isTeamB = (g.teamKey === 'b' || (g.teamName && g.teamName.trim().toLowerCase() === currentTeamB.trim().toLowerCase()));
      const selectedTeamName = isTeamB ? currentTeamB : currentTeamA;

      // Obtém somente os atletas do time selecionado para este gol
      const teamPlayers = getPlayersForTeam(selectedTeamName);

      row.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-size: 11px; font-weight: bold; color: ${isTeamB ? 'var(--accent)' : 'var(--secondary)'};">
            ⚽ Gol #${index + 1}
          </span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <select class="form-control edit-goal-team-select" data-index="${index}" style="font-size: 11px; padding: 2px 6px; font-weight: bold;">
              <option value="a" ${!isTeamB ? 'selected' : ''}>${currentTeamA}</option>
              <option value="b" ${isTeamB ? 'selected' : ''}>${currentTeamB}</option>
            </select>
            <button type="button" class="btn btn-sm btn-outline-danger btn-remove-goal" data-index="${index}" style="padding: 2px 6px; font-size: 11px;" title="Remover este gol">🗑️</button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
          <div>
            <label style="font-size: 10px; color: var(--text-caption); display: block; margin-bottom: 2px; font-weight: bold;">Autor do Gol (${selectedTeamName})</label>
            <select class="form-control edit-goal-autor-select" data-index="${index}" style="font-size: 12px; padding: 4px 6px;">
              ${teamPlayers.map(p => {
                const name = p.apelido || p.nome;
                const selected = (g.autorNome && g.autorNome.trim().toLowerCase() === name.trim().toLowerCase()) || (String(p.id) === String(g.autorId));
                return `<option value="${p.id}" data-name="${name}" ${selected ? 'selected' : ''}>${name}</option>`;
              }).join('')}
            </select>
          </div>

          <div>
            <label style="font-size: 10px; color: var(--text-caption); display: block; margin-bottom: 2px; font-weight: bold;">Assistência (Opcional)</label>
            <select class="form-control edit-goal-assist-select" data-index="${index}" style="font-size: 12px; padding: 4px 6px;">
              <option value="">Sem assistência</option>
              ${teamPlayers.map(p => {
                const name = p.apelido || p.nome;
                const selected = (g.assistNome && g.assistNome.trim().toLowerCase() === name.trim().toLowerCase()) || (String(p.id) === String(g.assistId));
                return `<option value="${p.id}" data-name="${name}" ${selected ? 'selected' : ''}>${name}</option>`;
              }).join('')}
            </select>
          </div>
        </div>
      `;

      goalsContainer.appendChild(row);
    });

    // Vincular eventos dos selects e botão remover
    const teamSelects = goalsContainer.querySelectorAll(".edit-goal-team-select");
    teamSelects.forEach(sel => {
      sel.onchange = (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"));
        const currentTeamA = teamASelect ? teamASelect.value : 'Time A';
        const currentTeamB = teamBSelect ? teamBSelect.value : 'Time B';
        if (goalsInEdit[idx]) {
          const selectedTeam = e.target.value;
          const targetTeamName = selectedTeam === 'a' ? currentTeamA : currentTeamB;
          goalsInEdit[idx].teamKey = selectedTeam;
          goalsInEdit[idx].teamName = targetTeamName;

          // Ao trocar o time do gol, seleciona por padrão o primeiro atleta daquele time
          const newTeamPlayers = getPlayersForTeam(targetTeamName);
          if (newTeamPlayers.length > 0) {
            goalsInEdit[idx].autorId = String(newTeamPlayers[0].id);
            goalsInEdit[idx].autorNome = newTeamPlayers[0].apelido || newTeamPlayers[0].nome;
          }
          goalsInEdit[idx].assistId = null;
          goalsInEdit[idx].assistNome = null;

          updateScoresFromGoals();
          renderEditGoalsList();
        }
      };
    });

    const autorSelects = goalsContainer.querySelectorAll(".edit-goal-autor-select");
    autorSelects.forEach(sel => {
      sel.onchange = (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"));
        const opt = e.target.options[e.target.selectedIndex];
        if (goalsInEdit[idx]) {
          goalsInEdit[idx].autorId = e.target.value;
          goalsInEdit[idx].autorNome = opt ? opt.getAttribute("data-name") : "";
        }
      };
    });

    const assistSelects = goalsContainer.querySelectorAll(".edit-goal-assist-select");
    assistSelects.forEach(sel => {
      sel.onchange = (e) => {
        const idx = parseInt(e.target.getAttribute("data-index"));
        const opt = e.target.options[e.target.selectedIndex];
        if (goalsInEdit[idx]) {
          if (e.target.value) {
            goalsInEdit[idx].assistId = e.target.value;
            goalsInEdit[idx].assistNome = opt ? opt.getAttribute("data-name") : "";
          } else {
            goalsInEdit[idx].assistId = null;
            goalsInEdit[idx].assistNome = null;
          }
        }
      };
    });

    const removeBtns = goalsContainer.querySelectorAll(".btn-remove-goal");
    removeBtns.forEach(btn => {
      btn.onclick = (e) => {
        const idx = parseInt(btn.getAttribute("data-index"));
        goalsInEdit.splice(idx, 1);
        updateScoresFromGoals();
        renderEditGoalsList();
      };
    });
  }

  function updateScoresFromGoals() {
    let scoreA = 0;
    let scoreB = 0;
    goalsInEdit.forEach(g => {
      if (g.teamKey === 'b') scoreB++;
      else scoreA++;
    });
    if (scoreAEl) scoreAEl.value = scoreA;
    if (scoreBEl) scoreBEl.value = scoreB;
  }

  // Evento do botão + Adicionar Gol
  if (btnAddGoal) {
    btnAddGoal.onclick = () => {
      const currentTeamA = teamASelect ? teamASelect.value : 'Time A';
      const teamAPlayers = getPlayersForTeam(currentTeamA);

      if (teamAPlayers.length === 0) {
        window.App.showToast("Nenhum atleta ativo cadastrado no time.", "warning");
        return;
      }

      const firstPlayer = teamAPlayers[0];

      goalsInEdit.push({
        id: Date.now(),
        autorId: String(firstPlayer.id),
        autorNome: firstPlayer.apelido || firstPlayer.nome,
        assistId: null,
        assistNome: null,
        teamKey: 'a',
        teamName: currentTeamA,
        timeSecs: 0
      });

      updateScoresFromGoals();
      renderEditGoalsList();
    };
  }

  // Quando o gestor muda a seleção dos times Mandante ou Visitante
  if (teamASelect) {
    teamASelect.onchange = () => {
      const currentTeamA = teamASelect.value;
      goalsInEdit.forEach(g => {
        if (g.teamKey === 'a') g.teamName = currentTeamA;
      });
      renderEditGoalsList();
    };
  }
  if (teamBSelect) {
    teamBSelect.onchange = () => {
      const currentTeamB = teamBSelect.value;
      goalsInEdit.forEach(g => {
        if (g.teamKey === 'b') g.teamName = currentTeamB;
      });
      renderEditGoalsList();
    };
  }

  renderEditGoalsList();

  // Fechar modal
  document.getElementById("btn-close-editar-partida").onclick = () => window.App.closeModal();
  document.getElementById("btn-cancel-editar-partida").onclick = () => window.App.closeModal();

  // Enviar alterações
  const btnSubmit = document.getElementById("btn-submit-editar-partida");
  if (btnSubmit) {
    btnSubmit.onclick = async () => {
      const golsA = parseInt(scoreAEl.value);
      const golsB = parseInt(scoreBEl.value);
      const timeANome = teamASelect ? teamASelect.value.trim() : '';
      const timeBNome = teamBSelect ? teamBSelect.value.trim() : '';

      if (!timeANome || !timeBNome) {
        window.App.showToast("Selecione times válidos.", "warning");
        return;
      }

      if (timeANome.toLowerCase() === timeBNome.toLowerCase()) {
        window.App.showToast("Selecione dois times diferentes para a partida.", "warning");
        return;
      }

      if (isNaN(golsA) || golsA < 0 || isNaN(golsB) || golsB < 0) {
        window.App.showToast("Informe placares válidos maiores ou iguais a 0.", "warning");
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Salvando...";

      try {
        const res = await Api.editarPartida(partida.id, golsA, golsB, timeANome, timeBNome, JSON.stringify(goalsInEdit));

        if (res.error) {
          window.App.showToast(res.error, "error");
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Salvar Alterações";
          return;
        }

        window.App.showToast("Partida e autores de gols atualizados com sucesso!", "success");
        window.App.closeModal();

        // Recarrega o histórico de partidas na tela gestor
        if (window.App.renderRecentMatches) {
          await window.App.renderRecentMatches();
        } else if (window.App.initPartidas) {
          window.App.initPartidas();
        }
      } catch (err) {
        console.error("[initModalEditar_partida]", err);
        window.App.showToast("Erro ao editar partida.", "error");
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Salvar Alterações";
      }
    };
  }
};
