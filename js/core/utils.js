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
