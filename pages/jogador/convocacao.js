// ==========================================================================
// pages/jogador/convocacao.js — Lógica da Tela de Convocação
// ==========================================================================

var Convocacao = {

  _selectedPeladaId: null,

  init: function () {
    this.populateGroupSelector();
    this.bindEvents();
  },

  // --- Popula o select de grupos (sincronizado com backend real) -----------
  populateGroupSelector: async function () {
    var selectGroup = document.getElementById('select-conv-pelada');
    if (!selectGroup) return;

    selectGroup.innerHTML = '<option value="">▼ Carregando grupos...</option>';

    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Sincroniza grupos com o backend real
        const resGroups = await fetch('/api/peladas/grupos', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resGroups.ok) {
          const groupsData = await resGroups.json();
          Api.saveGroups(groupsData);
        }
      }
    } catch (e) {
      console.warn('[Convocacao] Erro ao sincronizar grupos do backend:', e);
    }

    var groups = Api.getGroups();
    selectGroup.innerHTML = '<option value="">▼ Selecione o grupo</option>';

    groups.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.nome;
      selectGroup.appendChild(opt);
    });

    // Se houver grupo selecionado ativo na sessão, seleciona por padrão
    var currentGroup = Auth.currentGroup;
    if (currentGroup) {
      selectGroup.value = currentGroup.id;
      this.handleGroupChange(currentGroup.id);
    }
  },

  // --- Trata a mudança de grupo e popula as datas correspondentes --------
  handleGroupChange: async function (groupId) {
    var selectData = document.getElementById('select-conv-data');
    if (!selectData) return;

    if (!groupId) {
      selectData.innerHTML = '<option value="">Selecione um grupo primeiro</option>';
      selectData.disabled = true;
      selectData.style.background = 'var(--background)';

      this._selectedPeladaId = null;
      this.renderConfirmedList(null);
      this.updateMyStatus();
      return;
    }

    // Loader temporário
    selectData.innerHTML = '<option value="">Carregando datas...</option>';
    selectData.disabled = true;

    try {
      // Buscar peladas reais do grupo
      const peladas = await Api.listarDatasDoGrupo(groupId);

      if (!Array.isArray(peladas) || peladas.length === 0) {
        selectData.innerHTML = '<option value="">Nenhuma data cadastrada</option>';
        selectData.disabled = true;
        selectData.style.background = 'var(--background)';

        this._selectedPeladaId = null;
        this.renderConfirmedList(null);
        this.updateMyStatus();
        return;
      }

      // Priorizar peladas ativas/agendadas (não finalizadas), ou listar todas se todas estiverem finalizadas
      var activePeladas = peladas.filter(function (p) {
        return p.status !== 'finalizada';
      });
      var listToRender = activePeladas.length > 0 ? activePeladas : peladas;

      // Sincronizar localmente as peladas do grupo no localStorage para o resto do app
      const peladasLocais = Api.getPeladas().filter(p => String(p.grupo_id) !== String(groupId));
      listToRender.forEach(p => {
        peladasLocais.push({
          id: p.id,
          grupo_id: parseInt(groupId),
          data: p.data,
          horario: p.horario,
          local: p.local,
          status: p.status,
          max_jogadores: p.max_jogadores,
          valor_convocacao: p.valor_convocacao,
          chave_pix: p.chave_pix,
          chave_pix_nome: p.chave_pix_nome,
          criterio_empate: p.criterio_empate,
          vitorias_para_sair: p.vitorias_para_sair,
          jogadores_por_time: p.jogadores_por_time,
          quantidade_times: p.quantidade_times,
          regra_saida: p.regra_saida
        });
      });
      Api.savePeladas(peladasLocais);

      // Habilitar select e popular datas
      selectData.disabled = false;
      selectData.style.background = 'var(--card-background)';
      selectData.innerHTML = '';

      listToRender.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        var dataFmt = window.Utils ? window.Utils.formatDate(p.data) : p.data;
        opt.textContent = dataFmt + (p.horario ? ' · ' + p.horario : '') + (p.local ? ' (' + p.local + ')' : '');
        selectData.appendChild(opt);
      });

      // Pré-selecionar a primeira data da lista
      selectData.value = listToRender[0].id;
      this._selectedPeladaId = listToRender[0].id;
      this.renderConfirmedList(listToRender[0].id);
      this.updateMyStatus();
      this.updatePixInfo(listToRender[0].id);
    } catch (err) {
      console.error('[Convocacao] Erro ao carregar datas do grupo:', err);
      selectData.innerHTML = '<option value="">Erro ao carregar datas</option>';
      selectData.disabled = true;
    }
  },

  // --- Atualiza as informações do Pix com base na pelada selecionada --------
  updatePixInfo: async function (peladaId) {
    const keyEl = document.getElementById('pix-display-key');
    const benEl = document.getElementById('pix-display-beneficiario');
    if (!keyEl || !benEl) return;

    if (!peladaId) {
      keyEl.textContent = '--';
      benEl.textContent = '--';
      return;
    }

    let pelada = Api.getPelada(peladaId);
    if (!pelada || (!pelada.chave_pix && !pelada.chave_pix_nome)) {
      const selectGroup = document.getElementById('select-conv-pelada');
      const groupId = selectGroup ? selectGroup.value : null;
      if (groupId) {
        try {
          const peladas = await Api.listarDatasDoGrupo(groupId);
          const encontrada = peladas.find(p => String(p.id) === String(peladaId));
          if (encontrada) pelada = encontrada;
        } catch (e) { }
      }
    }

    if (pelada && (pelada.chave_pix || pelada.chave_pix_nome)) {
      keyEl.textContent = pelada.chave_pix || 'Não cadastrada pelo gestor';
      benEl.textContent = pelada.chave_pix_nome || 'Gestor da Pelada';
    } else {
      keyEl.textContent = 'Não cadastrada pelo gestor';
      benEl.textContent = 'Gestor da Pelada';
    }
  },

  // --- Renderiza a lista de confirmados puxada em tempo real ----------------
  renderConfirmedList: async function (peladaId) {
    var listEl = document.getElementById('confirmed-list');
    var counterEl = document.getElementById('conv-counter');
    if (!listEl) return;

    if (!peladaId) {
      listEl.innerHTML = '<div class="empty-state" style="padding: 32px;"><span style="font-size: 32px;">📋</span><p class="text-inter" style="font-size: 14px;">Selecione uma pelada e data acima para ver a lista.</p></div>';
      if (counterEl) counterEl.textContent = '0 / 0';
      return;
    }

    try {
      listEl.innerHTML = '<div style="padding: 32px; text-align: center;" class="text-inter">Carregando convocados...</div>';

      const convocados = await Api.listarConvocados(peladaId);

      // Obter max_jogadores da pelada atual local
      var pelada = Api.getPelada(peladaId);
      var max = pelada ? (pelada.max_jogadores || 20) : 20;

      // Filtrar confirmados
      var confirmed = convocados.filter(function (c) {
        return c.status === 'confirmado';
      });

      if (counterEl) counterEl.textContent = confirmed.length + ' / ' + max;

      if (confirmed.length === 0) {
        listEl.innerHTML = '<div class="empty-state" style="padding: 32px;"><span style="font-size: 32px;">👥</span><p class="text-inter" style="font-size: 14px;">Nenhum jogador confirmado ainda.</p></div>';
        return;
      }

      var html = '';
      confirmed.forEach(function (c) {
        var nome = c.apelido || c.nome || 'Desconhecido';
        var stars = Utils.starsHTML(c.autoavaliacao || 0, 5);
        var isMe = Auth.currentUser && String(c.id) === String(Auth.currentUser.id);

        var avatarHTML = '';
        var hasPhoto = c.foto || c.photo;
        if (hasPhoto) {
          avatarHTML = '<img src="' + hasPhoto + '" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2.5px solid var(--secondary); box-shadow: 0 2px 8px rgba(0,0,0,0.15);">';
        } else {
          avatarHTML = '<div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: #FFF; font-weight: 800; font-size: 18px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">' +
            nome.charAt(0).toUpperCase() +
            '</div>';
        }

        html += '<div style="display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-bottom: 1px solid var(--border-color);">' +
          avatarHTML +
          '<div style="flex: 1;">' +
          '<p class="text-inter" style="font-size: 15px; font-weight: 700; color: var(--text-heading);">' +
          nome + (isMe ? ' <span style="font-size: 11px; color: var(--secondary); background: rgba(0,230,118,0.1); padding: 2px 6px; border-radius: 10px;">Você</span>' : '') +
          (c.goleiro ? ' <span style="font-size: 11px; color: var(--accent); background: rgba(255,109,0,0.1); padding: 2px 6px; border-radius: 10px;">🧤</span>' : '') +
          '</p>' +
          '<p class="text-inter" style="font-size: 12px; color: var(--warning);">' + stars + '</p>' +
          '</div>' +
          '<span class="badge-status confirmado">✅</span>' +
          '</div>';
      });

      listEl.innerHTML = html;

      // Sincronizar localmente no localStorage convocations
      const localConvocations = Api.getConvocations().filter(c => String(c.pelada_id) !== String(peladaId));
      convocados.forEach(c => {
        localConvocations.push({
          id: 'c_' + c.id + '_' + peladaId,
          pelada_id: parseInt(peladaId),
          player_id: c.id,
          status: c.status,
          forma_pagamento: c.forma_pagamento,
          posicao_fila: c.posicao_fila
        });
      });
      Api.saveConvocations(localConvocations);

    } catch (err) {
      console.error('[Convocacao] Erro ao buscar confirmados:', err);
      listEl.innerHTML = '<div class="empty-state" style="padding: 32px;"><p class="text-inter" style="color:var(--danger)">Erro ao carregar convocados.</p></div>';
    }
  },

  // --- Atualiza o status e saldo do jogador ------------------------------
  updateMyStatus: async function () {
    if (window.Auth && window.Auth.refreshCurrentUser) {
      await window.Auth.refreshCurrentUser();
    }
    var user = Auth.currentUser;
    var statusEl = document.getElementById('my-status-badge');
    var balanceEl = document.getElementById('my-balance-conv');
    var btnAdd = document.getElementById('btn-conv-add');
    var btnRemove = document.getElementById('btn-conv-remove');
    var waitlistAlert = document.getElementById('waitlist-alert');
    var waitlistAlertText = document.getElementById('waitlist-alert-text');

    if (balanceEl && user) {
      var saldo = parseFloat(user.saldo || 0);
      balanceEl.textContent = Utils.formatCurrency(saldo);
      balanceEl.style.color = saldo < 0 ? 'var(--danger)' : 'var(--primary)';
    }

    let isConfirmed = false;
    let isWaiting = false;
    let hasSelected = false;
    let posicaoFila = 1;

    if (statusEl && user && Convocacao._selectedPeladaId) {
      hasSelected = true;
      var convocations = Api.getConvocations();
      var myConv = convocations.find(function (c) {
        return String(c.pelada_id) === String(Convocacao._selectedPeladaId) && String(c.player_id) === String(user.id);
      });

      if (myConv && myConv.status === 'confirmado') {
        statusEl.className = 'badge-status confirmado';
        statusEl.textContent = '✅ Confirmado';
        isConfirmed = true;
      } else if (myConv && myConv.status === 'espera') {
        statusEl.className = 'badge-status pendente';
        statusEl.textContent = '⏳ Fila de Espera';
        isWaiting = true;
        posicaoFila = myConv.posicao_fila || 1;
      } else if (myConv && myConv.status === 'cortado') {
        statusEl.className = 'badge-status cortado';
        statusEl.textContent = '❌ Cortado';
      } else {
        statusEl.className = 'badge-status pendente';
        statusEl.textContent = '⏳ Pendente';
      }
    } else if (statusEl) {
      statusEl.className = 'badge-status pendente';
      statusEl.textContent = '⏳ Selecione a pelada';
    }

    // Exibe ou oculta o alerta de fila de espera
    if (waitlistAlert && waitlistAlertText) {
      if (isWaiting && Convocacao._selectedPeladaId) {
        var pelada = Api.getPelada(Convocacao._selectedPeladaId);
        var limite = pelada ? (pelada.limite_atletas || pelada.max_jogadores || 20) : 20;
        
        waitlistAlert.style.display = 'flex';
        waitlistAlertText.innerHTML = `Lista cheia (${limite} vagas). Você entrou na <b>fila de espera (posição #${posicaoFila})</b>.`;
      } else {
        waitlistAlert.style.display = 'none';
      }
    }

    // Habilita/Desabilita os botões de ação dinamicamente
    if (btnAdd) {
      if (!hasSelected || isConfirmed || isWaiting) {
        btnAdd.disabled = true;
        btnAdd.style.opacity = "0.5";
        btnAdd.style.cursor = "not-allowed";
      } else {
        btnAdd.disabled = false;
        btnAdd.style.opacity = "1";
        btnAdd.style.cursor = "pointer";
      }
    }

    if (btnRemove) {
      if (!hasSelected || (!isConfirmed && !isWaiting)) {
        btnRemove.disabled = true;
        btnRemove.style.opacity = "0.5";
        btnRemove.style.cursor = "not-allowed";
      } else {
        btnRemove.disabled = false;
        btnRemove.style.opacity = "1";
        btnRemove.style.cursor = "pointer";
      }
    }
  },

  // --- Bind de eventos ---------------------------------------------------
  bindEvents: function () {
    var selectGroup = document.getElementById('select-conv-pelada');
    var selectData = document.getElementById('select-conv-data');
    var btnAdd = document.getElementById('btn-conv-add');
    var btnRemove = document.getElementById('btn-conv-remove');
    var btnCopyPix = document.getElementById('btn-copy-pix-key');
    var btnUploadPix = document.getElementById('btn-upload-pix-receipt');

    if (selectGroup) {
      selectGroup.addEventListener('change', function (e) {
        Convocacao.handleGroupChange(e.target.value);
      });
    }

    if (selectData) {
      selectData.addEventListener('change', function (e) {
        Convocacao._selectedPeladaId = e.target.value;
        Convocacao.renderConfirmedList(e.target.value);
        Convocacao.updateMyStatus();
        Convocacao.updatePixInfo(e.target.value);
      });
    }

    if (btnCopyPix) {
      btnCopyPix.onclick = function () {
        const keyText = document.getElementById('pix-display-key')?.textContent;
        if (!keyText || keyText.includes('Não cadastrada')) {
          Utils.toast('Nenhuma chave Pix válida disponível.', 'warning');
          return;
        }
        navigator.clipboard.writeText(keyText).then(() => {
          Utils.toast('Chave Pix copiada com sucesso! 📋', 'success');
        }).catch(() => {
          Utils.toast('Não foi possível copiar automaticamente.', 'warning');
        });
      };
    }

    if (btnUploadPix) {
      btnUploadPix.onclick = async function () {
        const fileInput = document.getElementById('pix-receipt-file-input');
        const file = fileInput ? fileInput.files[0] : null;

        if (!file) {
          Utils.toast('Selecione uma imagem ou PDF do comprovante Pix.', 'warning');
          return;
        }

        const pelada = Api.getPelada(Convocacao._selectedPeladaId);
        const expectedBen = pelada ? (pelada.chave_pix_nome || '') : '';
        const expectedVal = pelada ? parseFloat(pelada.valor_convocacao || 0) : 0;
        const expectedKey = pelada ? (pelada.chave_pix || '') : '';

        try {
          btnUploadPix.disabled = true;
          btnUploadPix.textContent = '⏳ Analisando comprovante (OCR)...';

          const parsedData = await window.PixOCR.processReceiptFile(file, expectedBen, expectedVal, expectedKey);

          Utils.toast('Comprovante lido! Enviando para o servidor...', 'info');

          const res = await Api.enviarComprovantePix(
            Convocacao._selectedPeladaId,
            parsedData.e2e_id,
            parsedData.valor || expectedVal || 20.0,
            parsedData.beneficiario || expectedBen,
            null
          );

          if (res.error) {
            Utils.toast(res.error, 'error');
            return;
          }

          Utils.toast('✅ Pix validado com sucesso! Saldo creditado.', 'success');

          // Atualiza saldo do usuário logado localmente
          if (Auth.currentUser) {
            Auth.currentUser.saldo = res.novoSaldo;
            localStorage.setItem('user', JSON.stringify(Auth.currentUser));
          }

          Convocacao.updateMyStatus();
          if (fileInput) fileInput.value = '';

        } catch (err) {
          console.error('[PixOCR]', err);
          Utils.toast(err.message || 'Erro ao processar comprovante Pix.', 'error');
        } finally {
          btnUploadPix.disabled = false;
          btnUploadPix.textContent = '🔍 Validar & Enviar Comprovante';
        }
      };
    }

    if (btnAdd) {
      btnAdd.onclick = async function () {
        if (!Convocacao._selectedPeladaId) {
          Utils.toast('Selecione uma pelada e data primeiro.', 'warning');
          return;
        }

        // Buscar a pelada do backend para garantir que valor_convocacao está atualizado
        let pelada = Api.getPelada(Convocacao._selectedPeladaId);

        // Se não tem valor_convocacao no cache, busca da lista mais recente do grupo
        if (!pelada || pelada.valor_convocacao == null) {
          try {
            const selectGroup = document.getElementById('select-conv-pelada');
            const grupoId = selectGroup ? selectGroup.value : null;
            if (grupoId) {
              const peladas = await Api.listarDatasDoGrupo(grupoId);
              const encontrada = peladas.find(p => String(p.id) === String(Convocacao._selectedPeladaId));
              if (encontrada) pelada = encontrada;
            }
          } catch (e) {
            console.warn('[Convocacao] Erro ao buscar pelada atualizada:', e);
          }
        }

        Router.openModal('pagamento', pelada || {});
      };
    }

    if (btnRemove) {
      btnRemove.onclick = function () {
        if (!Convocacao._selectedPeladaId) {
          Utils.toast('Selecione uma pelada e data primeiro.', 'warning');
          return;
        }
        var pelada = Api.getPelada(Convocacao._selectedPeladaId);
        Router.openModal('remocao', pelada);
      };
    }
  }
};

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initConvocacao = function () {
  Convocacao.init();
};
