// ==========================================================================
// js/core/adsense.js — Gerenciador de Anúncios Google AdSense
// PeladaPro · Suporte com opção ON / OFF (Habilitar / Desabilitar)
// ==========================================================================

(function () {
  const AdSenseManager = {
    KEYS: {
      enabled: 'pp_adsense_enabled',
      clientPubId: 'pp_adsense_pub_id',
      slotId: 'pp_adsense_slot_id'
    },

    isVipGroup() {
      // Neste momento (período de testes gratuito), os anúncios devem ser exibidos para TODOS (mesmo membros VIP/Premium)
      return false;
    },

    isEnabled() {
      // Ativado por padrão para testes de propaganda em todos os planos
      const stored = localStorage.getItem(this.KEYS.enabled);
      return stored === 'false' ? false : true;
    },

    getPubId() {
      return localStorage.getItem(this.KEYS.clientPubId) || '';
    },

    getSlotId() {
      return localStorage.getItem(this.KEYS.slotId) || '';
    },

    // --- Carrega dinamicamente o script oficial do Google AdSense ----------
    loadAdSenseScript(rawPubId) {
      if (!rawPubId) return;
      let pubId = rawPubId.trim();
      if (!pubId.startsWith('ca-pub-')) {
        pubId = pubId.startsWith('pub-') ? 'ca-' + pubId : 'ca-pub-' + pubId;
      }

      if (document.getElementById('google-adsense-script')) return;

      const script = document.createElement('script');
      script.id = 'google-adsense-script';
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pubId}`;
      script.setAttribute('crossorigin', 'anonymous');
      document.head.appendChild(script);
      console.log('📢 [AdSense] Script oficial do Google AdSense carregado:', pubId);
    },

    // --- Inicialização do serviço na inicialização do app ------------------
    init() {
      if (this.isEnabled()) {
        const pubId = this.getPubId();
        if (pubId) {
          this.loadAdSenseScript(pubId);
        }
      }
    },

    // --- Ligar / Desligar --------------------------------------------------
    enable(pubId, slotId = '') {
      localStorage.setItem(this.KEYS.enabled, 'true');
      if (pubId) localStorage.setItem(this.KEYS.clientPubId, pubId.trim());
      if (slotId) localStorage.setItem(this.KEYS.slotId, slotId.trim());

      this.loadAdSenseScript(pubId || this.getPubId());
      this.refreshAllContainers();
      console.log('✅ [AdSense] Anúncios Google AdSense ATIVADOS para todos os atletas.');
    },

    disable() {
      localStorage.setItem(this.KEYS.enabled, 'false');
      this.refreshAllContainers();
      console.log('🛑 [AdSense] Anúncios Google AdSense DESATIVADOS.');
    },

    // --- Renderiza um contêiner de anúncio em um elemento da página -------
    renderAdContainer(containerId, customSlotId = null) {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (!this.isEnabled()) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      let pubId = this.getPubId().trim();
      if (pubId && !pubId.startsWith('ca-pub-')) {
        pubId = pubId.startsWith('pub-') ? 'ca-' + pubId : 'ca-pub-' + pubId;
      }
      const slotId = customSlotId || this.getSlotId().trim();

      container.style.display = 'block';

      // Se tiver pubId válido do Google AdSense, injeta a tag ins oficial do AdSense
      if (pubId) {
        const slotAttr = slotId ? `data-ad-slot="${slotId}"` : '';
        container.innerHTML = `
          <div style="text-align: center; margin: 12px 0; overflow: hidden;" class="adsense-box">
            <span style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Publicidade Patrocinada</span>
            <ins class="adsbygoogle"
                 style="display:block"
                 data-ad-client="${pubId}"
                 ${slotAttr}
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
          </div>
        `;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          console.warn('[AdSense] Aviso ao empurrar bloco de anúncio:', e);
        }
      } else {
        // Banner de teste / demonstrativo exibido para validar o funcionamento do anúncio
        container.innerHTML = `
          <div style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border: 1.5px solid #10B981; border-radius: 14px; padding: 16px; text-align: center; margin: 12px 0; box-shadow: 0 8px 24px rgba(0,0,0,0.3); position: relative;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 6px;">
              <span style="background: #10B981; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px;">📢 ANÚNCIO / PUBLICIDADE LIVE</span>
              <span style="font-size: 11px; color: #94A3B8; font-weight: 700;">Google AdSense</span>
            </div>
            <div style="font-size: 13px; color: #F8FAFC; font-weight: 700; margin-bottom: 4px;">🏆 PeladaPro · Espaço Publicitário de Anúncios</div>
            <div style="font-size: 11px; color: #CBD5E1; font-weight: 500; line-height: 1.4;">
              Espaço de anúncio ativado e visível para todos os atletas (Versão Gratuita, VIP & Premium). 
              Insira o ID do Publisher <code>ca-pub-xxx</code> em Configurações para carregar anúncios reais do Google AdSense.
            </div>
          </div>
        `;
      }
    },

    // --- Atualiza todos os contêineres registrados na página --------------
    refreshAllContainers() {
      const ids = [
        'adsense-dashboard-banner',
        'adsense-convocacao-banner',
        'adsense-ranking-banner',
        'adsense-partidas-banner'
      ];
      ids.forEach(id => this.renderAdContainer(id));
    }
  };

  window.AdSenseManager = AdSenseManager;
  document.addEventListener('DOMContentLoaded', () => AdSenseManager.init());
})();
