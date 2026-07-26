// ==========================================================================
// MODAL: EDITAR PARTIDA (editar_partida.js)
// ==========================================================================

window.App.initModalEditar_partida = function(data) {
  const partida = data.partida || {};
  
  const teamAEl = document.getElementById("edit-match-team-a");
  const teamBEl = document.getElementById("edit-match-team-b");
  const scoreAEl = document.getElementById("edit-match-score-a");
  const scoreBEl = document.getElementById("edit-match-score-b");

  if (teamAEl) teamAEl.value = partida.time_a_nome || '';
  if (teamBEl) teamBEl.value = partida.time_b_nome || '';
  if (scoreAEl) scoreAEl.value = partida.gols_time_a;
  if (scoreBEl) scoreBEl.value = partida.gols_time_b;

  // Fechar modal
  document.getElementById("btn-close-editar-partida").onclick = () => window.App.closeModal();
  document.getElementById("btn-cancel-editar-partida").onclick = () => window.App.closeModal();

  // Enviar alterações
  const btnSubmit = document.getElementById("btn-submit-editar-partida");
  if (btnSubmit) {
    btnSubmit.onclick = async () => {
      const golsA = parseInt(scoreAEl.value);
      const golsB = parseInt(scoreBEl.value);
      const timeANome = teamAEl ? teamAEl.value.trim() : '';
      const timeBNome = teamBEl ? teamBEl.value.trim() : '';

      if (!timeANome || !timeBNome) {
        window.App.showToast("Informe nomes válidos para ambos os times.", "warning");
        return;
      }

      if (isNaN(golsA) || golsA < 0 || isNaN(golsB) || golsB < 0) {
        window.App.showToast("Informe placares válidos maiores ou iguais a 0.", "warning");
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = "Salvando...";

      try {
        const res = await Api.editarPartida(partida.id, golsA, golsB, timeANome, timeBNome);

        if (res.error) {
          window.App.showToast(res.error, "error");
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Salvar Alterações";
          return;
        }

        window.App.showToast("Placar atualizado com sucesso!", "success");
        window.App.closeModal();

        // Recarrega o histórico de partidas na tela gestor
        if (window.App.initPartidas) {
          // Busca e renderiza a lista de minijogos do banco na aba Partidas
          const container = document.getElementById("recent-matches-container");
          if (container && window.App.activePelada) {
            // Chamamos renderRecentMatches global que foi injetada no partidas.js
            const peladaId = window.App.activePelada.id;
            const partidas = await Api.listarPartidas(peladaId);
            container.innerHTML = "";

            if (partidas.length === 0) {
              container.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Nenhuma partida finalizada nesta pelada ainda.</p>`;
            } else {
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
                    <button class="btn btn-sm btn-outline-secondary btn-edit-match" data-partida='${JSON.stringify(p)}' style="padding: 4px; border:none; background:transparent;"><i data-feather="edit-2" style="width:14px; height:14px; color:var(--text-heading);"></i></button>
                    <button class="btn btn-sm btn-outline-secondary btn-delete-match" data-id="${p.id}" style="padding: 4px; border:none; background:transparent;"><i data-feather="trash" style="width:14px; height:14px; color:var(--danger);"></i></button>
                    <span class="text-inter" style="font-size:11px; color:var(--text-caption); margin-left: 4px;">${timeStr}</span>
                  </div>
                `;
                container.appendChild(item);
              });
              if (window.feather) feather.replace();
              setupHistoryActions(); // Vincula cliques nos novos botões gerados
            }
          }
        }
      } catch (err) {
        console.error("[initModalEditar_partida]", err);
        window.App.showToast("Erro ao editar placar.", "error");
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Salvar Alterações";
      }
    };
  }
};
