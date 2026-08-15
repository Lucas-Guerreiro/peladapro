// ==========================================================================
// pages/jogador/convocacao.js — Lógica da Tela de Convocação
// ==========================================================================

var Convocacao = {

  _selectedPeladaId: null,

  init: function () {
    this.populateGroupSelector();
    this.bindEvents();

    if (window.AdSenseManager) {
      window.AdSenseManager.renderAdContainer('adsense-convocacao-banner');
    }
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

    // Se houver grupo selecionado ativo na sessão ou no App, seleciona por padrão
    var currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    if (!currentGroup && groups.length > 0) {
      currentGroup = groups[0];
      if (window.Auth) window.Auth.currentGroup = currentGroup;
      window.App.currentGroup = currentGroup;
    }

    if (currentGroup && currentGroup.id) {
      selectGroup.value = currentGroup.id;
      this.handleGroupChange(currentGroup.id);
    } else if (groups.length > 0) {
      selectGroup.value = groups[0].id;
      this.handleGroupChange(groups[0].id);
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
      this._lastConvocados = convocados;

      // Obter max_jogadores da pelada atual local
      var pelada = Api.getPelada(peladaId);
      var max = pelada ? (pelada.max_jogadores || 20) : 20;

      // Filtrar confirmados
      var confirmed = convocados.filter(function (c) {
        return c.status === 'confirmado';
      });

      if (counterEl) {
        counterEl.textContent = confirmed.length + ' / ' + max;

        // Aplica o tema do time do coração do usuário logado (ou tema esportivo verde/dourado)
        const user = Auth.currentUser || (window.Auth && window.Auth.currentUser);
        const teamTheme = (user && user.time_coracao && window.App && window.App.getTeamThemeGlobal)
          ? window.App.getTeamThemeGlobal(user.time_coracao)
          : null;

        if (teamTheme) {
          counterEl.style.background = teamTheme.gradient || teamTheme.badgeBg || '#0F172A';
          counterEl.style.color = teamTheme.accent || teamTheme.badgeText || '#F5D270';
          counterEl.style.border = '1px solid ' + (teamTheme.border || 'rgba(245,210,112,0.4)');
          counterEl.style.boxShadow = '0 2px 8px ' + (teamTheme.borderGlow || 'rgba(0,0,0,0.2)');
        } else {
          counterEl.style.background = 'linear-gradient(135deg, #059669, #047857)';
          counterEl.style.color = '#FFFFFF';
          counterEl.style.border = '1px solid #10B981';
          counterEl.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.3)';
        }
      }

      if (confirmed.length === 0) {
        listEl.innerHTML = '<div class="empty-state" style="padding: 32px;"><span style="font-size: 32px;">👥</span><p class="text-inter" style="font-size: 14px;">Nenhum jogador confirmado ainda.</p></div>';
        return;
      }

      var html = '';
      confirmed.forEach(function (c) {
        var nome = c.apelido || c.nome || 'Desconhecido';
        var isMe = Auth.currentUser && String(c.id) === String(Auth.currentUser.id);

        var avatarHTML = '';
        var hasPhoto = c.foto || c.photo;
        if (hasPhoto) {
          avatarHTML = '<img src="' + hasPhoto + '" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2.5px solid var(--secondary); box-shadow: 0 2px 8px rgba(0,0,0,0.15);">';
        } else {
          avatarHTML = '<div style="width: 56px; height: 56px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: #FFF; font-weight: 800; font-size: 22px; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">' +
            nome.charAt(0).toUpperCase() +
            '</div>';
        }

        html += '<div onclick="Convocacao.openPlayerCardModal(' + c.id + ')" title="Clique para ver o Card do Atleta" style="display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background=\'rgba(29,158,117,0.06)\'" onmouseout="this.style.background=\'transparent\'">' +
          avatarHTML +
          '<div style="flex: 1;">' +
          '<p class="text-inter" style="font-size: 15px; font-weight: 700; color: var(--text-heading); margin: 0; display: flex; align-items: center; gap: 6px;">' +
          nome + (isMe ? ' <span style="font-size: 11px; color: var(--secondary); background: rgba(0,230,118,0.1); padding: 2px 6px; border-radius: 10px;">Você</span>' : '') +
          (c.goleiro ? ' <span style="font-size: 11px; color: var(--accent); background: rgba(255,109,0,0.1); padding: 2px 6px; border-radius: 10px;">🧤</span>' : '') +
          '</p>' +
          '<p style="font-size: 11px; color: #1D9E75; margin: 2px 0 0 0; font-weight: 600; display: flex; align-items: center; gap: 3px;">🎴 Ver Card de Atleta</p>' +
          '</div>' +
          '<span class="badge-status confirmado">✅</span>' +
          '</div>';
      });

      listEl.innerHTML = html;

      // Renderizar Lista de Espera (Fila)
      var waitlist = convocados.filter(function (c) {
        return c.status === 'espera' || c.status === 'fila_espera';
      }).sort(function (a, b) {
        return (a.posicao_fila || 99) - (b.posicao_fila || 99);
      });

      var waitlistContainer = document.getElementById('waitlist-card-container');
      var waitlistCounter = document.getElementById('waitlist-counter');
      var waitlistList = document.getElementById('waitlist-players-list');

      if (waitlistContainer && waitlistList) {
        if (waitlist.length > 0) {
          waitlistContainer.style.display = 'block';
          if (waitlistCounter) waitlistCounter.textContent = waitlist.length + (waitlist.length === 1 ? ' na fila' : ' na fila');

          var waitlistHtml = '';
          waitlist.forEach(function (c, idx) {
            var nome = c.apelido || c.nome || 'Desconhecido';
            var isMe = Auth.currentUser && String(c.id) === String(Auth.currentUser.id);
            var posFila = c.posicao_fila || (idx + 1);

            var avatarHTML = '';
            var hasPhoto = c.foto || c.photo;
            if (hasPhoto) {
              avatarHTML = '<img src="' + hasPhoto + '" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid #F59E0B;">';
            } else {
              avatarHTML = '<div style="width: 44px; height: 44px; border-radius: 50%; background: #F59E0B; display: flex; align-items: center; justify-content: center; color: #FFF; font-weight: 800; font-size: 18px; flex-shrink: 0;">' +
                nome.charAt(0).toUpperCase() +
                '</div>';
            }

            waitlistHtml += '<div onclick="Convocacao.openPlayerCardModal(' + c.id + ')" title="Clique para ver o Card do Atleta" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid rgba(245, 158, 11, 0.15); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background=\'rgba(245, 158, 11, 0.06)\'" onmouseout="this.style.background=\'transparent\'">' +
              '<span style="font-weight: 800; font-size: 13px; color: #B45309; min-width: 28px;">#' + posFila + '</span>' +
              avatarHTML +
              '<div style="flex: 1; min-width: 0;">' +
              '<p class="text-inter" style="font-size: 14px; font-weight: 700; color: var(--text-heading); margin: 0; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' +
              nome + (isMe ? ' <span style="font-size: 10px; color: #B45309; background: #FEF3C7; padding: 2px 6px; border-radius: 8px;">Você</span>' : '') +
              (c.goleiro ? ' 🧤' : '') +
              '</p>' +
              '<p style="font-size: 11px; color: #B45309; margin: 2px 0 0 0; font-weight: 600;">⏳ Fila de Espera</p>' +
              '</div>' +
              '</div>';
          });
          waitlistList.innerHTML = waitlistHtml;
        } else {
          waitlistContainer.style.display = 'none';
        }
      }

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

    const btnExportList = document.getElementById('btn-export-conv-list');
    if (btnExportList) {
      btnExportList.onclick = function () {
        const peladaId = Convocacao._selectedPeladaId;
        if (!peladaId) {
          Utils.toast('Selecione uma pelada e data para exportar a lista.', 'warning');
          return;
        }

        const pelada = Api.getPelada(peladaId);
        const dataStr = pelada && pelada.data ? (window.Utils ? window.Utils.formatDate(pelada.data.split('T')[0]) : pelada.data) : 'Data';
        const horario = pelada && pelada.horario ? ' às ' + pelada.horario : '';

        const confirmed = (Convocacao._lastConvocados || []).filter(c => c.status === 'confirmado');
        if (confirmed.length === 0) {
          Utils.toast('Nenhum atleta confirmado nesta data para exportar.', 'warning');
          return;
        }

        let txt = `⚽ *LISTA DE CONFIRMADOS — ${dataStr}${horario}*\n\n`;
        confirmed.forEach((c, idx) => {
          const pos = c.goleiro ? '🧤' : '🏃';
          const nome = c.apelido || c.nome || 'Atleta';
          txt += `${idx + 1}. ${pos} ${nome}\n`;
        });
        txt += `\nTotal: ${confirmed.length} confirmados ✅`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(() => {
            Utils.toast('Lista de confirmados da data copiada para a área de transferência! 📋', 'success');
          }).catch(() => {
            Utils.toast('Erro ao copiar lista.', 'warning');
          });
        } else {
          Utils.toast('Navegador não possui suporte a cópia automática.', 'warning');
        }
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

        // Checagem de capacidade: verificar se a lista oficial de confirmados já lotou
        try {
          const convocados = await Api.listarConvocados(Convocacao._selectedPeladaId);
          const confirmados = (convocados || []).filter(c => c.status === 'confirmado');
          const maxVagas = pelada ? (pelada.limite_atletas || pelada.max_jogadores || 20) : 20;

          if (confirmados.length >= maxVagas) {
            const confirmouFila = await new Promise((resolve) => {
              const modalRoot = document.getElementById('modal-container-root') || document.body;
              const dialog = document.createElement('div');
              dialog.id = 'waitlist-confirm-dialog';
              dialog.style.cssText = 'position: fixed; inset: 0; background: rgba(15,23,42,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 999999; padding: 20px;';
              dialog.innerHTML = `
                <div style="background: #1E293B; border: 1.5px solid #F59E0B; border-radius: 20px; padding: 24px; max-width: 420px; width: 100%; text-align: center; color: #FFFFFF; box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 20px rgba(245,158,11,0.2);">
                  <div style="font-size: 44px; margin-bottom: 12px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">⏳</div>
                  <h3 style="color: #F59E0B; margin: 0 0 10px; font-size: 20px; font-weight: 800;">Lista Oficial Cheia (${confirmados.length}/${maxVagas})</h3>
                  <p style="font-size: 14px; color: #E2E8F0; line-height: 1.5; margin: 0 0 22px;">
                    A lista de convidados para esta data já atingiu a quantidade máxima de vagas.
                    <br><br>
                    Se você continuar, seu nome será colocado na <b>FILA DE ESPERA</b> e o gestor receberá uma notificação!
                  </p>
                  <div style="display: flex; gap: 12px;">
                    <button id="btn-cancel-waitlist" style="flex: 1; padding: 12px; background: #334155; color: #FFFFFF; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 14px;">Cancelar</button>
                    <button id="btn-confirm-waitlist" style="flex: 1.5; padding: 12px; background: linear-gradient(135deg, #F59E0B, #D97706); color: #FFFFFF; border: none; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 14px; box-shadow: 0 4px 14px rgba(245,158,11,0.4);">Entrar na Fila</button>
                  </div>
                </div>
              `;
              modalRoot.appendChild(dialog);

              dialog.querySelector('#btn-cancel-waitlist').onclick = () => {
                dialog.remove();
                resolve(false);
              };
              dialog.querySelector('#btn-confirm-waitlist').onclick = () => {
                dialog.remove();
                resolve(true);
              };
            });

            if (!confirmouFila) return;
          }
        } catch (checkErr) {
          console.warn('[Convocacao] Erro na checagem de vagas:', checkErr);
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
  },

  // --- Abre Pop-Up com o Card (Ultimate FUT ou Básico conforme as regras de acesso) --------------
  openPlayerCardModal: async function (athleteId) {
    let athlete = null;

    // 1. Tenta buscar da API do backend em tempo real (/api/usuarios/:id)
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/usuarios/${athleteId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        athlete = await res.json();
      }
    } catch (e) {
      console.warn('[Convocacao] Erro ao buscar perfil completo na API:', e);
    }

    // 2. Fallbacks: busca na lista de convocados atual ou lista de usuários local
    let convocadosItem = null;
    if (this._lastConvocados && Array.isArray(this._lastConvocados)) {
      convocadosItem = this._lastConvocados.find(c => String(c.id) === String(athleteId));
    }

    let fullUserLocal = null;
    try {
      const users = Api.getUsuarios();
      fullUserLocal = users.find(u => String(u.id) === String(athleteId));
    } catch (e) {}

    // Combina garantindo que dados reais completos tenham precedência
    athlete = Object.assign({}, convocadosItem || {}, fullUserLocal || {}, athlete || {});

    if (!athlete || (!athlete.nome && !athlete.apelido)) {
      athlete = { id: athleteId, nome: 'Atleta', apelido: 'Atleta', gols: 0, partidas: 0 };
    }

    // 3. Regra de Acesso aos Cards:
    // O visual Ultimate FUT (brasão com cores do time do atleta) abre se:
    // - O usuário logado possui o Card Ultimate / VIP, OU
    // - O atleta selecionado possui o Card Ultimate / VIP
    const currentUser = Auth.currentUser || (window.Auth && window.Auth.currentUser) || JSON.parse(localStorage.getItem('usuario') || '{}');
    const viewerName = (currentUser.nome || currentUser.name || currentUser.apelido || '').toLowerCase();
    const viewerIsLucas = viewerName.includes('lucas fernandes') || viewerName.includes('lucas guerreiro');
    const cardStyle = localStorage.getItem('peladapro_card_style') || 'free';
    const isVipStorage = localStorage.getItem('peladapro_premium_adquirido') === 'true' || cardStyle === 'fut' || cardStyle === 'premium';
    const viewerIsVip = (window.App && window.App.isVipPlan && window.App.isVipPlan ? window.App.isVipPlan() : false) || (isVipStorage && viewerIsLucas);

    const targetName = (athlete.apelido || athlete.nome || '').toLowerCase();
    const targetIsLucas = targetName.includes('lucas fernandes') || targetName.includes('lucas guerreiro');
    const targetIsVip = athlete.vip || athlete.premium || athlete.is_vip || targetIsLucas;

    const shouldShowUltimateCard = viewerIsVip || targetIsVip;

    // Cria overlay no DOM se não existir
    var modalOverlay = document.getElementById('modal-athlete-card-overlay');
    if (!modalOverlay) {
      modalOverlay = document.createElement('div');
      modalOverlay.id = 'modal-athlete-card-overlay';
      modalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999; opacity: 0; pointer-events: none; transition: opacity 0.3s ease;';
      document.body.appendChild(modalOverlay);
    }

    var name = athlete.apelido || athlete.nome || 'Atleta';
    var foto = athlete.foto || athlete.photo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80';

    // Cálculo e formatação segura de Idade
    var age = athlete.idade || athlete.age;
    if ((age === undefined || age === null || isNaN(age)) && athlete.data_nascimento) {
      var ageCalc = (window.Utils && window.Utils.calcAge) ? window.Utils.calcAge(athlete.data_nascimento) : null;
      if (ageCalc === null || isNaN(ageCalc)) {
        var birth = new Date(athlete.data_nascimento);
        var ageDifMs = Date.now() - birth.getTime();
        var ageDate = new Date(ageDifMs);
        ageCalc = Math.abs(ageDate.getUTCFullYear() - 1970);
      }
      if (ageCalc !== null && !isNaN(ageCalc)) age = ageCalc;
    }
    age = (age !== null && age !== undefined && !isNaN(age)) ? age : '—';

    // Tenta carregar cache instantâneo de desempenho para evitar flicker/salto de dados no modal
    var cachedModalPerf = null;
    try {
      cachedModalPerf = JSON.parse(sessionStorage.getItem('cached_desempenho_' + athleteId));
    } catch(e) {}

    // Extrai valores reais numéricos com fallback seguro entre as fontes de dados
    var games = (cachedModalPerf && cachedModalPerf.jogos !== undefined) ? Number(cachedModalPerf.jogos) : 0;
    if (!games) {
      if (athlete && athlete.partidas !== undefined && athlete.partidas !== null && !isNaN(athlete.partidas)) games = Number(athlete.partidas);
      else if (athlete && athlete.jogos !== undefined && athlete.jogos !== null && !isNaN(athlete.jogos)) games = Number(athlete.jogos);
      else if (fullUserLocal && fullUserLocal.partidas !== undefined && fullUserLocal.partidas !== null) games = Number(fullUserLocal.partidas);
      else if (convocadosItem && convocadosItem.partidas !== undefined && convocadosItem.partidas !== null) games = Number(convocadosItem.partidas);
    }

    var goals = (cachedModalPerf && cachedModalPerf.gols !== undefined) ? Number(cachedModalPerf.gols) : 0;
    if (!goals) {
      if (athlete && athlete.gols !== undefined && athlete.gols !== null && !isNaN(athlete.gols)) goals = Number(athlete.gols);
      else if (fullUserLocal && fullUserLocal.gols !== undefined && fullUserLocal.gols !== null) goals = Number(fullUserLocal.gols);
      else if (convocadosItem && convocadosItem.gols !== undefined && convocadosItem.gols !== null) goals = Number(convocadosItem.gols);
    }

    var initialPts = (cachedModalPerf && cachedModalPerf.pontos !== undefined) ? Number(cachedModalPerf.pontos).toFixed(1) : '0.0';

    var memberYear = (athlete.criado_em || athlete.created_at) ? new Date(athlete.criado_em || athlete.created_at).getFullYear() : new Date().getFullYear();
    var flag = athlete.nacionalidade_flag || athlete.nacionalidade || '🇧🇷';

    // Gradientes temáticos do time do ATLETA SELECIONADO
    var theme = (window.Dashboard && window.Dashboard.getTeamTheme) ? window.Dashboard.getTeamTheme(athlete.time_coracao) : null;
    var bgGradient = theme ? theme.gradient : 'linear-gradient(135deg, #1D9E75 0%, #0D4030 50%, #0A1F16 100%)';
    var borderColor = theme ? theme.border : '#D4AF37';

    if (athlete.time_coracao) {
      var tName = athlete.time_coracao.toLowerCase().trim();
      if (tName.includes('flamengo')) { bgGradient = 'linear-gradient(135deg, #8B1A1A 0%, #3A050A 50%, #C8102E 100%)'; borderColor = '#8B1A1A'; }
      else if (tName.includes('vasco')) { bgGradient = 'linear-gradient(135deg, #222222 0%, #0D0D0D 50%, #1A1A1A 100%)'; borderColor = '#FFFFFF'; }
      else if (tName.includes('fluminense')) { bgGradient = 'linear-gradient(135deg, #831D1C 0%, #4A0E0E 40%, #006633 100%)'; borderColor = '#D4AF37'; }
      else if (tName.includes('palmeiras') || tName.includes('guarani')) { bgGradient = 'linear-gradient(135deg, #005931 0%, #02341D 50%, #001A0E 100%)'; borderColor = '#86EFAC'; }
      else if (tName.includes('corinthians') || tName.includes('botafogo')) { bgGradient = 'linear-gradient(135deg, #222222 0%, #111111 50%, #000000 100%)'; borderColor = '#F5D270'; }
      else if (tName.includes('são paulo') || tName.includes('sao paulo')) { bgGradient = 'linear-gradient(135deg, #800000 0%, #300000 50%, #1A0000 100%)'; borderColor = '#FF4D4D'; }
      else if (tName.includes('grêmio') || tName.includes('gremio') || tName.includes('cruzeiro')) { bgGradient = 'linear-gradient(135deg, #0055A5 0%, #003366 50%, #001A33 100%)'; borderColor = '#93C5FD'; }
      else if (tName.includes('internacional')) { bgGradient = 'linear-gradient(135deg, #990000 0%, #4D0000 50%, #260000 100%)'; borderColor = '#FCA5A5'; }
      else if (tName.includes('atlético') || tName.includes('atletico') || tName.includes('galo')) { bgGradient = 'linear-gradient(135deg, #222222 0%, #0F0F0F 50%, #000000 100%)'; borderColor = '#D4AF37'; }
    }

    if (shouldShowUltimateCard) {
      // 🏆 LAYOUT CARD ULTIMATE / FUT COM CORES DO TIME DO ATLETA SELECIONADO
      modalOverlay.innerHTML = `
        <div style="position: relative; width: 90%; max-width: 330px; border-radius: 24px; padding: 24px 20px; background: ${bgGradient}; border: 2.5px solid ${borderColor}; box-shadow: 0 20px 60px rgba(0,0,0,0.85), 0 0 35px rgba(212, 175, 55, 0.4); text-align: center; color: #FFFFFF; font-family: 'Inter', sans-serif;">
          <!-- Botão Fechar X -->
          <button onclick="Convocacao.closePlayerCardModal()" style="position: absolute; top: 14px; right: 14px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.4); color: #FFF; font-size: 16px; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; font-weight: 800;">
            ✕
          </button>

          <!-- Stack de Nacionalidade & Membro no Canto Superior Esquerdo -->
          <div style="position: absolute; top: 16px; left: 16px; display: flex; flex-direction: column; align-items: center; background: rgba(0, 0, 0, 0.65); border: 1.5px solid #F5D270; padding: 4px 8px; border-radius: 10px; backdrop-filter: blur(6px);">
            <span style="font-size: 14px;">${flag}</span>
            <span style="font-size: 9px; font-weight: 800; color: #F5D270; letter-spacing: 0.5px; margin-top: 1px;">Desde ${memberYear}</span>
          </div>

          <!-- Avatar Central com anel reluzente -->
          <div style="width: 100px; height: 100px; border-radius: 50%; border: 3.5px solid #F5D270; box-shadow: 0 0 25px rgba(245, 210, 112, 0.75), 0 8px 24px rgba(0,0,0,0.8); margin: 18px auto 12px; overflow: hidden; background: #0F172A;">
            <img src="${foto}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>

          <!-- Apelido / Nome do Atleta em Dourado -->
          <h3 style="color: #F5D270; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9), 0 0 12px rgba(245, 210, 112, 0.5); margin: 0 0 14px 0; border-bottom: 1.5px solid rgba(245, 210, 112, 0.4); padding-bottom: 6px;">
            ${name}
          </h3>

          <!-- FUT Stats Grid: 2 COLUNAS (Linha 1: Idade / Pontos | Linha 2: Gols / Jogos) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; background: rgba(0, 0, 0, 0.65); border: 1.5px solid rgba(245, 210, 112, 0.5); border-radius: 14px; padding: 10px 12px; margin-bottom: 16px; backdrop-filter: blur(8px);">
            <!-- Linha 1 / Coluna 1: IDADE -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 255, 255, 0.05); padding: 6px 4px; border-radius: 8px;">
              <span style="font-size: 16px; font-weight: 900; color: #FFFFFF;">${age}</span>
              <span style="font-size: 9px; font-weight: 800; color: #F5D270; letter-spacing: 0.5px;">IDADE</span>
            </div>
            <!-- Linha 1 / Coluna 2: PONTOS -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 255, 255, 0.05); padding: 6px 4px; border-radius: 8px;">
              <span id="modal-stat-pts" style="font-size: 16px; font-weight: 900; color: #FFFFFF;">${initialPts}</span>
              <span style="font-size: 9px; font-weight: 800; color: #F5D270; letter-spacing: 0.5px;">PTS</span>
            </div>
            <!-- Linha 2 / Coluna 1: GOLS -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 255, 255, 0.05); padding: 6px 4px; border-radius: 8px;">
              <span id="modal-stat-goals" style="font-size: 16px; font-weight: 900; color: #FFFFFF;">${goals}</span>
              <span style="font-size: 9px; font-weight: 800; color: #F5D270; letter-spacing: 0.5px;">GOLS</span>
            </div>
            <!-- Linha 2 / Coluna 2: JOGOS -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; background: rgba(255, 255, 255, 0.05); padding: 6px 4px; border-radius: 8px;">
              <span id="modal-stat-games" style="font-size: 16px; font-weight: 900; color: #FFFFFF;">${games}</span>
              <span style="font-size: 9px; font-weight: 800; color: #F5D270; letter-spacing: 0.5px;">JOGOS</span>
            </div>
          </div>

          <!-- Botão Fechar -->
          <button onclick="Convocacao.closePlayerCardModal()" style="width: 100%; background: linear-gradient(135deg, #F5D270, #D4AF37); color: #1A1A1A; font-weight: 800; font-size: 13px; border: none; border-radius: 10px; padding: 10px 0; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 14px rgba(245, 210, 112, 0.35);">
            Fechar Card
          </button>
        </div>
      `;
    } else {
      // ⚽ LAYOUT CARD BÁSICO / GRATUITO (Ambos os atletas possuem plano básico)
      modalOverlay.innerHTML = `
        <div style="position: relative; width: 90%; max-width: 320px; border-radius: 20px; padding: 22px 18px; background: #FFFFFF; border: 1.5px solid #CBD5E1; box-shadow: 0 20px 40px rgba(0,0,0,0.4); text-align: center; color: #0F172A; font-family: 'Inter', sans-serif;">
          <!-- Botão Fechar X -->
          <button onclick="Convocacao.closePlayerCardModal()" style="position: absolute; top: 12px; right: 12px; background: #F1F5F9; border: 1px solid #CBD5E1; color: #64748B; font-size: 16px; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; font-weight: 800;">
            ✕
          </button>

          <!-- Tag de Card Básico -->
          <div style="display: inline-block; background: #E2E8F0; color: #475569; font-size: 10px; font-weight: 800; padding: 3px 10px; border-radius: 8px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            Card Básico • ${flag} Desde ${memberYear}
          </div>

          <!-- Avatar Simples -->
          <div style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #1D9E75; margin: 0 auto 10px; overflow: hidden; background: #F1F5F9;">
            <img src="${foto}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>

          <!-- Apelido / Nome do Atleta em Escuro -->
          <h3 style="color: #0F172A; font-size: 18px; font-weight: 800; text-transform: uppercase; margin: 0 0 12px 0;">
            ${name}
          </h3>

          <!-- Stats Grid Básico (2 COLUNAS: Idade/Pontos | Gols/Jogos) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 10px; margin-bottom: 14px;">
            <!-- Linha 1 / Coluna 1: IDADE -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #FFFFFF; padding: 6px 4px; border-radius: 8px; border: 1px solid #E2E8F0;">
              <span style="font-size: 15px; font-weight: 800; color: #0F172A;">${age}</span>
              <span style="font-size: 9px; font-weight: 700; color: #64748B;">IDADE</span>
            </div>
            <!-- Linha 1 / Coluna 2: PONTOS -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #FFFFFF; padding: 6px 4px; border-radius: 8px; border: 1px solid #E2E8F0;">
              <span id="modal-stat-pts" style="font-size: 15px; font-weight: 800; color: #0F172A;">0</span>
              <span style="font-size: 9px; font-weight: 700; color: #64748B;">PTS</span>
            </div>
            <!-- Linha 2 / Coluna 1: GOLS -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #FFFFFF; padding: 6px 4px; border-radius: 8px; border: 1px solid #E2E8F0;">
              <span id="modal-stat-goals" style="font-size: 15px; font-weight: 800; color: #0F172A;">${goals}</span>
              <span style="font-size: 9px; font-weight: 700; color: #64748B;">GOLS</span>
            </div>
            <!-- Linha 2 / Coluna 2: JOGOS -->
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #FFFFFF; padding: 6px 4px; border-radius: 8px; border: 1px solid #E2E8F0;">
              <span id="modal-stat-games" style="font-size: 15px; font-weight: 800; color: #0F172A;">${games}</span>
              <span style="font-size: 9px; font-weight: 700; color: #64748B;">JOGOS</span>
            </div>
          </div>

          <!-- Banner Promocional para incentivar Upgrade para Ultimate FUT -->
          <div style="background: linear-gradient(135deg, #FFFBEB, #FEF3C7); border: 1px dashed #F59E0B; border-radius: 12px; padding: 10px; margin-bottom: 14px; text-align: center;">
            <p style="font-size: 11px; font-weight: 800; color: #B45309; margin: 0 0 4px 0;">
              ✦ Adquira o Card Ultimate!
            </p>
            <p style="font-size: 10px; color: #78350F; margin: 0; line-height: 1.3;">
              Visualização de cards no formato brasão FUT com as cores do seu time é um benefício exclusivo dos Membros Elite.
            </p>
          </div>

          <!-- Botão Upgrade -->
          <button onclick="window.location.href='#/premium'; Convocacao.closePlayerCardModal();" style="width: 100%; background: linear-gradient(135deg, #1D9E75, #0D4030); color: #FFFFFF; font-weight: 800; font-size: 12px; border: none; border-radius: 10px; padding: 10px 0; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">
            Conhecer Card Ultimate ✦
          </button>
        </div>
      `;
    }

    // Calcula Desempenho Real (PTS, JOGOS, GOLS) do atleta aberto no Pop-Up
    if (window.App && window.App.calcPlayerDesempenho) {
      window.App.calcPlayerDesempenho(athleteId, name).then(res => {
        if (res) {
          try {
            sessionStorage.setItem('cached_desempenho_' + athleteId, JSON.stringify(res));
          } catch(e) {}
          const ptsEl = document.getElementById('modal-stat-pts');
          const gamesEl = document.getElementById('modal-stat-games');
          const goalsEl = document.getElementById('modal-stat-goals');
          if (ptsEl) ptsEl.textContent = Number(res.pontos).toFixed(1);
          if (gamesEl && res.jogos > 0) gamesEl.textContent = res.jogos;
          if (goalsEl && res.gols > 0) goalsEl.textContent = res.gols;
        }
      }).catch(() => {});
    }

    setTimeout(function() {
      modalOverlay.style.opacity = '1';
      modalOverlay.style.pointerEvents = 'auto';
    }, 10);
  },

  // --- Fecha o Pop-Up do Card ------------------------------------------------
  closePlayerCardModal: function () {
    var modalOverlay = document.getElementById('modal-athlete-card-overlay');
    if (modalOverlay) {
      modalOverlay.style.opacity = '0';
      modalOverlay.style.pointerEvents = 'none';
    }
  }
};

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initConvocacao = function () {
  Convocacao.init();
};
