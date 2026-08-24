// ==========================================================================
// MODAL: DESCONVOCAR (remocao.js)
// ==========================================================================

var localPelada = null;

function calculateHoursLeft(pelada) {
  if (!pelada || !pelada.data) return 999;

  let year, month, day;

  if (pelada.data instanceof Date) {
    year = pelada.data.getFullYear();
    month = String(pelada.data.getMonth() + 1).padStart(2, '0');
    day = String(pelada.data.getDate()).padStart(2, '0');
  } else {
    const raw = String(pelada.data).split('T')[0];
    const parts = raw.split('-');
    if (parts.length === 3) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      return 999;
    }
  }

  let timeStr = pelada.horario ? String(pelada.horario).trim() : '19:00';
  const timeParts = timeStr.split(':');
  const horaStr = String(timeParts[0] || '19').padStart(2, '0');
  const minStr = String(timeParts[1] || '00').padStart(2, '0');

  const peladaDateTime = new Date(`${year}-${month}-${day}T${horaStr}:${minStr}:00-03:00`);
  const now = new Date();

  if (isNaN(peladaDateTime.getTime())) return 999;

  const timeDiffMs = peladaDateTime.getTime() - now.getTime();
  return timeDiffMs / (1000 * 60 * 60);
}

window.App.initModalRemocao = function (pelada) {
  localPelada = pelada;

  const user = window.Auth?.currentUser || window.App?.currentUser;
  const convocations = window.Api?.getConvocations ? window.Api.getConvocations() : [];
  const myConv = convocations.find(c => String(c.pelada_id) === String(pelada.id) && String(c.player_id || c.usuario_id) === String(user?.id));
  const isWaitlist = myConv && (myConv.status === 'espera' || myConv.status === 'fila_espera');

  const infoDiv = document.getElementById("removal-reimbursement-info");

  if (isWaitlist) {
    infoDiv.style.backgroundColor = "rgba(245, 158, 11, 0.12)";
    infoDiv.style.border = "1px solid rgba(245, 158, 11, 0.3)";
    infoDiv.style.color = "#B45309";
    infoDiv.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: start;">
        <span style="font-size: 20px;">⏳</span>
        <div>
          <strong style="font-size: 14px; color: #B45309;">Remoção da Fila de Espera</strong>
          <span style="display:block; font-size: 13px; margin-top: 4px; line-height: 1.4; color: #92400E;">Como você está na fila de espera, nenhum pagamento foi cobrado. Ao confirmar a desconvocação, seu nome será removido da fila.</span>
        </div>
      </div>
    `;
  } else {
    const hoursLeft = calculateHoursLeft(pelada);
    const cost = parseFloat(pelada.valor_convocacao) || 20.00;
    const costFmt = `R$ ${cost.toFixed(2).replace('.', ',')}`;

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

    // 1. Atualizar dados de sessão e saldo do usuário via Backend
    if (window.Auth && typeof window.Auth.refreshCurrentUser === 'function') {
      const updatedUser = await window.Auth.refreshCurrentUser();
      if (updatedUser && updatedUser.saldo !== undefined) {
        const saldoFmt = window.Utils ? window.Utils.formatCurrency(updatedUser.saldo) : `R$ ${parseFloat(updatedUser.saldo).toFixed(2).replace('.', ',')}`;
        const balanceElConv = document.getElementById('my-balance-conv');
        if (balanceElConv) balanceElConv.textContent = saldoFmt;
        const balanceElDash = document.getElementById('player-balance-value');
        if (balanceElDash) balanceElDash.textContent = saldoFmt;
      }
    }

    // 2. Atualizar cache local de convocação imediatamente para status 'pendente'
    const userObj = (window.Auth && window.Auth.currentUser) || (window.App && window.App.currentUser);
    if (window.Api && window.Api.getConvocations && userObj) {
      try {
        let localConvs = window.Api.getConvocations();
        localConvs = localConvs.map(c => {
          if (String(c.pelada_id) === String(localPelada.id) && (String(c.player_id) === String(userObj.id) || String(c.usuario_id) === String(userObj.id))) {
            return { ...c, status: 'pendente', presenca: false, posicao_fila: null };
          }
          return c;
        });
        window.Api.saveConvocations(localConvs);
      } catch (e) {
        console.warn('[remocao] Aviso ao atualizar cache local:', e);
      }
    }

    // Sucesso!
    if (responseData.estornado || opcaoRemocao === 'estorno') {
      window.App.showToast("Desconvocado com sucesso! Valor estornado ao seu saldo. 💰", "success");
    } else {
      window.App.showToast("Desconvocado. Prazo de 2h expirado (sem estorno).", "warning");
    }

    // 3. Re-renderizar listas e status nas telas do atleta e do gestor
    if (window.Convocacao) {
      await window.Convocacao.renderConfirmedList(localPelada.id);
      await window.Convocacao.updateMyStatus();
    }
    if (window.App && window.App.renderManagerCheckin) {
      await window.App.renderManagerCheckin(localPelada.id);
    }
    if (window.Dashboard && typeof window.Dashboard.renderPlayerData === 'function') {
      window.Dashboard.renderPlayerData();
    }

    // Notifica gestores no Supabase se ativo no frontend
    if (window.supabase && localPelada) {
      try {
        const u = (window.Auth && window.Auth.currentUser) || (window.App && window.App.currentUser) || {};
        const atletaNome = u.apelido || u.nome || 'Atleta';
        const { data: gestores } = await window.supabase
          .from('usuarios')
          .select('id')
          .or('tipo.eq.gestor,tipo.eq.ambos,tipo.eq.admin');

        if (gestores && gestores.length > 0) {
          const notifs = gestores.map(g => ({
            usuario_id: g.id,
            tipo: 'desconvocacao',
            titulo: '🚫 Atleta Desconvocado',
            mensagem: `O atleta ${atletaNome} desconvocou-se da pelada.`,
            lida: false
          }));
          await window.supabase.from('notificacoes').insert(notifs);
        }
      } catch (e) {
        console.warn('[remocao] Aviso ao salvar notificação para o gestor:', e);
      }
    }

    window.App.closeModal();
  } catch (err) {
    console.error("[remocao] Erro:", err);
    window.App.showToast("Erro de conexão ao desconvocar.", "error");
  }
}
