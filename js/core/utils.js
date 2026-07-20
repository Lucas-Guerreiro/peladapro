// ==========================================================================
// js/core/utils.js — Utilitários Globais
// PeladaPro · Fundacional
// ==========================================================================

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
    return new Intl.NumberFormat('pt-BR', {
      style:    'currency',
      currency: 'BRL'
    }).format(v);
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
    if (!dob) return '—';
    const diff = Date.now() - new Date(dob + 'T00:00:00').getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  }
};

window.Utils = Utils;
