// ==========================================================================
// Modal: Transferir Convidado para Atleta Cadastrado (transferir_convidado.js)
// ==========================================================================

window.App = window.App || {};

window.App.initModalTransferir_convidado = async function (data = {}) {
  const selectConvidado = document.getElementById('select-convidado-origem');
  const selectAtleta = document.getElementById('select-atleta-destino');
  const btnConfirm = document.getElementById('btn-confirmar-transferencia');

  if (!selectConvidado || !selectAtleta) return;

  const targetAthleteId = data.athleteId || data.usuarioId || null;

  // Carregar lista de atletas (do localStorage ou Supabase / Backend)
  let players = [];
  try {
    players = JSON.parse(localStorage.getItem('players') || '[]');
  } catch (e) { }

  if (players.length === 0 && window.supabase) {
    try {
      const { data: dbPlayers } = await window.supabase.from('usuarios').select('*');
      if (dbPlayers) players = dbPlayers;
    } catch (e) { }
  }

  // Filtrar Convidados (tipo === 'convidado' ou e-mail contendo convidado)
  const convidados = players.filter(p =>
    p.tipo === 'convidado' ||
    (p.email && (p.email.includes('@convidado.com') || p.email.startsWith('convidado_'))) ||
    p.is_convidado === true
  );

  // Filtrar Atletas Cadastrados (tipo !== 'convidado')
  const atletasCadastrados = players.filter(p =>
    p.tipo !== 'convidado' &&
    (!p.email || !p.email.includes('@convidado.com')) &&
    !p.is_convidado
  );

  // Preencher Select Convidado
  selectConvidado.innerHTML = '<option value="">-- Selecione o Convidado --</option>';
  if (convidados.length === 0) {
    selectConvidado.innerHTML = '<option value="">Nenhum convidado temporário encontrado</option>';
  } else {
    convidados.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.nome || c.apelido} (${c.gols || 0} gols | ${c.partidas || c.jogos || 0} jogos)`;
      selectConvidado.appendChild(opt);
    });
  }

  // Preencher Select Atleta Cadastrado
  selectAtleta.innerHTML = '<option value="">-- Selecione o Atleta --</option>';
  atletasCadastrados.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.nome || a.apelido} ${a.email ? '(' + a.email + ')' : ''}`;
    if (targetAthleteId && String(a.id) === String(targetAthleteId)) {
      opt.selected = true;
    }
    selectAtleta.appendChild(opt);
  });

  // Atualiza preview ao selecionar um convidado
  selectConvidado.onchange = function () {
    const cid = selectConvidado.value;
    const convidadoSel = convidados.find(c => String(c.id) === String(cid));

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
  if (btnConfirm) {
    btnConfirm.onclick = async function () {
      const convidadoId = selectConvidado.value;
      const usuarioId = selectAtleta.value;

      if (!convidadoId) {
        window.App.showToast('Selecione o convidado temporário de origem.', 'warning');
        return;
      }
      if (!usuarioId) {
        window.App.showToast('Selecione o atleta cadastrado de destino.', 'warning');
        return;
      }
      if (String(convidadoId) === String(usuarioId)) {
        window.App.showToast('O convidado e o atleta cadastrado devem ser pessoas diferentes.', 'error');
        return;
      }

      const convidadoSel = convidados.find(c => String(c.id) === String(convidadoId));
      const atletaSel = atletasCadastrados.find(a => String(a.id) === String(usuarioId));

      const convidadoNome = convidadoSel ? convidadoSel.nome : 'Convidado';
      const atletaNome = atletaSel ? atletaSel.nome : 'Atleta';

      if (!confirm(`Tem certeza que deseja transferir todo o histórico e números de "${convidadoNome}" para o atleta cadastrado "${atletaNome}"?\n\nEsta ação integrará os gols, jogos e saldo, e excluirá o perfil de convidado.`)) {
        return;
      }

      try {
        btnConfirm.disabled = true;
        btnConfirm.textContent = '🔄 Transferindo dados...';

        const token = localStorage.getItem('token');
        const res = await fetch('/api/usuarios/transferir-convidado', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            convidado_id: convidadoId,
            usuario_id: usuarioId
          })
        });

        const data = await res.json();

        if (!res.ok) {
          window.App.showToast(data.error || 'Erro ao transferir convidado.', 'error');
          btnConfirm.disabled = false;
          btnConfirm.textContent = '🔄 Confirmar & Mesclar Dados';
          return;
        }

        window.App.showToast(`🎉 ${data.message || 'Dados transferidos com sucesso!'}`, 'success');

        // Atualiza a lista de atletas na tela do gestor
        if (window.App.syncAthletesList) {
          await window.App.syncAthletesList();
        } else if (window.App.renderManagerAthletesList) {
          window.App.renderManagerAthletesList();
        }

        window.App.closeModal();
      } catch (err) {
        console.error('[transferirConvidado] Erro ao submeter:', err);
        window.App.showToast('Erro de conexão ao transferir convidado.', 'error');
        btnConfirm.disabled = false;
        btnConfirm.textContent = '🔄 Confirmar & Mesclar Dados';
      }
    };
  }
};
