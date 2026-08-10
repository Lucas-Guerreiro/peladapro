// ==========================================================================
// MODAL: AJUSTAR SALDO DE ATLETA (ajustar_saldo.js)
// ==========================================================================

window.App.initModalAjustar_saldo = function (data = {}) {
  const playerId = data.id || data.playerId;
  if (!playerId) return;

  const players = JSON.parse(localStorage.getItem("players")) || [];
  let p = players.find(x => String(x.id) === String(playerId));

  const hiddenId = document.getElementById("ajustar-saldo-player-id");
  const avatarCont = document.getElementById("ajustar-saldo-avatar-container");
  const nomeEl = document.getElementById("ajustar-saldo-atleta-nome");
  const saldoEl = document.getElementById("ajustar-saldo-atual-text");
  const valorInput = document.getElementById("ajustar-saldo-valor");
  const descInput = document.getElementById("ajustar-saldo-descricao");
  const btnCredito = document.getElementById("btn-tipo-credito");
  const btnDebito = document.getElementById("btn-tipo-debito");
  const btnConfirmar = document.getElementById("btn-confirmar-ajuste-saldo");

  let tipoOperacao = "credito"; // 'credito' ou 'debito'

  if (hiddenId) hiddenId.value = playerId;

  if (p) {
    if (nomeEl) nomeEl.textContent = p.apelido || p.nome || "Atleta";
    const saldoVal = parseFloat(p.saldo || 0);
    if (saldoEl) {
      saldoEl.textContent = window.Utils ? window.Utils.formatCurrency(saldoVal) : `R$ ${saldoVal.toFixed(2)}`;
      saldoEl.style.color = saldoVal >= 0 ? "#10B981" : "#EF4444";
    }

    if (avatarCont) {
      const initial = (p.nome || '?').charAt(0).toUpperCase();
      avatarCont.innerHTML = p.foto
        ? `<img src="${p.foto}" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary); display: inline-block;">`
        : `<div style="width: 64px; height: 64px; border-radius: 50%; background: #0284C7; color: #FFF; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; border: 3px solid #E2E8F0;">${initial}</div>`;
    }
  }

  // Alternar Tipo de Operação
  function setTipo(tipo) {
    tipoOperacao = tipo;
    if (tipo === "credito") {
      btnCredito.style.background = "#D1FAE5";
      btnCredito.style.color = "#065F46";
      btnCredito.style.borderColor = "#10B981";
      btnDebito.style.background = "#F1F5F9";
      btnDebito.style.color = "#64748B";
      btnDebito.style.borderColor = "#CBD5E1";
      if (descInput && (descInput.value === "Ajuste de Saldo" || !descInput.value)) {
        descInput.value = "Patrocínio / Apoio aluguel";
      }
    } else {
      btnDebito.style.background = "#FEE2E2";
      btnDebito.style.color = "#991B1B";
      btnDebito.style.borderColor = "#EF4444";
      btnCredito.style.background = "#F1F5F9";
      btnCredito.style.color = "#64748B";
      btnCredito.style.borderColor = "#CBD5E1";
      if (descInput && (descInput.value === "Patrocínio / Apoio aluguel" || !descInput.value)) {
        descInput.value = "Ajuste de Saldo";
      }
    }
  }

  if (btnCredito) btnCredito.onclick = () => setTipo("credito");
  if (btnDebito) btnDebito.onclick = () => setTipo("debito");

  // Atalhos Rápidos de Valor
  document.querySelectorAll(".btn-quick-val").forEach(btn => {
    btn.onclick = () => {
      const val = btn.getAttribute("data-val");
      if (valorInput) valorInput.value = parseFloat(val).toFixed(2);
    };
  });

  // Confirmar Ajuste de Saldo
  if (btnConfirmar) {
    btnConfirmar.onclick = async () => {
      const rawVal = parseFloat(valorInput.value);
      if (isNaN(rawVal) || rawVal <= 0) {
        window.App.showToast("Informe um valor válido maior que zero.", "warning");
        return;
      }

      const finalAmount = tipoOperacao === "credito" ? Math.abs(rawVal) : -Math.abs(rawVal);
      const desc = descInput ? (descInput.value.trim() || (tipoOperacao === "credito" ? "Crédito Manual" : "Débito Manual")) : "Ajuste de Saldo";

      let group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
      if (!group || !group.id) {
        try { group = JSON.parse(localStorage.getItem("currentGroup")); } catch (e) { }
      }

      if (!group || !group.id) {
        window.App.showToast("Grupo de referência não encontrado.", "error");
        return;
      }

      try {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = "Processando...";
        window.App.showToast("Salvando ajuste de saldo no servidor...", "info");

        const res = await window.Api.ajustarSaldoAtleta(playerId, group.id, finalAmount, desc);
        if (res.error) {
          window.App.showToast(res.error, "error");
          btnConfirmar.disabled = false;
          btnConfirmar.textContent = "💰 Confirmar Lançamento";
          return;
        }

        if (p) p.saldo = res.novoSaldo;
        localStorage.setItem("players", JSON.stringify(players));

        const toastVal = window.Utils ? window.Utils.formatCurrency(Math.abs(finalAmount)) : `R$ ${Math.abs(finalAmount).toFixed(2)}`;
        window.App.showToast(`Lançamento de ${tipoOperacao === 'credito' ? '+' : '-'}${toastVal} (${desc}) concluído com sucesso!`, "success");

        window.App.closeModal();

        // Atualiza listas em tempo real
        if (window.App.renderManagerAthletesList) window.App.renderManagerAthletesList();
        if (window.App.renderFinanceiroData) window.App.renderFinanceiroData();
        if (window.App.renderManagerCheckin && window.App.activePelada) window.App.renderManagerCheckin(window.App.activePelada.id);
      } catch (err) {
        console.error("[initModalAjustar_saldo]", err);
        window.App.showToast("Erro ao ajustar saldo.", "error");
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = "💰 Confirmar Lançamento";
      }
    };
  }
};
