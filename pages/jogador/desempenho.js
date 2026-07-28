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

  renderAll: function(peladaId) {
    this.renderArtilharia(peladaId);
    this.renderMelhoresAvaliados(peladaId);
    this.renderGoleiros(peladaId);
  },

  // --- Artilharia ---------------------------------------------------------
  renderArtilharia: function(peladaId) {
    var tbody = document.getElementById('desempenho-artilharia-body');
    if (!tbody) return;

    var players = Api.getPlayers() || [];
    var scorers = players
      .filter(function(p) { return (p.gols || 0) > 0 && !p.goleiro && p.ativo !== false; })
      .sort(function(a, b) { return (b.gols || 0) - (a.gols || 0); })
      .slice(0, 10);

    if (scorers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum gol registrado.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    scorers.forEach(function(p, idx) {
      var isMe = Auth.currentUser && String(p.id) === String(Auth.currentUser.id);
      html += '<tr' + (isMe ? ' style="background: rgba(0,230,118,0.05);"' : '') + '>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || (idx + 1)) + '</td>' +
        '<td style="font-weight: ' + (isMe ? '700' : '600') + '; color: ' + (isMe ? 'var(--secondary)' : 'var(--text-heading)') + ';">' +
          (p.apelido || p.nome) + (isMe ? ' <span style="font-size: 11px; color: var(--secondary);">↩ Você</span>' : '') +
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
        '<td style="text-align: center; color: var(--text-caption);">' + (p.partidas || 0) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  // --- Goleiros -----------------------------------------------------------
  renderGoleiros: function(peladaId) {
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
        '<td style="text-align: center; color: var(--text-caption);">' + (p.partidas || 0) + '</td>' +
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

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initDesempenho = function() {
  Desempenho.init();
};
