// ==========================================================================
// MODAL: LANÇAR GOL (lancar_gol.js)
// ==========================================================================

window.App.initModalLancar_gol = function(data) {
  const teamName = data.teamName || "Time";
  const teamKey = data.teamKey; // "a" | "b"
  const players = data.players || [];

  const titleEl = document.getElementById("lancar-gol-modal-title");
  if (titleEl) {
    titleEl.textContent = `⚽ Gol do ${teamName}`;
  }

  // Popula os selects de autor e assistência com os atletas do time
  const authorSelect = document.getElementById("select-goal-author");
  const assistSelect = document.getElementById("select-goal-assist");

  if (authorSelect) {
    authorSelect.innerHTML = "";
    players.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.apelido || p.nome} ${p.goleiro ? '🧤' : ''}`;
      authorSelect.appendChild(opt);
    });
  }

  if (assistSelect) {
    // Mantém a opção "Nenhuma"
    assistSelect.innerHTML = '<option value="">Nenhuma</option>';
    players.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.apelido || p.nome} ${p.goleiro ? '🧤' : ''}`;
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
        // 1. Grava no banco de dados real do PostgreSQL local para o atleta
        const res = await Api.lancarGolAtleta(autorId);

        if (res.error) {
          window.App.showToast(res.error, "error");
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Confirmar Gol";
          return;
        }

        // 2. Incrementa o placar local na partida ativa e grava a lista de autores de gols
        if (teamKey === "a") {
          window.App.liveMatch.scoreA = Math.max(0, window.App.liveMatch.scoreA + 1);
        } else {
          window.App.liveMatch.scoreB = Math.max(0, window.App.liveMatch.scoreB + 1);
        }

        const autorObj = players.find(p => String(p.id) === String(autorId));
        const autorNome = autorObj ? (autorObj.apelido || autorObj.nome) : "Jogador";

        if (!window.App.liveMatch.goals) window.App.liveMatch.goals = [];
        window.App.liveMatch.goals.push({
          id: Date.now(),
          autorId: autorId,
          autorNome: autorNome,
          teamKey: teamKey,
          teamName: teamName,
          timeSecs: window.App.liveMatch.timerSeconds
        });

        // 3. Persiste no localStorage e envia ao backend em tempo real
        localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
        const peladaId = window.App.activePelada ? window.App.activePelada.id : null;
        if (peladaId && window.Api && window.Api.atualizarLiveState) {
          let teams = [];
          try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch(e) {}
          window.Api.atualizarLiveState(peladaId, window.App.liveMatch, window.App.waitingQueue, teams);
        }

        // 4. Feedback visual
        const assistNome = assistId ? (players.find(p => String(p.id) === String(assistId))?.nome || "") : "";
        
        let msg = `Gol de ${autorNome}!`;
        if (assistNome) {
          msg += ` Assistência de ${assistNome}.`;
        }
        window.App.showToast(msg, "success");

        // 5. Fecha o modal
        window.App.closeModal();

        // 6. Atualiza a UI do placar na aba de Partidas e no Acompanhamento
        if (window.App.initPartidas) {
          // Atualiza os placares sem recarregar tudo
          const scoreAEl = document.getElementById("match-control-score-a");
          const scoreBEl = document.getElementById("match-control-score-b");
          if (scoreAEl) scoreAEl.textContent = window.App.liveMatch.scoreA;
          if (scoreBEl) scoreBEl.textContent = window.App.liveMatch.scoreB;
        }

        window.App.updateAcompanhamentoUI();

      } catch (err) {
        console.error("[lancar_gol]", err);
        window.App.showToast("Erro ao registrar gol.", "error");
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Confirmar Gol";
      }
    };
  }
};
