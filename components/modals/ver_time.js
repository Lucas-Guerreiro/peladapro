// ==========================================================================
// MODAL: VER JOGADORES DO TIME (ver_time.js)
// ==========================================================================

window.App.initModalVer_time = function(data) {
  data = data || {};
  const teamName = data.teamName || "Time";
  let players = data.players || [];

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
      players = window.App.confirmadosList || JSON.parse(localStorage.getItem("players")) || [];
    }
  }

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
    let allPlayersLocais = [];
    try { allPlayersLocais = JSON.parse(localStorage.getItem("players")) || []; } catch(e) {}
    if (!allPlayersLocais || allPlayersLocais.length === 0) {
      try { allPlayersLocais = window.Api.getPlayers() || []; } catch(e) {}
    }

    players.forEach(p => {
      const foundP = allPlayersLocais.find(pl => String(pl.id) === String(p.id)) || p;
      const fotoUrl = p.foto || foundP.foto || null;
      const nameStr = p.apelido || p.nome || 'Atleta';
      const initial = nameStr.charAt(0).toUpperCase();

      const avatarHtml = fotoUrl
        ? `<img src="${fotoUrl}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2.5px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,0.15);" alt="${nameStr}">`
        : `<div style="width: 48px; height: 48px; border-radius: 50%; background: #0284C7; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; border: 2.5px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${initial}</div>`;

      const div = document.createElement("div");
      div.style.display = "flex";
      div.style.justifyContent = "space-between";
      div.style.alignItems = "center";
      div.style.padding = "10px 14px";
      div.style.backgroundColor = "var(--background)";
      div.style.borderRadius = "8px";
      div.style.marginBottom = "6px";

      div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          ${avatarHtml}
          <span class="text-inter" style="font-size: 14px; font-weight: 600; color: var(--text-heading);">
            ${nameStr} ${p.goleiro ? '🧤' : ''}
          </span>
        </div>
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
