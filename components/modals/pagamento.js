// ==========================================================================
// MODAL: PAGAMENTO (pagamento.js)
// ==========================================================================

var localPelada = null;
var pollingInterval = null;

window.App.initModalPagamento = function (pelada) {
  localPelada = pelada;

  // Limpar qualquer polling pendente anterior
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

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
  const pixRadio = document.getElementById("pay-method-pix");
  const pixLabel = document.getElementById("payment-option-pix-label");
  const alertEl = document.getElementById("payment-insufficient-alert");
  const confirmBtn = document.getElementById("btn-confirm-payment-action");

  // Ajustes Visuais e de Estado Iniciais
  if (willBeNegative) {
    if (balanceRadio) {
      balanceRadio.disabled = true;
      balanceRadio.checked = false;
    }
    if (balanceLabel) {
      balanceLabel.style.opacity = "0.5";
      balanceLabel.style.cursor = "not-allowed";
      balanceLabel.classList.remove("payment-method-selected");
    }
    if (pixRadio) {
      pixRadio.checked = true; // Seleciona Pix por padrão
    }
    if (pixLabel) {
      pixLabel.classList.add("payment-method-selected");
    }
    if (alertEl) alertEl.style.display = "none"; // Só exibe se selecionar saldo
    if (confirmBtn) {
      confirmBtn.textContent = "Gerar PIX e Confirmar Presença";
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = "1";
      confirmBtn.style.cursor = "pointer";
    }
  } else {
    if (balanceRadio) {
      balanceRadio.disabled = false;
      balanceRadio.checked = true; // Seleciona Saldo por padrão
    }
    if (balanceLabel) {
      balanceLabel.classList.add("payment-method-selected");
    }
    if (pixLabel) {
      pixLabel.classList.remove("payment-method-selected");
    }
    if (alertEl) alertEl.style.display = "none";
    if (confirmBtn) {
      confirmBtn.textContent = "Concluir Convocação";
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = "1";
      confirmBtn.style.cursor = "pointer";
    }
  }

  // Monitorar mudança na seleção do meio de pagamento
  if (balanceRadio) {
    balanceRadio.onchange = () => {
      if (balanceLabel) balanceLabel.classList.add("payment-method-selected");
      if (pixLabel) pixLabel.classList.remove("payment-method-selected");
      
      if (willBeNegative) {
        if (alertEl) alertEl.style.display = "flex";
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.style.opacity = "0.5";
          confirmBtn.style.cursor = "not-allowed";
        }
      } else {
        if (alertEl) alertEl.style.display = "none";
        if (confirmBtn) {
          confirmBtn.textContent = "Concluir Convocação";
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = "1";
          confirmBtn.style.cursor = "pointer";
        }
      }
    };
  }

  if (pixRadio) {
    pixRadio.onchange = () => {
      if (pixLabel) pixLabel.classList.add("payment-method-selected");
      if (balanceLabel) balanceLabel.classList.remove("payment-method-selected");
      if (alertEl) alertEl.style.display = "none";
      if (confirmBtn) {
        confirmBtn.textContent = "Gerar PIX e Confirmar Presença";
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = "1";
        confirmBtn.style.cursor = "pointer";
      }
    };
  }

  // Interceptar fechamento do modal para limpar o polling
  const originalCloseModal = window.App.closeModal;
  window.App.closeModal = function () {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    originalCloseModal();
  };

  // Escutas de Botões do Modal
  document.getElementById("btn-close-payment-modal").onclick = window.App.closeModal;
  document.getElementById("btn-confirm-payment-action").onclick = handlePaymentAction;
};

async function handlePaymentAction() {
  const method = document.querySelector('input[name="payment-method"]:checked').value;

  if (method === 'saldo') {
    await handleConfirmPaymentSaldo();
  } else {
    await handleGeneratePixAction();
  }
}

