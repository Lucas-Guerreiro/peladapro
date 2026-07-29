// Interceptador para redirecionar chamadas de API locais em produção
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string' && input.startsWith('/api')) {
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
      style:    'currency',
      currency: 'BRL'
    }).format(safeNum);
  },

  formatDate(isoDate) {
    if (!isoDate) return '—';
    try {
      const dateStr = typeof isoDate === 'string' ? isoDate.substring(0, 10) : new Date(isoDate).toISOString().substring(0, 10);
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(isoDate).toLocaleDateString('pt-BR');
    } catch (e) {
      return '—';
    }
  },

  formatDatetime(isoDatetime) {
    return new Date(isoDatetime).toLocaleString('pt-BR');
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
      error:   '❌',
      info:    'ℹ️'
    };
    const container = this._getContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type] || '🔔'}</span><span>${msg}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.style.animation = 'none';
      el.style.opacity   = '0';
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
      // Se já é um objeto Date
      if (dob instanceof Date) {
        dateStr = dob.getFullYear() + '-' + String(dob.getMonth() + 1).padStart(2,'0') + '-' + String(dob.getDate()).padStart(2,'0');
      } else {
        // Garante string e pega apenas a parte AAAA-MM-DD
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
    } catch(e) {
      return null;
    }
  }
};

window.Utils = Utils;
