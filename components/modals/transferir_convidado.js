// ==========================================================================
// Modal: Transferir Convidado para Atleta Cadastrado (transferir_convidado.js)
// ==========================================================================

window.App = window.App || {};

window.App.initModalTransferir_convidado = async function (data = {}) {
  console.log('[transferir_convidado] Inicializando modal...', data);

  const selectConvidado = document.getElementById('select-convidado-origem');
  const selectAtleta = document.getElementById('select-atleta-destino');
  const btnConfirm = document.getElementById('btn-confirmar-transferencia');

  if (!selectConvidado || !selectAtleta || !btnConfirm) {
    console.error('[transferir_convidado] Elementos do modal não encontrados.');
    return;
  }

  const targetAthleteId = data.athleteId || data.usuarioId || null;

  // 1. Carregar a lista mais recente de atletas do banco de dados (Supabase / Backend)
  let players = [];

  if (window.supabase) {
    try {
      const { data: dbPlayers } = await window.supabase.from('usuarios').select('*');
      if (dbPlayers && dbPlayers.length > 0) players = dbPlayers;
    } catch (e) {
      console.warn('[transferir_convidado] Erro ao buscar no Supabase:', e);
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

  // Função auxiliar para identificar se é convidado
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

  // Preencher Select Convidado
  selectConvidado.innerHTML = '<option value="">-- Selecione o Convidado --</option>';
  const listaParaConvidados = convidados.length > 0 ? convidados : players;
  listaParaConvidados.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.nome || c.apelido || 'Sem Nome'} (${c.gols || 0} gols | ${c.partidas || c.jogos || 0} jogos)`;
    selectConvidado.appendChild(opt);
  });

  // Preencher Select Atleta Cadastrado
  selectAtleta.innerHTML = '<option value="">-- Selecione o Atleta --</option>';
  atletasCadastrados.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.nome || a.apelido || 'Sem Nome'} ${a.email ? '(' + a.email + ')' : ''}`;
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

  // Submissão do formulário de transferência
  btnConfirm.onclick = async function (e) {
    if (e) e.preventDefault();

    const convidadoId = selectConvidado.value;
    const usuarioId = selectAtleta.value;

    if (!convidadoId) {
      if (window.App && window.App.showToast) window.App.showToast('Selecione o convidado temporário de origem.', 'warning');
      else alert('Selecione o convidado temporário de origem.');
      return;
    }
    if (!usuarioId) {
      if (window.App && window.App.showToast) window.App.showToast('Selecione o atleta cadastrado de destino.', 'warning');
      else alert('Selecione o atleta cadastrado de destino.');
      return;
    }
    if (String(convidadoId) === String(usuarioId)) {
      if (window.App && window.App.showToast) window.App.showToast('O convidado e o atleta cadastrado devem ser pessoas diferentes.', 'error');
      else alert('O convidado e o atleta cadastrado devem ser pessoas diferentes.');
      return;
    }

    const convidadoSel = players.find(c => String(c.id) === String(convidadoId));
    const atletaSel = players.find(a => String(a.id) === String(usuarioId));

    const convidadoNome = convidadoSel ? (convidadoSel.nome || convidadoSel.apelido) : 'Convidado';
    const atletaNome = atletaSel ? (atletaSel.nome || atletaSel.apelido) : 'Atleta';

    if (!confirm(`Tem certeza que deseja transferir todo o histórico e números de "${convidadoNome}" para o atleta cadastrado "${atletaNome}"?\n\nEsta ação integrará os gols, jogos e saldo, e excluirá o perfil de convidado.`)) {
      return;
    }

    btnConfirm.disabled = true;
    btnConfirm.textContent = '🔄 Transferindo dados...';

    let sucesso = false;
    let mensagemSucesso = '';

    // 1. Tenta via Backend REST Endpoint (/api/usuarios/transferir-convidado)
    try {
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
          mensagemSucesso = data.message || `Dados de ${convidadoNome} transferidos com sucesso para ${atletaNome}!`;
        }
      }
    } catch (err) {
      console.warn('[transferirConvidado] Fallback para Supabase direto devido a erro na API:', err);
    }

    // 2. Fallback direto via Supabase se o endpoint da API não respondeu com sucesso
    if (!sucesso && window.supabase) {
      try {
        const golsC = parseInt(convidadoSel?.gols || 0);
        const jogosC = parseInt(convidadoSel?.partidas || convidadoSel?.jogos || 0);
        const saldoC = parseFloat(convidadoSel?.saldo || 0);

        // Transfere convocações
        await window.supabase
          .from('convocacoes')
          .update({ usuario_id: usuarioId })
          .eq('usuario_id', convidadoId);

        // Soma gols, partidas e saldo no atleta cadastrado
        await window.supabase
          .from('usuarios')
          .update({
            gols: parseInt(atletaSel?.gols || 0) + golsC,
            partidas: parseInt(atletaSel?.partidas || 0) + jogosC,
            saldo: parseFloat(atletaSel?.saldo || 0) + saldoC
          })
          .eq('id', usuarioId);

        // Exclui a conta do convidado temporário
        await window.supabase
          .from('usuarios')
          .delete()
          .eq('id', convidadoId);

        sucesso = true;
        mensagemSucesso = `Histórico de ${convidadoNome} mesclado com sucesso no perfil de ${atletaNome}!`;
      } catch (errDb) {
        console.error('[transferirConvidado] Erro ao transferir via Supabase:', errDb);
      }
    }

    if (sucesso) {
      if (window.App && window.App.showToast) window.App.showToast(`🎉 ${mensagemSucesso}`, 'success');
      else alert(mensagemSucesso);

      // Recarrega a lista de atletas na interface
      if (window.App.syncAthletesList) {
        await window.App.syncAthletesList();
      } else if (window.App.renderManagerAthletesList) {
        window.App.renderManagerAthletesList();
      }

      window.App.closeModal();
    } else {
      if (window.App && window.App.showToast) window.App.showToast('Erro ao processar a transferência do convidado.', 'error');
      else alert('Erro ao processar a transferência do convidado.');
      btnConfirm.disabled = false;
      btnConfirm.textContent = '🔄 Confirmar & Mesclar Dados';
    }
  };
};
