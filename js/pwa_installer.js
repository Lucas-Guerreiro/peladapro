/**
 * js/pwa_installer.js — Gerenciador de Instalação PWA (Botão & Balão Flutuante)
 */

window.PWAInstaller = {
  _deferredPrompt: null,

  init() {
    // 1. Registrar Service Worker com escopo absoluto /
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('📱 [PWA] Service Worker ativo com escopo /!');
          if (reg && reg.update) reg.update();
        })
        .catch(err => console.warn('📱 [PWA] Erro no Service Worker:', err));
    }

    // 2. Capturar evento de instalação nativo
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._deferredPrompt = e;
      window.deferredPWAInstallPrompt = e;

      // Exibe o balão flutuante apenas se não foi dispensado nesta sessão
      if (!sessionStorage.getItem('pwa_banner_dismissed')) {
        this.showFloatingBanner();
      }
    });

    // 3. Ocultar balão se o app já foi instalado
    window.addEventListener('appinstalled', () => {
      console.log('🎉 [PWA] App instalado com sucesso!');
      this.hideFloatingBanner();
      if (window.App && window.App.showToast) {
        window.App.showToast('Aplicativo instalado com sucesso na sua tela inicial! 🎉', 'success');
      }
    });

    // 4. Exibir balão no iOS se não estiver em modo standalone
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && !isStandalone && !sessionStorage.getItem('pwa_banner_dismissed')) {
      setTimeout(() => this.showFloatingBanner(true), 2500);
    }
  },

  /**
   * Renderiza o Balão Flutuante de Instalação
   */
  showFloatingBanner(isIOS = false) {
    if (document.getElementById('pwa-floating-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-floating-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      left: 20px;
      max-width: 440px;
      margin: 0 auto;
      background: #0F172A;
      color: #FFFFFF;
      border: 1.5px solid #0284C7;
      border-radius: 16px;
      padding: 16px 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-family: 'Inter', sans-serif;
      animation: pwaSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // Injeta CSS de animação
    if (!document.getElementById('pwa-styles')) {
      const style = document.createElement('style');
      style.id = 'pwa-styles';
      style.innerHTML = `
        @keyframes pwaSlideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    const titleText = isIOS ? '📱 Instalar PeladaPro no iPhone' : '📲 Instalar Aplicativo PeladaPro';
    const bodyText = isIOS
      ? 'Toque no ícone <b>Compartilhar ⎋</b> do Safari e escolha <b>"Adicionar à Tela de Início" ➕</b>.'
      : 'Instale na sua tela inicial para acesso rápido, avisos de convocação e melhor desempenho!';

    const btnInstallText = isIOS ? '💡 Ver Instruções' : '⚡ Instalar Agora';

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 38px; height: 38px; border-radius: 10px; background: #0284C7; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
            ⚽
          </div>
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: #F8FAFC;">${titleText}</h4>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #94A3B8; line-height: 1.3;">${bodyText}</p>
          </div>
        </div>
        <button id="pwa-btn-dismiss" style="background: transparent; border: none; color: #64748B; font-size: 18px; cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          ✖
        </button>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 4px;">
        <button id="pwa-btn-install" style="flex: 1; background: #0284C7; color: #FFFFFF; border: none; border-radius: 10px; padding: 10px 14px; font-weight: 700; font-size: 13px; cursor: pointer; transition: background 0.2s;">
          ${btnInstallText}
        </button>
        <button id="pwa-btn-later" style="background: rgba(255,255,255,0.08); color: #CBD5E1; border: none; border-radius: 10px; padding: 10px 14px; font-weight: 600; font-size: 13px; cursor: pointer;">
          Depois
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    // Eventos
    document.getElementById('pwa-btn-install').onclick = () => this.triggerInstall(isIOS);
    document.getElementById('pwa-btn-dismiss').onclick = () => this.dismissBanner();
    document.getElementById('pwa-btn-later').onclick = () => this.dismissBanner();
  },

  hideFloatingBanner() {
    const banner = document.getElementById('pwa-floating-banner');
    if (banner) banner.remove();
  },

  dismissBanner() {
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
    this.hideFloatingBanner();
  },

  /**
   * Aciona a instalação do PWA
   */
  async triggerInstall(isIOS = false) {
    if (isIOS) {
      alert("📱 PARA INSTALAR NO IPHONE / IPAD:\n\n1. Toque no ícone Compartilhar ⎋ no rodapé do Safari.\n2. Role a lista e toque em 'Adicionar à Tela de Início' ➕.\n3. Toque em 'Adicionar' no canto superior direito.\n\nPronto! O PeladaPro aparecerá como um app na sua tela.");
      return;
    }

    if (this._deferredPrompt) {
      this._deferredPrompt.prompt();
      const choice = await this._deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        console.log('Usuário aceitou a instalação do PWA');
      } else {
        console.log('Usuário recusou a instalação do PWA');
      }
      this._deferredPrompt = null;
      this.hideFloatingBanner();
    } else {
      alert("📲 Para instalar o app:\n\nToque no menu do navegador (três pontinhos ⋮ ou menu do navegador) e selecione 'Instalar aplicativo' ou 'Adicionar à tela inicial'.");
    }
  }
};

// Inicialização automática do PWA Installer
document.addEventListener('DOMContentLoaded', () => {
  window.PWAInstaller.init();
});
