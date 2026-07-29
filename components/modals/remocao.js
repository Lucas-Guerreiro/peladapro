// ==========================================================================
// MODAL: REMOÇÃO (remocao.js)
// ==========================================================================

let localPelada = null;

window.App.initModalRemocao = function(pelada) {
  localPelada = pelada;

  const peladaDateTime = new Date(`${pelada.data}T${pelada.horario}:00`);
  const now = new Date();
  const timeDiffMs = peladaDateTime.getTime() - now.getTime();
  const hoursLeft = timeDiffMs / (1000 * 60 * 60);

  const infoDiv = document.getElementById("removal-reimbursement-info");
  
  if (hoursLeft >= 2) {
    infoDiv.style.backgroundColor = "rgba(0, 200, 83, 0.1)";
    infoDiv.style.color = "var(--success)";
    infoDiv.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: start;">
        <i data-feather="check-circle" style="width: 20px; height: 20px; flex-shrink:0;"></i>
        <div>
          <strong>Reembolso Permitido!</strong>
          <span style="display:block; font-size:12px; margin-top:2px;">Faltam mais de 2 horas para o início da partida (${hoursLeft.toFixed(1)}h restantes). O valor da convocação será estornado ao seu saldo.</span>
        </div>
      </div>
    `;
  } else {
    infoDiv.style.backgroundColor = "rgba(255, 23, 68, 0.1)";
    infoDiv.style.color = "var(--danger)";
    infoDiv.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: start;">
        <i data-feather="alert-triangle" style="width: 20px; height: 20px; flex-shrink:0;"></i>
        <div>
          <strong>Sem Reembolso Financeiro!</strong>
          <span style="display:block; font-size:12px; margin-top:2px;">Faltam menos de 2 horas para o jogo. Pela política de sustentabilidade financeira, a taxa será direcionada ao caixa de multas da pelada.</span>
        </div>
      </div>
    `;
  }

  // Escutas
  document.getElementById("btn-close-removal-modal").onclick = window.App.closeModal;
  document.getElementById("btn-cancel-removal").onclick = window.App.closeModal;
  document.getElementById("btn-confirm-removal-action").onclick = handleConfirmRemoval;
  
  feather.replace();
};

async function handleConfirmRemoval() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.App.showToast("Sessão inválida. Faça logout e entre novamente.", "error");
    return;
  }

  const peladaDateTime = new Date(`${localPelada.data}T${localPelada.horario}:00`);
  const now = new Date();
  const timeDiffMs = peladaDateTime.getTime() - now.getTime();
  const hoursLeft = timeDiffMs / (1000 * 60 * 60);

  const opcaoRemocao = hoursLeft >= 2 ? 'estorno' : 'caixa';
  const cost = localPelada.valor_convocacao || 20.00;

  try {
    window.App.showToast("Cancelando presença no servidor...", "info");

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
      window.App.showToast(responseData.error || "Erro ao cancelar presença.", "error");
      return;
    }

    // Sucesso!
    if (opcaoRemocao === 'estorno') {
      window.App.showToast("Convocação cancelada. Taxa estornada ao saldo!", "success");
      // Atualizar o saldo na sessão do jogador logado!
      window.App.currentUser.saldo += cost;
      
      // Sincronizar na lista de players do localStorage
      const players = JSON.parse(localStorage.getItem("players")) || [];
      const p = players.find(x => String(x.id) === String(window.App.currentUser.id));
      if (p) {
        p.saldo = window.App.currentUser.saldo;
        localStorage.setItem("players", JSON.stringify(players));
      }
    } else {
      window.App.showToast("Convocação cancelada. Taxa retida ao caixa.", "warning");
    }

    // Atualizar dashboard do jogador
    if (window.Dashboard && typeof window.Dashboard.renderPlayerData === 'function') {
      window.Dashboard.renderPlayerData();
    }

    // Fechar modal
    window.App.closeModal();

    // Recarregar convocados e status da tela de Convocação
    if (window.Convocacao) {
      await window.Convocacao.renderConfirmedList(localPelada.id);
      window.Convocacao.updateMyStatus();
    }

  } catch (err) {
    console.error(err);
    window.App.showToast("Erro ao conectar ao servidor para cancelar presença.", "error");
  }
}
