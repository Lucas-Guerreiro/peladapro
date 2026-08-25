// ==========================================================================
// MODAL: LANÇAR GOL (lancar_gol.js)
// ==========================================================================

window.App.initModalLancar_gol = function(data) {
  data = data || {};
  const teamName = data.teamName || "Time";
  const teamKey = data.teamKey; // "a" | "b"
  let players = data.players || [];

  // Se a lista de jogadores do time veio vazia, tenta resolver de todas as fontes disponíveis
  if (!players || players.length === 0) {
    const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
    let teams = window.App.teams || [];
    if ((!teams || teams.length === 0) && peladaId) {
      try { teams = JSON.parse(localStorage.getItem(`teams_${peladaId}`)) || []; } catch (e) {}
    }
    if (!teams || teams.length === 0) {
      try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) {}
    }

    const cleanTarget = (teamName || "").trim().toLowerCase();
    const found = teams.find(t => t.nome && t.nome.trim().toLowerCase() === cleanTarget)
      || teams.find(t => t.nome && (t.nome.toLowerCase().includes(cleanTarget) || cleanTarget.includes(t.nome.toLowerCase())));

    if (found && Array.isArray(found.players) && found.players.length > 0) {
      players = found.players;
    } else {
      // Fallback: se o time não contiver a lista individual, usa todos os atletas confirmados da partida
      players = window.App.confirmadosList || JSON.parse(localStorage.getItem("players")) || [];
    }
  }

  const titleEl = document.getElementById("lancar-gol-modal-title");
  if (titleEl) {
    titleEl.textContent = `⚽ Gol do ${teamName}`;
  }

  // Popula os selects de autor e assistência com os atletas do time
  const authorSelect = document.getElementById("select-goal-author");
  const assistSelect = document.getElementById("select-goal-assist");

  if (authorSelect) {
    authorSelect.innerHTML = "";
    if (players.length === 0) {
      authorSelect.innerHTML = '<option value="">Nenhum atleta encontrado</option>';
    } else {
      players.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.apelido || p.nome || 'Atleta'} ${p.goleiro ? '🧤' : ''}`;
        authorSelect.appendChild(opt);
      });
    }
  }

  if (assistSelect) {
    assistSelect.innerHTML = '<option value="">Nenhuma</option>';
    players.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.apelido || p.nome || 'Atleta'} ${p.goleiro ? '🧤' : ''}`;
      assistSelect.appendChild(opt);
    });
  }

  // Eventos de fechamento
  document.getElementById("btn-close-lancar-gol").onclick = () => window.App.closeModal();
  document.getElementById("btn-cancel-lancar-gol").onclick = () => window.App.closeModal();

  // Submissão do gol
  const btnSubmit = document.getElementById("btn-submit-lancar-gol");
  if (btnSubmit) {
    btnSubmit.onclick = async () => {
      const autorId = authorSelect ? authorSelect.value : null;
      const assistId = assistSelect ? assistSelect.value : null;

      if (!autorId) {
        window.App.showToast("Selecione o autor do gol.", "warning");
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Gravando...";

      try {
        // 1. Tenta gravar no banco de dados em segundo plano (sem bloquear o jogo ao vivo)
        try {
          if (window.Api && window.Api.lancarGolAtleta) {
            window.Api.lancarGolAtleta(autorId).catch(e => console.warn("[lancar_gol] DB sync warning:", e));
          }
        } catch (e) {
          console.warn("[lancar_gol] Ignorando falha de API local para manter o jogo ativo:", e);
        }

        // 2. Incrementa o placar local na partida ativa e grava a lista de autores de gols
        if (!window.App.liveMatch) {
          window.App.liveMatch = { teamA: "Time A", teamB: "Time B", scoreA: 0, scoreB: 0, isPlaying: false, timerSeconds: 480, goals: [] };
        }

        if (teamKey === "a") {
          window.App.liveMatch.scoreA = Math.max(0, (window.App.liveMatch.scoreA || 0) + 1);
        } else {
          window.App.liveMatch.scoreB = Math.max(0, (window.App.liveMatch.scoreB || 0) + 1);
        }

        const autorObj = players.find(p => String(p.id) === String(autorId));
        const autorNome = autorObj ? (autorObj.apelido || autorObj.nome) : "Jogador";

        const assistObj = assistId ? players.find(p => String(p.id) === String(assistId)) : null;
        const assistNome = assistObj ? (assistObj.apelido || assistObj.nome) : null;

        if (!window.App.liveMatch.goals) window.App.liveMatch.goals = [];
        window.App.liveMatch.goals.push({
          id: Date.now(),
          autorId: autorId,
          autorNome: autorNome,
          assistId: assistId || null,
          assistNome: assistNome || null,
          teamKey: teamKey,
          teamName: teamName,
          timeSecs: window.App.liveMatch.timerSeconds || 0
        });

        // 3. Persiste no localStorage e envia ao backend em tempo real
        try { localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch)); } catch(e) {}
        const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
        if (peladaId) {
          try { localStorage.setItem(`liveMatch_${peladaId}`, JSON.stringify(window.App.liveMatch)); } catch(e) {}
          if (window.Api && window.Api.atualizarLiveState) {
            let teams = window.App.teams || [];
            let queue = window.App.waitingQueue || [];
            window.Api.atualizarLiveState(peladaId, window.App.liveMatch, queue, teams).catch(e => {});
          }
        }

        // 4. Feedback visual
        let msg = `Gol de ${autorNome}!`;
        if (assistNome) {
          msg += ` Assistência de ${assistNome}.`;
        }
        window.App.showToast(msg, "success");

        // 5. Fecha o modal
        window.App.closeModal();

        // 6. Atualiza a UI do placar na aba de Partidas e no Acompanhamento
        const scoreAEl = document.getElementById("match-control-score-a");
        const scoreBEl = document.getElementById("match-control-score-b");
        if (scoreAEl) scoreAEl.textContent = window.App.liveMatch.scoreA;
        if (scoreBEl) scoreBEl.textContent = window.App.liveMatch.scoreB;

        if (window.App.updateAcompanhamentoUI) {
          window.App.updateAcompanhamentoUI();
        }
        if (window.App.renderTournamentUI) {
          window.App.renderTournamentUI();
        }
        if (window.App.renderFormacaoTournamentUI) {
          window.App.renderFormacaoTournamentUI();
        }
        if (window.App.renderLiveMatchUI) {
          window.App.renderLiveMatchUI();
        }

      } catch (err) {
        console.error("[lancar_gol]", err);
        window.App.showToast("Erro ao registrar gol.", "error");
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Confirmar Gol";
      }
    };
  }
};
