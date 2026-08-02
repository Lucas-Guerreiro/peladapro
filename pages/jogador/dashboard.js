// ==========================================================================
// pages/jogador/dashboard.js — Lógica do Dashboard do Atleta
// Padrão: Dashboard object (spec) exposto em window.App.initDashboard
// ==========================================================================

var Dashboard = {

  _pollingTimer: null,

  init: function() {
    const user = Auth.currentUser;

    // O perfil só é considerado incompleto se o usuário NÃO for verificado/ativo E faltarem dados essenciais
    const isComplete = !user || 
                       (user.verificado === true) || 
                       (user.ativo === true) || 
                       (user.cadastro_completo === true) ||
                       (user.nome && user.whatsapp && (user.cpf || user.data_nascimento || user.autoavaliacao > 0));

    if (user && !isComplete) {
      this.renderCompletionScreen();
      return;
    }

    // Exibe a barra de abas que pode ter sido ocultada
    const tabsNav = document.getElementById('jogador-tabs-nav');
    if (tabsNav) tabsNav.style.display = 'flex';

    this.renderPlayerData();
    this.renderNextMatches();
  },

  // --- Dados do jogador logado -------------------------------------------
  renderPlayerData: function() {
    var user = Auth.currentUser;
    if (!user) return;

    // Nome
    var nameEl = document.getElementById('player-card-name');
    if (nameEl) nameEl.textContent = user.apelido || user.nome || user.name || '—';

    // Idade
    var age = Utils.calcAge(user.data_nascimento);
    console.log('[Dashboard] data_nascimento:', user.data_nascimento, '→ idade calculada:', age);
    var ageEl = document.getElementById('player-card-age');
    if (ageEl) ageEl.textContent = (age !== null && age !== undefined && !isNaN(age)) ? age : '—';

    // Foto
    var avatarEl = document.getElementById('player-avatar');
    if (avatarEl) {
      avatarEl.src = user.foto || user.photo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80';
    }

    // Saldo
    var balanceEl = document.getElementById('player-balance-value');
    var balanceCard = document.getElementById('player-card-balance');
    if (balanceEl) {
      var saldo = user.saldo || 0;
      balanceEl.textContent = Utils.formatCurrency(saldo);
      if (balanceCard) {
        balanceCard.classList.toggle('negative', saldo < 0);
      }
      if (saldo < 0) {
        balanceEl.style.color = 'var(--danger)';
      }
    }

    // Badge goleiro
    var gkBadge = document.getElementById('player-gk-badge');
    if (gkBadge) {
      gkBadge.classList.toggle('hidden', !user.goleiro);
    }

    // Nome do grupo
    var groupNameEl = document.getElementById('dashboard-group-name');
    if (groupNameEl && Auth.currentGroup) {
      groupNameEl.textContent = Auth.currentGroup.nome || '—';
    }
  },

  // --- Próximas peladas ---------------------------------------------------
  renderNextMatches: async function() {
    console.log('[Dashboard] renderNextMatches iniciado');
    var listEl = document.getElementById('next-matches-list');
    if (!listEl) {
      console.log('[Dashboard] listEl nao encontrado!');
      return;
    }

    // Função interna para renderizar o estado atual das peladas
    const buildListHTML = () => {
      console.log('[Dashboard] buildListHTML chamada');
      try {
        var peladas = Api.getPeladas() || [];
        console.log('[Dashboard] peladas locais:', peladas);
        var group = Auth.currentGroup;
        if (!group) {
          try {
            group = JSON.parse(localStorage.getItem('currentGroup'));
          } catch (e) {}
        }
        var groupId = group ? group.id : null;
        var userId = Auth.currentUser ? Auth.currentUser.id : null;
        console.log('[Dashboard] groupId:', groupId, 'userId:', userId);

        var today = new Date().toISOString().split('T')[0];
        var upcoming = peladas.filter(function(p) {
          return p.status === 'agendada' && p.data >= today &&
                 (!groupId || p.grupo_id === groupId);
        }).sort(function(a, b) { return a.data.localeCompare(b.data); }).slice(0, 4);
        console.log('[Dashboard] upcoming peladas:', upcoming);

        var convocations = Api.getConvocations() || [];
        console.log('[Dashboard] convocations locais:', convocations);

        if (upcoming.length === 0) {
          listEl.innerHTML = '<div class="empty-state" style="padding: 32px;"><span style="font-size: 32px;">🏟️</span><p class="text-inter" style="font-size: 14px;">Nenhuma pelada futura agendada.</p></div>';
          return;
        }

        var html = '';
        upcoming.forEach(function(p, idx) {
          var myConv = convocations.find(function(c) { return c.pelada_id === p.id && c.player_id === userId; });
          var status = myConv ? myConv.status : 'pendente';
          var isLast = idx === upcoming.length - 1;

          var statusMap = {
            confirmado: { label: '✅ Confirmado', color: 'var(--success)' },
            pendente:   { label: '⏳ Pendente',   color: 'var(--warning)' },
            cortado:    { label: '❌ Cortado',    color: 'var(--danger)'  }
          };
          var s = statusMap[status] || statusMap.pendente;

          var dateFormatted = Utils.formatDate(p.data);
          html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;' +
            (isLast ? '' : 'border-bottom: 1px solid var(--border-color);') + '">' +
            '<div>' +
              '<p class="text-inter" style="font-size: 14px; font-weight: 600; color: var(--text-heading);">' + dateFormatted + ' · ' + (p.horario || '') + '</p>' +
              '<p class="text-inter" style="font-size: 12px; color: var(--text-caption);">' + (p.local || (group && group.nome) || '') + '</p>' +
            '</div>' +
            '<span class="text-inter" style="font-size: 13px; font-weight: 700; color: ' + s.color + ';">' + s.label + '</span>' +
          '</div>';
        });

        listEl.innerHTML = html;
        console.log('[Dashboard] HTML renderizado com sucesso!');
      } catch (err) {
        console.error('[Dashboard] Erro interno em buildListHTML:', err);
      }
    };

    // 1. Renderiza imediatamente com o cache local
    buildListHTML();

    // 2. Busca dados em tempo real na nuvem de forma assíncrona
    var token = localStorage.getItem('token');
    if (token && window.Api && window.Api.getGruposDoGestor) {
      try {
        console.log('[Dashboard] Buscando grupos do servidor...');
        const grupos = await window.Api.getGruposDoGestor();
        console.log('[Dashboard] grupos retornados:', grupos);
        if (Array.isArray(grupos) && grupos.length > 0) {
          window.Api.saveGroups(grupos);

          // Se não houver grupo selecionado, define o primeiro como currentGroup
          if (!Auth.currentGroup) {
            Auth.currentGroup = grupos[0];
            localStorage.setItem('currentGroup', JSON.stringify(grupos[0]));
            // Atualiza o nome do grupo na UI
            var groupNameEl = document.getElementById('dashboard-group-name');
            if (groupNameEl) groupNameEl.textContent = grupos[0].nome;
          }

          let todasPeladas = [];
          for (const g of grupos) {
            try {
              console.log('[Dashboard] Buscando peladas do grupo:', g.id);
              const peladasGrupo = await window.Api.listarDatasDoGrupo(g.id);
              console.log('[Dashboard] peladas do grupo:', g.id, peladasGrupo);
              if (Array.isArray(peladasGrupo)) {
                todasPeladas = todasPeladas.concat(peladasGrupo);
              }
            } catch (e) {
              console.error('[Dashboard] Erro ao buscar peladas do grupo:', g.id, e);
            }
          }

          if (todasPeladas.length > 0) {
            window.Api.savePeladas(todasPeladas);

            const today = new Date().toISOString().split('T')[0];
            const upcoming = todasPeladas.filter(p => p.status === 'agendada' && p.data >= today).slice(0, 4);

            let localConvocations = window.Api.getConvocations() || [];
            for (const p of upcoming) {
              try {
                console.log('[Dashboard] Buscando convocações para pelada:', p.id);
                const convocados = await window.Api.listarConvocados(p.id);
                console.log('[Dashboard] convocados para pelada:', p.id, convocados);
                if (Array.isArray(convocados)) {
                  localConvocations = localConvocations.filter(c => String(c.pelada_id) !== String(p.id));
                  convocados.forEach(c => {
                    localConvocations.push({
                      id: 'c_' + c.id + '_' + p.id,
                      pelada_id: parseInt(p.id),
                      player_id: c.id,
                      status: c.status,
                      forma_pagamento: c.forma_pagamento
                    });
                  });
                }
              } catch (e) {
                console.error('[Dashboard] Erro ao buscar convocados para pelada:', p.id, e);
              }
            }
            window.Api.saveConvocations(localConvocations);

            // 3. Renderiza novamente com os dados atualizados
            buildListHTML();
          }
        }
      } catch (err) {
        console.error('[Dashboard] Erro na sincronização reativa:', err);
      }
    }
  },

  // --- Utilitário de timer ------------------------------------------------
  _formatTimer: function(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  },

  // --- Tela de complemento cadastral em tela cheia ------------------------
  _currentRating: 0,

  renderCompletionScreen: function() {
    // 1. Ocultar barra de abas para impedir navegação
    const tabsNav = document.getElementById('jogador-tabs-nav');
    if (tabsNav) tabsNav.style.display = 'none';

    // 2. Injetar a tela de completo.html no contêiner
    const container = document.getElementById('player-tab-content-container');
    if (!container) return;

    fetch('pages/jogador/completo.html?v=' + Date.now())
      .then(res => res.text())
      .then(html => {
        container.innerHTML = html;

        // 3. Inicializar e pré-preencher os inputs da tela com dados existentes do usuário
        const u = Auth.currentUser || {};
        const nomeInput = document.getElementById('comp-nome');
        const apelidoInput = document.getElementById('comp-apelido');
        const cpfInput = document.getElementById('comp-cpf');
        const nascimentoInput = document.getElementById('comp-nascimento');
        const whatsappInput = document.getElementById('comp-whatsapp');
        const goleiroCheck = document.getElementById('comp-goleiro');
        const saveBtn = document.getElementById('btn-save-cadastro');
        const stars = document.querySelectorAll('#comp-stars-selector .comp-rating-star');

        if (nomeInput) nomeInput.value = u.nome || u.name || '';
        if (apelidoInput) apelidoInput.value = u.apelido || (u.nome ? u.nome.split(' ')[0] : '');
        if (cpfInput && u.cpf) cpfInput.value = Utils.maskCPF(u.cpf);
        if (nascimentoInput && (u.data_nascimento || u.dob)) {
          try {
            const rawDate = u.data_nascimento || u.dob;
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              nascimentoInput.value = d.toISOString().split('T')[0];
            }
          } catch(e) {}
        }
        if (whatsappInput && u.whatsapp) whatsappInput.value = Utils.maskPhone(u.whatsapp);
        if (goleiroCheck) goleiroCheck.checked = !!u.goleiro;

        // Pré-carregar avaliação de estrelas se existente
        const initialRating = parseInt(u.autoavaliacao || u.avaliacao_media || 0);
        this._currentRating = initialRating;
        stars.forEach((s, idx) => {
          s.style.color = idx < initialRating ? 'var(--warning)' : '#ccc';
        });

        // Aplicar máscaras de digitação dinâmica
        if (cpfInput) {
          cpfInput.oninput = (e) => {
            e.target.value = Utils.maskCPF(e.target.value);
          };
        }
        if (whatsappInput) {
          whatsappInput.oninput = (e) => {
            e.target.value = Utils.maskPhone(e.target.value);
          };
        }

        // Seleção dinâmica de estrelas
        stars.forEach(star => {
          star.onclick = () => {
            const val = parseInt(star.dataset.value);
            this._currentRating = val;
            stars.forEach((s, idx) => {
              s.style.color = idx < val ? 'var(--warning)' : '#ccc';
            });
          };
        });

        // Evento de Salvar
        if (saveBtn) {
          saveBtn.onclick = () => this.handleSaveCompletion();
        }
      });
  },

  handleSaveCompletion: async function() {
    const nome = document.getElementById('comp-nome')?.value.trim();
    const apelido = document.getElementById('comp-apelido')?.value.trim();
    const cpf = document.getElementById('comp-cpf')?.value.trim();
    const nascimento = document.getElementById('comp-nascimento')?.value;
    const whatsapp = document.getElementById('comp-whatsapp')?.value.trim();
    const goleiro = document.getElementById('comp-goleiro')?.checked;
    const autoavaliacao = this._currentRating;

    if (!nome || !apelido || !cpf || !nascimento || !whatsapp) {
      Utils.toast('Preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    if (cpf.length < 14) {
      Utils.toast('CPF inválido.', 'error');
      return;
    }

    if (autoavaliacao === 0) {
      Utils.toast('Por favor, faça a sua autoavaliação de estrelas.', 'warning');
      return;
    }

    try {
      Utils.toast('Salvando perfil do atleta...', 'info');

      const res = await Api.atualizarPerfil({
        nome,
        apelido,
        cpf,
        data_nascimento: nascimento,
        whatsapp,
        goleiro,
        autoavaliacao
      });

      if (res.error) {
        Utils.toast(res.error, 'error');
        return;
      }

      Utils.toast('Perfil concluído com sucesso! Cadastro enviado para aprovação ⚽', 'success');

      // Se for um novo usuário pendente de aprovação do gestor
      if (!Auth.currentUser.verificado || !Auth.currentUser.ativo) {
        const userNome = nome;
        
        // Limpa a sessão local de forma silenciosa
        Auth.currentUser = null;
        Auth.currentGroup = null;
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentGroup');
        localStorage.removeItem('session_expiry');

        // Navega de volta ao login e exibe o modal explicativo
        Router.navigate('#/login');
        setTimeout(() => {
          Router.openModal('aviso_aprovacao', { nome: userNome });
        }, 300);
        return;
      }

      // Caso seja um usuário já ativo atualizando dados, mantém logado e vai para Convocação
      Auth.currentUser = {
        ...Auth.currentUser,
        nome,
        apelido,
        cpf,
        data_nascimento: nascimento,
        whatsapp,
        goleiro,
        autoavaliacao
      };

      Router.navigate('#/jogador/convocacao');

    } catch (err) {
      console.error(err);
      Utils.toast('Erro ao atualizar perfil.', 'error');
    }
  }
};

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initDashboard = async function() {
  if (window.Auth && window.Auth.refreshCurrentUser) {
    await window.Auth.refreshCurrentUser();
  }
  Dashboard.init();
};
