// ==========================================================================
// MODAL: DESCONVOCAR (remocao.js)
// ==========================================================================

let localPelada = null;

function calculateHoursLeft(pelada) {
  if (!pelada || !pelada.data) return 999;

  let dataStr = '';
  if (pelada.data instanceof Date) {
    dataStr = pelada.data.toISOString().split('T')[0];
  } else {
    dataStr = String(pelada.data).split('T')[0];
  }

  let timeStr = pelada.horario ? String(pelada.horario).trim() : '19:00';
  if (timeStr.length === 5) timeStr += ':00';

  const peladaDateTime = new Date(`${dataStr}T${timeStr}`);
  const now = new Date();

  if (isNaN(peladaDateTime.getTime())) return 999;

  const timeDiffMs = peladaDateTime.getTime() - now.getTime();
  return timeDiffMs / (1000 * 60 * 60);
}

window.App.initModalRemocao = function (pelada) {
  localPelada = pelada;

  const hoursLeft = calculateHoursLeft(pelada);
  const cost = parseFloat(pelada.valor_convocacao) || 20.00;
  const costFmt = `R$ ${cost.toFixed(2).replace('.', ',')}`;
  const infoDiv = document.getElementById("removal-reimbursement-info");

  if (hoursLeft >= 2) {
    infoDiv.style.backgroundColor = "rgba(0, 200, 83, 0.12)";
    infoDiv.style.border = "1px solid rgba(0, 200, 83, 0.3)";
    infoDiv.style.color = "#047857";
    infoDiv.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: start;">
        <span style="font-size: 20px;">✅</span>
        <div>
          <strong style="font-size: 14px; color: #047857;">Estorno de Saldo Permitido!</strong>
          <span style="display:block; font-size: 13px; margin-top: 4px; line-height: 1.4; color: #065F46;">Você está se desconvocando com antecedência. O valor pago (<b>${costFmt}</b>) será <b>estornado integralmente</b> para o seu saldo no aplicativo!</span>
        </div>
      </div>
    `;
  } else {
    infoDiv.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
    infoDiv.style.border = "1px solid rgba(239, 68, 68, 0.3)";
    infoDiv.style.color = "#B91C1C";
    infoDiv.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: start;">
        <span style="font-size: 20px;">⚠️</span>
        <div>
          <strong style="font-size: 14px; color: #B91C1C;">Faltam menos de 2 horas para a pelada!</strong>
          <span style="display:block; font-size: 13px; margin-top: 4px; line-height: 1.4; color: #991B1B;">Pela política de antecedência, faltam menos de 2 horas para o início do jogo. Se você se desconvocar agora, o valor pago <b>não poderá ser estornado</b>.</span>
        </div>
      </div>
    `;
  }

  // Escutas
  document.getElementById("btn-close-removal-modal").onclick = window.App.closeModal;
  document.getElementById("btn-cancel-removal").onclick = window.App.closeModal;
  document.getElementById("btn-confirm-removal-action").onclick = handleConfirmRemoval;

  if (window.feather) feather.replace();
};

async function handleConfirmRemoval() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.App.showToast("Sessão inválida. Faça logout e entre novamente.", "error");
    return;
  }

  const hoursLeft = calculateHoursLeft(localPelada);
  const opcaoRemocao = hoursLeft >= 2 ? 'estorno' : 'caixa';
  const cost = parseFloat(localPelada.valor_convocacao) || 20.00;

  try {
    window.App.showToast("Processando desconvocação...", "info");

    const res = await fetch('/api/convocacoes/remover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        pelada_id: localPelada.id,
        opcao_remocao: opcaoRemocao
      })
    });

    const responseData = await res.json();

    if (!res.ok) {
      window.App.showToast(responseData.error || "Erro ao desconvocar.", "error");
      return;
    }

    // Sucesso!
    if (opcaoRemocao === 'estorno') {
      window.App.showToast("Desconvocado com sucesso! Valor estornado ao seu saldo. 💰", "success");
      if (window.App.currentUser) {
        window.App.currentUser.saldo = (parseFloat(window.App.currentUser.saldo) || 0) + cost;
      }
      if (window.Auth && window.Auth.currentUser) {
        window.Auth.currentUser.saldo = (parseFloat(window.Auth.currentUser.saldo) || 0) + cost;
        localStorage.setItem("user", JSON.stringify(window.Auth.currentUser));
      }
    } else {
      window.App.showToast("Desconvocado. Prazo de 2h expirado (sem estorno).", "warning");
    }

    // Atualizar interface
    if (window.Convocacao) {
      await window.Convocacao.renderConfirmedList(localPelada.id);
      await window.Convocacao.updateMyStatus();
    }
    if (window.Dashboard && typeof window.Dashboard.renderPlayerData === 'function') {
      window.Dashboard.renderPlayerData();
    }

    window.App.closeModal();
  } catch (err) {
    console.error("[remocao] Erro:", err);
    window.App.showToast("Erro de conexão ao desconvocar.", "error");
  }
}
