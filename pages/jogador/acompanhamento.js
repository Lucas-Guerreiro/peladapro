// ==========================================================================
// pages/jogador/acompanhamento.js — Partida ao Vivo (Módulo Jogador)
// ==========================================================================

var Acompanhamento = {

  _pollingTimer: null,

  _getTeamTheme: function(teamName) {
    var name = (teamName || '').toLowerCase();
    
    if (name.includes('verm') || name.includes('red')) {
      return {
        bg: 'rgba(239, 83, 80, 0.15)',
        border: '#EF5350',
        text: '#FF8A80'
      };
    }
    if (name.includes('verd') || name.includes('green')) {
      return {
        bg: 'rgba(102, 187, 106, 0.15)',
        border: '#66BB6A',
        text: '#B9F6CA'
      };
    }
    if (name.includes('azul') || name.includes('blue')) {
      return {
        bg: 'rgba(66, 165, 245, 0.15)',
        border: '#42A5F5',
        text: '#82B1FF'
      };
    }
    if (name.includes('amar') || name.includes('yellow')) {
      return {
        bg: 'rgba(255, 238, 88, 0.12)',
        border: '#FFEE58',
        text: '#FFFF8D'
      };
    }
    if (name.includes('branc') || name.includes('white')) {
      return {
        bg: 'rgba(255, 255, 255, 0.1)',
        border: 'rgba(255, 255, 255, 0.6)',
        text: '#FFFFFF'
      };
    }
    if (name.includes('pret') || name.includes('black')) {
      return {
        bg: 'rgba(33, 33, 33, 0.5)',
        border: '#424242',
        text: '#E0E0E0'
      };
    }
    if (name.includes('laran') || name.includes('orange')) {
      return {
        bg: 'rgba(255, 167, 38, 0.15)',
        border: '#FFA726',
        text: '#FFD180'
      };
    }
    if (name.includes('cinz') || name.includes('gray') || name.includes('grey')) {
      return {
        bg: 'rgba(189, 189, 189, 0.15)',
        border: '#BDBDBD',
        text: '#EEEEEE'
      };
    }
    
    // Default para Time A / Time B
    if (name.includes('time a') || name.includes('a')) {
      return {
        bg: 'rgba(0, 229, 118, 0.1)',
        border: 'var(--primary)',
        text: 'var(--primary)'
      };
    }
    return {
      bg: 'rgba(142, 36, 170, 0.15)',
      border: 'var(--secondary)',
      text: '#E040FB'
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

    var group   = Auth.currentGroup;
    var configs = Api.getConfigs();
    var config  = group ? configs.find(function(c) { return c.grupo_id === group.id; }) : null;
    var totalSecs = (config && config.tempo_partida) ? config.tempo_partida * 60 : 900; // 15min default

    var elapsed = match ? (match.timerSeconds || 0) : 0;
    var totalMin = Math.floor(totalSecs / 60);
    var m = Math.floor(elapsed / 60);
    var s = elapsed % 60;
    var elapsedStr = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;

    if (timerText) timerText.textContent = elapsedStr + ' / ' + totalMin + ':00';
    if (progress)  progress.style.width = Math.min(100, (elapsed / totalSecs) * 100) + '%';

    if (status) {
      if (!match || !match.timerRunning) {
        status.textContent = elapsed > 0 ? 'Pausado' : 'Aguardando início';
      } else {
        status.textContent = 'Partida em andamento';
      }
    }
  },

  // --- Placar e Times ----------------------------------------------------
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
      teamAName.style.fontWeight = 'bold';
    }
    var cardA = document.getElementById('acomp-team-a');
    if (cardA) {
      cardA.style.background = themeA.bg;
      cardA.style.border = '1.5px solid ' + themeA.border;
      cardA.style.transition = 'all 0.3s ease';
    }

    if (teamBName) {
      teamBName.textContent = match.teamB || 'Time B';
      teamBName.style.color = themeB.text;
      teamBName.style.fontWeight = 'bold';
    }
    var cardB = document.getElementById('acomp-team-b');
    if (cardB) {
      cardB.style.background = themeB.bg;
      cardB.style.border = '1.5px solid ' + themeB.border;
      cardB.style.transition = 'all 0.3s ease';
    }

    if (scoreA)    scoreA.textContent    = match.scoreA || 0;
    if (scoreB)    scoreB.textContent    = match.scoreB || 0;

    // Jogadores dos times
    var teams   = Api.getTeams();
    var players = Api.getPlayers();

    function getTeamPlayersHTML(teamName) {
      var team = teams.find(function(t) { return t.nome === teamName; });
      if (!team || !team.players || team.players.length === 0) return '—';
      return team.players.slice(0, 4).map(function(tp) {
        var p = players.find(function(pl) { return pl.id === tp.id; });
        return p ? p.nome.split(' ')[0] : tp.nome || '?';
      }).join('<br>');
    }

    if (teamAPlayers) teamAPlayers.innerHTML = getTeamPlayersHTML(match.teamA);
    if (teamBPlayers) teamBPlayers.innerHTML = getTeamPlayersHTML(match.teamB);
  },

  // --- Fila de Espera ----------------------------------------------------
  renderQueue: function() {
    var listEl   = document.getElementById('acomp-queue-list');
    var countEl  = document.getElementById('acomp-queue-count');
    var queue    = window.App.waitingQueue || [];

    if (countEl) countEl.textContent = queue.length + ' time(s)';

    if (!listEl) return;

    if (queue.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding: 24px;"><p class="text-inter" style="font-size: 13px;">Nenhum time na fila.</p></div>';
      return;
    }

    var self = this;
    var html = '';
    queue.forEach(function(name, idx) {
      var theme = self._getTeamTheme(name);
      html += '<div class="queue-item" style="background: rgba(255,255,255,0.03); margin-bottom: 8px; border-radius: 6px; padding: 12px; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border-color); border-left: 4px solid ' + theme.border + ';">' +
        '<div style="display: flex; align-items: center; gap: 12px;">' +
          '<span class="pos" style="color: ' + theme.text + '; font-weight: bold; font-family: monospace;">' + (idx + 1) + '</span>' +
          '<span class="text-inter" style="font-size: 14px; font-weight: 600; color: var(--text-main);">' + name + '</span>' +
        '</div>' +
        (idx === 0 ? '<span class="text-inter" style="font-size: 10px; font-weight: 700; color: var(--primary); letter-spacing: 0.5px;">PRÓXIMO ▶</span>' : '') +
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
      gols: 'Time vencedor permanece em campo',
      vitórias: 'Sai após 2 vitórias consecutivas',
      tempo: 'Partidas de ' + (config && config.tempo_partida ? config.tempo_partida : 15) + ' minutos'
    };
    ruleEl.textContent = criterios.length > 0 ? (labels[criterios[0]] || criterios[0]) : 'Regra padrão: mais gols vence';
  },

  // --- Polling -----------------------------------------------------------
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
