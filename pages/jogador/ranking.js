// ==========================================================================
// pages/jogador/ranking.js — Classificação e Resultados
// ==========================================================================

var Ranking = {

  init: function() {
    this.populateFilter();
    this.renderAll();
    this.bindEvents();
  },

  populateFilter: function() {
    var selectEl = document.getElementById('ranking-pelada-filter');
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
      opt.textContent = '📅 ' + Utils.formatDate(p.data) + ' · ' + (p.horario || '') + ' — ' + (p.local || '');
      selectEl.appendChild(opt);
    });
  },

  renderAll: function(peladaId) {
    this.renderClassificacao(peladaId);
    this.renderResultados(peladaId);
    this.renderArtilharia(peladaId);
  },

  // --- Tabela de classificação dos times ----------------------------------
  renderClassificacao: function(peladaId) {
    var tbody = document.getElementById('ranking-teams-body');
    if (!tbody) return;

    var teams   = Api.getTeams();
    if (!teams || teams.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--text-caption);">Nenhum time sorteado ainda.</td></tr>';
      return;
    }

    // Ordena por vitórias, depois saldo de gols
    var sorted = teams.slice().sort(function(a, b) {
      var va = a.vitorias || 0; var vb = b.vitorias || 0;
      if (vb !== va) return vb - va;
      var sga = (a.gols_pro || 0) - (a.gols_contra || 0);
      var sgb = (b.gols_pro || 0) - (b.gols_contra || 0);
      return sgb - sga;
    });

    var badgeMap = ['🥇', '🥈', '🥉'];
    var classMap = ['ranking-gold', 'ranking-silver', 'ranking-bronze'];

    var html = '';
    sorted.forEach(function(team, idx) {
      var pts = (team.vitorias || 0) * 3 + (team.empates || 0);
      var sg  = (team.gols_pro || 0) - (team.gols_contra || 0);
      var sgStr = sg > 0 ? '+' + sg : String(sg);

      html += '<tr>' +
        '<td style="text-align: center;">' +
          (idx < 3 ? '<span class="ranking-badge-top ' + (classMap[idx] || '') + '">' + (badgeMap[idx] || (idx+1)) + '</span>' : (idx+1)) +
        '</td>' +
        '<td style="font-weight: 600;">' +
          '<span style="color: ' + (team.cor || '#666') + '; margin-right: 6px;">■</span>' + team.nome +
        '</td>' +
        '<td style="text-align: center; font-weight: 700;">' + pts + '</td>' +
        '<td style="text-align: center;">' + (team.jogos || 0) + '</td>' +
        '<td style="text-align: center;">' + (team.vitorias || 0) + '</td>' +
        '<td style="text-align: center; color: ' + (sg >= 0 ? 'var(--success)' : 'var(--danger)') + '; font-weight: 600;">' + sgStr + '</td>' +
      '</tr>';
    });

    tbody.innerHTML = html;
  },

  // --- Resultados das partidas --------------------------------------------
  renderResultados: function(peladaId) {
    var listEl  = document.getElementById('ranking-results-list');
    if (!listEl) return;

    // Busca histórico de partidas do localStorage (se existir)
    var historico = [];
    try { historico = JSON.parse(localStorage.getItem('match_history') || '[]'); } catch(e) {}

    if (historico.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding: 32px; background: var(--surface); border-radius: var(--radius-lg);"><span style="font-size: 32px;">🏟️</span><p class="text-inter" style="font-size: 14px;">Nenhum resultado registrado ainda.</p></div>';
      return;
    }

    var html = '';
    historico.slice(0, 10).forEach(function(m) {
      var corBorda = m.gols_a > m.gols_b ? '#4CAF50' : (m.gols_a < m.gols_b ? 'var(--danger)' : 'var(--warning)');
      html += '<div class="card" style="padding: 15px; border-left: 4px solid ' + corBorda + '; margin-bottom: 0;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">' +
          '<span class="text-inter" style="font-weight: 700;">' + m.team_a + ' ' + m.gols_a + ' × ' + m.gols_b + ' ' + m.team_b + '</span>' +
          '<span class="text-inter" style="font-size: 12px; color: var(--text-caption);">' + (m.horario || '') + '</span>' +
        '</div>' +
        (m.artilheiros ? '<p class="text-inter" style="font-size: 12px; color: var(--text-caption);">⚽ ' + m.artilheiros + '</p>' : '') +
      '</div>';
    });
    listEl.innerHTML = html;
  },

  // --- Artilharia ---------------------------------------------------------
  renderArtilharia: function(peladaId) {
    var tbody = document.getElementById('ranking-scorers-body');
    if (!tbody) return;

    var players = Api.getPlayers();
    var scorers = players
      .filter(function(p) { return (p.gols || 0) > 0; })
      .sort(function(a, b) { return (b.gols || 0) - (a.gols || 0); })
      .slice(0, 10);

    if (scorers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-caption);">Sem artilheiros registrados.</td></tr>';
      return;
    }

    var badgeMap = ['🥇', '🥈', '🥉'];
    var html = '';
    scorers.forEach(function(p, idx) {
      html += '<tr>' +
        '<td style="text-align: center;">' + (badgeMap[idx] || (idx + 1)) + '</td>' +
        '<td style="font-weight: 600;">' + p.nome + (p.goleiro ? ' 🧤' : '') + '</td>' +
        '<td style="text-align: center; font-weight: 700; color: var(--secondary);">' + (p.gols || 0) + ' ⚽</td>' +
        '<td style="text-align: center; color: var(--text-caption);">' + (p.partidas || 0) + '</td>' +
      '</tr>';
    });
    tbody.innerHTML = html;
  },

  // --- Bind de eventos ---------------------------------------------------
  bindEvents: function() {
    var filterEl = document.getElementById('ranking-pelada-filter');
    if (filterEl) {
      filterEl.addEventListener('change', function(e) {
        Ranking.renderAll(e.target.value === 'all' ? null : e.target.value);
      });
    }
  }
};

// --- Ponto de entrada chamado pelo Router ----------------------------------
window.App.initRanking = function() {
  Ranking.init();
};
