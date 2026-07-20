// ==========================================================================
// pages/jogador/desempenho.js — Estatísticas de Desempenho
// ==========================================================================

var Desempenho = {

  init: function() {
    this.populateFilter();
    this.renderAll();
    this.renderMyStats();
    this.bindEvents();
  },

  populateFilter: function() {
    var selectEl = document.getElementById('desempenho-pelada-filter');
    if (!selectEl) return;

    var peladas = Api.getPeladas();
    var group   = Auth.currentGroup;
    var groupId = group ? group.id : null;

    var filtered = peladas.filter(function(p) {
      return !groupId || p.grupo_id === groupId;
    });

    selectEl.innerHTML = '<option value="all">📊 Geral (Todas as Peladas)</option>';
    filtered.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = '📅 ' + Utils.formatDate(p.data) + ' · ' + (p.horario || '');
      selectEl.appendChild(opt);
    });
  },

  renderAll: function(peladaId) {
    this.renderArtilharia(peladaId);
    this.renderMelhoresAvaliados(peladaId);
    this.renderGoleiros(peladaId);
  },

  // --- Artilharia ---------------------------------------------------------
  renderArtilharia: function(peladaId) {
    var tbody = document.getElementById('desempenho-artilharia-body');
    if (!tbody) return;

    var players = Api.getPlayers();
    var scorers = players
      .filter(function(p) { return (p.gols || 0) > 0 && !p.goleiro; })
      .sort(function(a, b) { return (b.gols || 0) - (a.gols || 0); })
      .slice(0, 8);

    if (scorers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum gol registrado.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    scorers.forEach(function(p, idx) {
      var isMe = Auth.currentUser && p.id === Auth.currentUser.id;
      html += '<tr' + (isMe ? ' style="background: rgba(0,230,118,0.05);"' : '') + '>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || idx + 1) + '</td>' +
        '<td style="font-weight: ' + (isMe ? '700' : '600') + '; color: ' + (isMe ? 'var(--secondary)' : 'var(--text-heading)') + ';">' +
          p.nome + (isMe ? ' <span style="font-size: 11px; color: var(--secondary);">↩ Você</span>' : '') +
        '</td>' +
        '<td style="text-align: center; font-weight: 700; color: var(--primary);">' + (p.gols || 0) + ' ⚽</td>' +
        '<td style="text-align: center; color: var(--text-caption);">' + (p.partidas || 0) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  // --- Melhor avaliados ---------------------------------------------------
  renderMelhoresAvaliados: function(peladaId) {
    var tbody = document.getElementById('desempenho-rating-body');
    if (!tbody) return;

    var players = Api.getPlayers();
    var rated = players
      .filter(function(p) { return (p.avaliacao_media || p.autoavaliacao || 0) > 0 && (p.partidas || 0) > 0; })
      .sort(function(a, b) {
        var ra = a.avaliacao_media || a.autoavaliacao || 0;
        var rb = b.avaliacao_media || b.autoavaliacao || 0;
        return rb - ra;
      })
      .slice(0, 8);

    if (rated.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum dado de avaliação disponível.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    rated.forEach(function(p, idx) {
      var rating = p.avaliacao_media || p.autoavaliacao || 0;
      var isMe = Auth.currentUser && p.id === Auth.currentUser.id;
      html += '<tr' + (isMe ? ' style="background: rgba(0,230,118,0.05);"' : '') + '>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || idx + 1) + '</td>' +
        '<td style="font-weight: 600;">' + p.nome + (isMe ? ' <span style="font-size: 11px; color: var(--secondary);">↩ Você</span>' : '') + '</td>' +
        '<td style="text-align: center; color: var(--warning); font-weight: 700;">' + Utils.starsHTML(Math.round(rating)) + ' ' + rating.toFixed(1) + '</td>' +
        '<td style="text-align: center; color: var(--text-caption);">' + (p.partidas || 0) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  // --- Goleiros -----------------------------------------------------------
  renderGoleiros: function(peladaId) {
    var tbody = document.getElementById('desempenho-goleiros-body');
    if (!tbody) return;

    var players = Api.getPlayers();
    var goalkeepers = players
      .filter(function(p) { return p.goleiro && p.ativo; })
      .sort(function(a, b) { return (b.partidas || 0) - (a.partidas || 0) });

    if (goalkeepers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum goleiro cadastrado.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    goalkeepers.forEach(function(p, idx) {
      var isMe = Auth.currentUser && p.id === Auth.currentUser.id;
      html += '<tr' + (isMe ? ' style="background: rgba(0,230,118,0.05);"' : '') + '>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || idx + 1) + '</td>' +
        '<td style="font-weight: 600;">' +
          p.nome + ' <span style="font-size: 11px; color: var(--accent); background: rgba(255,109,0,0.1); padding: 2px 6px; border-radius: 10px;">🧤</span>' +
          (isMe ? ' <span style="font-size: 11px; color: var(--secondary);">↩ Você</span>' : '') +
        '</td>' +
        '<td style="text-align: center; color: var(--text-caption);">' + (p.partidas || 0) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  // --- Stats pessoais do jogador logado -----------------------------------
  renderMyStats: function() {
    var user = Auth.currentUser;
    if (!user) return;

    var golsEl    = document.getElementById('my-stat-gols');
    var partidasEl = document.getElementById('my-stat-partidas');
    var ratingEl  = document.getElementById('my-stat-rating');
    var saldoEl   = document.getElementById('my-stat-saldo');

    if (golsEl)    golsEl.textContent   = user.gols || 0;
    if (partidasEl) partidasEl.textContent = user.partidas || 0;
    if (ratingEl) {
      var r = user.avaliacao_media || user.autoavaliacao || 0;
      ratingEl.textContent = r.toFixed(1) + '★';
    }
    if (saldoEl) {
      var saldo = user.saldo || 0;
      saldoEl.textContent = Utils.formatCurrency(saldo);
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

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initDesempenho = function() {
  Desempenho.init();
};
