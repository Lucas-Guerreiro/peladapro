// ==========================================================================
// pages/jogador/acompanhamento.js — Partida ao Vivo (Módulo Jogador Redesign Responsivo)
// ==========================================================================

var Acompanhamento = {

  // Limpa o estado quando a pelada não está em andamento (sem sorteio)
  _limparEstado: function () {
    if (!window.App.liveMatch) {
      window.App.liveMatch = { teamA: 'Time A', teamB: 'Time B', scoreA: 0, scoreB: 0, isPlaying: false, timerSeconds: 0, goals: [] };
    }
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

    var currentGroup = (window.Auth && window.Auth.currentGroup) || (window.App && window.App.currentGroup);
    if (!currentGroup) {
      try {
        var groupRaw = localStorage.getItem('currentGroup');
        if (groupRaw) currentGroup = JSON.parse(groupRaw);
      } catch (e) { }
    }
    if (!currentGroup) {
      try {
        var groups = (window.Api && window.Api.getGroups) ? window.Api.getGroups() : [];
        if (groups && groups.length > 0) currentGroup = groups[0];
      } catch (e) { }
    }

    if (!currentGroup || !currentGroup.id) {
      select.innerHTML = '<option value="">Nenhum grupo ativo</option>';
      return;
    }

    try {
      var peladas = [];
      if (window.Api && window.Api.listarDatasDoGrupo) {
        peladas = await window.Api.listarDatasDoGrupo(currentGroup.id);
      }
      if (!peladas || peladas.length === 0) {
        peladas = (window.Api && window.Api.getPeladas) ? window.Api.getPeladas().filter(function (p) { return String(p.grupo_id) === String(currentGroup.id); }) : [];
      }
      if ((!peladas || peladas.length === 0) && window.supabase) {
        try {
          var { data: dbPeladas } = await window.supabase.from('peladas').select('*').order('data', { ascending: false });
          if (dbPeladas && dbPeladas.length > 0) peladas = dbPeladas;
        } catch (e) {}
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

      select.value = activePelada.id;
      window.App.activePelada = activePelada;

      select.onchange = async () => {
        var selId = select.value;
        var pSel = peladas.find(function (p) { return String(p.id) === String(selId); });
        if (pSel) {
          window.App.activePelada = pSel;
          try { localStorage.setItem("activePelada", JSON.stringify(pSel)); } catch (e) { }
          await Acompanhamento._fetchServerLiveState();
          Acompanhamento.render();
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
      var group = (window.Auth && window.Auth.currentGroup) || (window.App && window.App.currentGroup);
      if (group && group.id && window.Api && window.Api.listarDatasDoGrupo) {
        try {
          var peladasGroup = await window.Api.listarDatasDoGrupo(group.id);
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

    const groupConfigs = (window.Api && window.Api.getConfigs) ? window.Api.getConfigs() : [];
    const currentGrp = (window.Auth && window.Auth.currentGroup) || (window.App && window.App.currentGroup);
    const grpCfg = currentGrp ? groupConfigs.find(function (c) { return c.grupo_id === currentGrp.id; }) : null;
    const durationMin = grpCfg ? (grpCfg.tempo_partida || 8) : 8;

    let stateCarregado = false;

    if (peladaId && window.Api && window.Api.obterLiveState) {
      try {
        var res = await window.Api.obterLiveState(peladaId);
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
          }

          if (res.state.teams && res.state.teams.length > 0) {
            localStorage.setItem("teams", JSON.stringify(res.state.teams));
          }
          stateCarregado = true;
        }
      } catch (e) {
        console.error('[Acompanhamento] Erro ao obter liveState do servidor:', e);
      }
    }

    if (!stateCarregado && !window.App.liveMatch) {
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

    const timerCard = document.querySelector('.acomp-timer-wrapper-clear');
    const scoreCard = document.querySelector('.acomp-score-card-clear');
    const queueCard = document.getElementById('acomp-queue-list')?.closest('.acomp-card-clear');
    const ruleCard = document.getElementById('acomp-rule-desc-clear')?.closest('.acomp-card-clear') || document.querySelector('.acomp-rule-title-clear')?.closest('.acomp-card-clear');
    let infoCard = document.getElementById('acomp-no-teams-card');

    if (timerCard) timerCard.style.display = 'flex';
    if (scoreCard) scoreCard.style.display = 'flex';
    if (queueCard) queueCard.style.display = 'flex';
    if (ruleCard) ruleCard.style.display = 'flex';
    if (infoCard) infoCard.style.display = 'none';

    const btnToggleFS = document.getElementById("acomp-btn-toggle-fullscreen-scoreboard");
    if (btnToggleFS) {
      btnToggleFS.onclick = function () {
        if (window.App && window.App.openFullscreenScoreboard) {
          window.App.openFullscreenScoreboard();
        }
      };
    }

    this.renderTimer();
    this.renderScore();
    this.renderQueue();
    this.renderRule();
    this.renderRecentMatches();
    this.renderAcompanhamentoTournamentUI();
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

    // Renderiza Banner da Fase da Partida acima do Placar (Jogador)
    var phaseBanner = document.getElementById("acomp-phase-header-banner");
    var phaseTitle = document.getElementById("acomp-phase-header-title");
    var phaseSub = document.getElementById("acomp-phase-header-sub");

    if (phaseBanner && phaseTitle) {
      var tState = match ? (match.tournamentState || null) : null;
      var isTorneio = (peladaAtiva && peladaAtiva.modo === 'torneio') || !!tState;
      var pInfo = {
        title: '⚽ PELADA NORMAL — REINA CAMPO',
        sub: 'Revezamento de Equipes',
        bg: 'linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)',
        color: '#1E293B',
        border: '1px solid #94A3B8'
      };

      if (isTorneio && tState) {
        var currentMatchId = match ? match.tournamentMatchId : null;
        if (tState.fase === 'grupo') {
          var matchesList = tState.matches || [];
          var matchIndex = matchesList.findIndex(function(m) { return m.id === currentMatchId || m.status === 'em_andamento'; });
          if (matchIndex < 0) matchIndex = matchesList.findIndex(function(m) { return m.status !== 'encerrado'; });
          var gameNum = matchIndex >= 0 ? (matchIndex + 1) : 1;
          var totalGames = matchesList.length;
          var turnoTxt = tState.turno === 'ida_volta' ? 'Turno e Returno (Ida e Volta)' : 'Turno Único (Somente Ida)';
          pInfo = {
            title: '⚽ FASE DE GRUPOS — JOGO ' + gameNum + ' DE ' + totalGames,
            sub: 'Tabela Mista • ' + turnoTxt,
            bg: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            color: '#78350F',
            border: '1px solid #F59E0B'
          };
        } else if (tState.fase === 'mata_mata') {
          var matchesListK = tState.knockoutMatches || [];
          var matchObjK = matchesListK.find(function(m) { return m.id === currentMatchId || m.status === 'em_andamento'; }) || matchesListK.find(function(m) { return m.status !== 'encerrado'; });
          var phaseNameK = matchObjK && matchObjK.faseNome ? matchObjK.faseNome.toUpperCase() : 'SEMIFINAL (MATA-MATA)';
          pInfo = {
            title: '🔥 MATA-MATA — ' + phaseNameK,
            sub: 'Eliminatória Direta (Jogo Único)',
            bg: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
            color: '#075985',
            border: '1px solid #0284C7'
          };
        } else if (tState.fase === 'finais') {
          var matchesListF = tState.finalsMatches || [];
          var matchObjF = matchesListF.find(function(m) { return m.id === currentMatchId || m.status === 'em_andamento'; }) || matchesListF.find(function(m) { return m.status !== 'encerrado'; });
          var phaseNameF = matchObjF && matchObjF.faseNome ? matchObjF.faseNome.toUpperCase() : 'GRANDE FINAL';
          var is3rd = phaseNameF.indexOf('3º') !== -1 || phaseNameF.indexOf('TERCEIRO') !== -1;
          pInfo = {
            title: is3rd ? '🥉 DISPUTA DE 3º LUGAR' : '🏆 GRANDE FINAL DO TORNEIO',
            sub: is3rd ? 'Decisão da Medalha de Bronze' : 'Decisão do Grande Campeão do Torneio',
            bg: is3rd ? 'linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)' : 'linear-gradient(135deg, #FEF3C7 0%, #D1FAE5 100%)',
            color: is3rd ? '#831843' : '#065F46',
            border: is3rd ? '1px solid #EC4899' : '1px solid #10B981'
          };
        } else if (tState.fase === 'finalizado') {
          pInfo = {
            title: '🎉 MINI TORNEIO FINALIZADO',
            sub: 'Confira o Pódio dos Campeões!',
            bg: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
            color: '#065F46',
            border: '1px solid #10B981'
          };
        }
      }

      phaseTitle.textContent = pInfo.title;
      if (phaseSub) phaseSub.textContent = pInfo.sub;
      phaseBanner.style.background = pInfo.bg;
      phaseBanner.style.color = pInfo.color;
      phaseBanner.style.border = pInfo.border;
      phaseBanner.style.display = "block";
    }

    // Alertas de vitórias consecutivas (Apenas para Pelada Normal)
    var peladaAtiva = window.App.activePelada || {};
    var grupoAtivo = (Auth && Auth.currentGroup) || window.App.currentGroup || {};
    var isTorneioMode = peladaAtiva.modo && peladaAtiva.modo !== 'normal' && peladaAtiva.modo !== 'tradicional';

    var statusAEl = document.getElementById('acomp-team-a-status');
    var statusBEl = document.getElementById('acomp-team-b-status');

    if (isTorneioMode) {
      if (statusAEl) statusAEl.innerHTML = '';
      if (statusBEl) statusBEl.innerHTML = '';
    } else {
      var winsLimit = parseInt(peladaAtiva.vitorias_para_sair) || parseInt(grupoAtivo.vitorias_para_sair) || 2;
      var winsA = match.consecutiveWinsA || 0;
      var winsB = match.consecutiveWinsB || 0;

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

    this.renderAcompanhamentoTournamentUI();
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
      var group = (window.Auth && window.Auth.currentGroup) || (window.App && window.App.currentGroup);
      if (group && group.id && window.Api && window.Api.listarDatasDoGrupo) {
        try {
          var peladasGroup = await window.Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladasGroup) && peladasGroup.length > 0) {
            var active = peladasGroup.find(function (p) { return p.status !== 'finalizada'; }) || peladasGroup[0];
            if (active) peladaId = active.id;
          }
        } catch (e) { }
      }
    }

    try {
      var partidas = [];
      if (peladaId && window.Api && window.Api.listarPartidas) {
        try { partidas = await window.Api.listarPartidas(peladaId); } catch(e) {}
      }
      if (!partidas || !Array.isArray(partidas) || partidas.length === 0) {
        if (peladaId) {
          try { partidas = JSON.parse(localStorage.getItem("partidas_" + peladaId)) || JSON.parse(localStorage.getItem("recentMatches_" + peladaId)) || []; } catch(e) {}
        }
      }
      if (!partidas || !Array.isArray(partidas) || partidas.length === 0) {
        try { partidas = JSON.parse(localStorage.getItem("recentMatches")) || JSON.parse(localStorage.getItem("partidas")) || []; } catch(e) {}
      }
      if (!partidas || !Array.isArray(partidas) || partidas.length === 0) {
        try {
          var keys = Object.keys(localStorage).filter(function(k) { return k.indexOf("partidas") >= 0 || k.indexOf("recentMatches") >= 0; });
          keys.forEach(function(k) {
            try {
              var items = JSON.parse(localStorage.getItem(k));
              if (Array.isArray(items) && items.length > 0) {
                items.forEach(function(item) {
                  if (item && item.time_a_nome && !partidas.some(function(p) { return p.id === item.id; })) {
                    partidas.push(item);
                  }
                });
              }
            } catch(e) {}
          });
        } catch(e) {}
      }

      if (!partidas || !Array.isArray(partidas) || partidas.length === 0) {
        container.innerHTML = '<p style="text-align:center; font-size:13px; color:#64748b; padding:12px 0;">Nenhuma partida encerrada nesta pelada ainda.</p>';
        return;
      }

      // Ordena do jogo mais recente (#N) para o mais antigo (#1)
      partidas.sort(function (a, b) {
        return (b.numero_jogo || b.id || 0) - (a.numero_jogo || a.id || 0);
      });

      window.App.openGoalPanels = window.App.openGoalPanels || {};

      var teams = [];
      try { teams = (window.App && window.App.teams) || JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }

      // Popular seletor de filtro por time no Acompanhamento Jogador
      var filterSelect = document.getElementById("acomp-recent-matches-filter-team");
      var selectedTeam = "TODOS";
      if (filterSelect) {
        selectedTeam = filterSelect.value || "TODOS";

        var uniqueTeams = new Set();
        (teams || []).forEach(function (t) { if (t.nome || t.name) uniqueTeams.add(t.nome || t.name); });
        (partidas || []).forEach(function (p) {
          if (p.time_a_nome) uniqueTeams.add(p.time_a_nome);
          if (p.time_b_nome) uniqueTeams.add(p.time_b_nome);
        });

        var optionsHtml = '<option value="TODOS">🔍 Todos os Times (' + partidas.length + ')</option>';
        uniqueTeams.forEach(function (tName) {
          var count = partidas.filter(function (p) { return p.time_a_nome === tName || p.time_b_nome === tName; }).length;
          optionsHtml += '<option value="' + tName + '">' + tName + ' (' + count + ')</option>';
        });
        filterSelect.innerHTML = optionsHtml;
        filterSelect.value = uniqueTeams.has(selectedTeam) || selectedTeam === "TODOS" ? selectedTeam : "TODOS";

        filterSelect.onchange = function () {
          Acompanhamento.renderRecentMatches();
        };
      }

      // Filtragem por time selecionado
      var displayPartidas = partidas;
      if (selectedTeam && selectedTeam !== "TODOS") {
        displayPartidas = partidas.filter(function (p) {
          return p.time_a_nome === selectedTeam || p.time_b_nome === selectedTeam;
        });
      }

      if (displayPartidas.length === 0) {
        container.innerHTML = '<p style="text-align:center; font-size:13px; color:#64748b; padding:16px 0;">Nenhuma partida encontrada para o <strong>' + selectedTeam + '</strong> nesta pelada.</p>';
        return;
      }

      var html = '';
      var totalPartidas = displayPartidas.length;

      displayPartidas.forEach(function (p, idx) {
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

        html += '<div style="margin-bottom: 10px; background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%); border-radius: 14px; border: 1px solid #E2E8F0; border-left: 5px solid #10B981; padding: 12px 16px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04); display: flex; flex-direction: column; gap: 8px;">' +
          '<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 6px;">' +
          '  <span style="font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">📌 Jogo #' + numJogo + '</span>' +
          '  <button class="acomp-btn-toggle-goals" data-id="' + p.id + '" title="Ver quem fez os gols" style="padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #0F172A; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">⚽ Gols (' + goalsList.length + ')</button>' +
          '</div>' +
          '<div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; width: 100%; box-sizing: border-box;">' +
          '  <div style="display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; text-align: center;">' +
          '    <div style="width: 24px; height: 26px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));">' + embA + '</div>' +
          '    <span style="font-size: 13px; font-weight: 800; color: #0F172A; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (p.time_a_nome || 'Time A') + '</span>' +
          '  </div>' +
          '  <div style="display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
          '    <div style="background: #0F172A; color: #38BDF8; font-family: monospace, sans-serif; font-size: 15px; font-weight: 900; padding: 3px 14px; border-radius: 16px; letter-spacing: 1px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); text-align: center;">' + (p.gols_time_a || 0) + ' x ' + (p.gols_time_b || 0) + '</div>' +
          '  </div>' +
          '  <div style="display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; text-align: center;">' +
          '    <div style="width: 24px; height: 26px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));">' + embB + '</div>' +
          '    <span style="font-size: 13px; font-weight: 800; color: #0F172A; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + (p.time_b_nome || 'Time B') + '</span>' +
          '  </div>' +
          '</div>' +
          '<div id="acomp-match-goals-list-' + p.id + '" style="display: ' + (isOpen ? 'block' : 'none') + '; margin-top: 6px; padding-top: 8px; border-top: 1px dashed #CBD5E1; font-size: 12px;">' +
          (goalsList.length > 0
            ? '<div style="display:flex; flex-wrap:wrap; gap:6px;">' + goalsList.map(function (g) { return '<span style="background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">⚽ ' + (g.autorNome || 'Jogador') + (g.assistNome ? ' <span style="color:#0F172A; font-weight:600;">(Ass: ' + g.assistNome + ' 👟)</span>' : '') + ' <span style="color:#64748B; font-size:10px;">(' + (g.teamName || '') + ')</span></span>'; }).join('') + '</div>'
            : '<span style="font-size:11px; color:#64748B;">Placar encerrado: ' + (p.time_a_nome || 'Time A') + ' ' + (p.gols_time_a || 0) + ' x ' + (p.gols_time_b || 0) + ' ' + (p.time_b_nome || 'Time B') + '</span>'
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

  renderAcompanhamentoTournamentUI: function () {
    var tournamentCard = document.getElementById('acomp-tournament-card');
    var queueWrapper = document.querySelector('.acomp-queue-wrapper-clear');
    if (!tournamentCard) return;

    var peladaAtiva = window.App.activePelada || {};
    var liveMatch = window.App.liveMatch || {};
    var tState = liveMatch.tournamentState || (peladaAtiva.id ? JSON.parse(localStorage.getItem('tournamentState_' + peladaAtiva.id) || 'null') : null);
    var teams = [];
    try { teams = (window.App && window.App.teams) || JSON.parse(localStorage.getItem("teams")) || []; } catch (e) { }

    var isTorneio = (peladaAtiva && (peladaAtiva.modo === 'torneio' || peladaAtiva.modo === 'pontos_corridos' || peladaAtiva.modo === 'torneio_pontos_corridos' || peladaAtiva.modo === 'mata_mata_direto' || peladaAtiva.modo === 'torneio_livre')) || !!tState;

    if (!isTorneio || !tState) {
      tournamentCard.style.display = 'none';
      if (queueWrapper) queueWrapper.style.display = 'block';
      return;
    }

    tournamentCard.style.display = 'block';
    if (queueWrapper) queueWrapper.style.display = 'none';

    var isPontosCorridos = (peladaAtiva && (peladaAtiva.modo === 'pontos_corridos' || peladaAtiva.modo === 'torneio_pontos_corridos')) || (tState && (tState.modo === 'pontos_corridos' || tState.formato === 'pontos_corridos'));
    var isMataMataDireto = (peladaAtiva && peladaAtiva.modo === 'mata_mata_direto') || (tState && (tState.modo === 'mata_mata_direto' || tState.formato === 'mata_mata_direto'));
    var isTorneioLivre = (peladaAtiva && peladaAtiva.modo === 'torneio_livre') || (tState && (tState.modo === 'torneio_livre' || tState.formato === 'livre'));

    // Badge de Fase
    var badgeEl = document.getElementById('acomp-tournament-phase-badge');
    if (badgeEl) {
      if (tState.fase === 'livre' || isTorneioLivre) {
        badgeEl.textContent = '📋 TORNEIO LIVRE (CONFRONTOS MANUAIS)';
        badgeEl.style.background = '#E0F2FE'; badgeEl.style.color = '#0369A1';
      } else if (tState.fase === 'grupo') {
        badgeEl.textContent = isPontosCorridos ? 'CLASSIFICAÇÃO (PONTOS CORRIDOS)' : 'FASE DE GRUPOS (TABELA MISTA)';
        badgeEl.style.background = '#FEF3C7'; badgeEl.style.color = '#B45309';
      } else if (tState.fase === 'quartas') {
        badgeEl.textContent = isMataMataDireto ? 'QUARTAS DE FINAL (MATA-MATA DIRETO)' : 'QUARTAS DE FINAL (ELIMINATÓRIA)';
        badgeEl.style.background = '#E0F2FE'; badgeEl.style.color = '#0369A1';
      } else if (tState.fase === 'mata_mata') {
        badgeEl.textContent = isMataMataDireto ? 'SEMIFINAIS (MATA-MATA DIRETO)' : 'SEMIFINAIS (MATA-MATA)';
        badgeEl.style.background = '#E0F2FE'; badgeEl.style.color = '#0369A1';
      } else if (tState.fase === 'finais') {
        badgeEl.textContent = 'FINAIS & DISPUTA DE 3º LUGAR';
        badgeEl.style.background = '#FCE7F3'; badgeEl.style.color = '#9D174D';
      } else if (tState.fase === 'finalizado') {
        badgeEl.textContent = isMataMataDireto ? '⚡ MATA-MATA DIRETO FINALIZADO' : (isPontosCorridos ? '🏅 PONTOS CORRIDOS FINALIZADO' : '🏆 TORNEIO FINALIZADO');
        badgeEl.style.background = '#D1FAE5'; badgeEl.style.color = '#065F46';
      }
    }

    // 1. Tabela de Classificação
    var standingsBody = document.getElementById('acomp-tournament-standings-body');
    if (standingsBody) {
      var standings = tState.standings || [];
      if (standings.length === 0) {
        standingsBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:12px; color:#64748B;">Aguardando sorteio...</td></tr>';
      } else {
        var html = '';
        standings.forEach(function (st, idx) {
          var medal = '';
          html += '<tr style="' + (idx === 0 ? 'font-weight:700; background:rgba(254,243,199,0.3);' : '') + '">' +
            '<td style="text-align:center; font-weight:700;">' + (idx + 1) + '</td>' +
            '<td style="font-weight:700; color:#0F172A;">' + medal + st.nome + '</td>' +
            '<td style="text-align:center;">' + st.jogos + '</td>' +
            '<td style="text-align:center;">' + st.vitorias + '</td>' +
            '<td style="text-align:center;">' + st.empates + '</td>' +
            '<td style="text-align:center;">' + st.derrotas + '</td>' +
            '<td style="text-align:center;">' + st.golsPro + '</td>' +
            '<td style="text-align:center;">' + st.golsContra + '</td>' +
            '<td style="text-align:center;">' + (st.saldoGols > 0 ? '+' + st.saldoGols : st.saldoGols) + '</td>' +
            '<td style="text-align:center; font-weight:800; color:#D97706; font-size:13px;">' + st.pontos + '</td>' +
            '</tr>';
        });
        standingsBody.innerHTML = html;
      }
    }

    // 2. Lista de Jogos
    var matchesList = document.getElementById('acomp-tournament-matches-list');
    if (matchesList) {
      var allMatches = [];
      if (Array.isArray(tState.matches)) allMatches.push.apply(allMatches, tState.matches);
      if (Array.isArray(tState.knockoutMatches)) allMatches.push.apply(allMatches, tState.knockoutMatches);
      if (Array.isArray(tState.finalsMatches)) allMatches.push.apply(allMatches, tState.finalsMatches);

      var isNight = document.body.classList.contains('modo-noturno-ativo');

      if (allMatches.length === 0) {
        matchesList.innerHTML = '<div style="text-align:center; padding:12px; color:' + (isNight ? '#CBD5E1' : '#64748B') + ';">Nenhum jogo gerado.</div>';
      } else {
        var mHtml = '';
        allMatches.forEach(function (m, idx) {
          var isCurrent = m.id === (liveMatch.tournamentMatchId) || (m.status === 'em_andamento');
          var isDone = m.status === 'encerrado';

          var penTxt = (m.penaltisA !== null && m.penaltisB !== null && m.penaltisA !== undefined && m.penaltisB !== undefined)
            ? ' <small style="font-size:9px; opacity:0.9;">(' + m.penaltisA + 'x' + m.penaltisB + ' 🎯)</small>'
            : '';

          var statusTag = isDone
            ? '<span style="font-size:10px; background:' + (isNight ? 'rgba(16, 185, 129, 0.25)' : '#D1FAE5') + '; color:' + (isNight ? '#A7F3D0' : '#065F46') + '; padding:2px 6px; border-radius:4px; font-weight:700; border:' + (isNight ? '1px solid rgba(16, 185, 129, 0.4)' : 'none') + ';">✅ ' + m.golsA + ' x ' + m.golsB + penTxt + '</span>'
            : (isCurrent
              ? '<span style="font-size:10px; background:' + (isNight ? 'rgba(245, 210, 112, 0.25)' : '#FEF3C7') + '; color:' + (isNight ? '#FFFFFF' : '#B45309') + '; padding:2px 6px; border-radius:4px; font-weight:700; border:' + (isNight ? '1px solid #F59E0B' : '1px solid #FCD34D') + ';">⚽ EM ANDAMENTO</span>'
              : '<span style="font-size:10px; background:' + (isNight ? 'rgba(255, 255, 255, 0.15)' : '#F1F5F9') + '; color:' + (isNight ? '#E2E8F0' : '#64748B') + '; padding:2px 6px; border-radius:4px; font-weight:600; border:' + (isNight ? '1px solid rgba(255, 255, 255, 0.2)' : 'none') + ';">⏳ A JOGAR</span>');

          var rowBg = isNight
            ? (isCurrent ? 'linear-gradient(135deg, rgba(245, 210, 112, 0.25) 0%, rgba(15, 23, 42, 0.6) 100%)' : 'rgba(255, 255, 255, 0.12)')
            : (isCurrent ? '#FFFBEB' : '#F8FAFC');

          var rowBorder = isNight
            ? (isCurrent ? '#FCD34D' : 'rgba(255, 255, 255, 0.2)')
            : (isCurrent ? '#FCD34D' : '#E2E8F0');

          var textColor = isNight ? '#FFFFFF' : '#0F172A';
          var subTextColor = isNight ? 'rgba(255, 255, 255, 0.85)' : '#64748B';

          var embA = '', embB = '';
          if (window.TeamEmblems && teams.length > 0) {
            var tA = teams.find(function (t) { return (t.nome || t.name || '').toLowerCase().trim() === (m.teamA || '').toLowerCase().trim(); });
            var tB = teams.find(function (t) { return (t.nome || t.name || '').toLowerCase().trim() === (m.teamB || '').toLowerCase().trim(); });
            if (tA) embA = '<span style="display:inline-block; width:16px; height:18px; vertical-align:middle; margin-right:4px;">' + window.TeamEmblems.forTeam(tA) + '</span>';
            if (tB) embB = '<span style="display:inline-block; width:16px; height:18px; vertical-align:middle; margin-left:4px;">' + window.TeamEmblems.forTeam(tB) + '</span>';
          }

          mHtml += '<div style="margin-bottom: 8px; background: ' + rowBg + '; border-radius: 12px; border: 1px solid ' + rowBorder + '; border-left: 4px solid ' + (isCurrent ? '#F59E0B' : (isDone ? '#10B981' : '#64748B')) + '; padding: 10px 14px; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04); display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; width: 100%; box-sizing: border-box; backdrop-filter: blur(8px);' + (isCurrent && isNight ? ' box-shadow: 0 4px 12px rgba(245, 210, 112, 0.25);' : '') + '">' +
            '<div style="display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; text-align: center;">' +
            '<div style="width: 22px; height: 24px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));">' + embA + '</div>' +
            '<span style="font-size: 13px; font-weight: 800; color: ' + textColor + '; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + m.teamA + '</span>' +
            '</div>' +
            '<div style="display: flex; align-items: center; justify-content: center; flex-shrink: 0;">' +
            (isDone ? '<div style="background: #0F172A; color: #38BDF8; font-family: monospace, sans-serif; font-size: 15px; font-weight: 900; padding: 3px 12px; border-radius: 16px; letter-spacing: 1px;">' + m.golsA + ' x ' + m.golsB + penTxt + '</div>' : (isCurrent ? '<div style="background: #D97706; color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 14px; text-transform: uppercase;">⚽ EM ANDAMENTO</div>' : '<div style="background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 14px; text-transform: uppercase;">⏳ A JOGAR</div>')) +
            '</div>' +
            '<div style="display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; text-align: center;">' +
            '<div style="width: 22px; height: 24px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));">' + embB + '</div>' +
            '<span style="font-size: 13px; font-weight: 800; color: ' + textColor + '; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + m.teamB + '</span>' +
            '</div>' +
            '</div>';
        });
        matchesList.innerHTML = mHtml;
      }
    }

    // 3. Pódio do Torneio
    var podiumCont = document.getElementById('acomp-tournament-podium-container');
    var podiumCards = document.getElementById('acomp-tournament-podium-cards');
    if (podiumCont && podiumCards) {
      if (tState.podium || tState.fase === 'finalizado') {
        var pod = tState.podium || (window.TournamentEngine ? window.TournamentEngine.determinePodium(tState.finalsMatches, tState.standings) : {});
        podiumCont.style.display = 'block';
        podiumCards.innerHTML = '<div style="background:#FFF; padding:10px; border-radius:8px; border:1px solid #FCD34D; flex:1; min-width:110px;">' +
          '<div style="font-size:24px;">🥇</div>' +
          '<div style="font-size:10px; color:#B45309; font-weight:700;">CAMPEÃO</div>' +
          '<strong style="font-size:13px; color:#0F172A;">' + (pod.primeiro || '—') + '</strong>' +
          '</div>' +
          '<div style="background:#FFF; padding:10px; border-radius:8px; border:1px solid #CBD5E1; flex:1; min-width:110px;">' +
          '<div style="font-size:24px;">🥈</div>' +
          '<div style="font-size:10px; color:#475569; font-weight:700;">VICE-CAMPEÃO</div>' +
          '<strong style="font-size:13px; color:#0F172A;">' + (pod.segundo || '—') + '</strong>' +
          '</div>' +
          '<div style="background:#FFF; padding:10px; border-radius:8px; border:1px solid #FDBA74; flex:1; min-width:110px;">' +
          '<div style="font-size:24px;">🥉</div>' +
          '<div style="font-size:10px; color:#C2410C; font-weight:700;">3º LUGAR</div>' +
          '<strong style="font-size:13px; color:#0F172A;">' + (pod.terceiro || '—') + '</strong>' +
          '</div>' +
          '<div style="background:#FFF; padding:10px; border-radius:8px; border:1px solid #E2E8F0; flex:1; min-width:110px;">' +
          '<div style="font-size:24px;">4️⃣</div>' +
          '<div style="font-size:10px; color:#64748B; font-weight:700;">4º LUGAR</div>' +
          '<strong style="font-size:13px; color:#0F172A;">' + (pod.quarto || '—') + '</strong>' +
          '</div>';
      } else {
        podiumCont.style.display = 'none';
      }
    }
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
