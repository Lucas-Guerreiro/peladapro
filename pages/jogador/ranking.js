// ==========================================================================
// pages/jogador/ranking.js — Classificação e Artilharia
// ==========================================================================

var Ranking = {

  init: function() {
    this.populateFilter();
    this.bindEvents();
  },

  // --- Popula o filtro de peladas do grupo ativo ---
  populateFilter: async function() {
    var selectEl = document.getElementById('ranking-pelada-filter');
    if (!selectEl) return;

    var group = Auth.currentGroup;
    var groupId = group ? group.id : null;

    if (!groupId) {
      selectEl.innerHTML = '<option value="all">📊 Geral (Nenhum grupo ativo)</option>';
      this.renderAll('all');
      return;
    }

    selectEl.innerHTML = '<option value="all">📊 Carregando peladas...</option>';

    try {
      var peladas = await Api.listarDatasDoGrupo(groupId);
      selectEl.innerHTML = '<option value="all">📊 Geral (Todas as Peladas)</option>';

      if (Array.isArray(peladas) && peladas.length > 0) {
        peladas.forEach(function(p) {
          var opt = document.createElement('option');
          opt.value = p.id;
          var dataFmt = window.Utils ? window.Utils.formatDate(p.data) : p.data;
          opt.textContent = '📅 ' + dataFmt + (p.horario ? ' · ' + p.horario : '') + (p.local ? ' — ' + p.local : '');
          selectEl.appendChild(opt);
        });

        // Seleciona por padrão a pelada mais recente / ativa
        selectEl.value = peladas[0].id;
        this.renderAll(peladas[0].id);
      } else {
        this.renderAll('all');
      }
    } catch (e) {
      console.error('[Ranking] Erro ao carregar peladas:', e);
      selectEl.innerHTML = '<option value="all">📊 Geral (Todas as Peladas)</option>';
      this.renderAll('all');
    }
  },

  renderAll: async function(peladaId) {
    var id = (peladaId && peladaId !== 'all') ? peladaId : null;
    await this.renderClassificacao(id);
    await this.renderArtilharia(id);
  },

  // --- Tabela de classificação dos times (calculada a partir das partidas finalizadas) ---
  renderClassificacao: async function(peladaId) {
    var tbody = document.getElementById('ranking-teams-body');
    if (!tbody) return;

    var partidas = [];
    if (peladaId) {
      try {
        partidas = await Api.listarPartidas(peladaId);
      } catch (e) {
        console.warn('[Ranking] Erro ao carregar partidas para classificação:', e);
      }
    } else {
      var group = Auth.currentGroup;
      if (group && group.id) {
        try {
          var peladasGroup = await Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladasGroup)) {
            for (var i = 0; i < peladasGroup.length; i++) {
              var listP = await Api.listarPartidas(peladasGroup[i].id);
              if (Array.isArray(listP)) {
                partidas = partidas.concat(listP);
              }
            }
          }
        } catch (e) {}
      }
    }

    var teamsMap = {};

    // Inicializa com times sorteados localmente se existirem
    var localTeams = Api.getTeams() || [];
    localTeams.forEach(function(t) {
      var nome = t.nome || t.name;
      if (nome) {
        teamsMap[nome] = {
          nome: nome,
          cor: t.cor || '#0284C7',
          vitorias: 0,
          empates: 0,
          derrotas: 0,
          jogos: 0,
          gols_pro: 0,
          gols_contra: 0,
          pontos: 0
        };
      }
    });

    // Calcula pontuação e saldo acumulando as partidas do banco
    (partidas || []).forEach(function(m) {
      var timeA = m.time_a_nome || 'Time A';
      var timeB = m.time_b_nome || 'Time B';
      var gA = parseInt(m.gols_time_a) || 0;
      var gB = parseInt(m.gols_time_b) || 0;

      if (!teamsMap[timeA]) {
        teamsMap[timeA] = { nome: timeA, cor: '#2196F3', vitorias: 0, empates: 0, derrotas: 0, jogos: 0, gols_pro: 0, gols_contra: 0, pontos: 0 };
      }
      if (!teamsMap[timeB]) {
        teamsMap[timeB] = { nome: timeB, cor: '#FFC107', vitorias: 0, empates: 0, derrotas: 0, jogos: 0, gols_pro: 0, gols_contra: 0, pontos: 0 };
      }

      var tA = teamsMap[timeA];
      var tB = teamsMap[timeB];

      tA.jogos++;
      tB.jogos++;
      tA.gols_pro += gA;
      tA.gols_contra += gB;
      tB.gols_pro += gB;
      tB.gols_contra += gA;

      if (gA > gB) {
        tA.vitorias++;
        tA.pontos += 3;
        tB.derrotas++;
      } else if (gB > gA) {
        tB.vitorias++;
        tB.pontos += 3;
        tA.derrotas++;
      } else {
        tA.empates++;
        tA.pontos += 1;
        tB.empates++;
        tB.pontos += 1;
      }
    });

    var sortedTeams = Object.values(teamsMap).sort(function(a, b) {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      var sgA = a.gols_pro - a.gols_contra;
      var sgB = b.gols_pro - b.gols_contra;
      if (sgB !== sgA) return sgB - sgA;
      return b.gols_pro - a.gols_pro;
    });

    if (sortedTeams.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--text-caption);">Nenhuma partida ou time registrado ainda.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var classMap = ['ranking-gold', 'ranking-silver', 'ranking-bronze'];

    var html = '';
    sortedTeams.forEach(function(team, idx) {
      var sg = team.gols_pro - team.gols_contra;
      var sgStr = sg > 0 ? '+' + sg : String(sg);

      html += '<tr>' +
        '<td style="text-align: center;">' +
          (idx < 3 ? '<span class="ranking-badge-top ' + (classMap[idx] || '') + '">' + (badgeMap[idx] || (idx+1)) + '</span>' : (idx+1)) +
        '</td>' +
        '<td style="font-weight: 600;">' +
          '<span style="color: ' + (team.cor || '#666') + '; margin-right: 6px;">■</span>' + team.nome +
        '</td>' +
        '<td style="text-align: center; font-weight: 700;">' + team.pontos + '</td>' +
        '<td style="text-align: center;">' + team.jogos + '</td>' +
        '<td style="text-align: center;">' + team.vitorias + '</td>' +
        '<td style="text-align: center; color: ' + (sg >= 0 ? 'var(--success)' : 'var(--danger)') + '; font-weight: 600;">' + sgStr + '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;
  },

  // --- Artilharia ---
  renderArtilharia: async function(peladaId) {
    var tbody = document.getElementById('ranking-scorers-body');
    if (!tbody) return;

    var scorersMap = {};
    var partidas = [];

    if (peladaId) {
      try {
        partidas = await Api.listarPartidas(peladaId);
      } catch (e) {}
    } else {
      var group = Auth.currentGroup;
      if (group && group.id) {
        try {
          var peladasGroup = await Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladasGroup)) {
            for (var i = 0; i < peladasGroup.length; i++) {
              var listP = await Api.listarPartidas(peladasGroup[i].id);
              if (Array.isArray(listP)) partidas = partidas.concat(listP);
            }
          }
        } catch (e) {}
      }
    }

    if (Array.isArray(partidas) && partidas.length > 0) {
      var teams = [];
      try { teams = JSON.parse(localStorage.getItem('teams')) || []; } catch(e) {}
      if (!teams || teams.length === 0) teams = Api.getTeams() || [];

      if ((!teams || teams.length === 0) && peladaId && Api.obterLiveState) {
        try {
          var liveRes = await Api.obterLiveState(peladaId);
          if (liveRes && liveRes.state && Array.isArray(liveRes.state.teams)) {
            teams = liveRes.state.teams;
          }
        } catch(e) {}
      }

      var teamPlayersMap = {};
      (teams || []).forEach(function(t) {
        var tName = (t.nome || t.name || '').trim().toLowerCase();
        if (tName) {
          if (!teamPlayersMap[tName]) teamPlayersMap[tName] = new Set();
          var pList = t.jogadores || t.players || [];
          pList.forEach(function(p) {
            var pApelido = (p.apelido || '').trim().toLowerCase();
            var pNome = (p.nome || '').trim().toLowerCase();
            if (pApelido) teamPlayersMap[tName].add(pApelido);
            if (pNome) teamPlayersMap[tName].add(pNome);
          });
        }
      });

      var teamMatchesCount = {};
      var matchGols = {};
      var matchAssists = {};

      partidas.forEach(function(m) {
        var tA = (m.time_a_nome || '').trim().toLowerCase();
        var tB = (m.time_b_nome || '').trim().toLowerCase();

        if (tA) teamMatchesCount[tA] = (teamMatchesCount[tA] || 0) + 1;
        if (tB) teamMatchesCount[tB] = (teamMatchesCount[tB] || 0) + 1;

        let goalsList = [];
        if (m.autores_gols) {
          try { goalsList = typeof m.autores_gols === 'string' ? JSON.parse(m.autores_gols) : m.autores_gols; } catch(e) {}
        }
        (goalsList || []).forEach(function(g) {
          if (g.autorNome) {
            var aNome = g.autorNome.trim();
            matchGols[aNome] = (matchGols[aNome] || 0) + 1;
          }
          if (g.assistNome) {
            var assNome = g.assistNome.trim();
            matchAssists[assNome] = (matchAssists[assNome] || 0) + 1;
          }
        });
      });

      Object.keys(matchGols).forEach(function(nome) {
        var lowerKey = nome.toLowerCase();
        var jogosCount = 1;

        Object.keys(teamPlayersMap).forEach(function(tName) {
          if (teamPlayersMap[tName].has(lowerKey)) {
            jogosCount = Math.max(jogosCount, teamMatchesCount[tName] || 1);
          }
        });

        scorersMap[nome] = {
          nome: nome,
          gols: matchGols[nome] || 0,
          assistencias: matchAssists[nome] || 0,
          jogos: jogosCount
        };
      });

      Object.keys(matchAssists).forEach(function(nome) {
        if (!scorersMap[nome]) {
          var lowerKey = nome.toLowerCase();
          var jogosCount = 1;

          Object.keys(teamPlayersMap).forEach(function(tName) {
            if (teamPlayersMap[tName].has(lowerKey)) {
              jogosCount = Math.max(jogosCount, teamMatchesCount[tName] || 1);
            }
          });

          scorersMap[nome] = {
            nome: nome,
            gols: matchGols[nome] || 0,
            assistencias: matchAssists[nome] || 0,
            jogos: jogosCount
          };
        }
      });
    }

    var scorers = Object.values(scorersMap)
      .filter(function(p) { return p.gols > 0 || p.assistencias > 0; })
      .sort(function(a, b) {
        if (b.gols !== a.gols) return b.gols - a.gols;
        return b.assistencias - a.assistencias;
      });

    if (scorers.length === 0) {
      var players = Api.getPlayers() || [];
      scorers = players
        .filter(function(p) { return (p.gols || 0) > 0; })
        .map(function(p) { return { nome: p.apelido || p.nome, gols: p.gols || 0, assistencias: 0, jogos: p.partidas || 0 }; })
        .sort(function(a, b) { return b.gols - a.gols; });
    }

    if (scorers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-caption);">Sem artilheiros registrados.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    scorers.slice(0, 10).forEach(function(p, idx) {
      html += '<tr>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || (idx + 1)) + '</td>' +
        '<td style="font-weight: 600;">' + p.nome + '</td>' +
        '<td style="text-align: center; font-weight: 700; color: var(--secondary);">' + p.gols + ' ⚽</td>' +
        '<td style="text-align: center; color: var(--text-caption); font-weight: 600;">' + (p.assistencias || 0) + ' 👟</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;
  },

  // --- Bind de eventos ---
  bindEvents: function() {
    var filterEl = document.getElementById('ranking-pelada-filter');
    if (filterEl) {
      filterEl.addEventListener('change', function(e) {
        Ranking.renderAll(e.target.value);
      });
    }
  }
};

// --- Ponto de entrada chamado pelo Router ---
window.App.initRanking = function() {
  Ranking.init();
};
