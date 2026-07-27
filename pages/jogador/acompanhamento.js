// ==========================================================================
// pages/jogador/acompanhamento.js — Partida ao Vivo (Módulo Jogador Redesign Responsivo)
// ==========================================================================

var Acompanhamento = {

  _pollingTimer: null,
  _localTimer: null,

  // Mapeamento visual das cores dos times (fundo branco puro com bordas finas coloridas)
  _getTeamTheme: function(teamName) {
    var name = (teamName || '').toLowerCase().trim();
    name = name.replace(/^time\s+/, '').trim();
    
    if (name === 'a' || name.includes('azul') || name.includes('blue')) {
      return { bg: '#FFFFFF', border: '#BAE6FD', text: '#0284C7' };
    }
    if (name === 'b' || name.includes('amar') || name.includes('yellow')) {
      return { bg: '#FFFFFF', border: '#FEF08A', text: '#D97706' };
    }
    if (name === 'c' || name.includes('verm') || name.includes('red')) {
      return { bg: '#FFFFFF', border: '#FCA5A5', text: '#EF4444' };
    }
    if (name === 'd' || name.includes('verd') || name.includes('green')) {
      return { bg: '#FFFFFF', border: '#86EFAC', text: '#10B981' };
    }
    if (name === 'e' || name.includes('laranja') || name.includes('orange')) {
      return { bg: '#FFFFFF', border: '#FED7AA', text: '#EA580C' };
    }
    if (name === 'f' || name.includes('roxo') || name.includes('purple')) {
      return { bg: '#FFFFFF', border: '#E9D5FF', text: '#9333EA' };
    }
    if (name === 'g' || name.includes('rosa') || name.includes('pink')) {
      return { bg: '#FFFFFF', border: '#FBCFE8', text: '#DB2777' };
    }
    if (name === 'h' || name.includes('ciano') || name.includes('cyan')) {
      return { bg: '#FFFFFF', border: '#A5F3FC', text: '#0891B2' };
    }

    return { bg: '#FFFFFF', border: '#CBD5E1', text: '#475569' };
  },

  // Helper para localizar o objeto de um time pelo nome (tolerante a variações como "A" vs "Time A")
  _findTeam: function(teamName, teams) {
    if (!teamName || !teams || !teams.length) return null;
    var target = String(teamName).toLowerCase().trim();
    var targetClean = target.replace(/^time\s+/, '').trim();

    return teams.find(function(t) {
      if (!t || !t.nome) return false;
      var n = String(t.nome).toLowerCase().trim();
      var nClean = n.replace(/^time\s+/, '').trim();
      return n === target || nClean === targetClean || n === targetClean || nClean === target;
    }) || null;
  },

  initPeladaSelect: async function() {
    var select = document.getElementById("acomp-select-pelada-date");
    if (!select) return;

    var currentGroup = (Auth && Auth.currentGroup) || window.App.currentGroup;
    if (!currentGroup) {
      try {
        var groupRaw = localStorage.getItem('currentGroup');
        if (groupRaw) currentGroup = JSON.parse(groupRaw);
      } catch(e) {}
    }
    if (!currentGroup) {
      try {
        var groups = Api.getGroups ? Api.getGroups() : [];
        if (groups && groups.length > 0) currentGroup = groups[0];
      } catch(e) {}
    }

    if (!currentGroup || !currentGroup.id) {
      select.innerHTML = '<option value="">Nenhum grupo ativo</option>';
      return;
    }

    try {
      var peladas = [];
      if (Api.listarDatasDoGrupo) {
        peladas = await Api.listarDatasDoGrupo(currentGroup.id);
      }
      if (!peladas || peladas.length === 0) {
        peladas = Api.getPeladas ? Api.getPeladas().filter(function(p) { return String(p.grupo_id) === String(currentGroup.id); }) : [];
      }

      if (!peladas || peladas.length === 0) {
        select.innerHTML = '<option value="">Nenhuma pelada agendada</option>';
        return;
      }

      select.innerHTML = peladas.map(function(p) {
        var dataFmt = window.Utils ? window.Utils.formatDate(p.data) : p.data;
        var label = dataFmt + (p.horario ? ' às ' + p.horario : '') + ' (' + (p.status || 'agendada') + ')';
        return '<option value="' + p.id + '">' + label + '</option>';
      }).join('');

      var activePelada = peladas[0];
      if (window.App.activePelada) {
        var found = peladas.find(function(p) { return String(p.id) === String(window.App.activePelada.id); });
        if (found) activePelada = found;
      }

      window.App.activePelada = activePelada;
      try { localStorage.setItem("activePelada", JSON.stringify(activePelada)); } catch(e) {}
      select.value = activePelada.id;

      var self = this;
      select.onchange = async function() {
        var selectedId = select.value;
        var found = peladas.find(function(p) { return String(p.id) === String(selectedId); });
        if (found) {
          window.App.activePelada = found;
          try { localStorage.setItem("activePelada", JSON.stringify(found)); } catch(e) {}
          await self._fetchServerLiveState();
          self.render();
        }
      };
    } catch(e) {
      console.error('[Acompanhamento] Erro ao carregar datas das peladas:', e);
      select.innerHTML = '<option value="">Erro ao carregar datas</option>';
    }
  },

  init: async function() {
    await this.initPeladaSelect();
    await this._fetchServerLiveState();
    this.render();
    this._startPolling();
  },

  _fetchServerLiveState: async function() {
    var peladaId = window.App.activePelada ? window.App.activePelada.id : null;

    if (!peladaId) {
      try {
        var rawPelada = localStorage.getItem("activePelada");
        if (rawPelada) {
          var pObj = JSON.parse(rawPelada);
          if (pObj && pObj.id) peladaId = pObj.id;
        }
      } catch(e) {}
    }

    if (!peladaId) {
      var group = (Auth && Auth.currentGroup) || window.App.currentGroup;
      if (group && group.id && Api.listarDatasDoGrupo) {
        try {
          var peladasGroup = await Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladasGroup) && peladasGroup.length > 0) {
            var active = peladasGroup.find(function(p) { return p.status !== 'finalizada'; }) || peladasGroup[0];
            if (active) {
              peladaId = active.id;
              window.App.activePelada = active;
              try { localStorage.setItem("activePelada", JSON.stringify(active)); } catch(e) {}
            }
          }
        } catch(e) {}
      }
    }

    if (peladaId && Api.obterLiveState) {
      try {
        var res = await Api.obterLiveState(peladaId);
        if (res && res.state) {
          if (res.state.liveMatch) {
            window.App.liveMatch = res.state.liveMatch;
            localStorage.setItem("liveMatch", JSON.stringify(res.state.liveMatch));
          }
          if (res.state.waitingQueue) {
            window.App.waitingQueue = res.state.waitingQueue;
            localStorage.setItem("waitingQueue", JSON.stringify(res.state.waitingQueue));
          }
          if (res.state.teams) {
            localStorage.setItem("teams", JSON.stringify(res.state.teams));
          }
        }
      } catch(e) {}
    }
  },

  render: function() {
    // Sincroniza fallback em tempo real a partir do localStorage
    try {
      var rawMatch = localStorage.getItem("liveMatch");
      if (rawMatch) window.App.liveMatch = JSON.parse(rawMatch);
      var rawQueue = localStorage.getItem("waitingQueue");
      if (rawQueue) window.App.waitingQueue = JSON.parse(rawQueue);
      var rawPelada = localStorage.getItem("activePelada");
      if (rawPelada) window.App.activePelada = JSON.parse(rawPelada);
    } catch(e) {}

    this.renderTimer();
    this.renderScore();
    this.renderQueue();
    this.renderRule();
    this.renderRecentMatches();
  },

  // --- Cronômetro --------------------------------------------------------
  renderTimer: function() {
    var match = window.App.liveMatch;
    var timerText = document.getElementById('acomp-timer-text');
    var progress  = document.getElementById('acomp-timer-progress');
    var status    = document.getElementById('acomp-timer-status');
    var timerDot  = document.getElementById('acomp-timer-dot');

    var group   = (Auth && Auth.currentGroup) || window.App.currentGroup;
    var configs = Api.getConfigs ? Api.getConfigs() : [];
    var config  = group ? configs.find(function(c) { return c.grupo_id === group.id; }) : null;
    var totalSecs = (config && config.tempo_partida) ? config.tempo_partida * 60 : 480; // Default 8 min

    var remaining = match ? (match.timerSeconds !== undefined ? match.timerSeconds : 480) : 480;
    var totalMin = Math.floor(totalSecs / 60);
    var m = Math.floor(remaining / 60);
    var s = remaining % 60;
    var remainingStr = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;

    var elapsed = Math.max(0, totalSecs - remaining);

    if (timerText) timerText.textContent = remainingStr;
    if (progress)  progress.style.width = Math.min(100, Math.max(0, (elapsed / totalSecs) * 100)) + '%';

    if (status) {
      var isRunning = match && (match.isPlaying || match.timerRunning);
      if (isRunning) {
        status.textContent = 'EM ANDAMENTO';
        if (timerDot) timerDot.className = 'acomp-pulse-dot-clear';
      } else if (remaining > 0 && remaining < totalSecs) {
        status.textContent = 'PAUSADO';
        if (timerDot) timerDot.className = 'acomp-pulse-dot-clear paused';
      } else {
        status.textContent = 'PRONTO PARA INICIAR';
        if (timerDot) timerDot.className = 'acomp-pulse-dot-clear paused';
      }
    }
  },

  // --- Placar e Times ---------------------------------------------------
  renderScore: function() {
    var match = window.App.liveMatch || { teamA: 'Time A', teamB: 'Time B', scoreA: 0, scoreB: 0 };

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

    // Alertas de vitórias consecutivas
    var peladaAtiva = window.App.activePelada || {};
    var grupoAtivo  = (Auth && Auth.currentGroup) || window.App.currentGroup || {};
    var winsLimit   = parseInt(peladaAtiva.vitorias_para_sair) || parseInt(grupoAtivo.vitorias_para_sair) || 2;
    var winsA = match.consecutiveWinsA || 0;
    var winsB = match.consecutiveWinsB || 0;

    var statusAEl = document.getElementById('acomp-team-a-status');
    var statusBEl = document.getElementById('acomp-team-b-status');

    if (statusAEl) {
      statusAEl.innerHTML = '';
      if (winsA === winsLimit - 1 && winsA > 0) {
        statusAEl.innerHTML = '<span style="font-size: 10px; background: rgba(255, 145, 0, 0.15); color: #d97706; padding: 2px 6px; border-radius: 4px; font-weight: bold;">⚠️ PRÓXIMA REVEZA</span>';
      } else if (winsA > 0) {
        statusAEl.innerHTML = '<span style="font-size: 10px; background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 6px; border-radius: 4px; font-weight: bold;">🔥 ' + winsA + (winsA === 1 ? ' Vitória' : ' Vitórias') + '</span>';
      }
    }

    if (statusBEl) {
      statusBEl.innerHTML = '';
      if (winsB === winsLimit - 1 && winsB > 0) {
        statusBEl.innerHTML = '<span style="font-size: 10px; background: rgba(255, 145, 0, 0.15); color: #d97706; padding: 2px 6px; border-radius: 4px; font-weight: bold;">⚠️ PRÓXIMA REVEZA</span>';
      } else if (winsB > 0) {
        statusBEl.innerHTML = '<span style="font-size: 10px; background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 6px; border-radius: 4px; font-weight: bold;">🔥 ' + winsB + (winsB === 1 ? ' Vitória' : ' Vitórias') + '</span>';
      }
    }

    // Busca times do localStorage ou Api
    var teams = [];
    try {
      teams = JSON.parse(localStorage.getItem("teams")) || (Api.getTeams ? Api.getTeams() : []);
    } catch(e) {
      teams = Api.getTeams ? Api.getTeams() : [];
    }

    var players = [];
    try {
      players = JSON.parse(localStorage.getItem("players")) || (Api.getPlayers ? Api.getPlayers() : []);
    } catch(e) {
      players = Api.getPlayers ? Api.getPlayers() : [];
    }

    var self = this;

    // Escuta dos botões de Olho para ver escalação dos times
    var btnViewA = document.getElementById('acomp-btn-view-team-a');
    if (btnViewA) {
      btnViewA.onclick = function() {
        var teamObj = self._findTeam(match.teamA, teams) || { nome: match.teamA, players: [] };
        if (window.App && window.App.openModal) {
          window.App.openModal("ver_time", { teamName: teamObj.nome, players: teamObj.players });
        }
      };
    }
    var btnViewB = document.getElementById('acomp-btn-view-team-b');
    if (btnViewB) {
      btnViewB.onclick = function() {
        var teamObj = self._findTeam(match.teamB, teams) || { nome: match.teamB, players: [] };
        if (window.App && window.App.openModal) {
          window.App.openModal("ver_time", { teamName: teamObj.nome, players: teamObj.players });
        }
      };
    }

    function getTeamPlayersHTML(teamName, theme, isRightAligned) {
      var team = self._findTeam(teamName, teams);
      if (!team || !team.players || team.players.length === 0) {
        return '<div style="font-size: 12px; color: #94a3b8; text-align: center; width: 100%; padding: 8px 0;">Time sem escalação</div>';
      }
      return team.players.map(function(tp) {
        var p = players.find(function(pl) { return String(pl.id) === String(tp.id); });
        var nome = tp.apelido || tp.nome || (p ? (p.apelido || p.nome) : '?');
        var isGoleiro = tp.goleiro || (p && p.goleiro);

        // Calcula quantos gols este atleta marcou na partida ao vivo
        var playerGoals = (match.goals || []).filter(function(g) {
          return String(g.autorId) === String(tp.id) || 
                 String(g.autorId) === String(p ? p.id : '') ||
                 (g.autorNome && tp.nome && g.autorNome.toLowerCase() === tp.nome.toLowerCase()) ||
                 (g.autorNome && tp.apelido && g.autorNome.toLowerCase() === tp.apelido.toLowerCase());
        }).length;

        var goalBadgeHTML = playerGoals > 0 
          ? '<span style="color: #10B981; font-weight: 800; margin-left: 4px;" title="' + playerGoals + ' gol(s)">⚽' + (playerGoals > 1 ? '<span style="font-size: 10px; background: #10B981; color: #FFF; padding: 0 4px; border-radius: 8px; margin-left: 2px;">' + playerGoals + '</span>' : '') + '</span>' 
          : '';

        var avatarHTML = (p && p.foto) 
          ? '<img class="acomp-player-avatar-clear" src="' + p.foto + '" style="border: 1.5px solid ' + theme.border + ';">'
          : '<div style="width: 24px; height: 24px; border-radius: 50%; background: ' + theme.bg + '; border: 1.5px solid ' + theme.border + '; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: ' + theme.text + ';">' + nome.charAt(0).toUpperCase() + '</div>';

        if (isRightAligned) {
          return '<div class="acomp-player-item-clear" style="justify-content: flex-end; text-align: right; gap: 8px;">' +
            '<span class="acomp-player-name-clear">' + goalBadgeHTML + ' ' + nome + (isGoleiro ? ' 🧤' : '') + '</span>' +
            avatarHTML +
          '</div>';
        } else {
          return '<div class="acomp-player-item-clear" style="gap: 8px;">' +
            avatarHTML +
            '<span class="acomp-player-name-clear">' + nome + (isGoleiro ? ' 🧤' : '') + ' ' + goalBadgeHTML + '</span>' +
          '</div>';
        }
      }).join('');
    }

    // Renderiza lista de autores de gols do Time A (Abaixo do nome, alinhado à DIREITA)
    var goalsAEl = document.getElementById('acomp-team-a-goals');
    if (goalsAEl) {
      var goalsA = (match.goals || []).filter(function(g) {
        return g.teamKey === 'a' || (g.teamName && match.teamA && g.teamName.toLowerCase() === match.teamA.toLowerCase());
      });
      
      var tallyA = {};
      goalsA.forEach(function(g) {
        var n = g.autorNome || 'Jogador';
        tallyA[n] = (tallyA[n] || 0) + 1;
      });

      var htmlA = '';
      Object.keys(tallyA).forEach(function(nome) {
        var qtd = tallyA[nome];
        htmlA += '<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">' +
          '<span>' + nome + '</span>' +
          '<span style="color: #10B981;">⚽' + (qtd > 1 ? '<sup style="font-size: 9px; background: #10B981; color: #FFF; padding: 0 3px; border-radius: 6px; margin-left: 1px;">' + qtd + '</sup>' : '') + '</span>' +
        '</div>';
      });
      goalsAEl.innerHTML = htmlA;
    }

    // Renderiza lista de autores de gols do Time B (Abaixo do nome, alinhado à ESQUERDA)
    var goalsBEl = document.getElementById('acomp-team-b-goals');
    if (goalsBEl) {
      var goalsB = (match.goals || []).filter(function(g) {
        return g.teamKey === 'b' || (g.teamName && match.teamB && g.teamName.toLowerCase() === match.teamB.toLowerCase());
      });

      var tallyB = {};
      goalsB.forEach(function(g) {
        var n = g.autorNome || 'Jogador';
        tallyB[n] = (tallyB[n] || 0) + 1;
      });

      var htmlB = '';
      Object.keys(tallyB).forEach(function(nome) {
        var qtd = tallyB[nome];
        htmlB += '<div style="display: flex; align-items: center; justify-content: flex-start; gap: 4px;">' +
          '<span style="color: #10B981;">⚽' + (qtd > 1 ? '<sup style="font-size: 9px; background: #10B981; color: #FFF; padding: 0 3px; border-radius: 6px; margin-left: 1px;">' + qtd + '</sup>' : '') + '</span>' +
          '<span>' + nome + '</span>' +
        '</div>';
      });
      goalsBEl.innerHTML = htmlB;
    }
  },

  // --- Fila de Espera ----------------------------------------------------
  renderQueue: function() {
    var listEl   = document.getElementById('acomp-queue-list');
    var countEl  = document.getElementById('acomp-queue-count');
    var queue    = window.App.waitingQueue || [];

    if (countEl) countEl.textContent = queue.length + (queue.length === 1 ? ' time' : ' times');

    if (!listEl) return;

    if (!queue || queue.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding: 24px; text-align: center;"><p class="text-inter" style="font-size: 13px; color: #64748b;">Nenhum time na fila de espera.</p></div>';
      return;
    }

    var self = this;
    var teams = [];
    try {
      teams = JSON.parse(localStorage.getItem("teams")) || (Api.getTeams ? Api.getTeams() : []);
    } catch(e) {
      teams = Api.getTeams ? Api.getTeams() : [];
    }

    var players = [];
    try {
      players = JSON.parse(localStorage.getItem("players")) || (Api.getPlayers ? Api.getPlayers() : []);
    } catch(e) {
      players = Api.getPlayers ? Api.getPlayers() : [];
    }

    var html = '';

    queue.forEach(function(name, idx) {
      var theme = self._getTeamTheme(name);
      var teamObj = self._findTeam(name, teams);
      
      var avatarsHTML = '<div class="acomp-queue-badge-stack-clear">';
      if (teamObj && teamObj.players && teamObj.players.length > 0) {
        teamObj.players.slice(0, 4).forEach(function(tp) {
          var p = players.find(function(pl) { return String(pl.id) === String(tp.id); });
          var nome = tp.apelido || tp.nome || (p ? (p.apelido || p.nome) : '?');
          var fUrl = (p && p.foto) ? p.foto : null;

          if (fUrl) {
            avatarsHTML += '<img class="acomp-queue-avatar-clear" src="' + fUrl + '" style="border-color: ' + theme.border + ';">';
          } else {
            avatarsHTML += '<div class="acomp-queue-avatar-clear" style="background: ' + theme.bg + '; border-color: ' + theme.border + '; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; color: ' + theme.text + ';">' + nome.charAt(0).toUpperCase() + '</div>';
          }
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
          '<button class="acomp-btn-view-queue" data-team="' + name + '" style="border: 1px solid #CBD5E1; background: #FFFFFF; border-radius: 6px; padding: 2px 6px; cursor: pointer; font-size: 11px; margin-left: 6px;" title="Ver escalação do ' + name + '">👁️</button>' +
        '</div>' +
        (idx === 0 ? '<span class="acomp-next-badge-clear">PRÓXIMO ➜</span>' : '') +
      '</div>';
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.acomp-btn-view-queue').forEach(function(btn) {
      btn.onclick = function() {
        var tName = btn.getAttribute('data-team');
        var teamObj = self._findTeam(tName, teams) || { nome: tName, players: [] };
        if (window.App && window.App.openModal) {
          window.App.openModal("ver_time", { teamName: teamObj.nome, players: teamObj.players });
        }
      };
    });
  },

  // --- Histórico de Partidas Recentes ------------------------------------
  renderRecentMatches: async function() {
    var container = document.getElementById('acomp-recent-matches');
    if (!container) return;

    var peladaId = window.App.activePelada ? window.App.activePelada.id : null;

    if (!peladaId) {
      var select = document.getElementById("acomp-select-pelada-date");
      if (select && select.value) {
        peladaId = select.value;
      }
    }

    if (!peladaId) {
      try {
        var rawPelada = localStorage.getItem("activePelada");
        if (rawPelada) {
          var pObj = JSON.parse(rawPelada);
          if (pObj && pObj.id) peladaId = pObj.id;
        }
      } catch(e) {}
    }

    if (!peladaId) {
      var group = (Auth && Auth.currentGroup) || window.App.currentGroup;
      if (group && group.id && Api.listarDatasDoGrupo) {
        try {
          var peladasGroup = await Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladasGroup) && peladasGroup.length > 0) {
            var active = peladasGroup.find(function(p) { return p.status !== 'finalizada'; }) || peladasGroup[0];
            if (active) peladaId = active.id;
          }
        } catch(e) {}
      }
    }

    if (!peladaId) {
      container.innerHTML = '<p style="text-align:center; font-size:13px; color:#64748b; padding:12px 0;">Nenhuma pelada selecionada.</p>';
      return;
    }

    try {
      var partidas = await Api.listarPartidas(peladaId);
      if (!partidas || !Array.isArray(partidas) || partidas.length === 0) {
        container.innerHTML = '<p style="text-align:center; font-size:13px; color:#64748b; padding:12px 0;">Nenhuma partida encerrada nesta pelada ainda.</p>';
        return;
      }

      var html = '';
      partidas.forEach(function(p) {
        html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #F8FAFC; border-radius: 8px; border-left: 4px solid #10B981;">' +
          '<div style="display: flex; align-items: center; gap: 8px;">' +
            '<span style="font-size: 11px; font-weight: bold; background: #E2E8F0; color: #475569; padding: 2px 6px; border-radius: 4px;">#' + p.numero_jogo + '</span>' +
            '<span style="font-size: 13px; font-weight: 700; color: #1E293B;">' + (p.time_a_nome || 'Time A') + '</span>' +
          '</div>' +
          '<div style="font-size: 15px; font-weight: 800; color: #0F172A; font-family: monospace;">' +
            (p.gols_time_a || 0) + ' x ' + (p.gols_time_b || 0) +
          '</div>' +
          '<div style="display: flex; align-items: center; gap: 8px;">' +
            '<span style="font-size: 13px; font-weight: 700; color: #1E293B;">' + (p.time_b_nome || 'Time B') + '</span>' +
          '</div>' +
        '</div>';
      });
      container.innerHTML = html;
    } catch(e) {
      console.error('[Acompanhamento] Erro ao listar partidas recentes:', e);
      container.innerHTML = '<p style="text-align:center; font-size:13px; color:#64748b; padding:12px 0;">Sem histórico disponível.</p>';
    }
  },

  // --- Regra Ativa -------------------------------------------------------
  renderRule: function() {
    var ruleEl = document.getElementById('acomp-rule-text');
    if (!ruleEl) return;

    var group   = (Auth && Auth.currentGroup) || window.App.currentGroup;
    var configs = Api.getConfigs ? Api.getConfigs() : [];
    var config  = group ? configs.find(function(c) { return c.grupo_id === group.id; }) : null;

    var criterios = config && config.criterios_empate ? config.criterios_empate : [];
    var labels    = {
      gols: 'REGRA PADRÃO: MAIS GOLS VENCE',
      vitórias: 'REGRA: SAI APÓS 2 VITÓRIAS CONSECUTIVAS',
      tempo: 'REGRA: PARTIDAS DE ' + (config && config.tempo_partida ? config.tempo_partida : 8) + ' MINUTOS'
    };
    
    var ruleText = criterios.length > 0 ? (labels[criterios[0]] || ('REGRA: ' + criterios[0].toUpperCase())) : 'REGRA PADRÃO: MAIS GOLS VENCE';
    ruleEl.textContent = ruleText;
  },

  // --- Polling & Eventos -------------------------------------------------
  _startPolling: function() {
    if (Acompanhamento._pollingTimer) clearInterval(Acompanhamento._pollingTimer);
    if (Acompanhamento._localTimer) clearInterval(Acompanhamento._localTimer);

    // Fetch inicial do servidor
    Acompanhamento._fetchServerLiveState().then(function() {
      Acompanhamento.render();
    });

    // Polling do backend a cada 1000ms para sync multi-dispositivo instantâneo
    Acompanhamento._pollingTimer = setInterval(async function() {
      await Acompanhamento._fetchServerLiveState();
      Acompanhamento.render();
    }, 1000);

    // Loop do cronômetro local para decremento fluido do relógio a cada segundo
    Acompanhamento._localTimer = setInterval(function() {
      var match = window.App.liveMatch;
      if (match && (match.isPlaying || match.timerRunning)) {
        if (match.timerSeconds > 0) {
          match.timerSeconds--;
          Acompanhamento.renderTimer();
        }
      }
    }, 1000);

    window.removeEventListener('storage', Acompanhamento._onStorageChange);
    window.addEventListener('storage', Acompanhamento._onStorageChange);
  },

  _onStorageChange: function(e) {
    if (e.key === 'liveMatch' || e.key === 'waitingQueue' || e.key === 'teams' || e.key === 'activePelada') {
      Acompanhamento.render();
    }
  }
};

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initAcompanhamento = function() {
  Acompanhamento.init();
};
