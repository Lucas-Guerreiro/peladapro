// ==========================================================================
// PÁGINA: GESTOR - ATLETAS (atletas.js)
// ==========================================================================

window.App.initAtletas = function() {
  window.App.renderManagerAthletesList();
  
  // Sincroniza dados com o backend na entrada para carregar as solicitações
  window.App.syncAthletesList();

  document.getElementById("btn-open-add-athlete-modal").onclick = () => window.App.openModal("atleta");

  const searchInput = document.getElementById("athlete-search-input");
  if (searchInput) {
    searchInput.oninput = debounce((e) => {
      window.App.renderManagerAthletesList(e.target.value);
    }, 300);
  }
};

window.App.syncAthletesList = async function() {
  const token = localStorage.getItem("token");
  if (!token) return;
  try {
    const res = await fetch('/api/usuarios', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const players = await res.json();
      localStorage.setItem('players', JSON.stringify(players));
      window.App.renderManagerAthletesList();
    }
  } catch (e) {
    console.warn('[Atletas] Erro ao sincronizar dados do backend:', e);
  }
};

window.App.renderManagerAthletesList = function(searchQuery = "") {
  const players = JSON.parse(localStorage.getItem("players")) || [];
  const container = document.getElementById("athletes-list-container");
  if (!container) return;
  container.innerHTML = "";

  // 1. Filtrar pendentes (verificado === false) e cadastrados/aprovados (verificado === true)
  // Inclui tipo 'jogador', 'gestor' e 'ambos'
  const isAthlete = (p) => !p.tipo || p.tipo === 'jogador' || p.tipo === 'gestor' || p.tipo === 'ambos';
  const pendingPlayers = players.filter(p => p.verificado === false && isAthlete(p));
  const approvedPlayers = players.filter(p => p.verificado === true && isAthlete(p));

  // 2. Renderizar as solicitações pendentes no topo
  const pendingCard = document.getElementById("pending-requests-card");
  const pendingList = document.getElementById("pending-requests-list");

  if (pendingCard && pendingList) {
    if (pendingPlayers.length > 0) {
      pendingCard.classList.remove("hidden");
      pendingList.innerHTML = "";

      pendingPlayers.forEach(p => {
        const item = document.createElement("div");
        item.className = "card-athlete";
        item.style.borderLeft = "4px solid var(--accent)";
        item.style.background = "rgba(255, 109, 0, 0.03)";
        item.style.padding = "16px";

        const initials = p.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

        item.innerHTML = `
          <div class="athlete-info">
            <div style="width: 48px; height: 48px; border-radius:50%; background-color: var(--accent); color: #FFF; display:flex; align-items:center; justify-content:center; font-family: 'Inter', sans-serif; font-size:18px;">
              ${initials}
            </div>
            <div class="athlete-details">
              <h4 style="display:flex; align-items:center; gap:8px;">
                ${p.nome} 
                <span style="font-size:10px; font-weight:normal; background:rgba(255, 109, 0, 0.15); color:var(--accent); padding:2px 6px; border-radius:4px;">Pendente</span>
              </h4>
              <span style="font-size:12px; color: var(--text-caption);">E-mail: ${p.email}</span>
            </div>
          </div>
          <div class="athlete-actions" style="display:flex; gap: 8px;">
            <button class="btn btn-sm btn-approve-athlete" data-id="${p.id}" style="background:#2e7d32; border:none; padding:6px 12px; font-weight:600; color:#fff; cursor:pointer; border-radius:4px;">
              Aprovar ✅
            </button>
            <button class="btn btn-sm btn-reject-athlete" data-id="${p.id}" style="background:#c62828; border:none; padding:6px 12px; font-weight:600; color:#fff; cursor:pointer; border-radius:4px;">
              Recusar ❌
            </button>
          </div>
        `;

        item.querySelector(".btn-approve-athlete").onclick = () => approveAthlete(p.id);
        item.querySelector(".btn-reject-athlete").onclick = () => rejectAthlete(p.id, p.nome);

        pendingList.appendChild(item);
      });
    } else {
      pendingCard.classList.add("hidden");
      pendingList.innerHTML = "";
    }
  }

  // 3. Filtrar aprovados pelo termo de pesquisa
  const filtered = approvedPlayers.filter(p => {
    return (p.nome && p.nome.toLowerCase().includes(searchQuery.toLowerCase())) || (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Estatísticas baseadas apenas em contas confirmadas
  document.getElementById("summary-athletes-total").textContent = approvedPlayers.length;
  document.getElementById("summary-athletes-active").textContent = approvedPlayers.filter(p => p.ativo).length;
  document.getElementById("summary-athletes-debtors").textContent = approvedPlayers.filter(p => {
    const saldoVal = p.saldo ? parseFloat(p.saldo) : 0;
    return saldoVal < 0;
  }).length;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-feather="users" style="width: 32px; height: 32px;"></i>
        <p>Nenhum atleta cadastrado.</p>
      </div>
    `;
    feather.replace();
    return;
  }

  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "card-athlete";
    if (!p.ativo) card.style.opacity = "0.5";

    const initials = p.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
    
    // Tratamento de segurança para saldo e autoavaliação (evitando crashes por nulos)
    const saldoVal = p.saldo ? parseFloat(p.saldo) : 0;
    const balanceText = saldoVal.toFixed(2).replace(".", ",");
    const balanceColor = saldoVal >= 0 ? "var(--success)" : "var(--danger)";
    const estrelasText = p.autoavaliacao !== null && p.autoavaliacao !== undefined ? `${p.autoavaliacao} estrelas` : 'N/A';

    const avatarHTML = p.foto 
      ? `<img src="${p.foto}" class="athlete-avatar" alt="${p.nome}" style="width: 48px; height: 48px; min-width: 48px; min-height: 48px; max-width: 48px; max-height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; aspect-ratio: 1/1;" />`
      : `<div class="athlete-avatar-placeholder" style="width: 48px; height: 48px; min-width: 48px; min-height: 48px; max-width: 48px; max-height: 48px; border-radius: 50%; background-color: var(--primary); color: #FFF; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-size: 18px; flex-shrink: 0; aspect-ratio: 1/1;">${initials}</div>`;

    card.innerHTML = `
      <div class="athlete-info">
        ${avatarHTML}
        <div class="athlete-details">
          <h4>${p.nome} ${p.goleiro ? '🧤' : ''}</h4>
          <span style="font-size:12px; color: var(--text-caption); display: block; margin-top: 2px;">E-mail: ${p.email || '—'} | ⭐ ${estrelasText}</span>
        </div>
      </div>
      <div class="card-athlete-right">
        <div style="text-align: right;" class="athlete-saldo-col">
          <span style="font-size:11px; display:block; text-transform:uppercase; color: var(--text-caption); font-weight: 700;">Saldo</span>
          <strong style="color: ${balanceColor}; font-size:15px;">R$ ${balanceText}</strong>
        </div>
        <div class="athlete-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-sm btn-secondary btn-saldo-athlete" data-id="${p.id}" title="Lançar Crédito / Patrocínio / Ajuste">💰 Saldo</button>
          <button class="btn btn-sm btn-outline btn-edit-athlete" data-id="${p.id}" title="Editar Atleta">✏️ Editar</button>
          <button class="btn btn-sm btn-danger btn-delete-athlete" data-id="${p.id}" title="Excluir Atleta">🗑️ Excluir</button>
        </div>
      </div>
    `;
    
    card.querySelector(".btn-saldo-athlete").onclick = () => {
      if (window.manualFinanceSettlement) window.manualFinanceSettlement(p.id);
    };
    card.querySelector(".btn-edit-athlete").onclick = () => window.App.openModal("atleta", { id: p.id });
    card.querySelector(".btn-delete-athlete").onclick = () => deleteAthlete(p.id, p.nome);

    container.appendChild(card);
  });
  feather.replace();
};

async function approveAthlete(id) {
  try {
    Utils.toast("Aprovando cadastro do atleta...", "info");
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/usuarios/${id}/aprovar`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      Utils.toast(data.error || "Erro ao aprovar atleta.", "error");
      return;
    }

    Utils.toast("Atleta aprovado com sucesso!", "success");
    await window.App.syncAthletesList();
  } catch (err) {
    console.error(err);
    Utils.toast("Erro ao se conectar ao servidor.", "error");
  }
}

async function rejectAthlete(id, nome) {
  if (!confirm(`Deseja realmente recusar e excluir o cadastro de ${nome}?`)) return;

  try {
    Utils.toast("Recusando cadastro do atleta...", "info");
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/usuarios/${id}`, {
      method: "DELETE",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      Utils.toast(data.error || "Erro ao recusar atleta.", "error");
      return;
    }

    Utils.toast("Cadastro recusado e excluído!", "success");
    await window.App.syncAthletesList();
  } catch (err) {
    console.error(err);
    Utils.toast("Erro ao se conectar ao servidor.", "error");
  }
}

async function deleteAthlete(id, nome) {
  if (!confirm(`Deseja realmente excluir permanentemente o atleta ${nome}?`)) return;

  try {
    Utils.toast("Excluindo atleta do banco...", "info");
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/usuarios/${id}`, {
      method: "DELETE",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) {
      Utils.toast(data.error || "Erro ao excluir atleta.", "error");
      return;
    }

    Utils.toast("Atleta excluído com sucesso!", "success");
    await window.App.syncAthletesList();
  } catch (err) {
    console.error(err);
    Utils.toast("Erro ao se conectar ao servidor.", "error");
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
