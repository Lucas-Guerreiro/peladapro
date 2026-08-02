// ==========================================================================
// pages/jogador/acompanhamento.js — Partida ao Vivo (Módulo Jogador Redesign Responsivo)
// ==========================================================================

var Acompanhamento = {

  // Limpa o estado quando a pelada não está em andamento (sem sorteio)
  _limparEstado: function () {
    window.App.liveMatch = { teamA: 'Time A', teamB: 'Time B', scoreA: 0, scoreB: 0, isPlaying: false, timerSeconds: 0, goals: [] };
    window.App.waitingQueue = [];
    window.App.teams = [];
    localStorage.removeItem("teams");
    localStorage.setItem("waitingQueue", "[]");
    localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
    console.log("🧹 [Acompanhamento] Estado limpo (sem sorteio/pelada em andamento).");
  },

  _pollingTimer: null,
  _localTimer: null,

  // Mapeamento visual das cores dos times (fundo branco puro com bordas finas coloridas)
  _getTeamTheme: function (teamName) {
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
  _findTeam: function (teamName, teams) {
    if (!teamName || !teams || !teams.length) return null;
    var target = String(teamName).toLowerCase().trim();
    var targetClean = target.replace(/^time\s+/, '').trim();

    return teams.find(function (t) {
      if (!t || !t.nome) return false;
      var n = String(t.nome).toLowerCase().trim();
      var nClean = n.replace(/^time\s+/, '').trim();
      return n === target || nClean === targetClean || n === targetClean || nClean === target;
    }) || null;
  },

  initPeladaSelect: async function () {
    var select = document.getElementById("acomp-select-pelada-date");
    if (!select) return;

    var currentGroup = (Auth && Auth.currentGroup) || window.App.currentGroup;
    if (!currentGroup) {
      try {
        var groupRaw = localStorage.getItem('currentGroup');
        if (groupRaw) currentGroup = JSON.parse(groupRaw);
      } catch (e) { }
    }
    if (!currentGroup) {
      try {
        var groups = Api.getGroups ? Api.getGroups() : [];
        if (groups && groups.length > 0) currentGroup = groups[0];
      } catch (e) { }
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
        peladas = Api.getPeladas ? Api.getPeladas().filter(function (p) { return String(p.grupo_id) === String(currentGroup.id); }) : [];
      }

      if (!peladas || peladas.length === 0) {
        select.innerHTML = '<option value="">Nenhuma pelada agendada</option>';
        return;
      }

      select.innerHTML = peladas.map(function (p) {
        var dataFmt = window.Utils ? window.Utils.formatDate(p.data) : p.data;
        var label = dataFmt + (p.horario ? ' às ' + p.horario : '') + ' (' + (p.status || 'agendada') + ')';
        return '<option value="' + p.id + '">' + label + '</option>';
      }).join('');

      var activePelada = peladas[0];
      if (window.App.activePelada) {
        var found = peladas.find(function (p) { return String(p.id) === String(window.App.activePelada.id); });
        if (found) activePelada = found;
      }

      window.App.activePelada = activePelada;
      try { localStorage.setItem("activePelada", JSON.stringify(activePelada)); } catch (e) { }
      select.value = activePelada.id;

      var self = this;
      select.onchange = async function () {
        var selectedId = select.value;
        var found = peladas.find(function (p) { return String(p.id) === String(selectedId); });
        if (found) {
          window.App.activePelada = found;
          // Se a pelada selecionada não estiver em andamento, limpa confronto/fila
          if (found.status !== "ativa") {
            self._limparEstado();
          }
          try { localStorage.setItem("activePelada", JSON.stringify(found)); } catch (e) { }
          await self._fetchServerLiveState();
          self.render();
        }
      };
    } catch (e) {
      console.error('[Acompanhamento] Erro ao carregar datas das peladas:', e);
      select.innerHTML = '<option value="">Erro ao carregar datas</option>';
    }
  },

  init: async function () {
    await this.initPeladaSelect();
    await this._fetchServerLiveState();
    this.render();
    this._startPolling();
  },

  _fetchServerLiveState: async function () {
    var peladaId = window.App.activePelada ? window.App.activePelada.id : null;

    // Se a pelada ativa NÃO estiver em andamento (não for 'ativa'), limpa e NÃO recarrega confronto/fila
    var peladaAtiva = window.App.activePelada || {};
    if (peladaAtiva.status !== "ativa") {
      this._limparEstado();
      return;
    }

    if (!peladaId) {
      try {
        var rawPelada = localStorage.getItem("activePelada");
        if (rawPelada) {
          var pObj = JSON.parse(rawPelada);
          if (pObj && pObj.id) peladaId = pObj.id;
        }
      } catch (e) { }
    }

    if (!peladaId) {
      var group = (Auth && Auth.currentGroup) || window.App.currentGroup;
      if (group && group.id && Api.listarDatasDoGrupo) {
        try {
          var peladasGroup = await Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladasGroup) && peladasGroup.length > 0) {
            var active = peladasGroup.find(function (p) { return p.status !== 'finalizada'; }) || peladasGroup[0];
            if (active) {
              peladaId = active.id;
              window.App.activePelada = active;
              try { localStorage.setItem("activePelada", JSON.stringify(active)); } catch (e) { }
            }
          }
        } catch (e) { }
      }
    }

    const groupConfigs = window.Api.getConfigs() || [];
    const currentGrp = (Auth && Auth.currentGroup) || window.App.currentGroup;
    const grpCfg = currentGrp ? groupConfigs.find(function (c) { return c.grupo_id === currentGrp.id; }) : null;
    const durationMin = grpCfg ? (grpCfg.tempo_partida || 8) : 8;

    let stateCarregado = false;

    if (peladaId && Api.obterLiveState) {
      try {
        var res = await Api.obterLiveState(peladaId);
        if (res && res.state) {
          if (res.state.liveMatch) {
            window.App.liveMatch = res.state.liveMatch;
            localStorage.setItem("liveMatch", JSON.stringify(res.state.liveMatch));
          } else {
            window.App.liveMatch = {
              teamA: 'Time A',
              teamB: 'Time B',
              scoreA: 0,
              scoreB: 0,
              isPlaying: false,
              timerRunning: false,
              timerSeconds: durationMin * 60,
              goals: []
            };
            localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
          }

          if (res.state.waitingQueue) {
            window.App.waitingQueue = res.state.waitingQueue;
            localStorage.setItem("waitingQueue", JSON.stringify(res.state.waitingQueue));
          } else {
            window.App.waitingQueue = [];
            localStorage.setItem("waitingQueue", "[]");
          }

          if (res.state.teams && res.state.teams.length > 0) {
            localStorage.setItem("teams", JSON.stringify(res.state.teams));
          } else {
            localStorage.removeItem("teams");
          }
          stateCarregado = true;
        }
      } catch (e) {
        console.error('[Acompanhamento] Erro ao obter liveState do servidor:', e);
      }
    }

    if (!stateCarregado) {
      window.App.liveMatch = {
        teamA: 'Time A',
        teamB: 'Time B',
        scoreA: 0,
        scoreB: 0,
        isPlaying: false,
        timerRunning: false,
        timerSeconds: durationMin * 60,
        goals: []
      };
      localStorage.setItem("liveMatch", JSON.stringify(window.App.liveMatch));
      window.App.waitingQueue = [];
      localStorage.setItem("waitingQueue", "[]");
      localStorage.removeItem("teams");
    }
  },

  render: function () {
    // Sincroniza fallback em tempo real a partir do localStorage
    try {
      var rawMatch = localStorage.getItem("liveMatch");
      if (rawMatch) window.App.liveMatch = JSON.parse(rawMatch);
      var rawQueue = localStorage.getItem("waitingQueue");
      if (rawQueue) window.App.waitingQueue = JSON.parse(rawQueue);
      var rawPelada = localStorage.getItem("activePelada");
      if (rawPelada) window.App.activePelada = JSON.parse(rawPelada);
    } catch (e) { }

    var teams = [];
    try { teams = JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }

    const timerCard = document.querySelector('.acomp-timer-wrapper-clear');
    const scoreCard = document.querySelector('.acomp-score-card-clear');
    const queueCard = document.getElementById('acomp-queue-list')?.closest('.acomp-card-clear');
    const ruleCard = document.getElementById('acomp-rule-desc-clear')?.closest('.acomp-card-clear') || document.querySelector('.acomp-rule-title-clear')?.closest('.acomp-card-clear');
    let infoCard = document.getElementById('acomp-no-teams-card');

    if (!teams || teams.length < 2) {
      if (timerCard) timerCard.style.display = 'none';
      if (scoreCard) scoreCard.style.display = 'none';
      if (queueCard) queueCard.style.display = 'none';
      if (ruleCard) ruleCard.style.display = 'none';

      if (!infoCard) {
        infoCard = document.createElement('div');
        infoCard.id = 'acomp-no-teams-card';
        infoCard.className = 'acomp-card-clear';
        infoCard.style.textAlign = 'center';
        infoCard.style.padding = '32px 20px';
        infoCard.style.display = 'flex';
        infoCard.style.flexDirection = 'column';
        infoCard.style.alignItems = 'center';
        infoCard.style.justifyContent = 'center';
        infoCard.style.gap = '12px';

        infoCard.innerHTML = `
          <div style="font-size: 40px; line-height: 1;">⚽</div>
          <h4 class="text-inter" style="font-size: 16px; font-weight: 700; color: var(--text-heading); margin: 0;">Aguardando Sorteio</h4>
          <p class="text-inter" style="font-size: 13px; color: var(--text-caption); margin: 0; max-width: 320px; line-height: 1.5;">
            O gestor ainda não realizou o sorteio dos times para esta pelada. Assim que for feito, o placar e a fila de espera aparecerão aqui em tempo real!
          </p>
        `;
        const container = document.getElementById('player-tab-content-container');
        if (container) {
          const recentCard = document.querySelector('.acomp-card-clear:last-child');
          if (recentCard && recentCard !== infoCard) {
            container.insertBefore(infoCard, recentCard);
          } else {
            container.appendChild(infoCard);
          }
        }
      } else {
        infoCard.style.display = 'flex';
      }
    } else {
      if (timerCard) timerCard.style.display = 'flex';
      if (scoreCard) scoreCard.style.display = 'flex';
      if (queueCard) queueCard.style.display = 'flex';
      if (ruleCard) ruleCard.style.display = 'flex';
      if (infoCard) infoCard.style.display = 'none';

      this.renderTimer();
      this.renderScore();
      this.renderQueue();
      this.renderRule();
    }

    this.renderRecentMatches();
  },

  // --- Cronômetro --------------------------------------------------------
  renderTimer: function () {
    var match = window.App.liveMatch;
    var timerText = document.getElementById('acomp-timer-text');
    var progress = document.getElementById('acomp-timer-progress');
    var status = document.getElementById('acomp-timer-status');
    var timerDot = document.getElementById('acomp-timer-dot');

    var group = (Auth && Auth.currentGroup) || window.App.currentGroup;
    var configs = Api.getConfigs ? Api.getConfigs() : [];
    var config = group ? configs.find(function (c) { return c.grupo_id === group.id; }) : null;
    var totalSecs = (config && config.tempo_partida) ? config.tempo_partida * 60 : 480; // Default 8 min

    var remaining = match ? (match.timerSeconds !== undefined ? match.timerSeconds : 480) : 480;
    var totalMin = Math.floor(totalSecs / 60);
    var m = Math.floor(remaining / 60);
    var s = remaining % 60;
    var remainingStr = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;

    var elapsed = Math.max(0, totalSecs - remaining);

    if (timerText) timerText.textContent = remainingStr;
    if (progress) progress.style.width = Math.min(100, Math.max(0, (elapsed / totalSecs) * 100)) + '%';

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
  renderScore: function () {
    var match = window.App.liveMatch || { teamA: 'Time A', teamB: 'Time B', scoreA: 0, scoreB: 0 };

    var teamAName = document.getElementById('acomp-team-a-name');
    var teamBName = document.getElementById('acomp-team-b-name');
    var scoreA = document.getElementById('acomp-score-a');
    var scoreB = document.getElementById('acomp-score-b');
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

    // Renderiza emblemas dos times
    if (window.TeamEmblems) {
      var teamsLS = [];
      try { teamsLS = JSON.parse(localStorage.getItem('teams')) || []; } catch (e) { }
      var tA = teamsLS.find(function (t) { return (t.nome || t.name || '').toLowerCase().trim() === (match.teamA || '').toLowerCase().trim(); }) || teamsLS[0];
      var tB = teamsLS.find(function (t) { return (t.nome || t.name || '').toLowerCase().trim() === (match.teamB || '').toLowerCase().trim(); }) || teamsLS[1];
      var embAEl = document.getElementById('emblem-acomp-team-a');
      var embBEl = document.getElementById('emblem-acomp-team-b');
      if (embAEl) embAEl.innerHTML = window.TeamEmblems.forTeam(tA || { emblema: 0 });
      if (embBEl) embBEl.innerHTML = window.TeamEmblems.forTeam(tB || { emblema: 1 });
    }

    if (scoreA) scoreA.textContent = match.scoreA || 0;
    if (scoreB) scoreB.textContent = match.scoreB || 0;

    // Alertas de vitórias consecutivas
    var peladaAtiva = window.App.activePelada || {};
    var grupoAtivo = (Auth && Auth.currentGroup) || window.App.currentGroup || {};
    var winsLimit = parseInt(peladaAtiva.vitorias_para_sair) || parseInt(grupoAtivo.vitorias_para_sair) || 2;
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
    } catch (e) {
      teams = Api.getTeams ? Api.getTeams() : [];
    }

    var players = [];
    try {
      players = JSON.parse(localStorage.getItem("players")) || (Api.getPlayers ? Api.getPlayers() : []);
    } catch (e) {
      players = Api.getPlayers ? Api.getPlayers() : [];
    }

    var self = this;

    // Escuta dos botões de Olho para ver escalação dos times
    var btnViewA = document.getElementById('acomp-btn-view-team-a');
    if (btnViewA) {
      btnViewA.onclick = function () {
        var teamObj = self._findTeam(match.teamA, teams) || { nome: match.teamA, players: [] };
        if (window.App && window.App.openModal) {
          window.App.openModal("ver_time", { teamName: teamObj.nome, players: teamObj.players });
        }
      };
    }
    var btnViewB = document.getElementById('acomp-btn-view-team-b');
    if (btnViewB) {
      btnViewB.onclick = function () {
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
      return team.players.map(function (tp) {
        var p = players.find(function (pl) { return String(pl.id) === String(tp.id); });
        var nome = tp.apelido || tp.nome || (p ? (p.apelido || p.nome) : '?');
        var isGoleiro = tp.goleiro || (p && p.goleiro);

        // Calcula quantos gols este atleta marcou na partida ao vivo
        var playerGoals = (match.goals || []).filter(function (g) {
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
      var goalsA = (match.goals || []).filter(function (g) {
        return g.teamKey === 'a' || (g.teamName && match.teamA && g.teamName.toLowerCase() === match.teamA.toLowerCase());
      });

      var htmlA = goalsA.map(function (g) {
        return '<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; flex-wrap: wrap;">' +
          (g.assistNome ? '<span style="font-size: 11px; color: #64748B; font-weight: 600; background: #F1F5F9; padding: 1px 6px; border-radius: 4px;">' + g.assistNome + ' 👟</span>' : '') +
          '<span style="font-weight: 700; color: #0F172A;">' + (g.autorNome || 'Jogador') + '</span>' +
          '<span style="color: #10B981;">⚽</span>' +
          '</div>';
      }).join('');
      goalsAEl.innerHTML = htmlA;
    }

    // Renderiza lista de autores de gols do Time B (Abaixo do nome, alinhado à ESQUERDA)
    var goalsBEl = document.getElementById('acomp-team-b-goals');
    if (goalsBEl) {
      var goalsB = (match.goals || []).filter(function (g) {
        return g.teamKey === 'b' || (g.teamName && match.teamB && g.teamName.toLowerCase() === match.teamB.toLowerCase());
      });

      var htmlB = goalsB.map(function (g) {
        return '<div style="display: flex; align-items: center; justify-content: flex-start; gap: 4px; flex-wrap: wrap;">' +
          '<span style="color: #10B981;">⚽</span>' +
          '<span style="font-weight: 700; color: #0F172A;">' + (g.autorNome || 'Jogador') + '</span>' +
          (g.assistNome ? '<span style="font-size: 11px; color: #64748B; font-weight: 600; background: #F1F5F9; padding: 1px 6px; border-radius: 4px;">' + g.assistNome + ' 👟</span>' : '') +
          '</div>';
      }).join('');
      goalsBEl.innerHTML = htmlB;
    }
  },

  // --- Fila de Espera ----------------------------------------------------
  renderQueue: function () {
    var listEl = document.getElementById('acomp-queue-list');
    var countEl = document.getElementById('acomp-queue-count');
    var queue = window.App.waitingQueue || [];

    var teams = [];
    try {
      teams = JSON.parse(localStorage.getItem("teams")) || (Api.getTeams ? Api.getTeams() : []);
    } catch (e) {
      teams = Api.getTeams ? Api.getTeams() : [];
    }

    if ((!queue || queue.length === 0) && Array.isArray(teams) && teams.length > 2) {
      var liveMatch = window.App.liveMatch || {};
      var tA = liveMatch.teamA ? String(liveMatch.teamA).toLowerCase().trim() : '';
      var tB = liveMatch.teamB ? String(liveMatch.teamB).toLowerCase().trim() : '';

      queue = teams
        .map(function (t) { return t.nome || t.name; })
        .filter(function (n) {
          if (!n) return false;
          var low = String(n).toLowerCase().trim();
          return low !== tA && low !== tB;
        });

      if (queue.length > 0) {
        window.App.waitingQueue = queue;
        try { localStorage.setItem("waitingQueue", JSON.stringify(queue)); } catch (e) { }
      }
    }

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
    } catch (e) {
      teams = Api.getTeams ? Api.getTeams() : [];
    }

    var players = [];
    try {
      players = JSON.parse(localStorage.getItem("players")) || (Api.getPlayers ? Api.getPlayers() : []);
    } catch (e) {
      players = Api.getPlayers ? Api.getPlayers() : [];
    }

    var html = '';

    queue.forEach(function (name, idx) {
      var theme = self._getTeamTheme(name);
      var teamObj = self._findTeam(name, teams);

      var avatarsHTML = '<div class="acomp-queue-badge-stack-clear">';
      if (teamObj && teamObj.players && teamObj.players.length > 0) {
        teamObj.players.slice(0, 4).forEach(function (tp) {
          var p = players.find(function (pl) { return String(pl.id) === String(tp.id); });
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

      var emblemSvg = window.TeamEmblems ? window.TeamEmblems.forTeam(teamObj || { nome: name, emblema: idx % 10 }) : '';

      html += '<div class="acomp-queue-item-clear" style="border-left: 4px solid ' + theme.border + ';">' +
        '<div class="acomp-queue-team-info-clear">' +
        '<span class="acomp-queue-pos-clear" style="color: ' + theme.text + ';">' + (idx + 1) + '</span>' +
        '<div style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 4px;">' + emblemSvg + '</div>' +
        avatarsHTML +
        '<span class="acomp-queue-team-name-clear">' + name + '</span>' +
        '<button class="acomp-btn-view-queue" data-team="' + name + '" style="border: 1px solid #CBD5E1; background: #FFFFFF; border-radius: 6px; padding: 2px 6px; cursor: pointer; font-size: 11px; margin-left: 6px;" title="Ver escalação do ' + name + '">👁️</button>' +
        '</div>' +
        (idx === 0 ? '<span class="acomp-next-badge-clear">PRÓXIMO ➜</span>' : '') +
        '</div>';
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.acomp-btn-view-queue').forEach(function (btn) {
      btn.onclick = function () {
        var tName = btn.getAttribute('data-team');
        var teamObj = self._findTeam(tName, teams) || { nome: tName, players: [] };
        if (window.App && window.App.openModal) {
          window.App.openModal("ver_time", { teamName: teamObj.nome, players: teamObj.players });
        }
      };
    });
  },

  // --- Histórico de Partidas Recentes ------------------------------------
  renderRecentMatches: async function () {
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
      } catch (e) { }
    }

    if (!peladaId) {
      var group = (Auth && Auth.currentGroup) || window.App.currentGroup;
      if (group && group.id && Api.listarDatasDoGrupo) {
        try {
          var peladasGroup = await Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladasGroup) && peladasGroup.length > 0) {
            var active = peladasGroup.find(function (p) { return p.status !== 'finalizada'; }) || peladasGroup[0];
            if (active) peladaId = active.id;
          }
        } catch (e) { }
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

      // Ordena do jogo mais recente (#N) para o mais antigo (#1)
      partidas.sort(function (a, b) {
        return (b.numero_jogo || b.id || 0) - (a.numero_jogo || a.id || 0);
      });

      window.App.openGoalPanels = window.App.openGoalPanels || {};

      var html = '';
      var totalPartidas = partidas.length;
      var teams = [];
      try { teams = (window.App && window.App.teams) || JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }

      partidas.forEach(function (p, idx) {
        var numJogo = p.numero_jogo || p.id || (totalPartidas - idx);
        var isOpen = !!window.App.openGoalPanels[p.id];
        var tA = teams.find(function (t) { return (t.nome || t.name) === p.time_a_nome; }) || { nome: p.time_a_nome, emblema: 0 };
        var tB = teams.find(function (t) { return (t.nome || t.name) === p.time_b_nome; }) || { nome: p.time_b_nome, emblema: 1 };
        var embA = window.TeamEmblems ? window.TeamEmblems.forTeam(tA) : '';
        var embB = window.TeamEmblems ? window.TeamEmblems.forTeam(tB) : '';

        var goalsList = [];
        if (p.autores_gols) {
          try {
            goalsList = typeof p.autores_gols === 'string' ? JSON.parse(p.autores_gols) : p.autores_gols;
          } catch (e) { }
        }

        html += '<div style="margin-bottom: 8px; background: #F8FAFC; border-radius: 8px; border-left: 4px solid #10B981; padding: 10px 14px;">' +
          '<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">' +
          '<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">' +
          '<div style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">' + embA + '</div>' +
          '<span style="font-size: 13px; font-weight: 700; color: #1E293B;">' + (p.time_a_nome || 'Time A') + '</span>' +
          '<span style="font-size: 15px; font-weight: 800; color: #0F172A; font-family: monospace;">' + (p.gols_time_a || 0) + ' x ' + (p.gols_time_b || 0) + '</span>' +
          '<span style="font-size: 13px; font-weight: 700; color: #1E293B;">' + (p.time_b_nome || 'Time B') + '</span>' +
          '<div style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">' + embB + '</div>' +
          '</div>' +
          '<button class="acomp-btn-toggle-goals" data-id="' + p.id + '" title="Ver quem fez os gols" style="padding: 2px 8px; font-size: 11px; border-radius: 6px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #0F172A; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">⚽ Gols</button>' +
          '</div>' +
          '<div id="acomp-match-goals-list-' + p.id + '" style="display: ' + (isOpen ? 'block' : 'none') + '; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #CBD5E1; font-size: 12px;">' +
          (goalsList.length > 0
            ? '<div style="display:flex; flex-wrap:wrap; gap:6px;">' + goalsList.map(function (g) { return '<span style="background:rgba(16,185,129,0.1); color:#10B981; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">⚽ ' + (g.autorNome || 'Jogador') + (g.assistNome ? ' <span style="color:#0F172A; font-weight:600;">(Ass: ' + g.assistNome + ' 👟)</span>' : '') + ' <span style="color:#64748B; font-size:10px;">(' + (g.teamName || '') + ')</span></span>'; }).join('') + '</div>'
            : '<span style="font-size:11px; color:#64748B;">Placar final: ' + (p.time_a_nome || 'Time A') + ' ' + (p.gols_time_a || 0) + ' x ' + (p.gols_time_b || 0) + ' ' + (p.time_b_nome || 'Time B') + '</span>'
          ) +
          '</div>' +
          '</div>';
      });

      container.innerHTML = html;

      container.querySelectorAll('.acomp-btn-toggle-goals').forEach(function (btn) {
        btn.onclick = function () {
          var matchId = btn.getAttribute('data-id');
          window.App.openGoalPanels = window.App.openGoalPanels || {};
          window.App.openGoalPanels[matchId] = !window.App.openGoalPanels[matchId];

          var targetDiv = document.getElementById('acomp-match-goals-list-' + matchId);
          if (targetDiv) {
            targetDiv.style.display = window.App.openGoalPanels[matchId] ? 'block' : 'none';
          }
        };
      });
    } catch (e) {
      console.error('[Acompanhamento] Erro ao listar partidas recentes:', e);
      container.innerHTML = '<p style="text-align:center; font-size:13px; color:#64748b; padding:12px 0;">Sem histórico disponível.</p>';
    }
  },

  // --- Regra Ativa -------------------------------------------------------
  renderRule: function () {
    var ruleEl = document.getElementById('acomp-rule-text');
    if (!ruleEl) return;

    var group = (Auth && Auth.currentGroup) || window.App.currentGroup;
    var configs = Api.getConfigs ? Api.getConfigs() : [];
    var config = group ? configs.find(function (c) { return c.grupo_id === group.id; }) : null;

    var criterios = config && config.criterios_empate ? config.criterios_empate : [];
    var labels = {
      gols: 'REGRA PADRÃO: MAIS GOLS VENCE',
      vitórias: 'REGRA: SAI APÓS 2 VITÓRIAS CONSECUTIVAS',
      tempo: 'REGRA: PARTIDAS DE ' + (config && config.tempo_partida ? config.tempo_partida : 8) + ' MINUTOS'
    };

    var ruleText = criterios.length > 0 ? (labels[criterios[0]] || ('REGRA: ' + criterios[0].toUpperCase())) : 'REGRA PADRÃO: MAIS GOLS VENCE';
    ruleEl.textContent = ruleText;
  },

  // --- Polling & Eventos -------------------------------------------------
  _startPolling: function () {
    if (Acompanhamento._pollingTimer) clearTimeout(Acompanhamento._pollingTimer);
    if (Acompanhamento._localTimer) clearInterval(Acompanhamento._localTimer);

    // Fetch inicial do servidor
    Acompanhamento._fetchServerLiveState().then(function () {
      Acompanhamento.render();
    });

    // Polling inteligente e econômico (8s ao vivo, 30s inativo)
    const getIntervalTime = () => {
      var match = window.App.liveMatch;
      return (match && match.isPlaying) ? 8000 : 30000;
    };

    const runPolling = async () => {
      if (!window.Acompanhamento || Acompanhamento._pollingTimer === null) return;
      try {
        await Acompanhamento._fetchServerLiveState();
        Acompanhamento.render();
      } catch (e) { }

      if (Acompanhamento._pollingTimer !== null) {
        Acompanhamento._pollingTimer = setTimeout(runPolling, getIntervalTime());
      }
    };

    Acompanhamento._pollingTimer = setTimeout(runPolling, getIntervalTime());

    // Loop do cronômetro local para decremento fluido do relógio a cada segundo
    Acompanhamento._localTimer = setInterval(function () {
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

  _onStorageChange: function (e) {
    if (e.key === 'liveMatch' || e.key === 'waitingQueue' || e.key === 'teams' || e.key === 'activePelada') {
      Acompanhamento.render();
    }
  }
};

window.Acompanhamento = Acompanhamento;

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initAcompanhamento = function () {
  Acompanhamento.init();
};
