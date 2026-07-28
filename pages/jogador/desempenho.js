// ==========================================================================
// pages/jogador/desempenho.js — Estatísticas de Desempenho
// ==========================================================================

var Desempenho = {

  init: function() {
    this.populateFilter();
    this.renderMyStats();
    this.bindEvents();
  },

  populateFilter: async function() {
    var selectEl = document.getElementById('desempenho-pelada-filter');
    if (!selectEl) return;

    var group = Auth.currentGroup;
    var groupId = group ? group.id : null;

    if (!groupId) {
      selectEl.innerHTML = '<option value="all">📊 Geral (Todas as Peladas)</option>';
      this.renderAll('all');
      return;
    }

    try {
      var peladas = await Api.listarDatasDoGrupo(groupId);
      selectEl.innerHTML = '<option value="all">📊 Geral (Todas as Peladas)</option>';

      if (Array.isArray(peladas) && peladas.length > 0) {
        peladas.forEach(function(p) {
          var opt = document.createElement('option');
          opt.value = p.id;
          var dataFmt = window.Utils ? window.Utils.formatDate(p.data) : p.data;
          opt.textContent = '📅 ' + dataFmt + (p.horario ? ' · ' + p.horario : '');
          selectEl.appendChild(opt);
        });
      }
    } catch (e) {
      console.error('[Desempenho] Erro ao carregar peladas:', e);
      selectEl.innerHTML = '<option value="all">📊 Geral (Todas as Peladas)</option>';
    }

    this.renderAll('all');
  },

  renderAll: async function(peladaId) {
    var id = (peladaId && peladaId !== 'all') ? peladaId : null;
    await this.renderArtilharia(id);
    await this.renderMelhoresAvaliados(id);
    await this.renderGoleiros(id);
  },

  // --- Artilharia (Calcula Gols e Jogos por Time) --------------------------
  renderArtilharia: async function(peladaId) {
    var tbody = document.getElementById('desempenho-artilharia-body');
    if (!tbody) return;

    var players = Api.getPlayers() || [];
    var scorersMap = {};

    players.forEach(function(p) {
      if (p.ativo !== false && !p.goleiro) {
        var nome = (p.apelido || p.nome || '').trim();
        scorersMap[nome] = {
          id: p.id,
          nome: nome,
          gols: p.gols || 0,
          jogos: p.partidas || 0,
          isMe: Auth.currentUser && String(p.id) === String(Auth.currentUser.id)
        };
      }
    });

    try {
      var partidas = [];
      if (peladaId) {
        partidas = await Api.listarPartidas(peladaId);
      } else {
        var group = Auth.currentGroup;
        if (group && group.id) {
          var peladasGroup = await Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladasGroup)) {
            for (var i = 0; i < peladasGroup.length; i++) {
              var listP = await Api.listarPartidas(peladasGroup[i].id);
              if (Array.isArray(listP)) partidas = partidas.concat(listP);
            }
          }
        }
      }

      if (Array.isArray(partidas) && partidas.length > 0) {
        // Mapeia atletas por time sorteado
        var teamPlayersMap = {};
        var teams = [];
        try { teams = JSON.parse(localStorage.getItem('teams')) || []; } catch(e) {}
        if (!teams || teams.length === 0) teams = Api.getTeams() || [];

        (teams || []).forEach(function(t) {
          var tName = (t.nome || t.name || '').trim();
          if (tName) {
            if (!teamPlayersMap[tName]) teamPlayersMap[tName] = new Set();
            var pList = t.jogadores || t.players || [];
            pList.forEach(function(p) {
              var pName = (p.apelido || p.nome || '').trim();
              if (pName) teamPlayersMap[tName].add(pName);
            });
          }
        });

        var matchGols = {};
        var matchJogos = {};

        partidas.forEach(function(m) {
          var playersInMatch = new Set();

          // Atletas do Time A
          var tA = (m.time_a_nome || '').trim();
          if (tA && teamPlayersMap[tA]) {
            teamPlayersMap[tA].forEach(function(nome) { playersInMatch.add(nome); });
          }
          // Atletas do Time B
          var tB = (m.time_b_nome || '').trim();
          if (tB && teamPlayersMap[tB]) {
            teamPlayersMap[tB].forEach(function(nome) { playersInMatch.add(nome); });
          }

          // Processa gols e assistências da partida
          let goalsList = [];
          if (m.autores_gols) {
            try { goalsList = typeof m.autores_gols === 'string' ? JSON.parse(m.autores_gols) : m.autores_gols; } catch(e) {}
          }
          (goalsList || []).forEach(function(g) {
            if (g.autorNome) {
              var aNome = g.autorNome.trim();
              matchGols[aNome] = (matchGols[aNome] || 0) + 1;
              playersInMatch.add(aNome);
            }
            if (g.assistNome) {
              var assNome = g.assistNome.trim();
              playersInMatch.add(assNome);
            }
          });

          // Cada atleta em um dos dois times do jogo ganha +1 jogo disputado
          playersInMatch.forEach(function(nome) {
            matchJogos[nome] = (matchJogos[nome] || 0) + 1;
          });
        });

        Object.keys(matchGols).forEach(function(nome) {
          if (scorersMap[nome]) {
            scorersMap[nome].gols = matchGols[nome];
            scorersMap[nome].jogos = Math.max(scorersMap[nome].jogos, matchJogos[nome] || 1);
          } else {
            scorersMap[nome] = {
              nome: nome,
              gols: matchGols[nome],
              jogos: matchJogos[nome] || 1,
              isMe: false
            };
          }
        });

        // Atualiza quantidade de jogos também para os atletas que participaram das partidas mesmo sem fazer gols
        Object.keys(matchJogos).forEach(function(nome) {
          if (scorersMap[nome]) {
            scorersMap[nome].jogos = Math.max(scorersMap[nome].jogos, matchJogos[nome]);
          }
        });
      }
    } catch (e) {
      console.warn('[Desempenho] Erro ao recalcular artilharia:', e);
    }

    var scorers = Object.values(scorersMap)
      .filter(function(p) { return p.gols > 0; })
      .sort(function(a, b) {
        if (b.gols !== a.gols) return b.gols - a.gols;
        return a.jogos - b.jogos;
      })
      .slice(0, 10);

    if (scorers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum gol registrado.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    scorers.forEach(function(p, idx) {
      html += '<tr' + (p.isMe ? ' style="background: rgba(0,230,118,0.05);"' : '') + '>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || (idx + 1)) + '</td>' +
        '<td style="font-weight: ' + (p.isMe ? '700' : '600') + '; color: ' + (p.isMe ? 'var(--secondary)' : 'var(--text-heading)') + ';">' +
          p.nome + (p.isMe ? ' <span style="font-size: 11px; color: var(--secondary);">↩ Você</span>' : '') +
        '</td>' +
        '<td style="text-align: center; font-weight: 700; color: var(--primary);">' + p.gols + ' ⚽</td>' +
        '<td style="text-align: center; color: var(--text-caption); font-weight: 600;">' + p.jogos + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  // --- Melhor avaliados ---------------------------------------------------
  renderMelhoresAvaliados: async function(peladaId) {
    var tbody = document.getElementById('desempenho-rating-body');
    if (!tbody) return;

    var players = Api.getPlayers() || [];
    var rated = players
      .filter(function(p) {
        var rating = parseFloat(p.avaliacao_media) || parseInt(p.autoavaliacao) || 0;
        return rating > 0 && p.ativo !== false;
      })
      .sort(function(a, b) {
        var ra = parseFloat(a.avaliacao_media) || parseInt(a.autoavaliacao) || 0;
        var rb = parseFloat(b.avaliacao_media) || parseInt(b.autoavaliacao) || 0;
        return rb - ra;
      })
      .slice(0, 10);

    if (rated.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum dado de avaliação disponível.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    rated.forEach(function(p, idx) {
      var rating = parseFloat(p.avaliacao_media) || parseInt(p.autoavaliacao) || 0;
      var isMe = Auth.currentUser && String(p.id) === String(Auth.currentUser.id);
      var starsHTML = window.Utils ? window.Utils.starsHTML(Math.round(rating)) : '★';

      html += '<tr' + (isMe ? ' style="background: rgba(0,230,118,0.05);"' : '') + '>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || (idx + 1)) + '</td>' +
        '<td style="font-weight: 600;">' + (p.apelido || p.nome) + (isMe ? ' <span style="font-size: 11px; color: var(--secondary);">↩ Você</span>' : '') + '</td>' +
        '<td style="text-align: center; color: var(--warning); font-weight: 700;">' + starsHTML + ' ' + rating.toFixed(1) + '</td>' +
        '<td style="text-align: center; color: var(--text-caption); font-weight: 600;">' + (p.partidas || 0) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  // --- Goleiros -----------------------------------------------------------
  renderGoleiros: async function(peladaId) {
    var tbody = document.getElementById('desempenho-goleiros-body');
    if (!tbody) return;

    var players = Api.getPlayers() || [];
    var goalkeepers = players
      .filter(function(p) { return p.goleiro && p.ativo !== false; })
      .sort(function(a, b) { return (b.partidas || 0) - (a.partidas || 0); });

    if (goalkeepers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum goleiro cadastrado.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    goalkeepers.forEach(function(p, idx) {
      var isMe = Auth.currentUser && String(p.id) === String(Auth.currentUser.id);
      html += '<tr' + (isMe ? ' style="background: rgba(0,230,118,0.05);"' : '') + '>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || (idx + 1)) + '</td>' +
        '<td style="font-weight: 600;">' +
          (p.apelido || p.nome) + ' <span style="font-size: 11px; color: var(--accent); background: rgba(255,109,0,0.1); padding: 2px 6px; border-radius: 10px;">🧤</span>' +
          (isMe ? ' <span style="font-size: 11px; color: var(--secondary);">↩ Você</span>' : '') +
        '</td>' +
        '<td style="text-align: center; color: var(--text-caption); font-weight: 600;">' + (p.partidas || 0) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  // --- Stats pessoais do jogador logado -----------------------------------
  renderMyStats: function() {
    var user = Auth.currentUser;
    if (!user) return;

    var golsEl     = document.getElementById('my-stat-gols');
    var partidasEl = document.getElementById('my-stat-partidas');
    var ratingEl   = document.getElementById('my-stat-rating');
    var saldoEl    = document.getElementById('my-stat-saldo');

    if (golsEl)     golsEl.textContent     = user.gols || 0;
    if (partidasEl) partidasEl.textContent = user.partidas || 0;
    if (ratingEl) {
      var r = parseFloat(user.avaliacao_media) || parseInt(user.autoavaliacao) || 0;
      ratingEl.textContent = r > 0 ? (r.toFixed(1) + '★') : '—';
    }
    if (saldoEl) {
      var saldo = user.saldo || 0;
      saldoEl.textContent = window.Utils ? window.Utils.formatCurrency(saldo) : ('R$ ' + saldo);
      saldoEl.style.color = saldo < 0 ? 'var(--danger)' : 'var(--primary)';
    }
  },

  // --- Bind de eventos ---------------------------------------------------
  bindEvents: function() {
    var filterEl = document.getElementById('desempenho-pelada-filter');
    if (filterEl) {
      filterEl.addEventListener('change', function(e) {
        Desempenho.renderAll(e.target.value === 'all' ? null : e.target.value);
      });
    }
  }
};

// --- Ponto de entrada chamado pelo Router ---
window.App.initDesempenho = function() {
  Desempenho.init();
};
