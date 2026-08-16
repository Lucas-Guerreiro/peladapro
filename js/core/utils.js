// Interceptador para redirecionar chamadas de API locais em produção
(function () {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('http://localhost:3000/api')) {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocal) {
        input = input.replace('/api', '/api');
      }
    }
    return originalFetch(input, init);
  };
})();

const Utils = {

  // --- Máscaras -----------------------------------------------------------
  maskCPF(v) {
    v = v.replace(/\D/g, '').slice(0, 11);
    return v
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  },

  maskPhone(v) {
    v = v.replace(/\D/g, '').slice(0, 11);
    return v.length <= 10
      ? v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
      : v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  },

  // --- Formatação ---------------------------------------------------------
  formatCurrency(v) {
    const num = parseFloat(v);
    const safeNum = isNaN(num) ? 0 : num;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(safeNum);
  },

  getLocalTodayISO() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  formatDate(isoDate) {
    if (!isoDate) return '—';
    try {
      const dateStr = typeof isoDate === 'string' ? (isoDate.includes('T') ? isoDate.split('T')[0] : isoDate) : new Date(isoDate).toISOString().split('T')[0];
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return '—';
    }
  },

  formatDatetime(isoDatetime) {
    if (!isoDatetime) return '—';
    try {
      if (typeof isoDatetime === 'string') {
        const clean = isoDatetime.replace(' ', 'T');
        return new Date(clean).toLocaleString('pt-BR');
      }
      return new Date(isoDatetime).toLocaleString('pt-BR');
    } catch (e) {
      return String(isoDatetime);
    }
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  // --- Debounce -----------------------------------------------------------
  debounce(func, wait = 300) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  // --- Toast visual -------------------------------------------------------
  _toastContainer: null,

  _getContainer() {
    if (!this._toastContainer) {
      this._toastContainer = document.querySelector('.toast-container');
      if (!this._toastContainer) {
        this._toastContainer = document.createElement('div');
        this._toastContainer.className = 'toast-container';
        document.body.appendChild(this._toastContainer);
      }
    }
    return this._toastContainer;
  },

  /**
   * Exibe uma notificação toast.
   * @param {string} msg   Mensagem a exibir
   * @param {'success'|'warning'|'error'|'info'} type
   * @param {number} duration Milissegundos (padrão 3500)
   */
  toast(msg, type = 'success', duration = 3500) {
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };
    const container = this._getContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type] || '🔔'}</span><span>${msg}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.style.animation = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translateX(120%)';
      el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      setTimeout(() => el.remove(), 380);
    }, duration);
  },

  // --- Stars render -------------------------------------------------------
  starsHTML(count, max = 5) {
    let html = '';
    for (let i = 1; i <= max; i++) {
      html += i <= count ? '⭐' : '☆';
    }
    return html;
  },

  // --- Calcular idade -----------------------------------------------------
  calcAge(dob) {
    if (!dob) return null;
    try {
      var dateStr;
      if (dob instanceof Date) {
        dateStr = dob.getFullYear() + '-' + String(dob.getMonth() + 1).padStart(2, '0') + '-' + String(dob.getDate()).padStart(2, '0');
      } else {
        dateStr = String(dob).substring(0, 10);
      }
      var parts = dateStr.split('-');
      if (parts.length < 3) return null;
      var y = parseInt(parts[0], 10);
      var mo = parseInt(parts[1], 10) - 1;
      var d = parseInt(parts[2], 10);
      if (isNaN(y) || isNaN(mo) || isNaN(d)) return null;
      var birth = new Date(y, mo, d);
      var today = new Date();
      var age = today.getFullYear() - birth.getFullYear();
      var m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return (age >= 0 && age < 150) ? age : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Baixa a imagem (Base64 ou URL remota) diretamente para o dispositivo do usuário.
   */
  async downloadImage(imageUrl, athleteName = 'Atleta') {
    if (!imageUrl) {
      if (window.App && window.App.showToast) window.App.showToast("Nenhuma foto disponível para download.", "warning");
      return;
    }

    try {
      if (window.App && window.App.showToast) window.App.showToast(`Iniciando download da foto de ${athleteName}...`, "info");
      const cleanName = (athleteName || "Atleta").replace(/[^a-zA-Z0-9_]/g, "_");

      if (imageUrl.startsWith("data:")) {
        const mime = imageUrl.split(";")[0].split(":")[1] || "image/png";
        const ext = mime.split("/")[1] || "png";
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `Foto_${cleanName}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (window.App && window.App.showToast) window.App.showToast(`Foto de ${athleteName} baixada com sucesso! 📥`, "success");
        return;
      }

      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const ext = (blob.type && blob.type.includes("/")) ? blob.type.split("/")[1] : "jpg";

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Foto_${cleanName}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

      if (window.App && window.App.showToast) window.App.showToast(`Foto de ${athleteName} baixada com sucesso! 📥`, "success");
    } catch (err) {
      console.error("[downloadImage]", err);
      window.open(imageUrl, "_blank");
      if (window.App && window.App.showToast) window.App.showToast("Foto aberta em nova aba para salvar.", "info");
    }
  }
};

window.Utils = Utils;

window.App = window.App || {};

window.App.isAthleteCardDisabled = function (athleteId) {
  if (!athleteId) return false;
  try {
    const disabledList = JSON.parse(localStorage.getItem('peladapro_disabled_premium_athletes') || '[]');
    return disabledList.map(String).includes(String(athleteId));
  } catch (e) {
    return false;
  }
};

window.App.isVipPlan = function () {
  try {
    const user = (window.Auth && window.Auth.currentUser) || (window.App && window.App.currentUser) || JSON.parse(localStorage.getItem('usuario') || localStorage.getItem('currentUser') || '{}');
    if (user && user.id && window.App.isAthleteCardDisabled(user.id)) {
      return false;
    }
    if (user && (user.vip === true || user.premium === true || user.is_vip === true || user.plano === 'vip' || user.plano === 'premium')) {
      return true;
    }
  } catch (e) { }
  return false;
};

window.App.getTeamThemeGlobal = function (teamName) {
  if (window.Dashboard && window.Dashboard.getTeamTheme) {
    return window.Dashboard.getTeamTheme(teamName);
  }
  if (!teamName) return null;
  var name = teamName.toLowerCase().trim();
  if (name.includes('flamengo')) return { gradient: 'linear-gradient(135deg, #8B1A1A 0%, #3A050A 50%, #C8102E 100%)', border: '#8B1A1A', badgeBg: '#8B1A1A', accent: '#FFD700' };
  if (name.includes('vasco') || name.includes('botafogo') || name.includes('corinthians')) return { gradient: 'linear-gradient(135deg, #222222 0%, #0D0D0D 50%, #1A1A1A 100%)', border: '#FFFFFF', badgeBg: '#111111', accent: '#F5D270' };
  if (name.includes('palmeiras') || name.includes('guarani')) return { gradient: 'linear-gradient(135deg, #006437 0%, #04391F 50%, #011E10 100%)', border: '#86EFAC', badgeBg: '#006437', accent: '#F5D270' };
  if (name.includes('cruzeiro')) return { gradient: 'linear-gradient(135deg, #003399 0%, #001F66 50%, #050E2E 100%)', border: '#93C5FD', badgeBg: '#003399', accent: '#FFFFFF' };
  if (name.includes('fluminense')) return { gradient: 'linear-gradient(135deg, #831D1C 0%, #4A0E0E 40%, #006633 100%)', border: '#D4AF37', badgeBg: '#831D1C', accent: '#F5D270' };
  if (name.includes('são paulo') || name.includes('sao paulo')) return { gradient: 'linear-gradient(135deg, #C8102E 0%, #2B0007 45%, #0A0A0A 100%)', border: '#FFFFFF', badgeBg: '#C8102E', accent: '#F5D270' };
  return null;
};

window.App.toggleModoNoturnoGlobal = function () {
  if (window.App.isVipPlan && !window.App.isVipPlan()) {
    if (window.App && window.App.showToast) {
      window.App.showToast('⭐ O Modo Noturno no estilo do seu time é exclusivo para membros VIP ou Premium!', 'warning');
    }
    if (window.Dashboard && window.Dashboard.openModalPremium) {
      window.Dashboard.openModalPremium();
    }
    window.App.applyModoNoturnoGlobal(false);
    return;
  }
  const isCurrentlyNight = localStorage.getItem('peladapro_modo_noturno') === 'true';
  const nextNight = !isCurrentlyNight;
  localStorage.setItem('peladapro_modo_noturno', nextNight ? 'true' : 'false');
  window.App.applyModoNoturnoGlobal(nextNight);

  if (window.App && window.App.showToast) {
    window.App.showToast(nextNight ? '🌙 Modo Noturno no Tema do Time ativado!' : '☀️ Modo Claro ativado!', 'info');
  } else if (window.Utils && window.Utils.toast) {
    window.Utils.toast(nextNight ? '🌙 Modo Noturno no Tema do Time ativado!' : '☀️ Modo Claro ativado!', 'info');
  }
};

window.App.applyModoNoturnoGlobal = function (isNight) {
  if (window.App._isApplyingModoNoturno) return;
  window.App._isApplyingModoNoturno = true;

  try {
    if (window.App.isVipPlan && !window.App.isVipPlan()) {
      isNight = false;
    } else if (isNight === undefined) {
      isNight = localStorage.getItem('peladapro_modo_noturno') === 'true';
    }

  const user = window.Auth ? window.Auth.currentUser : null;
  let teamName = user ? user.time_coracao : null;
  if (!teamName) {
    try {
      const stored = JSON.parse(localStorage.getItem('currentUser'));
      if (stored && stored.time_coracao) teamName = stored.time_coracao;
    } catch (e) { }
  }
  const teamTheme = window.App.getTeamThemeGlobal(teamName);

  const buttons = document.querySelectorAll('.btn-global-modo-noturno, .btn-global-modo-noturno-icon');
  const labels = document.querySelectorAll('.lbl-modo-noturno-txt');

  if (isNight) {
    document.body.classList.add('modo-noturno-ativo');
    labels.forEach(lbl => lbl.textContent = 'Modo Noturno (Ativo)');
    buttons.forEach(btn => {
      btn.style.setProperty('background', teamTheme ? (teamTheme.badgeBg || '#0F172A') : '#0F172A', 'important');
      btn.style.setProperty('border-color', teamTheme ? (teamTheme.border || '#1D9E75') : '#1D9E75', 'important');
      btn.style.setProperty('color', '#FFFFFF', 'important');
      btn.style.setProperty('box-shadow', '0 4px 12px rgba(0,0,0,0.3)', 'important');
    });

    if (teamTheme) {
      document.documentElement.style.setProperty('--bg-modo-noturno', teamTheme.gradient);
      document.documentElement.style.setProperty('--border-modo-noturno', teamTheme.border);
      document.documentElement.style.setProperty('--accent-modo-noturno', teamTheme.accent || '#F5D270');
      document.documentElement.style.setProperty('--badge-modo-noturno', teamTheme.badgeBg || '#111111');
    } else {
      document.documentElement.style.setProperty('--bg-modo-noturno', 'linear-gradient(135deg, #0F172A 0%, #020617 100%)');
      document.documentElement.style.setProperty('--border-modo-noturno', '#1D9E75');
      document.documentElement.style.setProperty('--accent-modo-noturno', '#1D9E75');
      document.documentElement.style.setProperty('--badge-modo-noturno', '#0F172A');
    }

    const roleToggles = document.querySelectorAll('.role-toggle-switch');
    const roleSliders = document.querySelectorAll('.role-toggle-slider');

    roleToggles.forEach(toggle => {
      toggle.style.setProperty('background', 'linear-gradient(135deg, #C8102E 0%, #8B1A1A 100%)', 'important');
      toggle.style.setProperty('border-color', teamTheme ? (teamTheme.border || '#FFFFFF') : 'rgba(255,255,255,0.3)', 'important');
    });

    roleSliders.forEach(slider => {
      slider.style.setProperty('background', teamTheme ? (teamTheme.badgeBg || teamTheme.border || '#1D9E75') : '#1D9E75', 'important');
      slider.style.setProperty('box-shadow', '0 2px 8px rgba(0,0,0,0.6)', 'important');
    });
  } else {
    document.body.classList.remove('modo-noturno-ativo');
    document.documentElement.style.removeProperty('--bg-modo-noturno');
    document.documentElement.style.removeProperty('--border-modo-noturno');
    document.documentElement.style.removeProperty('--accent-modo-noturno');
    document.documentElement.style.removeProperty('--badge-modo-noturno');

    labels.forEach(lbl => lbl.textContent = 'Modo Noturno');
    buttons.forEach(btn => {
      btn.style.removeProperty('background');
      btn.style.removeProperty('border-color');
      btn.style.removeProperty('color');
      btn.style.removeProperty('box-shadow');
    });

    const roleToggles = document.querySelectorAll('.role-toggle-switch');
    const roleSliders = document.querySelectorAll('.role-toggle-slider');

    roleToggles.forEach(toggle => {
      toggle.style.setProperty('background', 'linear-gradient(135deg, #C8102E 0%, #8B1A1A 100%)', 'important');
      toggle.style.removeProperty('border-color');
    });

    roleSliders.forEach(slider => {
      slider.style.removeProperty('background');
      slider.style.removeProperty('box-shadow');
    });
  }

  if (window.Dashboard && window.Dashboard.applyModoNoturno) {
    window.Dashboard.applyModoNoturno(isNight);
  }
  } finally {
    window.App._isApplyingModoNoturno = false;
  }
};

window.App.computeStatsMap = async function(peladaId) {
  var players = (window.Api && window.Api.getPlayers) ? window.Api.getPlayers() : [];
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
        isMe: window.Auth && window.Auth.currentUser && (String(p.id) === String(window.Auth.currentUser.id) || (window.Auth.currentUser.nome && nome.toLowerCase() === window.Auth.currentUser.nome.toLowerCase()) || (window.Auth.currentUser.apelido && nome.toLowerCase() === window.Auth.currentUser.apelido.toLowerCase()))
      };
    }
  });

  try {
    var partidas = [];
    const escalacoesPorPelada = {};
    const token = localStorage.getItem('token') || localStorage.getItem('pelada_token');

    const carregarEscalacao = async (pId) => {
      if (escalacoesPorPelada[pId]) return;
      try {
        let teams = [];
        const rawTeams = localStorage.getItem(`teams_${pId}`);
        if (rawTeams) teams = JSON.parse(rawTeams);
        if (!teams || teams.length === 0) teams = (window.Api && window.Api.getTeams) ? window.Api.getTeams() : [];
        if (Array.isArray(teams) && teams.length > 0) {
          escalacoesPorPelada[pId] = {};
          teams.forEach(t => {
            const tName = (t.nome || t.name || '').trim().toLowerCase();
            if (tName) {
              escalacoesPorPelada[pId][tName] = new Set();
              const pList = t.jogadores || t.players || [];
              (pList || []).forEach(p => {
                const pApelido = (p.apelido || '').trim().toLowerCase();
                const pNome = (p.nome || '').trim().toLowerCase();
                if (pApelido) escalacoesPorPelada[pId][tName].add(pApelido);
                if (pNome) escalacoesPorPelada[pId][tName].add(pNome);
                if (p.id) escalacoesPorPelada[pId][tName].add(String(p.id));
              });
            }
          });
        }

        const resLive = await fetch(`/api/peladas/${pId}/live`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (resLive.ok) {
          const data = await resLive.json();
          const liveState = data.state || data || {};
          const times = liveState.teams || [];
          if (!escalacoesPorPelada[pId]) escalacoesPorPelada[pId] = {};
          (times || []).forEach(t => {
            const tName = (t.nome || t.name || '').trim().toLowerCase();
            if (tName) {
              if (!escalacoesPorPelada[pId][tName]) escalacoesPorPelada[pId][tName] = new Set();
              const pList = t.jogadores || t.players || [];
              (pList || []).forEach(p => {
                const pApelido = (p.apelido || '').trim().toLowerCase();
                const pNome = (p.nome || '').trim().toLowerCase();
                if (pApelido) escalacoesPorPelada[pId][tName].add(pApelido);
                if (pNome) escalacoesPorPelada[pId][tName].add(pNome);
                if (p.id) escalacoesPorPelada[pId][tName].add(String(p.id));
              });
            }
          });
        }
      } catch (e) {
        console.warn(`[computeStatsMap] Erro ao carregar times da pelada ${pId}:`, e);
      }
    };

    if (peladaId) {
      partidas = (window.Api && window.Api.listarPartidas) ? await window.Api.listarPartidas(peladaId) : [];
      await carregarEscalacao(peladaId);
    } else {
      var group = (window.Auth && window.Auth.currentGroup) || (window.App && window.App.currentGroup) || JSON.parse(localStorage.getItem('currentGroup') || 'null');
      if (!group || !group.id) {
        try {
          var grupos = window.Api && window.Api.listarGrupos ? await window.Api.listarGrupos() : (window.Api && window.Api.getGruposDoGestor ? await window.Api.getGruposDoGestor() : []);
          if (Array.isArray(grupos) && grupos.length > 0) group = grupos[0];
        } catch(e) {}
      }
      if (group && group.id && window.Api && window.Api.listarDatasDoGrupo) {
        var peladasGroup = await window.Api.listarDatasDoGrupo(group.id);
        if (Array.isArray(peladasGroup)) {
          for (var i = 0; i < peladasGroup.length; i++) {
            var listP = window.Api.listarPartidas ? await window.Api.listarPartidas(peladasGroup[i].id) : [];
            if (Array.isArray(listP) && listP.length > 0) {
              partidas = partidas.concat(listP);
              await carregarEscalacao(peladasGroup[i].id);
            }
          }
        }
      }
    }

    if (Array.isArray(partidas) && partidas.length > 0) {
      const teamMatchesByPelada = {};
      const playerTeamFromEvents = {};

      partidas.forEach(function(m) {
        const pId = m.pelada_id;
        if (!teamMatchesByPelada[pId]) teamMatchesByPelada[pId] = {};

        var tA = (m.time_a_nome || '').trim();
        var tB = (m.time_b_nome || '').trim();
        var gA = parseInt(m.gols_time_a) || 0;
        var gB = parseInt(m.gols_time_b) || 0;

        if (tA) teamMatchesByPelada[pId][tA.toLowerCase()] = (teamMatchesByPelada[pId][tA.toLowerCase()] || 0) + 1;
        if (tB) teamMatchesByPelada[pId][tB.toLowerCase()] = (teamMatchesByPelada[pId][tB.toLowerCase()] || 0) + 1;

        var ptsA = 0; var isWinA = false; var isCleanA = false;
        var ptsB = 0; var isWinB = false; var isCleanB = false;

        if (gA > gB) {
          isWinA = true;
          if (gB === 0) { ptsA = (gA >= 2) ? 3.0 : 2.5; isCleanA = true; }
          else { ptsA = 2.0; }
        } else if (gB > gA) {
          isWinB = true;
          if (gA === 0) { ptsB = (gB >= 2) ? 3.0 : 2.5; isCleanB = true; }
          else { ptsB = 2.0; }
        } else {
          if (gA === 0) { ptsA = 0.5; ptsB = 0.5; }
          else { ptsA = 1.0; ptsB = 1.0; }
        }

        var playersA = new Set();
        var playersB = new Set();
        const escalacaoPelada = escalacoesPorPelada[pId] || {};

        let goalsList = [];
        if (m.autores_gols) {
          try { goalsList = typeof m.autores_gols === 'string' ? JSON.parse(m.autores_gols) : m.autores_gols; } catch(e) {}
        }
        (goalsList || []).forEach(function(g) {
          var playerTeam = g.teamName ? g.teamName.trim().toLowerCase() : (g.teamKey === 'a' ? tA.toLowerCase() : (g.teamKey === 'b' ? tB.toLowerCase() : ''));
          if (g.autorId) playerTeamFromEvents[`${g.autorId}_${pId}`] = playerTeam;

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
          if (g.assistId) playerTeamFromEvents[`${g.assistId}_${pId}`] = playerTeam;
          if (g.assistNome) {
            var assName = g.assistNome.trim().toLowerCase();
            if (playerTeam === tA.toLowerCase()) playersA.add(assName);
            else if (playerTeam === tB.toLowerCase()) playersB.add(assName);
          }
        });

        Object.keys(statsMap).forEach(function(nomeKey) {
          const playerObj = statsMap[nomeKey];
          const pIdStr = String(playerObj.id);
          const pNome = playerObj.nome.toLowerCase();
          
          let jogouNoTime = null;
          if (tA && escalacaoPelada[tA.toLowerCase()]) {
            const setA = escalacaoPelada[tA.toLowerCase()];
            if (setA.has(pIdStr) || setA.has(pNome)) jogouNoTime = 'a';
          }
          if (!jogouNoTime && tB && escalacaoPelada[tB.toLowerCase()]) {
            const setB = escalacaoPelada[tB.toLowerCase()];
            if (setB.has(pIdStr) || setB.has(pNome)) jogouNoTime = 'b';
          }

          let estaEscaladoNestaPelada = false;
          Object.values(escalacaoPelada).forEach(set => {
            if (set.has(pIdStr) || set.has(pNome)) estaEscaladoNestaPelada = true;
          });

          if (!jogouNoTime && !estaEscaladoNestaPelada) {
            if (playersA.has(pNome) || playersA.has(pIdStr)) jogouNoTime = 'a';
            else if (playersB.has(pNome) || playersB.has(pIdStr)) jogouNoTime = 'b';
          }

          if (jogouNoTime === 'a') {
            playerObj.pontos += ptsA;
            if (isWinA) playerObj.vitorias += 1;
            if (isCleanA) playerObj.balizaZero += 1;
            if (!isWinA && ptsA > 0) playerObj.empates += 1;
            if (ptsA === 0) playerObj.derrotas += 1;
          } else if (jogouNoTime === 'b') {
            playerObj.pontos += ptsB;
            if (isWinB) playerObj.vitorias += 1;
            if (isCleanB) playerObj.balizaZero += 1;
            if (!isWinB && ptsB > 0) playerObj.empates += 1;
            if (ptsB === 0) playerObj.derrotas += 1;
          }
        });
      });

      Object.keys(statsMap).forEach(function(nomeKey) {
        const playerObj = statsMap[nomeKey];
        const pIdStr = String(playerObj.id);
        const pNome = playerObj.nome.toLowerCase();
        let totalJogosAtleta = 0;

        Object.keys(teamMatchesByPelada).forEach(function(pId) {
          const peladaTeams = teamMatchesByPelada[pId] || {};
          const escalacao = escalacoesPorPelada[pId] || {};
          let teamName = null;

          Object.keys(escalacao).forEach(function(tName) {
            const set = escalacao[tName];
            if (set.has(pIdStr) || set.has(pNome)) teamName = tName;
          });

          if (!teamName) {
            const teamFromGoal = playerTeamFromEvents[`${pIdStr}_${pId}`];
            if (teamFromGoal) teamName = teamFromGoal;
          }

          if (teamName && peladaTeams[teamName]) {
            totalJogosAtleta += peladaTeams[teamName];
          }
        });

        if (totalJogosAtleta > 0) playerObj.jogos = totalJogosAtleta;
      });
    }
  } catch(e) {
    console.warn('[computeStatsMap] Erro ao calcular estatisticas:', e);
  }

  return statsMap;
};

window.App.calcPlayerDesempenho = async function(usuarioId, usuarioNome) {
  try {
    const statsMap = await window.App.computeStatsMap(null);
    const uIdStr = String(usuarioId || '');
    const uNomeLower = (usuarioNome || '').trim().toLowerCase();

    const found = Object.values(statsMap).find(p => String(p.id) === uIdStr || (p.nome && p.nome.toLowerCase() === uNomeLower));
    if (found) {
      return { pontos: found.pontos, jogos: found.jogos, gols: found.gols };
    }
  } catch(e) {
    console.warn('[calcPlayerDesempenho] Erro ao calcular desempenho:', e);
  }
  return { pontos: 0, jogos: 0, gols: 0 };
};
