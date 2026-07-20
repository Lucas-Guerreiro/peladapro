// ==========================================================================
// pages/jogador/convocacao.js — Lógica da Tela de Convocação
// ==========================================================================

var Convocacao = {

  _selectedPeladaId: null,

  init: function() {
    this.populateGroupSelector();
    this.bindEvents();
  },

  // --- Popula o select de grupos (sincronizado com backend real) -----------
  populateGroupSelector: async function() {
    var selectGroup = document.getElementById('select-conv-pelada');
    if (!selectGroup) return;

    selectGroup.innerHTML = '<option value="">▼ Carregando grupos...</option>';

    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Sincroniza grupos com o backend real
        const resGroups = await fetch('http://localhost:3000/api/peladas/grupos', {
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
    
    groups.forEach(function(g) {
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
  handleGroupChange: async function(groupId) {
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
      var today = new Date().toISOString().split('T')[0];

      // Filtrar peladas agendadas do grupo e ordenar
      var upcoming = peladas.filter(function(p) {
        return p.status === 'agendada' && p.data >= today;
      }).sort(function(a, b) { return a.data.localeCompare(b.data); });

      if (upcoming.length === 0) {
        selectData.innerHTML = '<option value="">Nenhuma data agendada</option>';
        selectData.disabled = true;
        selectData.style.background = 'var(--background)';
        
        this._selectedPeladaId = null;
        this.renderConfirmedList(null);
        this.updateMyStatus();
        return;
      }

      // Sincronizar localmente as peladas do grupo no localStorage para o resto do app
      const peladasLocais = Api.getPeladas().filter(p => String(p.grupo_id) !== String(groupId));
      upcoming.forEach(p => {
        peladasLocais.push({
          id: p.id,
          grupo_id: parseInt(groupId),
          data: p.data,
          horario: p.horario,
          local: p.local,
          status: p.status,
          max_jogadores: p.max_jogadores,
          valor_convocacao: p.valor_convocacao,
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

      upcoming.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = Utils.formatDate(p.data) + ' · ' + (p.horario || '');
        selectData.appendChild(opt);
      });

      // Pré-selecionar a data mais próxima
      selectData.value = upcoming[0].id;
      this._selectedPeladaId = upcoming[0].id;
      this.renderConfirmedList(upcoming[0].id);
      this.updateMyStatus();
    } catch (err) {
      console.error('[Convocacao] Erro ao carregar datas do grupo:', err);
      selectData.innerHTML = '<option value="">Erro ao carregar datas</option>';
      selectData.disabled = true;
    }
  },

  // --- Renderiza a lista de confirmados puxada em tempo real ----------------
  renderConfirmedList: async function(peladaId) {
    var listEl    = document.getElementById('confirmed-list');
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
      var confirmed = convocados.filter(function(c) {
        return c.status === 'confirmado';
      });

      if (counterEl) counterEl.textContent = confirmed.length + ' / ' + max;

      if (confirmed.length === 0) {
        listEl.innerHTML = '<div class="empty-state" style="padding: 32px;"><span style="font-size: 32px;">👥</span><p class="text-inter" style="font-size: 14px;">Nenhum jogador confirmado ainda.</p></div>';
        return;
      }

      var html = '';
      confirmed.forEach(function(c) {
        var nome    = c.apelido || c.nome || 'Desconhecido';
        var stars   = Utils.starsHTML(c.autoavaliacao || 0, 5);
        var isMe    = Auth.currentUser && String(c.id) === String(Auth.currentUser.id);

        var avatarHTML = '';
        var hasPhoto = c.foto || c.photo;
        if (hasPhoto) {
          avatarHTML = '<img src="' + hasPhoto + '" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid var(--secondary);">';
        } else {
          avatarHTML = '<div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: #FFF; font-weight: 700; font-size: 14px; flex-shrink: 0;">' +
            nome.charAt(0).toUpperCase() +
          '</div>';
        }

        html += '<div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border-color);">' +
          avatarHTML +
          '<div style="flex: 1;">' +
            '<p class="text-inter" style="font-size: 14px; font-weight: 600; color: var(--text-heading);">' +
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
          forma_pagamento: c.forma_pagamento
        });
      });
      Api.saveConvocations(localConvocations);
      
    } catch (err) {
      console.error('[Convocacao] Erro ao buscar confirmados:', err);
      listEl.innerHTML = '<div class="empty-state" style="padding: 32px;"><p class="text-inter" style="color:var(--danger)">Erro ao carregar convocados.</p></div>';
    }
  },

  // --- Atualiza o status e saldo do jogador ------------------------------
  updateMyStatus: function() {
    var user      = Auth.currentUser;
    var statusEl  = document.getElementById('my-status-badge');
    var balanceEl = document.getElementById('my-balance-conv');
    var btnAdd    = document.getElementById('btn-conv-add');
    var btnRemove = document.getElementById('btn-conv-remove');
    
    if (balanceEl && user) {
      var saldo = user.saldo || 0;
      balanceEl.textContent   = Utils.formatCurrency(saldo);
      balanceEl.style.color   = saldo < 0 ? 'var(--danger)' : 'var(--primary)';
    }

    let isConfirmed = false;
    let hasSelected = false;

    if (statusEl && user && Convocacao._selectedPeladaId) {
      hasSelected = true;
      var convocations = Api.getConvocations();
      var myConv = convocations.find(function(c) {
        return String(c.pelada_id) === String(Convocacao._selectedPeladaId) && String(c.player_id) === String(user.id);
      });

      if (myConv && myConv.status === 'confirmado') {
        statusEl.className  = 'badge-status confirmado';
        statusEl.textContent = '✅ Confirmado';
        isConfirmed = true;
      } else if (myConv && myConv.status === 'cortado') {
        statusEl.className  = 'badge-status cortado';
        statusEl.textContent = '❌ Cortado';
      } else {
        statusEl.className  = 'badge-status pendente';
        statusEl.textContent = '⏳ Pendente';
      }
    } else if (statusEl) {
      statusEl.className  = 'badge-status pendente';
      statusEl.textContent = '⏳ Selecione a pelada';
    }

    // Habilita/Desabilita os botões de ação dinamicamente
    if (btnAdd) {
      if (!hasSelected || isConfirmed) {
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
      if (!hasSelected || !isConfirmed) {
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
  bindEvents: function() {
    var selectGroup = document.getElementById('select-conv-pelada');
    var selectData = document.getElementById('select-conv-data');
    var btnAdd = document.getElementById('btn-conv-add');
    var btnRemove = document.getElementById('btn-conv-remove');

    if (selectGroup) {
      selectGroup.addEventListener('change', function(e) {
        Convocacao.handleGroupChange(e.target.value);
      });
    }

    if (selectData) {
      selectData.addEventListener('change', function(e) {
        Convocacao._selectedPeladaId = e.target.value;
        Convocacao.renderConfirmedList(e.target.value);
        Convocacao.updateMyStatus();
      });
    }

    if (btnAdd) {
      btnAdd.onclick = async function() {
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
      btnRemove.onclick = function() {
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
window.App.initConvocacao = function() {
  Convocacao.init();
};
