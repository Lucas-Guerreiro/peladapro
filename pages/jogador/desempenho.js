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
        console.warn('[Desempenho] Erro ao carregar grupos:', e);
      }
    }

    try {
      var peladas = groupId ? await Api.listarDatasDoGrupo(groupId) : [];
      selectEl.innerHTML = '<option value="all">📊 Geral (Todas as Peladas)</option>';

      if (Array.isArray(peladas) && peladas.length > 0) {
        peladas.forEach(function(p) {
          var opt = document.createElement('option');
          opt.value = p.id;
          var rawDate = p.data ? String(p.data).split('T')[0] : '';
          var dataFmt = window.Utils ? window.Utils.formatDate(rawDate || p.data) : (p.data || '');
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

  // --- Método Único Centralizado para Calcular Estatísticas de Desempenho -----------
  computeStatsMap: async function(peladaId) {
    if (window.App && window.App.computeStatsMap) {
      return await window.App.computeStatsMap(peladaId);
    }
    return {};
  },

  // --- Melhor Jogador (Ranking por Pontuação Acumulada de Resultados) -----------
  renderMelhoresAvaliados: async function(peladaId) {
    var tbody = document.getElementById('desempenho-rating-body');
    if (!tbody) return;

    var statsMap = await this.computeStatsMap(peladaId);

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
        ? '<img src="' + fotoUrl + '" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid #D97706; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" alt="' + p.nome + '">'
        : '<div style="width: 64px; height: 64px; border-radius: 50%; background: #D97706; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; border: 3px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">' + initial + '</div>';

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
        ? '<img src="' + fotoUrl + '" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid #0284C7; box-shadow: 0 2px 8px rgba(0,0,0,0.15);" alt="' + name + '">'
        : '<div style="width: 64px; height: 64px; border-radius: 50%; background: #0284C7; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; border: 3px solid #E2E8F0; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">' + initial + '</div>';

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
