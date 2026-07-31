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

  if (willBeNegative) {
    balanceRadio.disabled = true;
    balanceRadio.checked = false;
    document.getElementById("pay-method-pix").checked = true;
    document.getElementById("pix-qr-area").classList.remove("hidden");
    balanceLabel.style.opacity = "0.5";
    balanceLabel.style.cursor = "not-allowed";
    window.App.showToast("Saldo insuficiente. Pague com PIX.", "warning");
  }

  // Escutas
  document.getElementById("btn-close-payment-modal").onclick = window.App.closeModal;
  document.getElementById("btn-confirm-payment-action").onclick = handleConfirmPayment;

  document.getElementById("pay-method-pix").onchange = (e) => {
    if (e.target.checked) document.getElementById("pix-qr-area").classList.remove("hidden");
  };
  document.getElementById("pay-method-balance").onchange = (e) => {
    if (e.target.checked) document.getElementById("pix-qr-area").classList.add("hidden");
  };
};

async function handleConfirmPayment() {
  const method = document.querySelector('input[name="payment-method"]:checked').value;
  const cost = parseFloat(localPelada.valor_convocacao) || 20.00;
  const token = localStorage.getItem('token');

  if (!token) {
    window.App.showToast("Sessão inválida. Faça logout e entre novamente.", "error");
    return;
  }

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

    // Sucesso!
    window.App.showToast("Presença confirmada no Supabase!", "success");

    // Sincronizar o saldo atualizado do jogador logado de volta na sessão local!
    if (method === 'saldo') {
      window.App.currentUser.saldo -= cost;

      // Sincronizar também na lista de players do localStorage
      const players = JSON.parse(localStorage.getItem("players")) || [];
      const p = players.find(x => String(x.id) === String(window.App.currentUser.id));
      if (p) {
        p.saldo = window.App.currentUser.saldo;
        localStorage.setItem("players", JSON.stringify(players));
      }
    }

    // Atualizar a dashboard do jogador (se tiver o saldo visível)
    if (window.Dashboard && typeof window.Dashboard.renderPlayerData === 'function') {
      window.Dashboard.renderPlayerData();
    }

    // Recarregar a lista de confirmados e status da convocação na tela de Convocação!
    if (window.Convocacao) {
      await window.Convocacao.renderConfirmedList(localPelada.id);
      window.Convocacao.updateMyStatus();
    }

    // Fechar o modal
    window.App.closeModal();

  } catch (err) {
    console.error(err);
    window.App.showToast("Erro ao conectar ao servidor para confirmar presença.", "error");
  }
}
