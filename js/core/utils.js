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
      el.style.transform = 'translateY(-20px)';
      el.style.transition = 'opacity 0.3s, transform 0.3s';
      setTimeout(() => el.remove(), 350);
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

window.App.getTeamThemeGlobal = function (teamName) {
  if (window.Dashboard && window.Dashboard.getTeamTheme) {
    return window.Dashboard.getTeamTheme(teamName);
  }
  if (!teamName) return null;
  var name = teamName.toLowerCase().trim();
  if (name.includes('flamengo')) return { gradient: 'linear-gradient(135deg, #000000 0%, #3A050A 50%, #C8102E 100%)', border: '#000000', badgeBg: '#000000', accent: '#FFD700' };
  if (name.includes('vasco') || name.includes('botafogo') || name.includes('corinthians')) return { gradient: 'linear-gradient(135deg, #222222 0%, #0D0D0D 50%, #1A1A1A 100%)', border: '#FFFFFF', badgeBg: '#111111', accent: '#F5D270' };
  if (name.includes('palmeiras') || name.includes('guarani')) return { gradient: 'linear-gradient(135deg, #006437 0%, #04391F 50%, #011E10 100%)', border: '#86EFAC', badgeBg: '#006437', accent: '#F5D270' };
  if (name.includes('cruzeiro')) return { gradient: 'linear-gradient(135deg, #003399 0%, #001F66 50%, #050E2E 100%)', border: '#93C5FD', badgeBg: '#003399', accent: '#FFFFFF' };
  if (name.includes('fluminense')) return { gradient: 'linear-gradient(135deg, #831D1C 0%, #4A0E0E 40%, #006633 100%)', border: '#D4AF37', badgeBg: '#831D1C', accent: '#F5D270' };
  if (name.includes('são paulo') || name.includes('sao paulo')) return { gradient: 'linear-gradient(135deg, #C8102E 0%, #2B0007 45%, #0A0A0A 100%)', border: '#FFFFFF', badgeBg: '#C8102E', accent: '#F5D270' };
  return null;
};

window.App.toggleModoNoturnoGlobal = function () {
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
  if (isNight === undefined) {
    isNight = localStorage.getItem('peladapro_modo_noturno') === 'true';
  }

  const user = window.Auth ? window.Auth.currentUser : null;
  const teamName = user ? user.time_coracao : null;
  const teamTheme = window.App.getTeamThemeGlobal(teamName);

  const buttons = document.querySelectorAll('.btn-global-modo-noturno, .btn-global-modo-noturno-icon, #btn-toggle-modo-noturno');
  const labels = document.querySelectorAll('.lbl-modo-noturno-txt, #lbl-modo-noturno');

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
  }

  if (window.Dashboard && window.Dashboard.applyModoNoturno) {
    window.Dashboard.applyModoNoturno(isNight);
  }
};
