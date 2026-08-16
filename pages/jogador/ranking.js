// ==========================================================================
// pages/jogador/ranking.js — Classificação e Artilharia
// ==========================================================================

var Ranking = {

  init: function() {
    this.populateFilter();
    this.bindEvents();
    if (window.AdSenseManager) {
      window.AdSenseManager.renderAdContainer('adsense-ranking-banner');
    }
  },

  // --- Popula o filtro de peladas do grupo ativo ---
  populateFilter: async function() {
    var selectEl = document.getElementById('ranking-pelada-filter');
    if (!selectEl) return;

    var group = (window.Auth && window.Auth.currentGroup) || (window.App && window.App.currentGroup) || JSON.parse(localStorage.getItem('currentGroup') || 'null');
    var groupId = group ? group.id : null;

    if (!groupId) {
      try {
        var grupos = Api.listarGrupos ? await Api.listarGrupos() : (Api.getGruposDoGestor ? await Api.getGruposDoGestor() : []);
        if (Array.isArray(grupos) && grupos.length > 0) {
          group = grupos[0];
          groupId = group.id;
          if (window.Auth && !window.Auth.currentGroup) window.Auth.currentGroup = group;
          if (window.App) window.App.currentGroup = group;
          localStorage.setItem('currentGroup', JSON.stringify(group));
        }
      } catch (e) {
        console.warn('[Ranking] Erro ao carregar grupos:', e);
      }
    }

    if (!groupId) {
      selectEl.innerHTML = '<option value="all">📊 Geral (Todas as Peladas)</option>';
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
          var rawDate = p.data ? String(p.data).split('T')[0] : '';
          var dataFmt = window.Utils ? window.Utils.formatDate(rawDate || p.data) : (p.data || '');
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

      var teamObj = localTeams.find(function(t) { return (t.nome || t.name) === team.nome; }) || { nome: team.nome, emblema: idx % 10 };
      var emblemSvg = window.TeamEmblems ? window.TeamEmblems.forTeam(teamObj) : '';

      html += '<tr>' +
        '<td style="text-align: center;">' +
          (idx < 3 ? '<span class="ranking-badge-top ' + (classMap[idx] || '') + '">' + (badgeMap[idx] || (idx+1)) + '</span>' : (idx+1)) +
        '</td>' +
        '<td style="font-weight: 600;">' +
          '<div style="display: inline-flex; align-items: center; gap: 8px;">' +
            '<div style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;">' + emblemSvg + '</div>' +
            '<span>' + team.nome + '</span>' +
          '</div>' +
        '</td>' +
        '<td style="text-align: center; font-weight: 700;">' + team.pontos + '</td>' +
        '<td style="text-align: center;">' + team.jogos + '</td>' +
        '<td style="text-align: center;">' + team.vitorias + '</td>' +
        '<td style="text-align: center; color: ' + (sg >= 0 ? 'var(--success)' : 'var(--danger)') + '; font-weight: 600;">' + sgStr + '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;
  },

  // --- Artilharia (Sincronizado 100% com o numero de jogos por time em Acompanhamento) ---
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
      // 1. Busca os times sorteados da pelada (do localStorage, Api ou LiveState)
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

      // Mapa de times -> jogadores
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

      // 2. Contabiliza a quantidade exata de partidas disputadas por cada TIME em CADA PELADA
      var teamMatchesByPelada = {};
      var playerTeamByPelada = {};
      var matchGols = {};
      var matchAssists = {};

      partidas.forEach(function(m) {
        var pId = m.pelada_id;
        if (!teamMatchesByPelada[pId]) teamMatchesByPelada[pId] = {};

        var tA = (m.time_a_nome || '').trim();
        var tB = (m.time_b_nome || '').trim();

        if (tA) {
          var keyA = tA.toLowerCase();
          teamMatchesByPelada[pId][keyA] = (teamMatchesByPelada[pId][keyA] || 0) + 1;
        }
        if (tB) {
          var keyB = tB.toLowerCase();
          teamMatchesByPelada[pId][keyB] = (teamMatchesByPelada[pId][keyB] || 0) + 1;
        }

        let goalsList = [];
        if (m.autores_gols) {
          try { goalsList = typeof m.autores_gols === 'string' ? JSON.parse(m.autores_gols) : m.autores_gols; } catch(e) {}
        }

        (goalsList || []).forEach(function(g) {
          var teamNameOfPlayer = g.teamName || (g.teamKey === 'a' ? tA : (g.teamKey === 'b' ? tB : null));
          var golKey = g.autorId ? String(g.autorId) : (g.autorNome ? g.autorNome.trim() : null);

          if (golKey) {
            var aNome = g.autorNome ? g.autorNome.trim() : golKey;
            if (!matchGols[golKey]) matchGols[golKey] = { id: golKey, nome: aNome, count: 0 };
            if (aNome.length < matchGols[golKey].nome.length) matchGols[golKey].nome = aNome;
            matchGols[golKey].count++;

            if (teamNameOfPlayer) {
              playerTeamByPelada[golKey + '_' + pId] = teamNameOfPlayer.trim().toLowerCase();
            }
          }

          var assKey = g.assistId ? String(g.assistId) : (g.assistNome ? g.assistNome.trim() : null);
          if (assKey) {
            var assNome = g.assistNome ? g.assistNome.trim() : assKey;
            if (!matchAssists[assKey]) matchAssists[assKey] = { id: assKey, nome: assNome, count: 0 };
            if (assNome.length < matchAssists[assKey].nome.length) matchAssists[assKey].nome = assNome;
            matchAssists[assKey].count++;

            if (teamNameOfPlayer) {
              playerTeamByPelada[assKey + '_' + pId] = teamNameOfPlayer.trim().toLowerCase();
            }
          }
        });
      });

      // Helper para calcular o total acumulado de jogos do atleta somando cada pelada disputada
      function getGamesForPlayer(key) {
        var totalGames = 0;

        Object.keys(teamMatchesByPelada).forEach(function(pId) {
          var peladaTeams = teamMatchesByPelada[pId] || {};
          var teamFromGoal = playerTeamByPelada[key + '_' + pId];

          if (teamFromGoal && peladaTeams[teamFromGoal]) {
            totalGames += peladaTeams[teamFromGoal];
          } else {
            var lowerKey = key.toLowerCase();
            var matchedGames = 0;
            Object.keys(teamPlayersMap).forEach(function(tName) {
              if (teamPlayersMap[tName] && teamPlayersMap[tName].has(lowerKey)) {
                matchedGames = Math.max(matchedGames, peladaTeams[tName] || 0);
              }
            });

            if (matchedGames > 0) {
              totalGames += matchedGames;
            } else if (playerTeamByPelada[key + '_' + pId]) {
              var allCounts = Object.values(peladaTeams);
              if (allCounts.length > 0) totalGames += Math.max.apply(null, allCounts);
            }
          }
        });

        return totalGames > 0 ? totalGames : 1;
      }

      Object.keys(matchGols).forEach(function(key) {
        scorersMap[key] = {
          id: key,
          nome: matchGols[key].nome,
          gols: matchGols[key].count || 0,
          assistencias: matchAssists[key] ? matchAssists[key].count : 0,
          jogos: getGamesForPlayer(key)
        };
      });

      Object.keys(matchAssists).forEach(function(key) {
        if (!scorersMap[key]) {
          scorersMap[key] = {
            id: key,
            nome: matchAssists[key].nome,
            gols: 0,
            assistencias: matchAssists[key].count || 0,
            jogos: getGamesForPlayer(key)
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

    if (scorers.length === 0 && !peladaId) {
      var players = Api.getPlayers() || [];
      scorers = players
        .filter(function(p) { return (p.gols || 0) > 0; })
        .map(function(p) { return { nome: p.apelido || p.nome, gols: p.gols || 0, assistencias: 0, jogos: p.partidas || 0 }; })
        .sort(function(a, b) { return b.gols - a.gols; });
    }

    if (scorers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum gol registrado nesta data ainda.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    var allPlayersList = Api.getPlayers() || [];
    try {
      var locP = JSON.parse(localStorage.getItem("players"));
      if (Array.isArray(locP) && locP.length > 0) allPlayersList = locP;
    } catch(e) {}

    scorers.slice(0, 10).forEach(function(p, idx) {
      var foundPlayer = allPlayersList.find(function(pl) {
        var pName = (pl.apelido || pl.nome || '').trim().toLowerCase();
        var fullN = (pl.nome || '').trim().toLowerCase();
        var targetN = (p.nome || '').trim().toLowerCase();
        return pName === targetN || fullN === targetN || String(pl.id) === String(p.id);
      });

      var fotoUrl = foundPlayer ? foundPlayer.foto : null;
      var initial = (p.nome || '?').charAt(0).toUpperCase();

      var avatarHTML = fotoUrl
        ? '<img src="' + fotoUrl + '" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid #10B981; flex-shrink: 0;" alt="' + p.nome + '">'
        : '<div style="width: 36px; height: 36px; border-radius: 50%; background: #10B981; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; border: 2px solid #E2E8F0; flex-shrink: 0;">' + initial + '</div>';

      html += '<tr style="border-bottom: 1px solid var(--border-color, #F1F5F9);">' +
        '<td style="text-align: center; padding: 8px 6px; font-weight: 700;">' + (badgeMap[idx] || (idx + 1)) + '</td>' +
        '<td style="font-weight: 700; padding: 8px 6px;">' +
          '<div style="display: flex; align-items: center; gap: 8px;">' +
            avatarHTML +
            '<span style="font-size: 13px; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">' + p.nome + '</span>' +
          '</div>' +
        '</td>' +
        '<td style="text-align: center; font-weight: 800; color: #10B981; font-size: 13px; padding: 8px 6px;">' + p.gols + ' ⚽</td>' +
        '<td style="text-align: center; color: #64748B; font-weight: 600; font-size: 12px; padding: 8px 6px;">' + (p.assistencias || 0) + ' 👟</td>' +
        '<td style="text-align: center; color: #0F172A; font-weight: 800; font-size: 13px; padding: 8px 6px;">' + (p.jogos || 1) + '</td>' +
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
