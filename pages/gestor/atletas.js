// ==========================================================================
// PÁGINA: GESTOR - ATLETAS (atletas.js)
// ==========================================================================

window.App.initAtletas = function() {
  window.App.renderManagerAthletesList();
  
  // Sincroniza dados com o backend na entrada para carregar as solicitações
  window.App.syncAthletesList();

  const btnAdd = document.getElementById("btn-open-add-athlete-modal");
  if (btnAdd) btnAdd.onclick = () => window.App.openModal("atleta");

  const btnTransfer = document.getElementById("btn-open-transfer-guest-modal");
  if (btnTransfer) btnTransfer.onclick = () => window.App.openModal("transferir_convidado");

  const btnExport = document.getElementById("btn-export-athlete-names");
  if (btnExport) btnExport.onclick = () => window.App.exportAthleteNames();

  const searchInput = document.getElementById("athlete-search-input");
  if (searchInput) {
    searchInput.oninput = debounce((e) => {
      window.App.renderManagerAthletesList(e.target.value);
    }, 300);
  }
};

window.App.exportAthleteNames = function() {
  const players = JSON.parse(localStorage.getItem("players")) || [];
  const isAthlete = (p) => p.tipo !== 'incorporado';
  const approvedPlayers = players.filter(p => (p.verificado === true || p.ativo === true) && isAthlete(p));

  const searchInput = document.getElementById("athlete-search-input");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

  const targetPlayers = query 
    ? approvedPlayers.filter(p => (p.nome && p.nome.toLowerCase().includes(query)) || (p.email && p.email.toLowerCase().includes(query)))
    : approvedPlayers;

  if (targetPlayers.length === 0) {
    if (window.Utils && window.Utils.toast) window.Utils.toast("Nenhum atleta encontrado para exportar.", "warning");
    return;
  }

  const names = targetPlayers
    .map(p => (p.nome || '').trim())
    .filter(n => n.length > 0);

  const textContent = names.join("\n");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textContent).catch(() => {});
  }

  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `nomes_atletas_${dateStr}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const msg = `${names.length} nome(s) exportado(s) e copiado(s)!`;
  if (window.Utils && window.Utils.toast) {
    window.Utils.toast(msg, "success");
  } else if (window.App && window.App.showToast) {
    window.App.showToast(msg, "success");
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

  // 1. Filtrar pendentes e cadastrados/aprovados
  const isAthlete = (p) => p.tipo !== 'incorporado';
  const pendingPlayers = players.filter(p => p.verificado === false && p.ativo === false && isAthlete(p));
  const approvedPlayers = players.filter(p => (p.verificado === true || p.ativo === true) && isAthlete(p));

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
        item.style.borderLeft = "4px solid #F59E0B";
        item.style.background = "#FFFBEB";
        item.style.padding = "16px";
        item.style.borderRadius = "10px";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.flexWrap = "wrap";
        item.style.gap = "12px";

        const initials = p.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

        item.innerHTML = `
          <div class="athlete-info" style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 240px;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background-color: #F59E0B; color: #FFF; display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; font-size: 20px; font-weight: 800; flex-shrink: 0;">
              ${initials}
            </div>
            <div class="athlete-details">
              <h4 style="display: flex; align-items: center; gap: 8px; margin: 0 0 4px 0; font-size: 15px; font-weight: 800; color: #92400E;">
                ${p.nome} 
                <span style="font-size: 10px; font-weight: 700; background: rgba(245, 158, 11, 0.2); color: #B45309; padding: 2px 6px; border-radius: 4px;">Pendente</span>
              </h4>
              <span style="font-size: 12px; color: #78350F;">E-mail: <strong>${p.email}</strong> ${p.whatsapp ? `· WhatsApp: ${p.whatsapp}` : ''}</span>
            </div>
          </div>
          <div class="athlete-actions" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-sm btn-approve-as-athlete" data-id="${p.id}" style="background: #10B981; border: none; padding: 8px 14px; font-weight: 700; color: #fff; cursor: pointer; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px;" title="Aprovar como Atleta Fixo (Mensalista)">
              <i data-feather="check-circle" style="width: 14px; height: 14px;"></i> Como Atleta
            </button>
            <button class="btn btn-sm btn-approve-as-guest" data-id="${p.id}" style="background: #F59E0B; border: none; padding: 8px 14px; font-weight: 700; color: #fff; cursor: pointer; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px;" title="Aprovar como Convidado (Diarista / Avulso)">
              <i data-feather="user-plus" style="width: 14px; height: 14px;"></i> Como Convidado
            </button>
            <button class="btn btn-sm btn-reject-athlete" data-id="${p.id}" style="background: #EF4444; border: none; padding: 8px 12px; font-weight: 700; color: #fff; cursor: pointer; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; font-size: 12px;" title="Recusar e excluir solicitação">
              <i data-feather="x" style="width: 14px; height: 14px;"></i> Recusar
            </button>
          </div>
        `;

        item.querySelector(".btn-approve-as-athlete").onclick = () => approveAthlete(p.id, 'jogador');
        item.querySelector(".btn-approve-as-guest").onclick = () => approveAthlete(p.id, 'convidado');
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
      <div class="empty-state" style="padding: 40px; text-align: center; color: #94A3B8;">
        <i data-feather="users" style="width: 36px; height: 36px; margin-bottom: 8px;"></i>
        <p style="margin: 0; font-size: 14px; font-weight: 600;">Nenhum atleta ou convidado encontrado.</p>
      </div>
    `;
    feather.replace();
    return;
  }

  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "card-athlete";
    if (!p.ativo) card.style.opacity = "0.5";

    // Tratamento de segurança para saldo e autoavaliação
    const saldoVal = p.saldo ? parseFloat(p.saldo) : 0;
    const balanceText = saldoVal.toFixed(2).replace(".", ",");
    const balanceColor = saldoVal >= 0 ? "var(--success)" : "var(--danger)";
    const estrelasText = p.autoavaliacao !== null && p.autoavaliacao !== undefined ? `${p.autoavaliacao} estrelas` : 'N/A';

    const fotoUrl = p.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nome)}&background=0F172A&color=38BDF8&size=256&bold=true`;

    const avatarHTML = `<img src="${fotoUrl}" class="athlete-avatar btn-download-avatar" alt="${p.nome}" title="Clique para baixar foto do perfil" style="width: 56px; height: 56px; min-width: 56px; min-height: 56px; max-width: 56px; max-height: 56px; border-radius: 50%; object-fit: cover; flex-shrink: 0; aspect-ratio: 1/1; cursor: pointer; transition: transform 0.15s; border: 2px solid #0284C7; box-shadow: 0 2px 6px rgba(0,0,0,0.08);" onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform='scale(1)'" />`;

    const downloadBtnHTML = `<button class="btn btn-sm btn-outline btn-download-athlete-photo" data-id="${p.id}" title="Baixar foto do perfil" style="display: inline-flex; align-items: center; gap: 4px; border-radius: 8px; padding: 6px 10px; font-weight: 600;"><i data-feather="download" style="width: 13px; height: 13px;"></i> Foto</button>`;

    const isGoleiroBadge = p.goleiro 
      ? `<span style="font-size: 11px; font-weight: 700; background: rgba(255, 109, 0, 0.1); color: var(--accent); padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;"><i data-feather="shield" style="width: 11px; height: 11px;"></i> Goleiro</span>` 
      : '';

    // Badge de tipo (Convidado vs Atleta vs Gestor)
    let tipoBadge = '';
    let toggleRoleBtn = '';

    if (p.tipo === 'convidado') {
      tipoBadge = `<span style="font-size: 11px; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: #D97706; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;"><i data-feather="tag" style="width: 11px; height: 11px;"></i> Convidado</span>`;
      toggleRoleBtn = `<button class="btn btn-sm btn-outline btn-toggle-role" data-id="${p.id}" data-target="jogador" title="Alterar vínculo para Atleta Fixo da Pelada" style="border-color: #10B981; color: #059669; font-weight: 700; border-radius: 8px; padding: 6px 10px; display: inline-flex; align-items: center; gap: 4px;"><i data-feather="arrow-up-circle" style="width: 13px; height: 13px;"></i> Tornar Atleta</button>`;
    } else if (p.tipo === 'gestor' || p.tipo === 'ambos') {
      tipoBadge = `<span style="font-size: 11px; font-weight: 700; background: rgba(2, 132, 199, 0.12); color: #0284C7; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;"><i data-feather="award" style="width: 11px; height: 11px;"></i> Gestor</span>`;
    } else {
      tipoBadge = `<span style="font-size: 11px; font-weight: 700; background: rgba(16, 185, 129, 0.12); color: #059669; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;"><i data-feather="check" style="width: 11px; height: 11px;"></i> Atleta</span>`;
      toggleRoleBtn = `<button class="btn btn-sm btn-outline btn-toggle-role" data-id="${p.id}" data-target="convidado" title="Alterar vínculo para Convidado (Diarista)" style="border-color: #F59E0B; color: #D97706; font-weight: 700; border-radius: 8px; padding: 6px 10px; display: inline-flex; align-items: center; gap: 4px;"><i data-feather="arrow-down-circle" style="width: 13px; height: 13px;"></i> Tornar Convidado</button>`;
    }

    card.innerHTML = `
      <div class="athlete-info" style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0;">
        ${avatarHTML}
        <div class="athlete-details" style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.nome}</h4>
            ${tipoBadge}
            ${isGoleiroBadge}
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748B; flex-wrap: wrap;">
            <span>${p.email || 'Sem e-mail'}</span>
            <span>·</span>
            <span style="display: inline-flex; align-items: center; gap: 3px; font-weight: 600; color: #D97706;"><i data-feather="star" style="width: 12px; height: 12px;"></i> ${estrelasText}</span>
          </div>
        </div>
      </div>

      <div class="card-athlete-right" style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
        <div style="text-align: right; min-width: 90px;" class="athlete-saldo-col">
          <span style="font-size: 10px; display: block; text-transform: uppercase; color: #64748B; font-weight: 800; letter-spacing: 0.5px;">Saldo</span>
          <strong style="color: ${balanceColor}; font-size: 16px; font-weight: 900;">R$ ${balanceText}</strong>
        </div>
        <div class="athlete-actions" style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
          ${downloadBtnHTML}
          ${toggleRoleBtn}
          <button class="btn btn-sm btn-outline btn-merge-athlete" data-id="${p.id}" title="Incorporar Histórico de Convidado" style="border-color: #CBD5E1; color: #334155; font-weight: 700; border-radius: 8px; padding: 6px 10px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-feather="git-pull-request" style="width: 13px; height: 13px; color: #0284C7;"></i> Mesclar
          </button>
          <button class="btn btn-sm btn-secondary btn-saldo-athlete" data-id="${p.id}" title="Lançar Crédito / Patrocínio / Ajuste" style="font-weight: 700; border-radius: 8px; padding: 6px 10px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-feather="dollar-sign" style="width: 13px; height: 13px;"></i> Saldo
          </button>
          <button class="btn btn-sm btn-outline btn-edit-athlete" data-id="${p.id}" title="Editar Atleta" style="font-weight: 700; border-radius: 8px; padding: 6px 10px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-feather="edit-2" style="width: 13px; height: 13px;"></i> Editar
          </button>
          <button class="btn btn-sm btn-danger btn-delete-athlete" data-id="${p.id}" title="Excluir Atleta" style="font-weight: 700; border-radius: 8px; padding: 6px 10px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-feather="trash-2" style="width: 13px; height: 13px;"></i>
          </button>
        </div>
      </div>
    `;
    
    if (p.foto) {
      const avatarImg = card.querySelector(".btn-download-avatar");
      if (avatarImg) avatarImg.onclick = () => window.Utils.downloadImage(p.foto, p.nome);

      const downloadBtn = card.querySelector(".btn-download-athlete-photo");
      if (downloadBtn) downloadBtn.onclick = () => window.Utils.downloadImage(p.foto, p.nome);
    }

    const btnToggle = card.querySelector(".btn-toggle-role");
    if (btnToggle) {
      btnToggle.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetRole = btnToggle.getAttribute("data-target");
        toggleAthleteRole(p.id, targetRole, p.nome);
      };
    }

    const btnMerge = card.querySelector(".btn-merge-athlete");
    if (btnMerge) {
      btnMerge.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.App.openModal("transferir_convidado", { athleteId: p.id });
      };
    }

    const btnSaldo = card.querySelector(".btn-saldo-athlete");
    if (btnSaldo) {
      btnSaldo.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.App.openModal("ajustar_saldo", { id: p.id });
      };
    }
    card.querySelector(".btn-edit-athlete").onclick = () => window.App.openModal("atleta", { id: p.id });
    card.querySelector(".btn-delete-athlete").onclick = () => deleteAthlete(p.id, p.nome);

    container.appendChild(card);
  });
  feather.replace();
};

