// ==========================================================================
// pages/jogador/dashboard.js — Lógica do Dashboard do Atleta
// Padrão: Dashboard object (spec) exposto em window.App.initDashboard
// ==========================================================================

var Dashboard = {

  _pollingTimer: null,

  init: function() {
    const user = Auth.currentUser;
    // Se o perfil do atleta estiver incompleto (faltar nome, cpf ou data_nascimento)
    if (user && (!user.nome || !user.cpf || !user.data_nascimento)) {
      this.renderCompletionScreen();
      return;
    }

    // Exibe a barra de abas que pode ter sido ocultada
    const tabsNav = document.getElementById('jogador-tabs-nav');
    if (tabsNav) tabsNav.style.display = 'flex';

    this.renderPlayerData();
    this.renderNextMatches();
    this.renderLiveMatch();
    this.renderQueueList();
    this._startPolling();
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
    var ageEl = document.getElementById('player-card-age');
    if (ageEl) ageEl.textContent = typeof age === 'number' ? age : '—';

    // Foto
    var avatarEl = document.getElementById('player-avatar');
    if (avatarEl) {
      avatarEl.src = user.foto || user.photo || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80';
    }

    // Estrelas
    var starsEl = document.getElementById('player-card-stars');
    if (starsEl) {
      var rating = user.autoavaliacao || user.avaliacao_media || 0;
      starsEl.innerHTML = Utils.starsHTML(Math.round(rating));
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
  renderNextMatches: function() {
    var listEl = document.getElementById('next-matches-list');
    if (!listEl) return;

    var peladas = Api.getPeladas();
    var group   = Auth.currentGroup;
    var groupId = group ? group.id : null;

    var today = new Date().toISOString().split('T')[0];
    var upcoming = peladas.filter(function(p) {
      return p.status === 'agendada' && p.data >= today &&
             (!groupId || p.grupo_id === groupId);
    }).sort(function(a, b) { return a.data.localeCompare(b.data); }).slice(0, 4);

    var convocations = Api.getConvocations();
    var userId       = Auth.currentUser ? Auth.currentUser.id : null;

    if (upcoming.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding: 32px;"><span style="font-size: 32px;">🏟️</span><p class="text-inter" style="font-size: 14px;">Nenhuma pelada futura agendada.</p></div>';
      return;
    }

    var html = '';
    upcoming.forEach(function(p, idx) {
      var myConv  = convocations.find(function(c) { return c.pelada_id === p.id && c.player_id === userId; });
      var status  = myConv ? myConv.status : 'pendente';
      var isLast  = idx === upcoming.length - 1;

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
          '<p class="text-inter" style="font-size: 12px; color: var(--text-caption);">' + (p.local || Auth.currentGroup?.nome || '') + '</p>' +
        '</div>' +
        '<span class="text-inter" style="font-size: 13px; font-weight: 700; color: ' + s.color + ';">' + s.label + '</span>' +
      '</div>';
    });

    listEl.innerHTML = html;
  },

  // --- Partida ao vivo ----------------------------------------------------
  renderLiveMatch: function() {
    var match = window.App.liveMatch;
    if (!match) return;

    var teamAName  = document.getElementById('live-team-a-name');
    var teamBName  = document.getElementById('live-team-b-name');
    var scoreA     = document.getElementById('live-team-a-score');
    var scoreB     = document.getElementById('live-team-b-score');
    var timerEl    = document.getElementById('live-match-timer');
    var progressEl = document.getElementById('live-match-timer-progress');

    if (teamAName)  teamAName.textContent  = match.teamA || 'Time A';
    if (teamBName)  teamBName.textContent  = match.teamB || 'Time B';
    if (scoreA)     scoreA.textContent     = match.scoreA || 0;
    if (scoreB)     scoreB.textContent     = match.scoreB || 0;

    var configs = Api.getConfigs();
    var group   = Auth.currentGroup;
    var config  = group ? configs.find(function(c) { return c.grupo_id === group.id; }) : null;
    var matchMinutes = (config && config.tempo_partida) ? config.tempo_partida : 15;

    var totalSecs = matchMinutes * 60;
    var remaining = match.timerSeconds || 0;
    var elapsed = Math.max(0, totalSecs - remaining);

    if (timerEl)    timerEl.textContent    = Dashboard._formatTimer(remaining);
    if (progressEl) progressEl.style.width = Math.min(100, (elapsed / totalSecs) * 100) + '%';
  },

  // --- Fila de espera -----------------------------------------------------
  renderQueueList: function() {
    var containerEl = document.getElementById('dashboard-queue-list');
    if (!containerEl) return;

    var queue = window.App.waitingQueue || [];
    var listEl = containerEl.querySelector('.queue-list');
    if (!listEl) return;

    if (queue.length === 0) {
      listEl.innerHTML = '<p class="text-inter" style="text-align: center; font-size: 13px; color: var(--text-caption); padding: 16px;">Nenhum time na fila.</p>';
      return;
    }

    var html = '';
    queue.forEach(function(name, idx) {
      html += '<div class="queue-item">' +
        '<span class="pos">' + (idx + 1) + '</span>' +
        '<span class="text-inter" style="font-size: 14px; font-weight: 600;">' + name + '</span>' +
        (idx === 0 ? '<span class="text-inter" style="font-size: 11px; color: var(--success); font-weight: 700;">PRÓXIMO</span>' : '') +
      '</div>';
    });
    listEl.innerHTML = html;
  },

  // --- Polling de atualização ao vivo (a cada 5s) -------------------------
  _startPolling: function() {
    if (Dashboard._pollingTimer) clearInterval(Dashboard._pollingTimer);
    Dashboard._pollingTimer = setInterval(function() {
      Dashboard.renderLiveMatch();
      Dashboard.renderQueueList();
    }, 5000);
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

        // 3. Inicializar os inputs da tela
        const nomeInput = document.getElementById('comp-nome');
        const cpfInput = document.getElementById('comp-cpf');
        const whatsappInput = document.getElementById('comp-whatsapp');
        const saveBtn = document.getElementById('btn-save-cadastro');
        const stars = document.querySelectorAll('#comp-stars-selector .comp-rating-star');

        // Pré-carregar o nome completo do jogador logado
        if (nomeInput && Auth.currentUser) {
          nomeInput.value = Auth.currentUser.nome || '';
        }

        // Aplicar máscaras
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

        // Seleção de estrelas
        this._currentRating = 0;
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
window.App.initDashboard = function() {
  Dashboard.init();
};
