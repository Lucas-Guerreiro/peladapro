// components/modals/recarga.js — Lógica de Recarga de Saldo Pessoal via Pix Automático

window.App = window.App || {};

window.App.initModalRecarga = function(data = {}) {
  let pollingInterval = null;
  let currentPaymentId = null;

  const btnClose = document.getElementById('btn-close-recarga-modal');
  const btnCancelFlow = document.getElementById('btn-cancel-recarga-flow');
  const btnGeneratePix = document.getElementById('btn-generate-recarga-pix');
  const inputCustom = document.getElementById('recarga-custom-amount');
  const quickBtns = document.querySelectorAll('.btn-quick-recarga');

  const stepInput = document.getElementById('recarga-input-step');
  const stepPix = document.getElementById('recarga-pix-step');
  const valDisplay = document.getElementById('recarga-pix-val-display');
  const qrContainer = document.getElementById('recarga-qrcode-container');
  const inputCopiaCola = document.getElementById('recarga-copia-cola-input');
  const btnCopyPix = document.getElementById('btn-copy-recarga-pix');
  const pollingStatus = document.getElementById('recarga-polling-status');

  function cleanup() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  if (btnClose) {
    btnClose.onclick = () => {
      cleanup();
      Router.closeModal();
    };
  }

  if (btnCancelFlow) {
    btnCancelFlow.onclick = () => {
      cleanup();
      stepPix.style.display = 'none';
      stepInput.style.display = 'block';
      if (window.feather) feather.replace();
    };
  }

  quickBtns.forEach(btn => {
    btn.onclick = () => {
      quickBtns.forEach(b => {
        b.style.background = '#F8FAFC';
        b.style.borderColor = '#CBD5E1';
        b.style.color = '#334155';
      });
      btn.style.background = 'rgba(2, 132, 199, 0.08)';
      btn.style.borderColor = '#0284C7';
      btn.style.color = '#0284C7';
      if (inputCustom) inputCustom.value = btn.getAttribute('data-val');
    };
  });

  if (btnGeneratePix) {
    btnGeneratePix.onclick = async () => {
      const valor = parseFloat(inputCustom ? inputCustom.value : 0);
      if (isNaN(valor) || valor < 1.00) {
        Utils.toast('O valor mínimo para recarga é de R$ 1,00.', 'warning');
        return;
      }

      try {
        btnGeneratePix.disabled = true;
        btnGeneratePix.innerHTML = '<span class="spinner-inline" style="width: 16px; height: 16px; border: 2px solid #FFF; border-top-color: transparent; border-radius: 50%; display: inline-block; animation: spin 1s linear infinite;"></span> Gerando Pix...';

        const res = await Api.criarRecargaPix(valor, data.grupo_id || null);

        if (res.error) {
          Utils.toast(res.error, 'error');
          return;
        }

        currentPaymentId = res.id;

        // Renderizar QR Code e chave Copia e Cola
        if (valDisplay) valDisplay.textContent = Utils.formatCurrency(valor);
        if (inputCopiaCola) inputCopiaCola.value = res.qr_code || '';

        if (qrContainer) {
          if (res.qr_code_base64 && res.qr_code_base64.length > 20) {
            qrContainer.innerHTML = `<img src="data:image/png;base64,${res.qr_code_base64}" alt="QR Code Pix" style="width: 170px; height: 170px; display: block; border-radius: 8px;">`;
          } else if (res.qr_code) {
            // Usar API de QR code pública se base64 vier vazio (mock / fallback)
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(res.qr_code)}`;
            qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR Code Pix" style="width: 170px; height: 170px; display: block; border-radius: 8px;">`;
          }
        }

        stepInput.style.display = 'none';
        stepPix.style.display = 'flex';
        if (window.feather) feather.replace();

        // Iniciar Polling de aprovação automática a cada 3 segundos
        startPolling(currentPaymentId);

      } catch (err) {
        console.error('[RecargaPix]', err);
        Utils.toast('Erro ao gerar cobrança Pix.', 'error');
      } finally {
        btnGeneratePix.disabled = false;
        btnGeneratePix.innerHTML = '<i data-feather="qr-code" style="width: 18px; height: 18px;"></i> Gerar Chave Pix para Recarga';
        if (window.feather) feather.replace();
      }
    };
  }

  if (btnCopyPix) {
    btnCopyPix.onclick = () => {
      if (inputCopiaCola && inputCopiaCola.value) {
        navigator.clipboard.writeText(inputCopiaCola.value).then(() => {
          Utils.toast('Código Pix Copia e Cola copiado com sucesso!', 'success');
        }).catch(() => {
          inputCopiaCola.select();
          document.execCommand('copy');
          Utils.toast('Código Pix copiado!', 'success');
        });
      }
    };
  }

  function startPolling(paymentId) {
    cleanup();
    pollingInterval = setInterval(async () => {
      try {
        const res = await Api.obterStatusRecarga(paymentId);
        if (res && res.status === 'approved') {
          cleanup();
          
          if (pollingStatus) {
            pollingStatus.style.background = '#ECFDF5';
            pollingStatus.style.borderColor = '#10B981';
            pollingStatus.style.color = '#047857';
            pollingStatus.innerHTML = '✅ Pagamento Aprovado! Saldo creditado.';
          }

          Utils.toast('🎉 Recarga de saldo aprovada com sucesso!', 'success');

          // Atualiza o saldo local do usuário
          if (Auth.currentUser && res.novoSaldo != null) {
            Auth.currentUser.saldo = parseFloat(res.novoSaldo);
            localStorage.setItem('user', JSON.stringify(Auth.currentUser));
          }

          // Notifica telas ativas para atualizar saldo na UI
          if (window.Dashboard && window.Dashboard.init) window.Dashboard.init();
          if (window.Convocacao && window.Convocacao.updateMyStatus) window.Convocacao.updateMyStatus();
          if (window.FinanceiroAtleta && window.FinanceiroAtleta.init) window.FinanceiroAtleta.init();

          setTimeout(() => {
            Router.closeModal();
          }, 2000);
        }
      } catch (e) {
        console.warn('[Polling Recarga Error]', e);
      }
    }, 3000);
  }
};
