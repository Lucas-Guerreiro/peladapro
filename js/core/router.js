// ==========================================================================
// js/core/router.js — Roteador SPA com Hash Routing
// PeladaPro · Fundacional
// ==========================================================================

const Router = {

  // --- Tabela de Rotas ---------------------------------------------------
  _routes: {
    '#/':                    { page: 'login',               permission: 'public'  },
    '#/login':               { page: 'login',               permission: 'public'  },
    '#/cadastro':            { page: 'cadastro',            permission: 'public'  },
    '#/jogador/dashboard':   { page: 'jogador/dashboard',   permission: 'jogador' },
    '#/jogador/convocacao':  { page: 'jogador/convocacao',  permission: 'jogador' },
    '#/jogador/acompanhamento': { page: 'jogador/acompanhamento', permission: 'jogador' },
    '#/jogador/ranking':     { page: 'jogador/ranking',     permission: 'jogador' },
    '#/jogador/desempenho':  { page: 'jogador/desempenho',  permission: 'jogador' },
    '#/gestor/atletas':      { page: 'gestor/atletas',      permission: 'gestor'  },
    '#/gestor/formacao':     { page: 'gestor/formacao',     permission: 'gestor'  },
    '#/gestor/partidas':     { page: 'gestor/partidas',     permission: 'gestor'  },
    '#/gestor/financeiro':   { page: 'gestor/financeiro',   permission: 'gestor'  },
    '#/gestor/config':       { page: 'gestor/config',       permission: 'gestor'  }
  },

  // Estado da aba ativa e da navegação
  activeRoute: null,
  activeTabId: null,
  _currentLayoutRole: null,

  // --- Inicialização -------------------------------------------------------
  async init() {
    // Seed do banco de dados na primeira carga
    await Api.checkAndInitDatabase();

    // 1. Escuta mudanças de hash (sempre registrado primeiro)
    window.addEventListener('hashchange', () => {
      this._handleRoute(window.location.hash || '#/');
    });

    // 2. Capturar callback do Google OAuth via hash do Supabase
    const hashStr = window.location.hash || '';
    if (hashStr.includes('access_token=')) {
      const params = {};
      hashStr.substring(1).split('&').forEach(pair => {
        const parts = pair.split('=');
        params[parts[0]] = decodeURIComponent(parts[1]);
      });

      if (params.access_token) {
        // Limpar hash da URL para maior segurança
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
        
        // Efetuar login com o token (a navegação posterior disparará o hashchange)
        setTimeout(() => {
          Auth.loginWithGoogleToken(params.access_token);
        }, 100);
        return;
      }
    }

    // Rota inicial convencional
    const hash = window.location.hash || '#/';
    this._handleRoute(hash);
  },

  // --- Navegar ------------------------------------------------------------
  navigate(hash) {
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      // Hash igual — força o handler (page reload sem recarregar)
      this._handleRoute(hash);
    }
  },

  // --- Handler Principal --------------------------------------------------
  async _handleRoute(hash) {
    const route = this._routes[hash] || this._routes['#/login'];
    this.activeRoute = hash;

    // Guarda de permissão
    if (route.permission === 'jogador' || route.permission === 'gestor') {
      if (!Auth.isLoggedIn()) {
        return this.navigate('#/login');
      }
    }

    await this._loadPage(route);
  },

  // --- Carregar Página ----------------------------------------------------
  async _loadPage(route) {
    const app = document.getElementById('app');
    if (!app) return;

    const isGestorPage  = route.page.startsWith('gestor/');
    const isJogadorPage = route.page.startsWith('jogador/');
    const needsLayout   = isGestorPage || isJogadorPage;
    const newRole       = isGestorPage ? 'gestor' : (isJogadorPage ? 'jogador' : null);

    // ---- Precisa renderizar o layout principal? ----
    if (needsLayout && this._currentLayoutRole !== newRole) {
      await this._injectMainLayout(newRole);
      this._currentLayoutRole = newRole;
    }

    // ---- Página pública (login / cadastro) ----
    if (!needsLayout) {
      this._currentLayoutRole = null;
      try {
        app.innerHTML = `<div class="app-container"></div>`;
        const res = await fetch(`pages/${route.page}.html?v=${Date.now()}`);
        app.querySelector('.app-container').innerHTML = await res.text();
      } catch (e) {
        console.error('[Router]', e);
        app.innerHTML = `<div class="login-container"><p style="color:var(--danger)">Erro ao carregar página.</p></div>`;
      }
      this._afterPageLoad(route);
      return;
    }

    // ---- Aba dentro do layout ----
    const tabName = route.page.split('/')[1];
    const container = document.getElementById(
      isGestorPage ? 'manager-tab-content-container' : 'player-tab-content-container'
    );
    if (!container) return;

    // Skeleton enquanto carrega
    container.innerHTML = `
      <div class="card" style="padding:32px">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text" style="width:80%"></div>
        <div class="skeleton skeleton-text" style="width:90%"></div>
      </div>`;

    try {
      const res = await fetch(`pages/${route.page}.html?v=${Date.now()}`);
      container.innerHTML = await res.text();
    } catch (e) {
      container.innerHTML = `<p style="padding:20px;color:var(--danger)">Erro ao carregar aba.</p>`;
    }

    // Carrega o JS correspondente
    const jsPath = `pages/${route.page}.js`;
    this._loadScript(jsPath, () => {
      this.activeTabId = tabName;
      const initFn = `init${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
      if (window.App && window.App[initFn]) window.App[initFn]();
    });

    // Atualiza estado visual das abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.name === tabName);
    });

    this._afterPageLoad(route);
  },

  // --- Injetar Layout Principal -------------------------------------------
  async _injectMainLayout(role) {
    const app = document.getElementById('app');
    const layoutFile = role === 'gestor' ? 'pages/gestor/layout.html' : 'pages/jogador/layout.html';

    // Header fixo do app
    const headerHTML = `
      <header class="main-header" id="main-header">
        <div class="brand" style="cursor:pointer" onclick="Router.navigate(Auth.currentUser?.gestor ? '#/gestor/atletas' : '#/jogador/dashboard')">
          <h1>PELADA <span>PRO</span></h1>
        </div>
        <div class="user-nav-status">
          <span class="text-inter" style="font-size:14px; color:var(--text-caption); font-weight:600" id="header-user-name">
            ${Auth.currentUser ? Auth.currentUser.nome : ''}
          </span>
          <button class="btn btn-outline btn-sm" onclick="Auth.logout()">Sair</button>
        </div>
      </header>`;

    try {
      const res = await fetch(`${layoutFile}?v=${Date.now()}`);
      const layoutHTML = await res.text();
      app.innerHTML = headerHTML + `<div class="app-container">${layoutHTML}</div>`;
    } catch (e) {
      app.innerHTML = headerHTML + `<div class="app-container"><p>Erro ao carregar layout.</p></div>`;
    }

    // Atualiza nome no header
    const nameEl = document.getElementById('header-user-name');
    if (nameEl && Auth.currentUser) nameEl.textContent = Auth.currentUser.nome;

    // Bind das abas de navegação
    this._bindTabButtons(role);
  },

  // --- Bind das Abas do Layout -------------------------------------------
  _bindTabButtons(role) {
    document.querySelectorAll('.tab-btn[data-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;           // ex: "gestor/formacao.html"
        const name   = btn.dataset.name;             // ex: "formacao"
        const hash   = `#/${target.replace('.html', '')}`;
        Router.navigate(hash);
      });
    });
  },

  // --- Pós-carregamento ---------------------------------------------------
  _afterPageLoad(route) {
    // Ativa ícones Feather se disponível
    if (window.feather) feather.replace();
    // Dispara evento customizado para scripts que escutam
    document.dispatchEvent(new CustomEvent('page:loaded', { detail: { route } }));
  },

  // --- Modal --------------------------------------------------------------
  async openModal(modalName, data = {}) {
    const root = document.getElementById('modal-container-root');
    if (!root) {
      // Cria container de modal se não existir
      const div = document.createElement('div');
      div.id = 'modal-container-root';
      document.body.appendChild(div);
    }

    try {
      const res = await fetch(`components/modals/${modalName}.html?v=${Date.now()}`);
      document.getElementById('modal-container-root').innerHTML = await res.text();
    } catch (e) {
      console.error('[Router] Modal não encontrado:', modalName);
      return;
    }

    this._loadScript(`components/modals/${modalName}.js`, () => {
      const initFn = `initModal${modalName.charAt(0).toUpperCase() + modalName.slice(1)}`;
      if (window.App && window.App[initFn]) window.App[initFn](data);
    });

    // Abre com animação
    setTimeout(() => {
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.classList.add('active');
      if (window.feather) feather.replace();
    }, 20);
  },

  closeModal() {
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      setTimeout(() => {
        const root = document.getElementById('modal-container-root');
        if (root) root.innerHTML = '';
      }, 300);
    }
  },

  // --- loadScript ---------------------------------------------------------
  _loadScript(src, callback) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.src = `${src}?v=${Date.now()}`;
    script.onload = callback || (() => {});
    script.onerror = () => console.error('[Router] Falha ao carregar script:', src);
    document.head.appendChild(script);
  }
};

