// ==========================================================================
// MODAL: VER JOGADORES DO TIME (ver_time.js)
// ==========================================================================

window.App.initModalVer_time = function(data) {
  const teamName = data.teamName || "Time";
  const players = data.players || [];

  const titleEl = document.getElementById("ver-time-modal-title");
  if (titleEl) {
    titleEl.textContent = `👥 Escalados: ${teamName}`;
  }

  const container = document.getElementById("ver-time-list-container");
  if (!container) return;

  container.innerHTML = "";

  if (players.length === 0) {
    container.innerHTML = `<p class="text-inter" style="text-align:center; font-size:13px; color:var(--text-caption); padding: 12px 0;">Nenhum jogador escalado neste time.</p>`;
  } else {
    players.forEach(p => {
      const div = document.createElement("div");
      div.style.display = "flex";
      div.style.justifyContent = "space-between";
      div.style.alignItems = "center";
      div.style.padding = "10px 14px";
      div.style.backgroundColor = "var(--background)";
      div.style.borderRadius = "8px";

      div.innerHTML = `
        <span class="text-inter" style="font-size: 14px; font-weight: 500; color: var(--text-heading);">
          ${p.apelido || p.nome} ${p.goleiro ? '🧤' : ''}
        </span>
        <span style="color: var(--warning); font-size: 11px;">
          ${"★".repeat(parseInt(p.autoavaliacao) || 3)}
        </span>
      `;
      container.appendChild(div);
    });
  }

  // Eventos de fechamento
  document.getElementById("btn-close-ver-time").onclick = () => window.App.closeModal();
  document.getElementById("btn-ok-ver-time").onclick = () => window.App.closeModal();
};
