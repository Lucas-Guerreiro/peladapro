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
      try {
        const override = localStorage.getItem('pp_vip_test_override');
        if (override) {
          return override === 'ativa';
        }
        let grp = (window.App && window.App.currentGroup) ? window.App.currentGroup : null;
        if (!grp && window.Auth) grp = window.Auth.currentGroup;
        if (!grp) {
          const raw = localStorage.getItem('currentGroup');
          if (raw) grp = JSON.parse(raw);
        }
        if (grp && grp.licenca_status === 'ativa') {
          if (grp.licenca_expira_em) {
            const exp = new Date(grp.licenca_expira_em);
            if (exp > new Date()) return true;
          } else {
            return true;
          }
        }
      } catch (e) { }
      return false;
    },

    isEnabled() {
      // Se o grupo estiver no Modo VIP (Licença Ativa), NENHUM anúncio ou palavra 'Publicidade' deve ser exibido!
      if (this.isVipGroup()) {
        return false;
      }
      const stored = localStorage.getItem(this.KEYS.enabled);
      return stored === 'true';
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
      console.log('✅ [AdSense] Anúncios Google AdSense ATIVADOS.');
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

      // Se tiver pubId válido, injeta a tag ins do AdSense (slotId é opcional)
      if (pubId) {
        const slotAttr = slotId ? `data-ad-slot="${slotId}"` : '';
        container.innerHTML = `
          <div style="text-align: center; margin: 12px 0; overflow: hidden;" class="adsense-box">
            <span style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Publicidade</span>
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
        // Banner demonstrativo quando o AdSense está ligado aguardando ID do Publisher
        container.innerHTML = `
          <div style="background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%); border: 1px dashed #CBD5E1; border-radius: 12px; padding: 14px; text-align: center; margin: 12px 0;">
            <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">📢 Espaço de Anúncio Google AdSense (Ativado)</div>
            <div style="font-size: 12px; color: #475569; font-weight: 500;">O espaço de publicidade está ativado. Insira o seu <strong>ID do Publisher</strong> (ca-pub-xxx) no painel de Configurações para exibir os anúncios do Google.</div>
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
