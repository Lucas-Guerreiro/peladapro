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
      const stored = localStorage.getItem(this.KEYS.clientPubId);
      if (stored && stored.trim()) return stored.trim();
      return 'ca-pub-2291446471490542';
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
    async init() {
      // 1. Tenta sincronizar com o banco de dados (Supabase / Backend)
      await this.syncWithDatabase();

      if (this.isEnabled()) {
        const pubId = this.getPubId();
        if (pubId && !this.isPlaceholderPubId(pubId)) {
          this.loadAdSenseScript(pubId);
        }
        this.refreshAllContainers();
      }
    },

    isPlaceholderPubId(pubId) {
      if (!pubId) return true;
      const clean = pubId.trim().toLowerCase();
      if (clean.includes('7952143569713459')) return false; // ID real do usuário
      return clean.includes('1234567890') || clean.includes('xxx') || clean.includes('example') || clean.length < 10;
    },

    // --- Sincroniza as configurações de anúncio do banco de dados ----------
    async syncWithDatabase() {
      try {
        let pubId = '';
        let slotId = '';
        let enabled = null;

        // Tenta buscar via Supabase
        if (window.supabase) {
          const { data: { session } } = await window.supabase.auth.getSession();
          if (session?.user) {
            const { data } = await window.supabase
              .from('usuarios')
              .select('adsense_pub_id, adsense_slot_id, adsense_enabled')
              .eq('email', session.user.email)
              .single();

            if (data) {
              if (data.adsense_pub_id) pubId = data.adsense_pub_id;
              if (data.adsense_slot_id) slotId = data.adsense_slot_id;
              if (data.adsense_enabled !== null && data.adsense_enabled !== undefined) {
                enabled = data.adsense_enabled;
              }
            }
          }
        }

        // Tenta buscar via Auth.currentUser (Web App)
        if (!pubId && window.Auth && window.Auth.currentUser) {
          const u = window.Auth.currentUser;
          if (u.adsense_pub_id) pubId = u.adsense_pub_id;
          if (u.adsense_slot_id) slotId = u.adsense_slot_id;
          if (u.adsense_enabled !== undefined) enabled = u.adsense_enabled;
        }

        // Se encontrou configurações no banco, atualiza o cache local
        if (pubId) localStorage.setItem(this.KEYS.clientPubId, pubId);
        if (slotId) localStorage.setItem(this.KEYS.slotId, slotId);
        if (enabled !== null) localStorage.setItem(this.KEYS.enabled, enabled ? 'true' : 'false');

      } catch (e) {
        console.warn('⚠️ [AdSense] Erro ao sincronizar AdSense com o banco:', e);
      }
    },

    // --- Ligar / Desligar (Salva no LocalStorage E no Banco de Dados) -------
    async enable(pubId, slotId = '') {
      const cleanPub = pubId ? pubId.trim() : this.getPubId();
      const cleanSlot = slotId ? slotId.trim() : this.getSlotId();

      localStorage.setItem(this.KEYS.enabled, 'true');
      if (cleanPub) localStorage.setItem(this.KEYS.clientPubId, cleanPub);
      if (cleanSlot) localStorage.setItem(this.KEYS.slotId, cleanSlot);

      this.loadAdSenseScript(cleanPub);
      this.refreshAllContainers();

      // Persiste no banco de dados (Supabase & Backend API)
      await this.saveToDatabase(true, cleanPub, cleanSlot);
      console.log('✅ [AdSense] Anúncios Google AdSense ATIVADOS e salvos no banco.');
    },

    async disable() {
      localStorage.setItem(this.KEYS.enabled, 'false');
      this.refreshAllContainers();

      // Persiste desativação no banco de dados
      await this.saveToDatabase(false, this.getPubId(), this.getSlotId());
      console.log('🛑 [AdSense] Anúncios Google AdSense DESATIVADOS e salvos no banco.');
    },

    // --- Persiste as configurações no Banco de Dados (Supabase / Backend) ----
    async saveToDatabase(enabled, pubId, slotId) {
      try {
        const payload = {
          adsense_enabled: enabled,
          adsense_pub_id: pubId || '',
          adsense_slot_id: slotId || '',
        };

        // 1. Persiste no Supabase (se autenticado)
        if (window.supabase) {
          const { data: { session } } = await window.supabase.auth.getSession();
          if (session?.user) {
            await window.supabase
              .from('usuarios')
              .update(payload)
              .eq('email', session.user.email);
          }
        }

        // 2. Persiste via API Backend (se disponível)
        if (window.Api && window.Api.atualizarPerfil) {
          window.Api.atualizarPerfil(payload).catch(() => {});
        }

        // 3. Atualiza Auth.currentUser
        if (window.Auth && window.Auth.currentUser) {
          Object.assign(window.Auth.currentUser, payload);
          localStorage.setItem('usuario', JSON.stringify(window.Auth.currentUser));
          localStorage.setItem('currentUser', JSON.stringify(window.Auth.currentUser));
        }
      } catch (e) {
        console.warn('⚠️ [AdSense] Erro ao salvar configurações no banco:', e);
      }
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

      // Se tiver pubId real e válido do Google AdSense, injeta a tag ins oficial do AdSense
      if (pubId && !this.isPlaceholderPubId(pubId)) {
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
