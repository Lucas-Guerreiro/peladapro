// ==========================================================================
// Modal: Transferir Convidado para Atleta Cadastrado (transferir_convidado.js)
// ==========================================================================

window.App = window.App || {};

// Notificação utilitária compatível com a aplicação
function notifyUser(msg, type = 'info') {
  if (window.Utils && typeof window.Utils.toast === 'function') {
    window.Utils.toast(msg, type);
  } else if (window.App && typeof window.App.showToast === 'function') {
    window.App.showToast(msg, type);
  } else {
    alert(msg);
  }
}

// Método de inicialização invocado pelo Router
window.App.initModalTransferir_convidado = async function (data = {}) {
  console.log('[transferir_convidado] Inicializando modal com data:', data);

  const selectConvidado = document.getElementById('select-convidado-origem');
  const selectAtleta = document.getElementById('select-atleta-destino');

  if (!selectConvidado || !selectAtleta) {
    console.error('[transferir_convidado] Elementos de seleção não encontrados no DOM.');
    return;
  }

  const targetAthleteId = data.athleteId || data.usuarioId || null;

  // 1. Carregar a lista mais recente de atletas do banco de dados (Supabase / Backend API / localStorage)
  let players = [];

  if (window.supabase) {
    try {
      const { data: dbPlayers, error } = await window.supabase.from('usuarios').select('*');
      if (dbPlayers && dbPlayers.length > 0) {
        players = dbPlayers;
        console.log('[transferir_convidado] Atletas carregados do Supabase:', players.length);
      }
      if (error) console.warn('[transferir_convidado] Aviso Supabase:', error.message);
    } catch (e) {
      console.warn('[transferir_convidado] Erro ao consultar Supabase:', e);
    }
  }

  if (players.length === 0) {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch('/api/usuarios', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) players = await res.json();
      }
    } catch (e) { }
  }

  if (players.length === 0) {
    try {
      players = JSON.parse(localStorage.getItem('players') || '[]');
    } catch (e) { }
  }

  window.App._cachedPlayersForTransfer = players;

  // Função auxiliar para identificar se o registro é de convidado
  const isConvidadoUser = (p) => {
    if (!p) return false;
    const type = String(p.tipo || '').toLowerCase();
    const email = String(p.email || '').toLowerCase();
    return (
      type === 'convidado' ||
      email.includes('@convidado.com') ||
      email.startsWith('convidado_') ||
      p.is_convidado === true ||
      p.convidado === true
    );
  };

  const convidados = players.filter(isConvidadoUser);
  const atletasCadastrados = players.filter(p => !isConvidadoUser(p));

  console.log('[transferir_convidado] Total convidados:', convidados.length, '| Total atletas:', atletasCadastrados.length);

  // Preencher Select Convidado
  selectConvidado.innerHTML = '<option value="">-- Selecione o Convidado --</option>';
  const listaParaConvidados = convidados.length > 0 ? convidados : players;
  listaParaConvidados.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.nome || c.apelido || 'Convidado Sem Nome'} (${c.gols || 0} gols | ${c.partidas || c.jogos || 0} jogos)`;
    selectConvidado.appendChild(opt);
  });

  // Preencher Select Atleta Cadastrado
  selectAtleta.innerHTML = '<option value="">-- Selecione o Atleta --</option>';
  const listaParaAtletas = atletasCadastrados.length > 0 ? atletasCadastrados : players;
  listaParaAtletas.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.nome || a.apelido || 'Atleta Sem Nome'} ${a.email ? '(' + a.email + ')' : ''}`;
    if (targetAthleteId && String(a.id) === String(targetAthleteId)) {
      opt.selected = true;
    }
    selectAtleta.appendChild(opt);
  });

  // Atualiza preview ao selecionar um convidado
  selectConvidado.onchange = function () {
    const cid = selectConvidado.value;
    const convidadoSel = players.find(c => String(c.id) === String(cid));

    const golsEl = document.getElementById('preview-transfer-gols');
    const jogosEl = document.getElementById('preview-transfer-jogos');
    const saldoEl = document.getElementById('preview-transfer-saldo');

    if (convidadoSel) {
      if (golsEl) golsEl.textContent = convidadoSel.gols || 0;
      if (jogosEl) jogosEl.textContent = convidadoSel.partidas || convidadoSel.jogos || 0;
      if (saldoEl) {
        const s = parseFloat(convidadoSel.saldo || 0);
        saldoEl.textContent = `R$ ${s.toFixed(2).replace('.', ',')}`;
        saldoEl.style.color = s >= 0 ? '#10B981' : '#EF4444';
      }
    } else {
      if (golsEl) golsEl.textContent = '0';
      if (jogosEl) jogosEl.textContent = '0';
      if (saldoEl) saldoEl.textContent = 'R$ 0,00';
    }
  };
};

