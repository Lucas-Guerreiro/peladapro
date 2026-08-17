// ==========================================================================
// pages/jogador/dashboard.js — Lógica do Dashboard do Atleta
// Padrão: Dashboard object (spec) exposto em window.App.initDashboard
// ==========================================================================

var Dashboard = {

  _pollingTimer: null,

  init: function () {
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

    // Restaurar visual premium se já foi ativado anteriormente
    this.initPremiumState();

    // Aplicar Modo Noturno no Tema do Time se estiver ativo
    this.applyModoNoturno();

    // Renderizar anúncio Google AdSense (se ativado pelo gestor)
    if (window.AdSenseManager) {
      window.AdSenseManager.renderAdContainer('adsense-dashboard-banner');
    }
  },

  // --- Dados do jogador logado -------------------------------------------
  renderPlayerData: function () {
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

    // Time do Coração e Estilo do Time
    var teamBadge = document.getElementById('player-card-team-badge');
    var teamNameEl = document.getElementById('player-card-team-name');
    var teamTheme = this.getTeamTheme(user.time_coracao);

    if (teamBadge && teamNameEl) {
      if (user.time_coracao && user.time_coracao.trim()) {
        teamNameEl.textContent = user.time_coracao.trim();
        teamBadge.style.display = 'inline-flex';

        if (teamTheme) {
          teamBadge.style.background = teamTheme.badgeBg;
          teamBadge.style.color = teamTheme.badgeText;
          teamBadge.style.borderColor = teamTheme.border;
        }
      } else {
        teamBadge.style.display = 'none';
      }
    }

    // Aplica o tema do time ao card do jogador se um time foi escolhido
    var card = document.getElementById('player-fifa-card');
    if (card && user) {
      this.applyTeamCardTheme(card, user.time_coracao);
    }

    // Aplica ou remove o estilo de card conforme a escolha do usuário
    var style = localStorage.getItem('peladapro_card_style') || (localStorage.getItem(this._PREMIUM_KEY) === 'true' ? 'premium' : 'free');
    this.applyCardStyle(style);

    // Preenche bandeira da nacionalidade e ano de aquisição do atleta
    var nacFlagEl = document.getElementById('fut-player-nac-flag');
    if (nacFlagEl) nacFlagEl.textContent = user.nacionalidade_flag || user.nacionalidade || '🇧🇷';

    var sinceEl = document.getElementById('fut-player-member-since');
    if (sinceEl) {
      var memberYear = (user.criado_em || user.created_at) ? new Date(user.criado_em || user.created_at).getFullYear() : new Date().getFullYear();
      sinceEl.textContent = 'Desde ' + memberYear;
    }

    var futAgeEl = document.getElementById('fut-stat-age');
    if (futAgeEl) futAgeEl.textContent = (age !== null && age !== undefined && !isNaN(age)) ? age : '—';

    // 1. Tenta carregar cache instantâneo de desempenho para evitar flicker/salto de dados
    var cachedPerf = null;
    try {
      cachedPerf = JSON.parse(sessionStorage.getItem('cached_desempenho_' + user.id));
    } catch(e) {}

    var gamesVal = (cachedPerf && cachedPerf.jogos !== undefined)
      ? Number(cachedPerf.jogos)
      : ((user.partidas !== undefined && user.partidas !== null) ? Number(user.partidas) : ((user.jogos !== undefined && user.jogos !== null) ? Number(user.jogos) : 0));

    var goalsVal = (cachedPerf && cachedPerf.gols !== undefined)
      ? Number(cachedPerf.gols)
      : ((user.gols !== undefined && user.gols !== null) ? Number(user.gols) : ((user.goals !== undefined && user.goals !== null) ? Number(user.goals) : 0));

    var ptsVal = (cachedPerf && cachedPerf.pontos !== undefined)
      ? Number(cachedPerf.pontos)
      : ((user.pontos !== undefined && user.pontos !== null) ? Number(user.pontos) : 0);

    var futPtsEl = document.getElementById('fut-stat-pts');
    if (futPtsEl) futPtsEl.textContent = ptsVal.toFixed(1);

    var futGamesEl = document.getElementById('fut-stat-games');
    if (futGamesEl) futGamesEl.textContent = gamesVal;

    var futGoalsEl = document.getElementById('fut-stat-goals');
    if (futGoalsEl) futGoalsEl.textContent = goalsVal;

    var ptsCardEl = document.getElementById('player-card-pts-val');
    if (ptsCardEl) ptsCardEl.textContent = ptsVal.toFixed(1);

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

    // Jogos, Gols e Membro desde
    var gamesEl = document.getElementById('player-card-games-val');
    if (gamesEl) gamesEl.textContent = gamesVal;

    var goalsEl = document.getElementById('player-card-goals-val');
    if (goalsEl) goalsEl.textContent = goalsVal;

    // Recalcula o Desempenho Real (PTS) assincronamente a partir das partidas reais do grupo
    if (window.App && window.App.calcPlayerDesempenho && user && user.id) {
      window.App.calcPlayerDesempenho(user.id, user.nome || user.apelido).then(res => {
        if (res) {
          try {
            sessionStorage.setItem('cached_desempenho_' + user.id, JSON.stringify(res));
          } catch(e) {}

          if (futPtsEl) futPtsEl.textContent = Number(res.pontos).toFixed(1);
          if (ptsCardEl) ptsCardEl.textContent = Number(res.pontos).toFixed(1);
          if (futGamesEl && res.jogos > 0) futGamesEl.textContent = res.jogos;
          if (gamesEl && res.jogos > 0) gamesEl.textContent = res.jogos;
          if (futGoalsEl && res.gols > 0) futGoalsEl.textContent = res.gols;
          if (goalsEl && res.gols > 0) goalsEl.textContent = res.gols;
        }
      }).catch(() => {});
    }

    var sinceEl = document.getElementById('player-member-since-year');
    if (sinceEl) {
      if (user.created_at) {
        var yr = new Date(user.created_at).getFullYear();
        if (!isNaN(yr)) sinceEl.textContent = yr;
      }
    }

    // Nome do grupo
    var groupNameEl = document.getElementById('dashboard-group-name');
    if (groupNameEl && Auth.currentGroup) {
      groupNameEl.textContent = Auth.currentGroup.nome || '—';
    }
  },

  // --- Próximas peladas ---------------------------------------------------
  renderNextMatches: async function () {
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
          } catch (e) { }
        }
        var groupId = group ? group.id : null;
        var userId = Auth.currentUser ? Auth.currentUser.id : null;
        console.log('[Dashboard] groupId:', groupId, 'userId:', userId);

        var today = window.Utils && window.Utils.getLocalTodayISO ? window.Utils.getLocalTodayISO() : (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        var upcoming = peladas.filter(function (p) {
          const condStatus = (p.status !== 'finalizada');

          let pDateStr = '';
          if (p.data) {
            if (p.data.includes('T')) {
              pDateStr = p.data.split('T')[0];
            } else if (p.data.includes('/')) {
              const partes = p.data.split('/');
              if (partes.length === 3) {
                pDateStr = `${partes[2]}-${partes[1]}-${partes[0]}`;
              } else {
                pDateStr = p.data;
              }
            } else {
              pDateStr = p.data;
            }
          }

          const condData = (pDateStr >= today);
          return condStatus && condData;
        }).sort(function (a, b) {
          const dateA = a.data && a.data.includes('T') ? a.data.split('T')[0] : a.data;
          const dateB = b.data && b.data.includes('T') ? b.data.split('T')[0] : b.data;
          return dateA.localeCompare(dateB);
        }).slice(0, 4);
        console.log('[Dashboard] upcoming peladas:', upcoming);

        var convocations = Api.getConvocations() || [];
        console.log('[Dashboard] convocations locais:', convocations);

        if (upcoming.length === 0) {
          listEl.innerHTML = '<div class="empty-state" style="padding: 32px;"><span style="font-size: 32px;">🏟️</span><p class="text-inter" style="font-size: 14px;">Nenhuma pelada futura agendada.</p></div>';
          return;
        }

        var html = '';
        upcoming.forEach(function (p, idx) {
          var myConv = convocations.find(function (c) { return c.pelada_id === p.id && c.player_id === userId; });
          var isLast = idx === upcoming.length - 1;

          let statusLabel = '⏳ Pendente';
          let statusColor = 'var(--warning)';

          if (myConv) {
            if (myConv.status === 'confirmado') {
              statusLabel = '✅ Confirmado';
              statusColor = 'var(--success)';
            } else if (myConv.status === 'espera') {
              const pos = myConv.posicao_fila ? ` (#${myConv.posicao_fila})` : '';
              statusLabel = `⏳ Em Espera${pos}`;
              statusColor = '#F59E0B';
            } else if (myConv.status === 'cortado') {
              statusLabel = '❌ Cortado';
              statusColor = 'var(--danger)';
            }
          }

          var dateFormatted = Utils.formatDate(p.data);
          html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px;' +
            (isLast ? '' : 'border-bottom: 1px solid rgba(255,255,255,0.15);') + '">' +
            '<div>' +
            '<p class="text-inter" style="font-size: 14px; font-weight: 600; margin: 0;">' + dateFormatted + ' · ' + (p.horario || '') + '</p>' +
            '<p class="text-inter" style="font-size: 12px; opacity: 0.85; margin: 2px 0 0 0;">' + (p.local || (group && group.nome) || '') + '</p>' +
            '</div>' +
            '<span class="text-inter" style="font-size: 13px; font-weight: 700; color: ' + statusColor + ';">' + statusLabel + '</span>' +
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

            const today = window.Utils && window.Utils.getLocalTodayISO ? window.Utils.getLocalTodayISO() : (() => {
              const d = new Date();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })();
            const upcoming = todasPeladas.filter(p => p.status !== 'finalizada' && p.data >= today).slice(0, 4);

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
                      forma_pagamento: c.forma_pagamento,
                      posicao_fila: c.posicao_fila
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
  _formatTimer: function (secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  },

  // --- Tela de complemento cadastral em tela cheia ------------------------
  _currentRating: 0,

  renderCompletionScreen: function () {
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
        const teamSelect = document.getElementById('comp-team');
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
          } catch (e) { }
        }
        if (whatsappInput && u.whatsapp) whatsappInput.value = Utils.maskPhone(u.whatsapp);
        if (teamSelect && u.time_coracao) teamSelect.value = u.time_coracao;
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

  handleSaveCompletion: async function () {
    const nome = document.getElementById('comp-nome')?.value.trim();
    const apelido = document.getElementById('comp-apelido')?.value.trim();
    const cpf = document.getElementById('comp-cpf')?.value.trim();
    const nascimento = document.getElementById('comp-nascimento')?.value;
    const whatsapp = document.getElementById('comp-whatsapp')?.value.trim();
    const time_coracao = document.getElementById('comp-team')?.value.trim();
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
        autoavaliacao,
        time_coracao
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
  },

  // ─── CARD PREMIUM ───────────────────────────────────────────────────────────

  // Chave de localStorage para persistir o estado premium
  _PREMIUM_KEY: 'peladapro_card_premium_ativo',

  // Verifica e aplica o estado premium ao inicializar o card
  initPremiumState: function () {
    if (localStorage.getItem(this._PREMIUM_KEY) === 'true') {
      this._aplicarEstiloPremium();
    }
  },

  // Abre o modal bottom-sheet premium com dados do atleta
  openModalPremium: function () {
    var user = Auth.currentUser;
    var overlay = document.getElementById('modal-premium-overlay');
    if (!overlay) return;

    // Preenche nome, foto e time no preview do card
    var modalName = document.getElementById('modal-premium-name');
    var modalAvatar = document.getElementById('modal-premium-avatar');
    var modalTeam = document.getElementById('modal-premium-team');
    if (modalName && user) modalName.textContent = user.apelido || user.nome || 'Atleta';
    if (modalAvatar && user && (user.foto || user.photo)) {
      modalAvatar.src = user.foto || user.photo;
    }
    if (modalTeam && user) {
      if (user.time_coracao && user.time_coracao.trim()) {
        modalTeam.textContent = '⚽ ' + user.time_coracao.trim();
        modalTeam.style.display = 'block';
      } else {
        modalTeam.style.display = 'none';
      }
    }

    // Preenche estatísticas completas para o card FIFA UT
    var peladas = Api.getPeladas ? Api.getPeladas() : [];
    var userId = user ? user.id : null;
    var totalJogos = 0, totalGols = 0, totalAssists = 0, totalMvp = 0;
    peladas.forEach(function (p) {
      if (p.jogadores) {
        p.jogadores.forEach(function (j) {
          if (j.usuario_id === userId || j.id === userId) {
            totalJogos++;
            totalGols    += (j.gols || 0);
            totalAssists += (j.assistencias || j.assists || 0);
            if (j.mvp || j.craque) totalMvp++;
          }
        });
      }
    });

    // Rating dinâmico (60–99) baseado em desempenho
    var baseRating = 60;
    var rating = Math.min(99, baseRating + Math.floor(totalJogos * 0.5) + Math.floor(totalGols * 1.2) + Math.floor(totalAssists * 0.8) + totalMvp * 3);
    var elRating = document.getElementById('modal-card-rating');
    if (elRating) elRating.textContent = rating || 75;

    // Velocidade simulada (autoavaliação × 10, 60–99)
    var vel = user && user.autoavaliacao ? Math.min(99, 60 + user.autoavaliacao * 4) : 75;

    var setEl = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val || '—';
    };
    setEl('modal-stat-jogos',  totalJogos);
    setEl('modal-stat-gols',   totalGols);
    setEl('modal-stat-assist', totalAssists || '0');
    setEl('modal-stat-vel',    vel);
    setEl('modal-stat-mvp',    totalMvp || '0');

    // Aplica tema do time no card do modal (preview)
    var fifaCardPreview = document.getElementById('fifa-card-preview');
    if (fifaCardPreview && user) {
      this.applyTeamCardTheme(fifaCardPreview, user.time_coracao);
      var teamTheme = this.getTeamTheme(user.time_coracao);
      if (teamTheme) {
        if (elRating && teamTheme.ratingColor) {
          elRating.style.color = teamTheme.ratingColor;
        }
        if (modalTeam && teamTheme.accent) {
          modalTeam.style.color = teamTheme.accent;
        }
      }
    }

    // Sincroniza o estado dos botões dentro do modal
    var btnUltimate = document.getElementById('btn-modal-ativar-ultimate');
    var btnVip = document.getElementById('btn-modal-adquirir');

    var user = Auth.currentUser;
    var hasUltimate = user && (user.card_ultimate === true || user.plano === 'ultimate' || localStorage.getItem('peladapro_ultimate_purchased') === 'true');
    var isVip = (window.App && window.App.isVipPlan && window.App.isVipPlan());

    var currentCardStyle = localStorage.getItem('peladapro_card_style') || 'free';

    if (btnUltimate) {
      if (hasUltimate) {
        if (currentCardStyle === 'free') {
          btnUltimate.textContent = '⚡ Aplicar Card Ultimate no Perfil';
          btnUltimate.disabled = false;
          btnUltimate.style.opacity = '1';
          btnUltimate.style.background = 'linear-gradient(135deg, #D4AF37, #F5D270)';
          btnUltimate.onclick = function() { Dashboard.ativarApenasCardUltimate(); };
        } else {
          btnUltimate.textContent = '✓ Card Ultimate Ativo';
          btnUltimate.disabled = true;
          btnUltimate.style.opacity = '0.7';
          btnUltimate.style.background = '#64748B';
        }
      } else {
        btnUltimate.textContent = '🏆 Ativar Apenas Card Ultimate';
        btnUltimate.disabled = false;
        btnUltimate.style.opacity = '1';
        btnUltimate.style.background = 'linear-gradient(135deg, #D4AF37, #F5D270)';
        btnUltimate.onclick = function() { Dashboard.ativarApenasCardUltimate(); };
      }
    }

    if (btnVip) {
      if (isVip) {
        if (currentCardStyle === 'free') {
          btnVip.textContent = '⚡ Aplicar Card Premium no Perfil';
          btnVip.disabled = false;
          btnVip.style.opacity = '1';
          btnVip.style.background = 'linear-gradient(135deg, #10B981, #059669)';
          btnVip.onclick = function() { Dashboard.ativarApenasAssinaturaVIP(); };
        } else {
          btnVip.textContent = '✓ Assinatura VIP / Premium Ativa';
          btnVip.disabled = true;
          btnVip.style.opacity = '0.7';
          btnVip.style.background = '#64748B';
        }
      } else {
        btnVip.textContent = '✨ Ativar Assinatura VIP / Premium (Grátis)';
        btnVip.disabled = false;
        btnVip.style.opacity = '1';
        btnVip.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        btnVip.onclick = function() { Dashboard.ativarApenasAssinaturaVIP(); };
      }
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  // Fecha o modal (ao clicar no overlay ou no botão X)
  closeModalPremium: function (event) {
    if (event && event.target !== document.getElementById('modal-premium-overlay')) return;
    document.getElementById('modal-premium-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  },

  // 1. Ativa APENAS o Card Ultimate do Perfil (persiste no backend e localStorage)
  ativarApenasCardUltimate: async function () {
    localStorage.setItem('peladapro_ultimate_purchased', 'true');
    localStorage.setItem('peladapro_card_style', 'fut');

    if (Auth.currentUser) {
      Auth.currentUser.card_ultimate = true;
      Auth.currentUser.card_style = 'fut';
      localStorage.setItem('currentUser', JSON.stringify(Auth.currentUser));
      localStorage.setItem('usuario', JSON.stringify(Auth.currentUser));
    }

    if (window.Api && window.Api.atualizarPerfil) {
      window.Api.atualizarPerfil({ card_ultimate: true, plano: 'ultimate' }).catch(e => console.warn('[Api] Erro ao persistir card_ultimate no backend:', e));
    }

    var btn = document.getElementById('btn-modal-ativar-ultimate');
    if (btn) {
      btn.textContent = '✓ Card Ultimate Adquirido!';
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }

    var self = this;
    setTimeout(function () {
      document.getElementById('modal-premium-overlay')?.classList.remove('open');
      document.body.style.overflow = '';
      self._aplicarEstiloPremium();

      if (window.App && window.App.showToast) {
        window.App.showToast('🏆 Card Ultimate do Perfil ativado com sucesso!', 'success');
      }
    }, 800);
  },

  // 2. Ativa APENAS a Assinatura VIP / Premium (persiste no backend e localStorage)
  ativarApenasAssinaturaVIP: async function () {
    localStorage.setItem('peladapro_vip_adquirido', 'true');
    localStorage.setItem('peladapro_card_style', 'fut');

    if (Auth.currentUser) {
      Auth.currentUser.vip = true;
      Auth.currentUser.premium = true;
      Auth.currentUser.plano = 'vip';
      Auth.currentUser.card_style = 'fut';
      localStorage.setItem('currentUser', JSON.stringify(Auth.currentUser));
      localStorage.setItem('usuario', JSON.stringify(Auth.currentUser));
    }

    if (window.Api && window.Api.atualizarPerfil) {
      window.Api.atualizarPerfil({ vip: true, premium: true, plano: 'vip', card_style: 'fut' }).catch(e => console.warn('[Api] Erro ao persistir VIP no backend:', e));
    }

    var btn = document.getElementById('btn-modal-adquirir');
    if (btn) {
      btn.textContent = '✓ Assinatura VIP Ativada!';
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }

    var self = this;
    setTimeout(function () {
      document.getElementById('modal-premium-overlay')?.classList.remove('open');
      document.body.style.overflow = '';
      self._aplicarEstiloPremium();

      if (window.App && window.App.showToast) {
        window.App.showToast('🎉 Parabéns! Card Premium ativado e aplicado com sucesso!', 'success');
      }
    }, 800);
  },

  ativarCardPremium: function () {
    this.ativarApenasAssinaturaVIP();
  },

  // Aplica o tema visual do time a qualquer elemento de card (com flag !important)
  applyTeamCardTheme: function (cardEl, teamName) {
    if (!cardEl) return;
    var theme = this.getTeamTheme(teamName);
    if (theme) {
      cardEl.classList.add('has-team-theme');
      cardEl.style.setProperty('background', theme.gradient, 'important');
      cardEl.style.setProperty('border-color', theme.border, 'important');
      cardEl.style.setProperty('border-width', '1.5px', 'important');
      cardEl.style.setProperty('box-shadow', `0 16px 40px ${theme.borderGlow}, 0 0 0 1px ${theme.border}`, 'important');

      // Harmoniza o botão Convocação (btn-accent) com as cores de destaque do clube
      var btnAccent = cardEl.querySelector('.btn-accent');
      if (btnAccent) {
        btnAccent.style.setProperty('background', 'linear-gradient(135deg, #F5D270, #D4AF37)', 'important');
        btnAccent.style.setProperty('color', '#1A1A1A', 'important');
        btnAccent.style.setProperty('border-color', '#F5D270', 'important');
      }

      // Harmoniza o botão Editar (btn-outline-secondary) com estilo vidro fosco
      var btnEdit = cardEl.querySelector('.btn-outline-secondary');
      if (btnEdit) {
        btnEdit.style.setProperty('background', 'rgba(255, 255, 255, 0.16)', 'important');
        btnEdit.style.setProperty('color', '#FFFFFF', 'important');
        btnEdit.style.setProperty('border-color', 'rgba(255, 255, 255, 0.45)', 'important');
      }

      // Harmoniza o card Meu Saldo (.card-fifa-balance)
      var balanceBox = cardEl.querySelector('.card-fifa-balance');
      if (balanceBox) {
        balanceBox.style.setProperty('background', 'rgba(0, 0, 0, 0.55)', 'important');
        balanceBox.style.setProperty('border-color', theme.border || 'rgba(245, 210, 112, 0.4)', 'important');

        var balanceLabel = balanceBox.querySelector('.label');
        if (balanceLabel) balanceLabel.style.setProperty('color', theme.accent || '#F5D270', 'important');

        var balanceVal = balanceBox.querySelector('.value');
        if (balanceVal) balanceVal.style.setProperty('color', '#FFFFFF', 'important');
      }
    } else {
      cardEl.classList.remove('has-team-theme');
      if (!cardEl.classList.contains('premium-ativo') && !cardEl.classList.contains('fut-ultimate-ativo')) {
        cardEl.style.removeProperty('background');
        cardEl.style.removeProperty('border-color');
        cardEl.style.removeProperty('border-width');
        cardEl.style.removeProperty('box-shadow');

        var btnAccentReset = cardEl.querySelector('.btn-accent');
        if (btnAccentReset) {
          btnAccentReset.style.removeProperty('background');
          btnAccentReset.style.removeProperty('color');
          btnAccentReset.style.removeProperty('border-color');
        }

        var btnEditReset = cardEl.querySelector('.btn-outline-secondary');
        if (btnEditReset) {
          btnEditReset.style.removeProperty('background');
          btnEditReset.style.removeProperty('color');
          btnEditReset.style.removeProperty('border-color');
        }

        var balanceReset = cardEl.querySelector('.card-fifa-balance');
        if (balanceReset) {
          balanceReset.style.removeProperty('background');
          balanceReset.style.removeProperty('border-color');
          var lblR = balanceReset.querySelector('.label');
          if (lblR) lblR.style.removeProperty('color');
          var valR = balanceReset.querySelector('.value');
          if (valR) valR.style.removeProperty('color');
        }
      }
    }
  },

  // Retorna paleta visual temática baseada no time do coração do atleta
  getTeamTheme: function (teamName) {
    if (!teamName) return null;
    var name = teamName.toLowerCase().trim();

    // Flamengo (Rubro-Negro: Fundo Preto -> Vermelho, Botões e Borda Pretos)
    if (name.includes('flamengo')) {
      return {
        gradient: 'linear-gradient(135deg, #8B1A1A 0%, #3A050A 50%, #C8102E 100%)',
        border: '#8B1A1A',
        borderGlow: 'rgba(200, 16, 46, 0.4)',
        accent: '#FFD700',
        badgeBg: '#000000',
        badgeText: '#FFFFFF',
        ratingColor: '#FFD700'
      };
    }

    // Vasco da Gama (Alvinegro Cruz de Malta)
    if (name.includes('vasco')) {
      return {
        gradient: 'linear-gradient(135deg, #222222 0%, #0D0D0D 50%, #1A1A1A 100%)',
        border: '#FFFFFF',
        borderGlow: 'rgba(255, 255, 255, 0.4)',
        accent: '#F5D270',
        badgeBg: '#111111',
        badgeText: '#FFFFFF',
        ratingColor: '#FFFFFF'
      };
    }

    // Fluminense (Vinho, Verde & Branco)
    if (name.includes('fluminense')) {
      return {
        gradient: 'linear-gradient(135deg, #831D1C 0%, #4A0E0E 40%, #006633 100%)',
        border: '#D4AF37',
        borderGlow: 'rgba(131, 29, 28, 0.5)',
        accent: '#F5D270',
        badgeBg: '#831D1C',
        badgeText: '#FFFFFF',
        ratingColor: '#F5D270'
      };
    }

    // Botafogo (Alvinegro Estrela Solitária)
    if (name.includes('botafogo')) {
      return {
        gradient: 'linear-gradient(135deg, #262626 0%, #0F0F0F 50%, #000000 100%)',
        border: '#D4AF37',
        borderGlow: 'rgba(212, 175, 55, 0.4)',
        accent: '#FFFFFF',
        badgeBg: '#262626',
        badgeText: '#FFFFFF',
        ratingColor: '#FFFFFF'
      };
    }

    // Corinthians (Alvinegro Paulista)
    if (name.includes('corinthians')) {
      return {
        gradient: 'linear-gradient(135deg, #222222 0%, #0D0D0D 50%, #1A1A1A 100%)',
        border: '#FFFFFF',
        borderGlow: 'rgba(255, 255, 255, 0.4)',
        accent: '#F5D270',
        badgeBg: '#111111',
        badgeText: '#FFFFFF',
        ratingColor: '#FFFFFF'
      };
    }

    // Palmeiras (Alviverde)
    if (name.includes('palmeiras')) {
      return {
        gradient: 'linear-gradient(135deg, #006437 0%, #04391F 50%, #011E10 100%)',
        border: '#86EFAC',
        borderGlow: 'rgba(0, 100, 55, 0.5)',
        accent: '#F5D270',
        badgeBg: '#006437',
        badgeText: '#FFFFFF',
        ratingColor: '#86EFAC'
      };
    }

    // São Paulo (Tricolor Paulista)
    if (name.includes('são paulo') || name.includes('sao paulo')) {
      return {
        gradient: 'linear-gradient(135deg, #C8102E 0%, #2B0007 45%, #0A0A0A 100%)',
        border: '#FFFFFF',
        borderGlow: 'rgba(200, 16, 46, 0.4)',
        accent: '#F5D270',
        badgeBg: '#C8102E',
        badgeText: '#FFFFFF',
        ratingColor: '#FFFFFF'
      };
    }

    // Santos (Alvinegro Praiano)
    if (name.includes('santos')) {
      return {
        gradient: 'linear-gradient(135deg, #2C2C2C 0%, #141414 50%, #000000 100%)',
        border: '#D4AF37',
        borderGlow: 'rgba(212, 175, 55, 0.4)',
        accent: '#F5D270',
        badgeBg: '#1F1F1F',
        badgeText: '#FFFFFF',
        ratingColor: '#F5D270'
      };
    }

    // Red Bull Bragantino
    if (name.includes('bragantino')) {
      return {
        gradient: 'linear-gradient(135deg, #D31411 0%, #6E0907 45%, #0B1A30 100%)',
        border: '#D31411',
        borderGlow: 'rgba(211, 20, 17, 0.5)',
        accent: '#FFFFFF',
        badgeBg: '#D31411',
        badgeText: '#FFFFFF',
        ratingColor: '#FFFFFF'
      };
    }

    // Ponte Preta
    if (name.includes('ponte preta')) {
      return {
        gradient: 'linear-gradient(135deg, #2A2A2A 0%, #121212 50%, #000000 100%)',
        border: '#FFFFFF',
        borderGlow: 'rgba(255, 255, 255, 0.3)',
        accent: '#FFFFFF',
        badgeBg: '#1A1A1A',
        badgeText: '#FFFFFF',
        ratingColor: '#FFFFFF'
      };
    }

    // Guarani
    if (name.includes('guarani')) {
      return {
        gradient: 'linear-gradient(135deg, #005931 0%, #02341D 50%, #001A0E 100%)',
        border: '#86EFAC',
        borderGlow: 'rgba(0, 89, 49, 0.5)',
        accent: '#FFFFFF',
        badgeBg: '#005931',
        badgeText: '#FFFFFF',
        ratingColor: '#86EFAC'
      };
    }

    // Atlético Mineiro (Galo Alvinegro)
    if (name.includes('atlético mineiro') || name.includes('atletico mineiro') || name.includes('galo')) {
      return {
        gradient: 'linear-gradient(135deg, #222222 0%, #0F0F0F 50%, #000000 100%)',
        border: '#D4AF37',
        borderGlow: 'rgba(212, 175, 55, 0.5)',
        accent: '#F5D270',
        badgeBg: '#141414',
        badgeText: '#FFFFFF',
        ratingColor: '#F5D270'
      };
    }

    // Cruzeiro (Azul Celeste / Royal)
    if (name.includes('cruzeiro')) {
      return {
        gradient: 'linear-gradient(135deg, #003399 0%, #001F66 50%, #050E2E 100%)',
        border: '#93C5FD',
        borderGlow: 'rgba(0, 51, 153, 0.5)',
        accent: '#FFFFFF',
        badgeBg: '#003399',
        badgeText: '#FFFFFF',
        ratingColor: '#93C5FD'
      };
    }

    // América Mineiro (Coelho Verde & Preto)
    if (name.includes('américa mineiro') || name.includes('america mineiro')) {
      return {
        gradient: 'linear-gradient(135deg, #008040 0%, #004D26 45%, #051A0E 100%)',
        border: '#86EFAC',
        borderGlow: 'rgba(0, 128, 64, 0.5)',
        accent: '#F5D270',
        badgeBg: '#008040',
        badgeText: '#FFFFFF',
        ratingColor: '#86EFAC'
      };
    }

    return null;
  },

  // --- Modo Noturno no Tema do Time -------------------------------------
  toggleModoNoturno: function () {
    if (window.App && window.App.toggleModoNoturnoGlobal) {
      window.App.toggleModoNoturnoGlobal();
    }
  },

  applyModoNoturno: function (isNight) {
    var card = document.getElementById('player-fifa-card');
    var user = Auth.currentUser;
    if (card && isNight && user && user.time_coracao) {
      var style = localStorage.getItem('peladapro_card_style') || 'free';
      if (style !== 'free') {
        this.applyTeamCardTheme(card, user.time_coracao);
      }
    }
  },

  initPremiumState: function () {
    this.initCardStyle();
  },

  initCardStyle: function () {
    var user = Auth.currentUser;
    var disabledList = JSON.parse(localStorage.getItem('peladapro_disabled_premium_athletes') || '[]');
    var isAthleteDisabledByMaster = user && disabledList.map(String).includes(String(user.id));

    var hasUltimateCard = user && (user.card_ultimate === true || user.plano === 'ultimate' || user.card_style === 'fut' || localStorage.getItem('peladapro_ultimate_purchased') === 'true');
    var isVipUser = (window.App && window.App.isVipPlan && window.App.isVipPlan());
    var savedStyle = localStorage.getItem('peladapro_card_style');

    var initialStyle = 'free';
    if (!isAthleteDisabledByMaster && (hasUltimateCard || isVipUser)) {
      initialStyle = (savedStyle === 'free') ? 'fut' : (savedStyle || 'fut');
      localStorage.setItem('peladapro_card_style', initialStyle);
    } else {
      localStorage.setItem('peladapro_card_style', 'free');
      initialStyle = 'free';
    }

    this.applyCardStyle(initialStyle);
  },

  // Aplica o estilo de card do perfil ('free', 'premium', 'fut')
  applyCardStyle: function (style) {
    var card = document.getElementById('player-fifa-card');
    var badgeVip = document.getElementById('badge-vip-card');
    var user = Auth.currentUser;

    var disabledList = JSON.parse(localStorage.getItem('peladapro_disabled_premium_athletes') || '[]');
    var isAthleteDisabledByMaster = user && disabledList.map(String).includes(String(user.id));

    if (isAthleteDisabledByMaster) {
      style = 'free';
      localStorage.removeItem('peladapro_ultimate_purchased');
      localStorage.removeItem('peladapro_vip_adquirido');
      localStorage.removeItem('peladapro_premium_adquirido');
      localStorage.setItem('peladapro_card_style', 'free');
      if (user) {
        user.card_ultimate = false;
        user.vip = false;
        user.premium = false;
        user.plano = 'gratis';
        user.card_style = 'free';
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('usuario', JSON.stringify(user));
      }
    }

    if (style === 'premium') style = 'fut';
    if (!style) style = 'free';

    localStorage.setItem('peladapro_card_style', style);

    if (style === 'free') {
      if (card) {
        card.classList.remove('premium-ativo', 'fut-ultimate-ativo', 'has-team-theme');
        card.removeAttribute('style');
        card.querySelectorAll('[style]').forEach(function (el) {
          el.removeAttribute('style');
        });
      }
      if (badgeVip) {
        badgeVip.classList.add('hidden');
      }
      this.updatePremiumButtonState();
      return;
    }

    if (card) {
      card.classList.remove('premium-ativo', 'fut-ultimate-ativo');

      if (style === 'fut') {
        card.classList.add('fut-ultimate-ativo');
      }

      if (user && user.time_coracao) {
        this.applyTeamCardTheme(card, user.time_coracao);
      }
    }

    if (badgeVip) {
      badgeVip.classList.toggle('hidden', style === 'free');
    }

    this.updatePremiumButtonState();
  },

  _aplicarEstiloPremium: function () {
    this.applyCardStyle('fut');
  },

  _removerEstiloPremium: function () {
    this.applyCardStyle('free');
  },

  toggleCardPremiumTeste: function () {
    var user = Auth.currentUser;
    var disabledList = JSON.parse(localStorage.getItem('peladapro_disabled_premium_athletes') || '[]');
    if (user && disabledList.map(String).includes(String(user.id))) {
      if (window.App && window.App.showToast) {
        window.App.showToast("🚫 O Card Premium deste atleta foi desativado pelo Controle Master.", "warning");
      }
      this.applyCardStyle('free');
      return;
    }

    var currentStyle = localStorage.getItem('peladapro_card_style') || 'free';
    var nextStyle = currentStyle === 'free' ? 'fut' : 'free';
    this.applyCardStyle(nextStyle);
  },

  // Sincroniza o estado do botão de upgrade ou teste de Card Premium
  updatePremiumButtonState: function () {
    var btnUpgrade = document.getElementById('btn-upgrade-premium');
    if (!btnUpgrade) return;

    var user = Auth.currentUser;
    var disabledList = JSON.parse(localStorage.getItem('peladapro_disabled_premium_athletes') || '[]');
    var isAthleteDisabledByMaster = user && disabledList.map(String).includes(String(user.id));
    var style = localStorage.getItem('peladapro_card_style') || 'free';

    if (isAthleteDisabledByMaster) {
      btnUpgrade.classList.remove('ativo');
      btnUpgrade.textContent = '⭐ Ativar Card Premium';
      btnUpgrade.style.background = 'linear-gradient(135deg, #D4AF37, #F5D270, #D4AF37)';
      btnUpgrade.style.borderColor = '#D4AF37';
      btnUpgrade.style.color = '#1A1A1A';
      btnUpgrade.onclick = function () {
        Dashboard.openModalPremium();
      };
      return;
    }

    if (style !== 'free') {
      var isNight = localStorage.getItem('peladapro_modo_noturno') === 'true';
      btnUpgrade.classList.add('ativo');
      btnUpgrade.textContent = isNight ? '☀️ Alternar para Modo Claro' : '🌙 Alternar Modo Noturno (Tema do Time)';
      btnUpgrade.style.background = isNight ? '#0F172A' : 'linear-gradient(135deg, #1E293B, #0F172A)';
      btnUpgrade.style.borderColor = '#F5D270';
      btnUpgrade.style.color = '#F5D270';
      btnUpgrade.onclick = function () {
        window.App.toggleModoNoturnoGlobal();
      };
    } else {
      btnUpgrade.classList.remove('ativo');
      btnUpgrade.textContent = '⭐ Ativar Card Premium';
      btnUpgrade.style.background = 'linear-gradient(135deg, #D4AF37, #F5D270, #D4AF37)';
      btnUpgrade.style.borderColor = '#D4AF37';
      btnUpgrade.style.color = '#1A1A1A';
      btnUpgrade.onclick = function () {
        Dashboard.openModalPremium();
      };
    }
  }
};

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initDashboard = async function () {
  if (window.Auth && window.Auth.refreshCurrentUser) {
    await window.Auth.refreshCurrentUser();
  }
  Dashboard.init();
};