async function handleConfirmPaymentSaldo() {
  const cost = parseFloat(localPelada.valor_convocacao) || 20.00;
  const token = localStorage.getItem('token');
  const confirmBtn = document.getElementById("btn-confirm-payment-action");

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "⏳ Confirmando...";
  }

  try {
    const res = await fetch('/api/convocacoes/confirmar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        pelada_id: localPelada.id,
        forma_pagamento: 'saldo'
      })
    });

    const data = await res.json();

    if (res.status < 200 || res.status >= 300) {
      window.App.showToast(data.error || "Erro ao confirmar presença.", "error");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Concluir Convocação";
      }
      return;
    }

    window.App.showToast("Presença confirmada via Saldo! ⚽", "success");

    // Deduz do saldo na sessão local
    if (window.App.currentUser) {
      window.App.currentUser.saldo = (parseFloat(window.App.currentUser.saldo) || 0) - cost;
      try {
        const players = JSON.parse(localStorage.getItem("players")) || [];
        const p = players.find(x => String(x.id) === String(window.App.currentUser.id));
        if (p) {
          p.saldo = window.App.currentUser.saldo;
          localStorage.setItem("players", JSON.stringify(players));
        }
      } catch (e) { }
    }

    // Atualiza UIs
    await refreshUI();
    window.App.closeModal();

  } catch (err) {
    console.error("[pagamento] Erro no saldo:", err);
    window.App.showToast("Erro ao se conectar ao servidor.", "error");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Concluir Convocação";
    }
  }
}

async function handleGeneratePixAction() {
  const confirmBtn = document.getElementById("btn-confirm-payment-action");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "⏳ Gerando Pix...";
  }

  try {
    const data = await Api.criarPagamentoPix(localPelada.id);

    if (data.error) {
      window.App.showToast(data.error, "error");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Gerar PIX e Confirmar Presença";
      }
      return;
    }

    // 1. Mostrar a área do Pix Gerado e ocultar a seleção
    document.getElementById("payment-selection-area").style.display = "none";
    
    const qrCodeImg = document.getElementById("pix-qr-code-img");
    if (qrCodeImg) {
      qrCodeImg.src = `data:image/png;base64,${data.qr_code_base64}`;
    }

    const copiaColaInput = document.getElementById("pix-copia-cola-input");
    if (copiaColaInput) {
      copiaColaInput.value = data.qr_code;
    }

    document.getElementById("pix-generated-area").style.display = "flex";

    // 2. Ação de copiar chave
    document.getElementById("btn-copy-pix-copia-cola").onclick = () => {
      copiaColaInput.select();
      copiaColaInput.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(copiaColaInput.value)
        .then(() => window.App.showToast("Código Copia e Cola copiado! 📋", "success"))
        .catch(() => window.App.showToast("Não foi possível copiar automaticamente.", "warning"));
    };

    // 3. Ação de simular aprovação do Pix (para testes)
    document.getElementById("btn-simular-aprovacao-pix").onclick = async () => {
      window.App.showToast("Simulando aprovação de pagamento...", "info");
      const simRes = await Api.simularAprovacaoPix(data.id);
      if (simRes.error) {
        window.App.showToast(simRes.error, "error");
      } else {
        window.App.showToast("Simulação concluída! Presença confirmada.", "success");
      }
    };

    // 4. Iniciar Polling para escutar a aprovação real
    startPixPolling(data.id);

  } catch (err) {
    console.error("[pagamento] Erro ao gerar Pix:", err);
    window.App.showToast("Erro ao se conectar ao servidor.", "error");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Gerar PIX e Confirmar Presença";
    }
  }
}

function startPixPolling(paymentId) {
  if (pollingInterval) clearInterval(pollingInterval);

  pollingInterval = setInterval(async () => {
    try {
      const res = await Api.obterStatusPagamentoPix(localPelada.id);
      
      // Se a convocação do jogador mudou para "confirmado" ou "espera"
      if (res && (res.statusConvocacao === 'confirmado' || res.statusConvocacao === 'espera')) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        
        if (res.statusConvocacao === 'espera') {
          window.App.showToast(`✅ Pagamento Pix confirmado! Você entrou na fila de espera (Posição #${res.posicaoFila || 1}).`, "success");
        } else {
          window.App.showToast("🎉 Pagamento Pix confirmado e presença garantida!", "success");
        }

        await refreshUI();
        window.App.closeModal();
      }
    } catch (e) {
      console.warn('[PixPolling] Erro de rede no status do Pix:', e);
    }
  }, 4000); // Polling a cada 4 segundos
}

async function refreshUI() {
  // Atualiza dashboard
  try {
    if (window.Dashboard && typeof window.Dashboard.renderPlayerData === 'function') {
      await window.Dashboard.renderPlayerData();
    }
  } catch (e) { }

  // Recarrega lista na tela de convocação
  try {
    if (window.Convocacao) {
      await window.Convocacao.renderConfirmedList(localPelada.id);
      await window.Convocacao.updateMyStatus();
    }
  } catch (e) { }
}