// Método de submissão invocado via onclick no botão HTML
window.App.executarTransferenciaConvidado = async function (e) {
  if (e && e.preventDefault) e.preventDefault();
  console.log('[executarTransferenciaConvidado] Iniciando processo de transferência...');

  const selectConvidado = document.getElementById('select-convidado-origem');
  const selectAtleta = document.getElementById('select-atleta-destino');
  const btnConfirm = document.getElementById('btn-confirmar-transferencia');

  if (!selectConvidado || !selectAtleta) {
    notifyUser('Erro: Formulário do modal não foi carregado corretamente.', 'error');
    return;
  }

  const convidadoId = selectConvidado.value;
  const usuarioId = selectAtleta.value;

  console.log('[executarTransferenciaConvidado] convidadoId:', convidadoId, '| usuarioId:', usuarioId);

  if (!convidadoId || convidadoId === '') {
    notifyUser('Por favor, selecione o Convidado Temporário de origem.', 'warning');
    return;
  }
  if (!usuarioId || usuarioId === '') {
    notifyUser('Por favor, selecione o Atleta Cadastrado de destino.', 'warning');
    return;
  }
  if (String(convidadoId) === String(usuarioId)) {
    notifyUser('O Convidado de origem e o Atleta de destino devem ser pessoas diferentes.', 'error');
    return;
  }

  const players = window.App._cachedPlayersForTransfer || [];
  const convidadoSel = players.find(c => String(c.id) === String(convidadoId));
  const atletaSel = players.find(a => String(a.id) === String(usuarioId));

  const convidadoNome = selectConvidado.options[selectConvidado.selectedIndex]?.text || (convidadoSel ? (convidadoSel.nome || convidadoSel.apelido) : 'Convidado');
  const atletaNome = selectAtleta.options[selectAtleta.selectedIndex]?.text || (atletaSel ? (atletaSel.nome || atletaSel.apelido) : 'Atleta');

  console.log('[executarTransferenciaConvidado] Iniciando mesclagem de:', convidadoNome, 'para:', atletaNome);

  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.textContent = '🔄 Transferindo dados...';
  }

  let sucesso = false;
  let mensagemSucesso = '';

  // 1. TENTA PRIMEIRAMENTE VIA SUPABASE DIRETO (Serverless / Vercel Compatible)
  if (window.supabase) {
    try {
      console.log('[executarTransferenciaConvidado] Processando via Supabase...');

      const { data: cData } = await window.supabase.from('usuarios').select('*').eq('id', convidadoId).single();
      const { data: aData } = await window.supabase.from('usuarios').select('*').eq('id', usuarioId).single();

      const cObj = cData || convidadoSel || {};
      const aObj = aData || atletaSel || {};

      const golsC = parseInt(cObj.gols || 0);
      const jogosC = parseInt(cObj.partidas || cObj.jogos || 0);
      const saldoC = parseFloat(cObj.saldo || 0);

      // Transfere as convocações do convidado para o atleta
      const { error: errConv } = await window.supabase
        .from('convocacoes')
        .update({ usuario_id: usuarioId })
        .eq('usuario_id', convidadoId);

      if (errConv) console.warn('[transferirConvidado] Supabase convocações notice:', errConv.message);

      // Atualiza estatísticas (Gols, Partidas, Saldo) no perfil do atleta cadastrado
      const { error: errUser } = await window.supabase
        .from('usuarios')
        .update({
          gols: parseInt(aObj.gols || 0) + golsC,
          partidas: parseInt(aObj.partidas || 0) + jogosC,
          saldo: parseFloat(aObj.saldo || 0) + saldoC
        })
        .eq('id', usuarioId);

      if (errUser) throw new Error('Erro ao atualizar atleta no Supabase: ' + errUser.message);

      // Deleta a conta temporária de convidado
      const { error: errDel } = await window.supabase
        .from('usuarios')
        .delete()
        .eq('id', convidadoId);

      if (errDel) console.warn('[transferirConvidado] Supabase delete convidado notice:', errDel.message);

      sucesso = true;
      mensagemSucesso = `Histórico de ${cObj.nome || convidadoNome} transferido e integrado com sucesso ao perfil de ${aObj.nome || atletaNome}!`;
    } catch (errSupabase) {
      console.warn('[executarTransferenciaConvidado] Erro Supabase direto:', errSupabase);
    }
  }

  // 2. SE NÃO CONCLUIU VIA SUPABASE, TENTA VIA API REST BACKEND
  if (!sucesso) {
    try {
      console.log('[executarTransferenciaConvidado] Tentando via API REST Backend...');
      const token = localStorage.getItem('token');
      if (token) {
        const res = await fetch('/api/usuarios/transferir-convidado', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ convidado_id: convidadoId, usuario_id: usuarioId })
        });

        if (res.ok) {
          const data = await res.json();
          sucesso = true;
          mensagemSucesso = data.message || `Dados transferidos com sucesso!`;
        }
      }
    } catch (errApi) {
      console.warn('[executarTransferenciaConvidado] Erro API REST:', errApi);
    }
  }

  if (sucesso) {
    notifyUser(`🎉 ${mensagemSucesso}`, 'success');

    // Recarrega a lista de atletas na tela do gestor
    if (window.App.syncAthletesList) {
      await window.App.syncAthletesList();
    } else if (window.App.renderManagerAthletesList) {
      window.App.renderManagerAthletesList();
    }

    if (window.App.closeModal) window.App.closeModal();
  } else {
    notifyUser('Erro ao processar a transferência do convidado. Verifique os dados.', 'error');
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = '🔄 Confirmar & Mesclar Dados';
    }
  }
};