async function approveAthlete(id, tipo = 'jogador') {
  const tipoLabel = tipo === 'convidado' ? 'Convidado' : 'Atleta Fixo';
  try {
    Utils.toast(`Aprovando cadastro como ${tipoLabel}...`, "info");
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/usuarios/${id}/aprovar`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ tipo })
    });

    const data = await res.json();
    if (!res.ok) {
      Utils.toast(data.error || "Erro ao aprovar cadastro.", "error");
      return;
    }

    Utils.toast(`Cadastro aprovado com sucesso como ${tipoLabel}! 🎉`, "success");
    await window.App.syncAthletesList();
  } catch (err) {
    console.error(err);
    Utils.toast("Erro ao se conectar ao servidor.", "error");
  }
}

async function toggleAthleteRole(id, targetRole, nome) {
  const targetLabel = targetRole === 'convidado' ? 'Convidado (Diarista / Avulso)' : 'Atleta Fixo da Pelada (Mensalista)';
  if (!confirm(`Deseja alterar o estado de ${nome} para "${targetLabel}"?`)) return;

  try {
    Utils.toast(`Alterando para ${targetRole === 'convidado' ? 'Convidado' : 'Atleta'}...`, "info");
    const token = localStorage.getItem("token");

    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ tipo: targetRole })
    });

    const data = await res.json();
    if (!res.ok) {
      Utils.toast(data.error || "Erro ao alterar estado do atleta.", "error");
      return;
    }

    Utils.toast(`Estado de ${nome} alterado com sucesso para ${targetRole === 'convidado' ? 'Convidado' : 'Atleta'}! 🎉`, "success");
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
