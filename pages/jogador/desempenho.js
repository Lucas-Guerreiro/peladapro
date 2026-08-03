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
    await this.renderMelhoresAvaliados(id);
    await this.renderGoleiros(id);
  },

  // --- Melhor Jogador (Ranking por Pontuação Acumulada de Resultados) -----------
  renderMelhoresAvaliados: async function(peladaId) {
    var tbody = document.getElementById('desempenho-rating-body');
    if (!tbody) return;

    var players = Api.getPlayers() || [];
    var statsMap = {};

    players.forEach(function(p) {
      if (p.ativo !== false) {
        var nome = (p.apelido || p.nome || '').trim();
        statsMap[nome] = {
          id: p.id,
          nome: nome,
          gols: 0,
          pontos: 0,
          vitorias: 0,
          balizaZero: 0,
          empates: 0,
          derrotas: 0,
          jogos: 0,
          isMe: Auth.currentUser && (String(p.id) === String(Auth.currentUser.id) || (Auth.currentUser.nome && nome.toLowerCase() === Auth.currentUser.nome.toLowerCase()) || (Auth.currentUser.apelido && nome.toLowerCase() === Auth.currentUser.apelido.toLowerCase()))
        };
      }
    });

    try {
      var partidas = [];
      const escalacoesPorPelada = {};
      const token = localStorage.getItem('token');

      // Helper assíncrono para obter escalação real de uma pelada na nuvem
      const carregarEscalacao = async (pId) => {
        if (escalacoesPorPelada[pId]) return;
        try {
          const resTimes = await fetch(`/api/formacao/pelada/${pId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (resTimes.ok) {
            const times = await resTimes.json();
            escalacoesPorPelada[pId] = {};
            (times || []).forEach(t => {
              const tName = (t.nome || '').trim().toLowerCase();
              if (tName) {
                escalacoesPorPelada[pId][tName] = new Set();
                (t.jogadores || []).forEach(p => {
                  const pApelido = (p.apelido || '').trim().toLowerCase();
                  const pNome = (p.nome || '').trim().toLowerCase();
                  if (pApelido) {
                    escalacoesPorPelada[pId][tName].add(pApelido);
                    escalacoesPorPelada[pId][tName].add(pApelido.split(" ")[0]);
                  }
                  if (pNome) {
                    escalacoesPorPelada[pId][tName].add(pNome);
                    escalacoesPorPelada[pId][tName].add(pNome.split(" ")[0]);
                  }
                  escalacoesPorPelada[pId][tName].add(String(p.id));
                });
              }
            });
          }
        } catch (e) {
          console.warn(`[Desempenho] Erro ao carregar times da pelada ${pId}:`, e);
        }
      };

      if (peladaId) {
        partidas = await Api.listarPartidas(peladaId);
        await carregarEscalacao(peladaId);
      } else {
        var group = Auth.currentGroup;
        if (group && group.id) {
          var peladasGroup = await Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladasGroup)) {
            for (var i = 0; i < peladasGroup.length; i++) {
              var listP = await Api.listarPartidas(peladasGroup[i].id);
              if (Array.isArray(listP) && listP.length > 0) {
                partidas = partidas.concat(listP);
                await carregarEscalacao(peladasGroup[i].id);
              }
            }
          }
        }
      }

      if (Array.isArray(partidas) && partidas.length > 0) {
        partidas.forEach(function(m) {
          var tA = (m.time_a_nome || '').trim();
          var tB = (m.time_b_nome || '').trim();
          var gA = parseInt(m.gols_time_a) || 0;
          var gB = parseInt(m.gols_time_b) || 0;

          var ptsA = 0; var isWinA = false; var isCleanA = false;
          var ptsB = 0; var isWinB = false; var isCleanB = false;

          if (gA > gB) {
            isWinA = true;
            if (gB === 0) {
              ptsA = (gA >= 2) ? 3.0 : 2.5;
              isCleanA = true;
            } else {
              ptsA = 2.0;
            }
          } else if (gB > gA) {
            isWinB = true;
            if (gA === 0) {
              ptsB = (gB >= 2) ? 3.0 : 2.5;
              isCleanB = true;
            } else {
              ptsB = 2.0;
            }
          } else {
            if (gA === 0) {
              ptsA = 0.5; ptsB = 0.5;
            } else {
              ptsA = 1.0; ptsB = 1.0;
            }
          }

          var playersA = new Set();
          var playersB = new Set();

          const escalacaoPelada = escalacoesPorPelada[m.pelada_id] || {};

          if (tA && escalacaoPelada[tA.toLowerCase()]) {
            escalacaoPelada[tA.toLowerCase()].forEach(function(nome) { playersA.add(nome); });
          }
          if (tB && escalacaoPelada[tB.toLowerCase()]) {
            escalacaoPelada[tB.toLowerCase()].forEach(function(nome) { playersB.add(nome); });
          }

          let goalsList = [];
          if (m.autores_gols) {
            try { goalsList = typeof m.autores_gols === 'string' ? JSON.parse(m.autores_gols) : m.autores_gols; } catch(e) {}
          }
          (goalsList || []).forEach(function(g) {
            var playerTeam = g.teamName ? g.teamName.trim().toLowerCase() : (g.teamKey === 'a' ? tA.toLowerCase() : (g.teamKey === 'b' ? tB.toLowerCase() : ''));
            if (g.autorNome) {
              var aName = g.autorNome.trim().toLowerCase();
              if (playerTeam === tA.toLowerCase()) playersA.add(aName);
              else if (playerTeam === tB.toLowerCase()) playersB.add(aName);

              Object.keys(statsMap).forEach(function(nomeKey) {
                if (nomeKey.toLowerCase() === aName || (statsMap[nomeKey].id && String(statsMap[nomeKey].id) === String(g.autorId))) {
                  statsMap[nomeKey].gols += 1;
                }
              });
            }
            if (g.assistNome) {
              var assName = g.assistNome.trim().toLowerCase();
              if (playerTeam === tA.toLowerCase()) playersA.add(assName);
              else if (playerTeam === tB.toLowerCase()) playersB.add(assName);
            }
          });

          // Pontuação e contagem de jogos para o Time A
          playersA.forEach(function(lowerName) {
            Object.keys(statsMap).forEach(function(nomeKey) {
              if (nomeKey.toLowerCase() === lowerName || String(statsMap[nomeKey].id) === lowerName) {
                statsMap[nomeKey].pontos += ptsA;
                statsMap[nomeKey].jogos += 1;
                if (isWinA) statsMap[nomeKey].vitorias += 1;
                if (isCleanA) statsMap[nomeKey].balizaZero += 1;
                if (!isWinA && ptsA > 0) statsMap[nomeKey].empates += 1;
                if (ptsA === 0) statsMap[nomeKey].derrotas += 1;
              }
            });
          });

          // Pontuação e contagem de jogos para o Time B
          playersB.forEach(function(lowerName) {
            Object.keys(statsMap).forEach(function(nomeKey) {
              if (nomeKey.toLowerCase() === lowerName || String(statsMap[nomeKey].id) === lowerName) {
                statsMap[nomeKey].pontos += ptsB;
                statsMap[nomeKey].jogos += 1;
                if (isWinB) statsMap[nomeKey].vitorias += 1;
                if (isCleanB) statsMap[nomeKey].balizaZero += 1;
                if (!isWinB && ptsB > 0) statsMap[nomeKey].empates += 1;
                if (ptsB === 0) statsMap[nomeKey].derrotas += 1;
              }
            });
          });

        });
      }
    } catch (e) {
      console.warn('[Desempenho] Erro ao calcular Melhor Jogador:', e);
    }

    var ranked = Object.values(statsMap)
      .filter(function(p) { return p.jogos > 0 || p.pontos > 0; })
      .sort(function(a, b) {
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
        if (b.balizaZero !== a.balizaZero) return b.balizaZero - a.balizaZero;
        return a.derrotas - b.derrotas;
      });

    // Atualiza os widgets do card "Meu Desempenho Pessoal" do usuario logado
    if (Auth.currentUser) {
      var userKey = (Auth.currentUser.apelido || Auth.currentUser.nome || '').trim().toLowerCase();
      var myStats = ranked.find(function(r) { return r.isMe || r.nome.toLowerCase() === userKey; });
      if (myStats) {
        this.updateMyPersonalStats(myStats.gols, myStats.jogos, myStats.pontos);
      } else {
        this.updateMyPersonalStats(Auth.currentUser.gols || 0, Auth.currentUser.partidas || 0, 0);
      }
    }

    if (ranked.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum dado de partida disponível.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    var allPlayersList = Api.getPlayers() || [];
    try {
      var locP = JSON.parse(localStorage.getItem("players"));
      if (Array.isArray(locP) && locP.length > 0) allPlayersList = locP;
    } catch(e) {}

    ranked.slice(0, 10).forEach(function(p, idx) {
      var foundPlayer = allPlayersList.find(function(pl) {
        var pName = (pl.apelido || pl.nome || '').trim().toLowerCase();
        var fullN = (pl.nome || '').trim().toLowerCase();
        var targetN = (p.nome || '').trim().toLowerCase();
        return pName === targetN || fullN === targetN || String(pl.id) === String(p.id);
      });

      var fotoUrl = foundPlayer ? foundPlayer.foto : null;
      var initial = (p.nome || '?').charAt(0).toUpperCase();

      var avatarHTML = fotoUrl
        ? '<img src="' + fotoUrl + '" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2.5px solid #D97706; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" alt="' + p.nome + '">'
        : '<div style="width: 48px; height: 48px; border-radius: 50%; background: #D97706; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; border: 2.5px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">' + initial + '</div>';

      var ptsFmt = p.pontos.toFixed(1).replace('.', ',');
      html += '<tr' + (p.isMe ? ' style="background: rgba(0,230,118,0.05);"' : '') + '>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || (idx + 1)) + '</td>' +
        '<td style="font-weight: 700;">' +
          '<div style="display: flex; align-items: center; gap: 10px;">' +
            avatarHTML +
            '<span style="font-size: 14px; color: #0F172A;">' + p.nome + (p.isMe ? ' <span style="font-size: 11px; color: var(--secondary);">↩ Você</span>' : '') + '</span>' +
          '</div>' +
        '</td>' +
        '<td style="text-align: center; color: #D97706; font-weight: 800; font-size: 14px;">' + ptsFmt + ' 🎖️</td>' +
        '<td style="text-align: center; color: #64748B; font-weight: 600;">' + p.jogos + '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;
  },

  // --- Goleiros -----------------------------------------------------------
  renderGoleiros: async function(peladaId) {
    var tbody = document.getElementById('desempenho-goleiros-body');
    if (!tbody) return;

    var players = Api.getPlayers() || [];
    try {
      var locP = JSON.parse(localStorage.getItem("players"));
      if (Array.isArray(locP) && locP.length > 0) players = locP;
    } catch(e) {}

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
      var name = p.apelido || p.nome;
      var fotoUrl = p.foto;
      var initial = (name || '?').charAt(0).toUpperCase();

      var avatarHTML = fotoUrl
        ? '<img src="' + fotoUrl + '" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2.5px solid #0284C7; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" alt="' + name + '">'
        : '<div style="width: 48px; height: 48px; border-radius: 50%; background: #0284C7; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; border: 2.5px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">' + initial + '</div>';

      html += '<tr' + (isMe ? ' style="background: rgba(0,230,118,0.05);"' : '') + '>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || (idx + 1)) + '</td>' +
        '<td style="font-weight: 700;">' +
          '<div style="display: flex; align-items: center; gap: 10px;">' +
            avatarHTML +
            '<span style="font-size: 14px; color: #0F172A;">' + name + ' 🧤' + (isMe ? ' <span style="font-size: 11px; color: var(--secondary);">↩ Você</span>' : '') + '</span>' +
          '</div>' +
        '</td>' +
        '<td style="text-align: center; color: #0284C7; font-weight: 800; font-size: 14px;">' + (p.partidas || 0) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  // --- Stats pessoais do jogador logado -----------------------------------
  renderMyStats: function() {
    this.updateMyPersonalStats();
  },

  updateMyPersonalStats: function(myGoals, myGames, myPoints) {
    var user = Auth.currentUser;
    var golsEl     = document.getElementById('my-stat-gols');
    var partidasEl = document.getElementById('my-stat-partidas');
    var ratingEl   = document.getElementById('my-stat-rating');
    if (golsEl)     golsEl.textContent     = (myGoals !== undefined ? myGoals : (user ? (user.gols || 0) : 0));
    if (partidasEl) partidasEl.textContent = (myGames !== undefined ? myGames : (user ? (user.partidas || 0) : 0));
    if (ratingEl) {
      var pts = (myPoints !== undefined ? myPoints : 0);
      ratingEl.textContent = pts > 0 ? (pts.toFixed(1).replace('.', ',')) : '0,0';
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
