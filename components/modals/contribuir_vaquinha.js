// ==========================================================================
// MODAL: CONTRIBUIR COM A VAQUINHA VIA PIX (contribuir_vaquinha.js)
// ==========================================================================

window.App.initModalContribuir_vaquinha = function(data = {}) {
  const btnClose = document.getElementById("btn-close-contribuir-modal");
  if (btnClose) btnClose.onclick = () => {
    stopPollingContrib();
    window.App.closeModal();
  };

  const arrecadacao = data.arrecadacao || {};
  window._activeModalArrecadacao = arrecadacao;

  // Preenche dados da campanha
  const titleEl = document.getElementById("contrib-target-title");
  const descEl = document.getElementById("contrib-target-desc");
  const customValInput = document.getElementById("contrib-custom-value");

  if (titleEl) titleEl.textContent = arrecadacao.titulo || "Campanha de Arrecadação";
  if (descEl) descEl.textContent = arrecadacao.descricao || "Contribuição para materiais da pelada";
  
  const valSugerido = parseFloat(arrecadacao.valor_sugerido || 10);
  if (customValInput) customValInput.value = valSugerido.toFixed(2);

  // Botões de valores rápidos
  document.querySelectorAll(".btn-quick-val").forEach(btn => {
    btn.onclick = (e) => {
      document.querySelectorAll(".btn-quick-val").forEach(b => {
        b.style.background = "#F1F5F9";
        b.style.color = "#334155";
        b.style.borderColor = "#CBD5E1";
      });
      const target = e.currentTarget;
      target.style.background = "#0284C7";
      target.style.color = "#FFFFFF";
      target.style.borderColor = "#0284C7";

      const val = target.getAttribute("data-val");
      if (customValInput) customValInput.value = parseFloat(val).toFixed(2);
    };
  });

  // Botão Gerar Pix
  const btnGen = document.getElementById("btn-generate-contrib-pix");
  if (btnGen) {
    btnGen.onclick = handleGeneratePix;
  }
};

let _contribPollInterval = null;

function stopPollingContrib() {
  if (_contribPollInterval) {
    clearInterval(_contribPollInterval);
    _contribPollInterval = null;
  }
}

async function handleGeneratePix() {
  const arrecadacao = window._activeModalArrecadacao;
  if (!arrecadacao || !arrecadacao.id) {
    window.App.showToast("Campanha inválida.", "error");
    return;
  }

  const inputVal = document.getElementById("contrib-custom-value");
  const valor = parseFloat(inputVal ? inputVal.value : 0);

  if (isNaN(valor) || valor <= 0) {
    window.App.showToast("Informe um valor válido para contribuir.", "warning");
    return;
  }

  const btnGen = document.getElementById("btn-generate-contrib-pix");
  if (btnGen) {
    btnGen.disabled = true;
    btnGen.innerHTML = `Gerando QR Code Pix... ⏳`;
  }

  try {
    const res = await window.Api.gerarPixContribuicao(arrecadacao.id, valor);
    if (res.error) {
      window.App.showToast(res.error, "error");
      if (btnGen) {
        btnGen.disabled = false;
        btnGen.innerHTML = `<span>Gerar Pix Copia e Cola</span> ⚡`;
      }
      return;
    }

    // Exibe Etapa 2 (QR Code e Copia e Cola)
    document.getElementById("step-choose-value").style.display = "none";
    const stepQr = document.getElementById("step-pix-qr-area");
    stepQr.style.display = "flex";

    const valDisplay = document.getElementById("pix-contrib-val-display");
    if (valDisplay) valDisplay.textContent = `R$ ${valor.toFixed(2).replace('.', ',')}`;

    // Carrega Imagem do QR Code
    const qrImg = document.getElementById("pix-contrib-qr-img");
    if (qrImg) {
      if (res.qr_code_base64) {
        qrImg.src = `data:image/png;base64,${res.qr_code_base64}`;
      } else {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(res.qr_code)}`;
      }
    }

    // Botão Copiar Pix
    const btnCopy = document.getElementById("btn-copy-contrib-pix-code");
    if (btnCopy) {
      btnCopy.onclick = () => {
        if (navigator.clipboard && res.qr_code) {
          navigator.clipboard.writeText(res.qr_code).then(() => {
            window.App.showToast("Código Pix copiado com sucesso! Cole no app do seu banco.", "success");
            btnCopy.innerHTML = `✅ Código Pix Copiado!`;
            setTimeout(() => {
              btnCopy.innerHTML = `<i data-feather="copy" style="width: 16px; height: 16px;"></i> Copiar Código Pix`;
              if (window.feather) feather.replace();
            }, 3000);
          });
        }
      };
    }

    // Botão de simulação
    const btnSimular = document.getElementById("btn-simular-aprovacao-contrib");
    if (btnSimular) {
      btnSimular.onclick = async () => {
        btnSimular.disabled = true;
        btnSimular.textContent = "Simulando aprovação...";
        try {
          await window.Api.simularAprovacaoContribuicao(res.contribuicao_id);
          stopPollingContrib();
          showSuccessStep(valor);
        } catch (e) {
          window.App.showToast("Erro ao simular aprovação.", "error");
          btnSimular.disabled = false;
        }
      };
    }

    // Inicia Polling em tempo real para verificar se o banco aprovou
    startPollingStatus(res.contribuicao_id, valor);

    if (window.feather) feather.replace();

  } catch (err) {
    console.error('[handleGeneratePix]', err);
    window.App.showToast("Erro ao gerar pagamento Pix.", "error");
    if (btnGen) {
      btnGen.disabled = false;
      btnGen.innerHTML = `<span>Gerar Pix Copia e Cola</span> ⚡`;
    }
  }
}

function startPollingStatus(contribuicaoId, valor) {
  stopPollingContrib();
  _contribPollInterval = setInterval(async () => {
    try {
      const res = await window.Api.consultarStatusContribuicao(contribuicaoId);
      if (res && res.status === 'approved') {
        stopPollingContrib();
        showSuccessStep(valor);
      }
    } catch (e) {
      console.warn('[Polling Contrib]', e.message);
    }
  }, 2500);
}

function showSuccessStep(valor) {
  const stepQr = document.getElementById("step-pix-qr-area");
  const stepSuccess = document.getElementById("step-contrib-success");
  if (stepQr) stepQr.style.display = "none";
  if (stepSuccess) stepSuccess.style.display = "flex";

  const successVal = document.getElementById("success-contrib-val");
  if (successVal) successVal.textContent = `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;

  if (window.feather) feather.replace();
}