window.Router = Router;

// ==========================================================================
// Shim window.App — Retrocompatibilidade com módulos existentes
// Permite que pages/jogador/*.js e pages/gestor/*.js usem window.App.*
// sem precisar ser reescritos
// ==========================================================================
window.App = {
  // --- Sessão (proxies para Auth) -----------------------------------------
  get currentUser()    { return Auth.currentUser; },
  get currentGroup()   { return Auth.currentGroup; },
  set currentGroup(v)  { Auth.currentGroup = v; },

  // --- Cache de grupos do gestor ------------------------------------------
  gestorGroups: [],
  syncDrawnDates: null,

  // --- Navegação ----------------------------------------------------------
  get activeTabId()  { return Router.activeTabId; },
  get currentRoute() { return Router.activeRoute; },

  // --- UI -----------------------------------------------------------------
  showToast(msg, type = 'success')    { Utils.toast(msg, type); },
  openModal(name, data)               { Router.openModal(name, data); },
  closeModal()                        { Router.closeModal(); },

  // --- Estado do jogo ao vivo (lido do localStorage para persistência) ----------------------
  liveMatch: JSON.parse(localStorage.getItem("liveMatch")) || {
    teamA: 'Time A', teamB: 'Time B',
    scoreA: 0, scoreB: 0,
    timerSeconds: 0, isPlaying: false
  },
  waitingQueue:   JSON.parse(localStorage.getItem("waitingQueue")) || [],
  presentPlayers: [],

  // --- Placeholders que serão sobrescritos pelos scripts das abas --------
  renderDrawnTeams:             () => {},
  updateAcompanhamentoUI:       () => {},
  initDashboard:                () => {},
  initConvocacao:               () => {},
  initDesempenho:               () => {},
  initAtletas:                  () => {},
  initFormacao:                 () => {},
  initPartidas:                 () => {},
  initFinanceiro:               () => {},
  initConfig:                   () => {},
  initModalPagamento:           () => {},
  initModalRemocao:             () => {},
  initModalSorteio:             () => {},
  initModalAtleta:              () => {},
  initModalDespesa:             () => {},
  initModalPartida_config:      () => {},
  initModalCriar_pelada:        () => {},
  initModalAviso_aprovacao:     () => {},
  initModalLancar_gol:          () => {},
  initModalVer_time:            () => {},
  initModalEditar_partida:      () => {}
};
