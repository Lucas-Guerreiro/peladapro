// ==========================================================================
// MODAL: PAGAMENTO (pagamento.js)
// ==========================================================================

let localPelada = null;

window.App.initModalPagamento = function (pelada) {
  localPelada = pelada;

  // PostgreSQL retorna números como string — parseFloat garante o tipo correto
  const cost = parseFloat(pelada.valor_convocacao) || 20.00;
  const user = window.Auth?.currentUser || window.App?.currentUser;
  const saldoUser = parseFloat((user && user.saldo) || 0);

  document.getElementById("payment-match-cost").textContent = `R$ ${cost.toFixed(2).replace(".", ",")}`;
  document.getElementById("payment-my-balance").textContent = `Disponível: R$ ${saldoUser.toFixed(2).replace(".", ",")}`;

  // Limite de saldo negativo: lê do grupo ativo (config padrão) ou 0
  const grupo = window.App.currentGroup || {};
  const negativeLimit = parseFloat(grupo.limite_saldo_negativo || 0);

  const willBeNegative = saldoUser - cost < -negativeLimit;
  const balanceRadio = document.getElementById("pay-method-balance");
  const balanceLabel = document.getElementById("payment-option-balance-label");
  const alertEl = document.getElementById("payment-insufficient-alert");
  const confirmBtn = document.getElementById("btn-confirm-payment-action");

  if (willBeNegative) {
    if (balanceRadio) {
      balanceRadio.disabled = true;
      balanceRadio.checked = false;
    }
    if (balanceLabel) {
      balanceLabel.style.opacity = "0.5";
      balanceLabel.style.cursor = "not-allowed";
      balanceLabel.style.border = "2px solid var(--border-color)";
      balanceLabel.style.background = "var(--background)";
    }
    if (alertEl) alertEl.style.display = "flex";
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = "0.5";
      confirmBtn.style.cursor = "not-allowed";
    }
    window.App.showToast("Saldo insuficiente. Faça a recarga via Pix na tela anterior.", "warning");
  } else {
    if (balanceRadio) {
      balanceRadio.disabled = false;
      balanceRadio.checked = true;
    }
    if (balanceLabel) {
      balanceLabel.style.opacity = "1";
      balanceLabel.style.cursor = "pointer";
      balanceLabel.style.border = "2px solid var(--primary)";
      balanceLabel.style.background = "rgba(2, 132, 199, 0.04)";
    }
    if (alertEl) alertEl.style.display = "none";
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = "1";
      confirmBtn.style.cursor = "pointer";
    }
  }

  // Escutas
  document.getElementById("btn-close-payment-modal").onclick = window.App.closeModal;
  document.getElementById("btn-confirm-payment-action").onclick = handleConfirmPayment;
};

async function handleConfirmPayment() {
  const method = document.querySelector('input[name="payment-method"]:checked').value;
  const cost = parseFloat(localPelada.valor_convocacao) || 20.00;
  const token = localStorage.getItem('token');

  if (!token) {
    window.App.showToast("Sessão inválida. Faça logout e entre novamente.", "error");
    return;
  }

  let confirmed = false;
  try {
    window.App.showToast("Confirmando presença no servidor...", "info");

    const res = await fetch('/api/convocacoes/confirmar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        pelada_id: localPelada.id,
        forma_pagamento: method
      })
    });

    const responseData = await res.json();

    if (res.status < 200 || res.status >= 300) {
      window.App.showToast(responseData.error || "Erro ao confirmar presença.", "error");
      return;
    }

    confirmed = true; // ✅ Pagamento confirmado com sucesso

    // Sucesso!
    window.App.showToast("Presença confirmada no Supabase!", "success");

    // Sincronizar o saldo atualizado do jogador logado de volta na sessão local!
    if (method === 'saldo' && window.App.currentUser) {
      window.App.currentUser.saldo = (parseFloat(window.App.currentUser.saldo) || 0) - cost;

      try {
        const players = JSON.parse(localStorage.getItem("players")) || [];
        const p = players.find(x => String(x.id) === String(window.App.currentUser.id));
        if (p) {
          p.saldo = window.App.currentUser.saldo;
          localStorage.setItem("players", JSON.stringify(players));
        }
      } catch (e) { console.warn("[pagamento] Erro ao sincronizar saldo local:", e); }
    }

    // Atualizar a dashboard do jogador (se tiver o saldo visível)
    try {
      if (window.Dashboard && typeof window.Dashboard.renderPlayerData === 'function') {
        window.Dashboard.renderPlayerData();
      }
    } catch (uiErr) { console.warn("[pagamento] Erro ao atualizar dashboard:", uiErr); }

    // Recarregar a lista de confirmados e status da convocação na tela de Convocação!
    try {
      if (window.Convocacao) {
        await window.Convocacao.renderConfirmedList(localPelada.id);
        window.Convocacao.updateMyStatus();
      }
    } catch (uiErr) {
      console.warn("[pagamento] Erro secundário ao atualizar UI de convocados:", uiErr);
    }

    // Fechar o modal
    window.App.closeModal();

  } catch (err) {
    console.error("[pagamento] Erro ao confirmar presença:", err);
    // Só mostra o erro de conexão se o pagamento NÃO foi confirmado
    if (!confirmed) {
      window.App.showToast("Erro ao conectar ao servidor para confirmar presença.", "error");
    }
  }
}
