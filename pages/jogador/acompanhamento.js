// ==========================================================================
// pages/jogador/acompanhamento.js — Partida ao Vivo (Módulo Jogador Redesign Responsivo)
// ==========================================================================

var Acompanhamento = {

  _pollingTimer: null,

  // Lista de imagens premium para os avatares mockados de atletas
  _avatarStock: [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=80&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&auto=format&fit=crop&q=80'
  ],

  // Mapeamento visual das cores dos times (fundo branco puro com bordas finas coloridas)
  _getTeamTheme: function(teamName) {
    var name = (teamName || '').toLowerCase().trim();
    
    // Se o time contiver A ou Azul
    if (name === 'a' || name.endsWith(' a') || name.includes('azul') || name.includes('blue')) {
      return {
        bg: '#FFFFFF',
        border: '#BAE6FD',
        text: '#0284C7'
      };
    }
    // Se o time contiver B ou Amarelo
    if (name === 'b' || name.endsWith(' b') || name.includes('amar') || name.includes('yellow')) {
      return {
        bg: '#FFFFFF',
        border: '#FEF08A',
        text: '#D97706'
      };
    }
    // Se o time contiver C ou Vermelho
    if (name === 'c' || name.endsWith(' c') || name.includes('verm') || name.includes('red')) {
      return {
        bg: '#FFFFFF',
        border: '#FCA5A5',
        text: '#EF4444'
      };
    }
    // Se o time contiver D ou Verde
    if (name === 'd' || name.endsWith(' d') || name.includes('verd') || name.includes('green')) {
      return {
        bg: '#FFFFFF',
        border: '#86EFAC',
        text: '#10B981'
      };
    }
    // Time E (Laranja)
    if (name === 'e' || name.endsWith(' e') || name.includes('laranja') || name.includes('orange')) {
      return {
        bg: '#FFFFFF',
        border: '#FED7AA',
        text: '#EA580C'
      };
    }
    // Time F (Roxo)
    if (name === 'f' || name.endsWith(' f') || name.includes('roxo') || name.includes('purple')) {
      return {
        bg: '#FFFFFF',
        border: '#E9D5FF',
        text: '#9333EA'
      };
    }
    // Time G (Rosa)
    if (name === 'g' || name.endsWith(' g') || name.includes('rosa') || name.includes('pink')) {
      return {
        bg: '#FFFFFF',
        border: '#FBCFE8',
        text: '#DB2777'
      };
    }
    // Time H (Ciano)
    if (name === 'h' || name.endsWith(' h') || name.includes('ciano') || name.includes('cyan')) {
      return {
        bg: '#FFFFFF',
        border: '#A5F3FC',
        text: '#0891B2'
      };
    }

    // Fallback padrão se não bater
    return {
      bg: '#FFFFFF',
      border: '#E2E8F0',
      text: '#475569'
    };
  },

  init: function() {
    this.render();
    this._startPolling();
  },

  render: function() {
    this.renderTimer();
    this.renderScore();
    this.renderQueue();
    this.renderRule();
  },

  // --- Cronômetro --------------------------------------------------------
  renderTimer: function() {
    var match = window.App.liveMatch;
    var timerText = document.getElementById('acomp-timer-text');
    var progress  = document.getElementById('acomp-timer-progress');
    var status    = document.getElementById('acomp-timer-status');
    var timerDot  = document.getElementById('acomp-timer-dot');

    var group   = Auth.currentGroup;
    var configs = Api.getConfigs();
    var config  = group ? configs.find(function(c) { return c.grupo_id === group.id; }) : null;
    var totalSecs = (config && config.tempo_partida) ? config.tempo_partida * 60 : 900; // 15min default

    var remaining = match ? (match.timerSeconds || 0) : 0;
    var totalMin = Math.floor(totalSecs / 60);
    var m = Math.floor(remaining / 60);
    var s = remaining % 60;
    var remainingStr = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;

    var elapsed = Math.max(0, totalSecs - remaining);

    if (timerText) timerText.textContent = remainingStr + ' / ' + (totalMin < 10 ? '0' : '') + totalMin + ':00';
    if (progress)  progress.style.width = Math.min(100, (elapsed / totalSecs) * 100) + '%';

    if (status) {
      if (!match || !match.timerRunning) {
        status.textContent = elapsed > 0 ? 'Pausado' : 'Aguardando início';
        if (timerDot) timerDot.className = 'acomp-pulse-dot-clear paused';
      } else {
        status.textContent = 'Partida em andamento';
        if (timerDot) timerDot.className = 'acomp-pulse-dot-clear';
      }
    }
  },

  // --- Placar e Times (Com fotos e alinhamentos simétricos) --------------
  renderScore: function() {
    var match = window.App.liveMatch;
    if (!match) return;

    var teamAName    = document.getElementById('acomp-team-a-name');
    var teamBName    = document.getElementById('acomp-team-b-name');
    var scoreA       = document.getElementById('acomp-score-a');
    var scoreB       = document.getElementById('acomp-score-b');
    var teamAPlayers = document.getElementById('acomp-team-a-players');
    var teamBPlayers = document.getElementById('acomp-team-b-players');

    var themeA = this._getTeamTheme(match.teamA);
    var themeB = this._getTeamTheme(match.teamB);

    if (teamAName) {
      teamAName.textContent = match.teamA || 'Time A';
      teamAName.style.color = themeA.text;
    }
    var cardA = document.getElementById('acomp-team-a');
    if (cardA) {
      cardA.style.background = themeA.bg;
      cardA.style.border = '1px solid ' + themeA.border;
    }

    if (teamBName) {
      teamBName.textContent = match.teamB || 'Time B';
      teamBName.style.color = themeB.text;
    }
    var cardB = document.getElementById('acomp-team-b');
    if (cardB) {
      cardB.style.background = themeB.bg;
      cardB.style.border = '1px solid ' + themeB.border;
    }

    if (scoreA) scoreA.textContent = match.scoreA || 0;
    if (scoreB) scoreB.textContent = match.scoreB || 0;

    // Jogadores dos times
    var teams   = Api.getTeams();
    var players = Api.getPlayers();
    var self    = this;

    function getTeamPlayersHTML(teamName, theme, isRightAligned) {
      var team = teams.find(function(t) { return t.nome === teamName; });
      if (!team || !team.players || team.players.length === 0) {
        return '<div style="font-size: 13px; color: #64748b; text-align: center; width: 100%;">—</div>';
      }
      return team.players.slice(0, 4).map(function(tp) {
        var p = players.find(function(pl) { return pl.id === tp.id; });
        var nome = p ? p.nome.split(' ')[0] : tp.nome || '?';
        
        var fotoIndex = p ? p.id % self._avatarStock.length : 0;
        var fotoUrl = p && p.foto ? p.foto : self._avatarStock[fotoIndex];

        if (isRightAligned) {
          return '<div class="acomp-player-item-clear" style="justify-content: flex-end; text-align: right; gap: 8px;">' +
            '<span class="acomp-player-name-clear">' + nome + '</span>' +
            '<img class="acomp-player-avatar-clear" src="' + fotoUrl + '" style="border: 1.5px solid ' + theme.border + ';">' +
          '</div>';
        } else {
          return '<div class="acomp-player-item-clear" style="gap: 8px;">' +
            '<img class="acomp-player-avatar-clear" src="' + fotoUrl + '" style="border: 1.5px solid ' + theme.border + ';">' +
            '<span class="acomp-player-name-clear">' + nome + '</span>' +
          '</div>';
        }
      }).join('');
    }

    if (teamAPlayers) teamAPlayers.innerHTML = getTeamPlayersHTML(match.teamA, themeA, false);
    if (teamBPlayers) teamBPlayers.innerHTML = getTeamPlayersHTML(match.teamB, themeB, true);
  },

  // --- Fila de Espera (Com avatar stack e tags de ordem) ------------------
  renderQueue: function() {
    var listEl   = document.getElementById('acomp-queue-list');
    var countEl  = document.getElementById('acomp-queue-count');
    var queue    = window.App.waitingQueue || [];

    if (countEl) countEl.textContent = queue.length + ' time(s)';

    if (!listEl) return;

    if (queue.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding: 24px; text-align: center;"><p class="text-inter" style="font-size: 13px; color: #64748b;">Nenhum time na fila.</p></div>';
      return;
    }

    var self = this;
    var teams = Api.getTeams();
    var players = Api.getPlayers();
    var html = '';

    queue.forEach(function(name, idx) {
      var theme = self._getTeamTheme(name);
      var teamObj = teams.find(function(t) { return t.nome === name; });
      
      // Montagem do avatar stack (máximo 3 fotos)
      var avatarsHTML = '<div class="acomp-queue-badge-stack-clear">';
      if (teamObj && teamObj.players && teamObj.players.length > 0) {
        teamObj.players.slice(0, 3).forEach(function(tp) {
          var p = players.find(function(pl) { return pl.id === tp.id; });
          var fotoIndex = p ? p.id % self._avatarStock.length : 0;
          var fUrl = p && p.foto ? p.foto : self._avatarStock[fotoIndex];
          avatarsHTML += '<img class="acomp-queue-avatar-clear" src="' + fUrl + '" style="border-color: ' + theme.border + ';">';
        });
      } else {
        avatarsHTML += '<div style="width: 20px; height: 20px; border-radius: 50%; background: ' + theme.bg + '; border: 1.5px solid ' + theme.border + '; display: flex; align-items: center; justify-content: center;"><span style="font-size: 9px; color: ' + theme.text + '; font-weight: bold;">⚽</span></div>';
      }
      avatarsHTML += '</div>';

      html += '<div class="acomp-queue-item-clear" style="border-left: 4px solid ' + theme.border + ';">' +
        '<div class="acomp-queue-team-info-clear">' +
          '<span class="acomp-queue-pos-clear" style="color: ' + theme.text + ';">' + (idx + 1) + '</span>' +
          avatarsHTML +
          '<span class="acomp-queue-team-name-clear">' + name + '</span>' +
        '</div>' +
        (idx === 0 ? '<span class="acomp-next-badge-clear">PRÓXIMO ➜</span>' : '') +
      '</div>';
    });

    listEl.innerHTML = html;
  },

  // --- Regra Ativa -------------------------------------------------------
  renderRule: function() {
    var ruleEl = document.getElementById('acomp-rule-text');
    if (!ruleEl) return;

    var group   = Auth.currentGroup;
    var configs = Api.getConfigs();
    var config  = group ? configs.find(function(c) { return c.grupo_id === group.id; }) : null;

    var criterios = config && config.criterios_empate ? config.criterios_empate : [];
    var labels    = {
      gols: 'REGRA PADRÃO: MAIS GOLS VENCE',
      vitórias: 'REGRA: SAI APÓS 2 VITÓRIAS CONSECUTIVAS',
      tempo: 'REGRA: PARTIDAS DE ' + (config && config.tempo_partida ? config.tempo_partida : 15) + ' MINUTOS'
    };
    
    var ruleText = criterios.length > 0 ? (labels[criterios[0]] || ('REGRA: ' + criterios[0].toUpperCase())) : 'REGRA PADRÃO: MAIS GOLS VENCE';
    ruleEl.textContent = ruleText;
  },

  // --- Polling de atualização --------------------------------------------
  _startPolling: function() {
    if (Acompanhamento._pollingTimer) clearInterval(Acompanhamento._pollingTimer);
    Acompanhamento._pollingTimer = setInterval(function() {
      Acompanhamento.render();
    }, 3000);
  }
};

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initAcompanhamento = function() {
  Acompanhamento.init();
};
