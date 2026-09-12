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
    // Opções especiais: Sem Autor e Gol Contra (Correção B)
    const optSemAutor = document.createElement("option");
    optSemAutor.value = "sem_autor";
    optSemAutor.textContent = "⚽ Sem Autor (Indefinido)";
    authorSelect.appendChild(optSemAutor);

    const optGolContra = document.createElement("option");
    optGolContra.value = "gol_contra";
    optGolContra.textContent = "🔴 Gol Contra (para o adversário)";
    authorSelect.appendChild(optGolContra);
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

  if (authorSelect && assistSelect) {
    authorSelect.onchange = () => {
      const isSpecial = authorSelect.value === "sem_autor" || authorSelect.value === "gol_contra";
      assistSelect.disabled = isSpecial;
      if (isSpecial) assistSelect.value = "";
    };
  }

  // Desbloqueia botões de gol e fecha modal no ciclo de vida (Ajuste 1)
  const fecharModalGol = () => {
    if (window.App && typeof window.App.unlockGoalButtons === "function") {
      window.App.unlockGoalButtons();
    }
    window.App.closeModal();
  };

  const btnClose = document.getElementById("btn-close-lancar-gol");
  if (btnClose) btnClose.onclick = fecharModalGol;

  const btnCancel = document.getElementById("btn-cancel-lancar-gol");
  if (btnCancel) btnCancel.onclick = fecharModalGol;

  // Fechamento ao clicar no backdrop ou pressionar ESC
  const backdropEl = document.getElementById("modal-lancar-gol-backdrop");
  if (backdropEl) {
    backdropEl.onclick = (e) => {
      if (e.target === backdropEl) fecharModalGol();
    };
  }
  const onEscKey = (e) => {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", onEscKey);
      fecharModalGol();
    }
  };
  document.addEventListener("keydown", onEscKey);


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

      const isSemAutor = autorId === "sem_autor";
      const isGolContra = autorId === "gol_contra";

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Gravando...";

      try {
        // Grava gol individual do atleta apenas se for um jogador real (Correção B)
        if (!isSemAutor && !isGolContra) {
          try {
            if (window.Api && window.Api.lancarGolAtleta) {
              window.Api.lancarGolAtleta(autorId).catch(e => console.warn("[lancar_gol] DB sync warning:", e));
            }
          } catch (e) {
            console.warn("[lancar_gol] Ignorando falha de API local para manter o jogo ativo:", e);
          }
        }

        // Gol contra beneficia o time adversário na contagem de placar (Correção B)
        if (!window.App.liveMatch) {
          window.App.liveMatch = { teamA: "Time A", teamB: "Time B", scoreA: 0, scoreB: 0, isPlaying: false, timerSeconds: 480, goals: [] };
        }

        const beneficiaryTeamKey = isGolContra ? (teamKey === "a" ? "b" : "a") : teamKey;
        const beneficiaryTeamName = isGolContra
          ? (teamKey === "a" ? (window.App.liveMatch.teamB || "Time B") : (window.App.liveMatch.teamA || "Time A"))
          : teamName;

        let autorNome = "Sem Autor";
        let finalAutorId = null;
        if (isGolContra) {
          autorNome = "Gol Contra";
        } else if (!isSemAutor) {
          const autorObj = players.find(p => String(p.id) === String(autorId));
          autorNome = autorObj ? (autorObj.apelido || autorObj.nome) : "Jogador";
          finalAutorId = autorId;
        }

        const assistObj = (!isSemAutor && !isGolContra && assistId) ? players.find(p => String(p.id) === String(assistId)) : null;
        const assistNome = assistObj ? (assistObj.apelido || assistObj.nome) : null;

        if (!window.App.liveMatch.goals) window.App.liveMatch.goals = [];
        window.App.liveMatch.goals.push({
          id: Date.now(),
          autorId: finalAutorId,
          autorNome: autorNome,
          assistId: (!isSemAutor && !isGolContra) ? (assistId || null) : null,
          assistNome: assistNome,
          teamKey: beneficiaryTeamKey,
          teamName: beneficiaryTeamName,
          concedingTeamKey: isGolContra ? teamKey : null,
          tipo: isGolContra ? "gol_contra" : (isSemAutor ? "sem_autor" : "gol"),
          timeSecs: window.App.liveMatch.timerSeconds || 0
        });

        window.App.liveMatch.scoreA = window.App.liveMatch.goals.filter(g => g.teamKey === 'a').length;
        window.App.liveMatch.scoreB = window.App.liveMatch.goals.filter(g => g.teamKey === 'b').length;

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
        let msg = isGolContra ? `Gol Contra computado para ${beneficiaryTeamName}!` : (isSemAutor ? `Gol registrado (Sem Autor) para ${beneficiaryTeamName}!` : `Gol de ${autorNome}!`);
        if (assistNome) {
          msg += ` Assistência de ${assistNome}.`;
        }
        window.App.showToast(msg, "success");

        // 5. Fecha o modal e desbloqueia os botões (Ajuste 1)
        if (window.App && typeof window.App.unlockGoalButtons === "function") {
          window.App.unlockGoalButtons();
        }
        window.App.closeModal();


        // 6. Atualiza a UI do placar na aba de Partidas, no Acompanhamento e na Tela Cheia
        const scoreAEl = document.getElementById("match-control-score-a");
        const scoreBEl = document.getElementById("match-control-score-b");
        if (scoreAEl) scoreAEl.textContent = window.App.liveMatch.scoreA;
        if (scoreBEl) scoreBEl.textContent = window.App.liveMatch.scoreB;

        const fsScoreA = document.getElementById("fs-score-a");
        const fsScoreB = document.getElementById("fs-score-b");
        if (fsScoreA) fsScoreA.textContent = window.App.liveMatch.scoreA;
        if (fsScoreB) fsScoreB.textContent = window.App.liveMatch.scoreB;

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
        if (window.App.syncFullscreenScoreboardUI) {
          window.App.syncFullscreenScoreboardUI();
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
