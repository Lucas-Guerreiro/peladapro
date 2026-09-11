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

  const peladaManaus = new Date(`${year}-${month}-${day}T${horaStr}:${minStr}:00-04:00`);
  const peladaBrasilia = new Date(`${year}-${month}-${day}T${horaStr}:${minStr}:00-03:00`);
  const now = new Date();

  if (isNaN(peladaManaus.getTime()) && isNaN(peladaBrasilia.getTime())) return 999;

  const timeDiffMsManaus = peladaManaus.getTime() - now.getTime();
  const timeDiffMsBrasilia = peladaBrasilia.getTime() - now.getTime();

  return Math.max(timeDiffMsManaus, timeDiffMsBrasilia) / (1000 * 60 * 60);
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
  const token = localStorage.getItem('token') || localStorage.getItem('pelada_token') || localStorage.getItem('authToken');
  if (!token) {
    window.App.showToast("Sessão inválida. Faça logout e entre novamente.", "error");
    return;
  }

  const hoursLeft = calculateHoursLeft(localPelada);
  const opcaoRemocao = hoursLeft >= 2 ? 'estorno' : 'caixa';
  const cost = parseFloat(localPelada.valor_convocacao) || 20.00;

  try {
    console.group('%c 🚀 DISPARANDO DESCONVOCACÃO ', 'background: #0284C7; color: #FFF; font-size: 13px; font-weight: bold;');
    console.log('1️⃣ Dados de Entrada:', {
      pelada_id: localPelada ? localPelada.id : null,
      opcaoRemocao: opcaoRemocao,
      hoursLeft: hoursLeft
    });

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
    console.log('2️⃣ Resposta HTTP:', res.status, res.statusText);
    console.log('3️⃣ Resposta JSON do Servidor:', responseData);

    if (!res.ok) {
      console.error('❌ ERRO RETORNADO PELO SERVIDOR:', responseData);
      console.groupEnd();
      window.App.showToast(responseData.error || "Erro ao desconvocar.", "error");
      return;
    }

    // 1. Atualizar dados de sessão e saldo do usuário via Backend
    if (window.Auth && typeof window.Auth.refreshCurrentUser === 'function') {
      const updatedUser = await window.Auth.refreshCurrentUser();
      console.log('4️⃣ Usuário/saldo atualizado via refreshCurrentUser:', updatedUser);
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
        console.log('5️⃣ Cache local de convocação atualizado.');
      } catch (e) {
        console.warn('Aviso ao atualizar cache local:', e);
      }
    }

    // Sucesso!
    if (responseData.estornado || opcaoRemocao === 'estorno') {
      const estornoVal = parseFloat(localPelada.valor_convocacao) > 0 ? parseFloat(localPelada.valor_convocacao) : 20.00;
      if (window.Auth && window.Auth.currentUser) {
        window.Auth.currentUser.saldo = Math.max(parseFloat(window.Auth.currentUser.saldo || 0), estornoVal);
        localStorage.setItem("currentUser", JSON.stringify(window.Auth.currentUser));
        localStorage.setItem("usuario", JSON.stringify(window.Auth.currentUser));
      }
      if (window.App && window.App.currentUser) {
        window.App.currentUser.saldo = Math.max(parseFloat(window.App.currentUser.saldo || 0), estornoVal);
      }

      const saldoFinalFmt = window.Utils ? window.Utils.formatCurrency(window.Auth.currentUser.saldo) : `R$ ${parseFloat(window.Auth.currentUser.saldo).toFixed(2).replace('.', ',')}`;
      const balanceElConv = document.getElementById('my-balance-conv');
      if (balanceElConv) balanceElConv.textContent = saldoFinalFmt;
      const balanceElDash = document.getElementById('player-balance-value');
      if (balanceElDash) balanceElDash.textContent = saldoFinalFmt;

      console.log('6️⃣ Saldo final atualizado no DOM:', saldoFinalFmt);
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

    console.log('✅ Desconvocação efetuada com sucesso!');
    console.groupEnd();
    window.App.closeModal();
  } catch (err) {
    console.error("❌ Erro no fluxo de desconvocação:", err);
    console.groupEnd();
    window.App.showToast("Erro ao processar desconvocação.", "error");
  }
}

