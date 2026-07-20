// ==========================================================================
// pages/jogador/acompanhamento.js — Partida ao Vivo (Módulo Jogador)
// ==========================================================================

var Acompanhamento = {

  _pollingTimer: null,

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

    if (teamAName) teamAName.textContent = match.teamA || 'Time A';
    if (teamBName) teamBName.textContent = match.teamB || 'Time B';
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
        var nome = p ? p.nome.split(' ')[0] : tp.nome || '?';
        var stars = p ? '★'.repeat(p.autoavaliacao || 0) : '';
        return nome + ' ' + stars;
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

    var colors = ['var(--success)', 'var(--warning)', 'var(--accent)', 'var(--danger)'];
    var html = '';
    queue.forEach(function(name, idx) {
      var borderColor = colors[idx] || 'var(--primary)';
      html += '<div class="queue-item" style="border-left-color: ' + borderColor + ';">' +
        '<span class="pos">' + (idx + 1) + '</span>' +
        '<span class="text-inter" style="font-size: 14px; font-weight: 600;">' + name + '</span>' +
        (idx === 0 ? '<span class="text-inter" style="font-size: 11px; font-weight: 700; color: var(--success);">PRÓXIMO ▶</span>' : '') +
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