// ==========================================================================
// FUNÇÃO DE TESTE E DIAGNÓSTICO EM TEMPO REAL DISPONÍVEL NO CONSOLE (F12)
// Digite TestDesconvocacao() no Console do Navegador para rodar o teste!
// ==========================================================================
window.TestDesconvocacao = async function (peladaIdInput) {
  const peladaId = peladaIdInput || (localPelada ? localPelada.id : 27);
  console.group('%c 🧪 DIAGNÓSTICO DE DESCONVOCACÃO (CONSOLE) ', 'background: #0284C7; color: white; font-size: 14px; font-weight: bold; padding: 4px 8px; border-radius: 4px;');
  
  const token = localStorage.getItem('token') || localStorage.getItem('pelada_token') || localStorage.getItem('authToken');
  console.log('1️⃣ Token JWT em Uso:', token ? `${token.substring(0, 25)}...` : '❌ NENHUM TOKEN ENCONTRADO!');

  if (!token) {
    console.groupEnd();
    return '❌ Erro: Sessão não encontrada no navegador.';
  }

  // 2. Testa perfil / me
  let userMe = null;
  try {
    const resMe = await fetch('/api/usuarios/me', { headers: { 'Authorization': `Bearer ${token}` } });
    if (resMe.ok) {
      userMe = await resMe.json();
      console.log('2️⃣ Dados do Atleta Logado (/api/usuarios/me):', userMe);
      console.log(`   ➜ ID: ${userMe.id} | Nome: ${userMe.nome || userMe.apelido} | Saldo Atual no Banco: R$ ${userMe.saldo}`);
    } else {
      console.error('2️⃣ Erro ao consultar perfil:', resMe.status, resMe.statusText);
    }
  } catch (e) {
    console.error('2️⃣ Falha na requisição /api/usuarios/me:', e);
  }

  // 3. Convocação da pelada antes da desconvocação
  try {
    const resConvs = await fetch(`/api/convocacoes/pelada/${peladaId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (resConvs.ok) {
      const convs = await resConvs.json();
      const minhaConv = convs.find(c => String(c.id || c.usuario_id) === String(userMe?.id));
      console.log(`3️⃣ Lista de Convocados no Banco (Pelada #${peladaId}):`);
      console.log('   ➜ Sua Convocação Atual no Banco:', minhaConv || '❌ Nenhuma convocação nesta pelada');
    }
  } catch (e) {
    console.error('3️⃣ Erro ao listar convocados:', e);
  }

  // 4. Executa desconvocação via POST /api/convocacoes/remover
  console.log('4️⃣ Disparando POST /api/convocacoes/remover...');
  try {
    const resRemover = await fetch('/api/convocacoes/remover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ pelada_id: peladaId, opcao_remocao: 'estorno' })
    });
    const bodyRemover = await resRemover.json();
    console.log(`   ➜ HTTP Status: ${resRemover.status} ${resRemover.statusText}`);
    console.log('   ➜ Resposta do Backend:', bodyRemover);

    // 5. Re-checa o saldo pós-remoção
    const resMePos = await fetch('/api/usuarios/me', { headers: { 'Authorization': `Bearer ${token}` } });
    if (resMePos.ok) {
      const userMePos = await resMePos.json();
      console.log(`5️⃣ Verificação Pós-Remoção (/api/usuarios/me):`);
      console.log(`   ➜ Saldo Anterior: R$ ${userMe?.saldo} | Novo Saldo no Banco: R$ ${userMePos.saldo}`);
    }

    // 6. Re-checa a lista de convocados pós-remoção
    const resConvsPos = await fetch(`/api/convocacoes/pelada/${peladaId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (resConvsPos.ok) {
      const convsPos = await resConvsPos.json();
      const minhaConvPos = convsPos.find(c => String(c.id || c.usuario_id) === String(userMe?.id));
      console.log(`6️⃣ Convocados no Banco Pós-Remoção:`);
      console.log('   ➜ Status do Atleta Pós-Remoção:', minhaConvPos || '✅ Removido completamente!');
    }

  } catch (e) {
    console.error('4️⃣ Erro na requisição:', e);
  }

  console.groupEnd();
  return '✅ Diagnóstico finalizado! Verifique os passos 1 a 6 acima no Console.';
};
