// ==========================================================================
// js/core/auth.js — Autenticação e Sessão com Integração Real ao Backend
// PeladaPro · Fundacional
// ==========================================================================

const Auth = {
  currentUser:  null,
  currentGroup: null,
  _selectedRole: 'jogador',  // 'jogador' | 'gestor'

  // --- Estado -------------------------------------------------------------
  isLoggedIn() {
    if (this.currentUser !== null) return true;
    return this.checkSavedSession();
  },

  setRole(role) {
    this._selectedRole = role;
    // Atualiza visual das tabs de login se existirem
    document.querySelectorAll('.login-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === role);
    });

    // Atualiza dinamicamente o label e o placeholder de credencial de acordo com a role
    const userLabel = document.getElementById('login-user-label');
    const userInput = document.getElementById('login-user');
    if (userInput) {
      if (role === 'jogador') {
        if (userLabel) userLabel.textContent = 'E-mail';
        userInput.placeholder = 'Ex.: atleta@gmail.com';
      } else {
        if (userLabel) userLabel.textContent = 'CPF ou E-mail';
        userInput.placeholder = 'Ex.: 111.222.333-44';
      }
    }
  },

  // --- Login Real (conecta ao Backend Node.js / Supabase) -----------------
  async login() {
    const userInput  = document.getElementById('login-user');
    const passInput  = document.getElementById('login-pass');

    if (!userInput || !passInput) return;

    const identifier = userInput.value.trim();
    const password   = passInput.value || 'senha123'; // Senha padrão se vazia

    if (!identifier) {
      Utils.toast('Informe seu E-mail ou CPF.', 'warning');
      return;
    }

    try {
      Utils.toast('Autenticando contra Supabase...', 'info', 1000);
      
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: identifier, senha: password })
      });

      const data = await response.json();
      if (!response.ok) {
        Utils.toast(data.error || 'Credenciais inválidas.', 'error');
        return;
      }

      // Se a conta está pendente de aprovação do gestor
      if (data.status === 'aprovacao_pendente') {
        Utils.toast(data.message || 'Cadastro pendente de aprovação.', 'warning');
        Router.openModal('aviso_aprovacao', { nome: data.nome });
        return;
      }

      // Salva token JWT
      localStorage.setItem('token', data.token);

      // Sincroniza jogadores do Supabase no localStorage para compatibilidade com SPA legada
      await this._syncDataFromBackend(data.token);

      // Inicia a sessão com o jogador retornado
      this._startSession(data.usuario);
    } catch (err) {
      console.error(err);
      Utils.toast('Erro ao conectar ao servidor backend (Supabase).', 'error');
    }
  },

  // --- Cadastro Real Simplificado (registra no Supabase com OTP) -----------
  async register() {
    const nome = document.getElementById('register-name')?.value.trim();
    const email = document.getElementById('register-email')?.value.trim();
    const password = document.getElementById('register-password')?.value;
    const confirmPassword = document.getElementById('register-confirm-password')?.value;

    if (!nome || !email || !password || !confirmPassword) {
      Utils.toast('Preencha todos os campos do formulário.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      Utils.toast('As senhas digitadas não batem.', 'warning');
      return;
    }

    try {
      Utils.toast('Criando conta no Supabase...', 'info', 1000);
      
      const response = await fetch('http://localhost:3000/api/auth/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome,
          email: email,
          senha: password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        Utils.toast(data.error || 'Erro ao registrar usuário.', 'error');
        return;
      }

      Utils.toast('Conta criada! Cadastro enviado para aprovação.', 'success');

      // Abre o modal informativo de aprovação pendente pelo gestor
      Router.openModal('aviso_aprovacao', { nome: nome });

    } catch (err) {
      console.error(err);
      Utils.toast('Erro ao conectar ao servidor para registro.', 'error');
    }
  },

  // --- Fluxo Real do Google OAuth via Supabase Auth ------------------------
  async loginWithGoogle() {
    Utils.toast('Redirecionando para o Google...', 'info', 1000);
    const redirectUrl = window.location.origin + '/';
    window.location.href = 'https://xgsdaavryzhqxkwsonkk.supabase.co/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(redirectUrl);
  },

  async loginWithGoogleToken(accessToken) {
    try {
      Utils.toast('Autenticando sessão do Google...', 'info', 1000);
      const res = await fetch('http://localhost:3000/api/auth/google-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken })
      });

      const data = await res.json();
      if (!res.ok) {
        Utils.toast(data.error || 'Erro na autenticação do Google.', 'error');
        return;
      }

      // Se a conta do Google está pendente de aprovação do gestor
      if (data.status === 'aprovacao_pendente') {
        Utils.toast(data.message || 'Cadastro pendente de aprovação pelo gestor.', 'warning');
        Router.openModal('aviso_aprovacao', { nome: data.nome });
        return;
      }

      // Salva token local do Express e sincroniza
      localStorage.setItem('token', data.token);
      await this._syncDataFromBackend(data.token);

      // Inicia sessão
      this._startSession(data.usuario);
    } catch (err) {
      console.error(err);
      Utils.toast('Falha ao autenticar com o Google no servidor.', 'error');
    }
  },

  // --- Sincronizar dados do banco real para o localStorage local ----------
  async _syncDataFromBackend(token) {
    try {
      const res = await fetch('http://localhost:3000/api/usuarios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const players = await res.json();
        localStorage.setItem('players', JSON.stringify(players));
      }
    } catch (e) {
      console.warn('[Auth] Erro ao sincronizar dados do backend:', e);
    }
  },

  // --- Acesso Rápido integrado ao Supabase --------------------------------
  async testAccess(role) {
    const r = role || this._selectedRole;
    // CPFs correspondentes ao seed do banco do Supabase
    const cpf = r === 'gestor' ? '111.222.333-44' : '222.333.444-55';
    this._selectedRole = r;

    try {
      Utils.toast('Autenticando contra Supabase...', 'info', 1000);
      
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf, senha: 'senha123' })
      });

      const data = await response.json();
      if (!response.ok) {
        Utils.toast(data.error || 'Erro no acesso rápido contra Supabase.', 'error');
        return;
      }

      localStorage.setItem('token', data.token);
      await this._syncDataFromBackend(data.token);
      
      this._startSession(data.usuario);
    } catch (err) {
      console.error(err);
      Utils.toast('Erro ao conectar no banco real Supabase.', 'error');
    }
  },

  // Abrir Tela de Seleção de Perfil para trocar entre Gestor e Jogador
  openProfileSelection() {
    Router.navigate('#/selecionar-perfil');
  },

  // Selecionar Papel (Gestor ou Jogador)
  selectRole(role) {
    if (!role || (role !== 'gestor' && role !== 'jogador')) return;

    const chkRemember = document.getElementById('chk-remember-profile');
    if (chkRemember) {
      if (chkRemember.checked) {
        localStorage.setItem('ultimo_perfil', role);
      } else {
        localStorage.removeItem('ultimo_perfil');
      }
    }

    if (!this.currentUser) {
      try {
        const raw = localStorage.getItem('currentUser');
        if (raw) this.currentUser = JSON.parse(raw);
      } catch(e) {}
    }
    if (!this.currentUser) return Router.navigate('#/login');
    this._startSession(this.currentUser, role);
  },

  _startSession(player, forcedRole = null) {
    this.currentUser = player;

    // Regra de Duplo Acesso:
    // tipo = "jogador" -> Redireciona para dashboard do jogador
    // tipo = "gestor"  -> Redireciona para dashboard do gestor
    // tipo = "ambos"   -> Se ultimo_perfil != null -> Redireciona direto para ultimo_perfil
    //                     Se ultimo_perfil = null -> Exibe Tela de Seleção (#/selecionar-perfil)

    const isGestorOnly = (player.tipo === 'gestor');
    const isJogadorOnly = (player.tipo === 'jogador');

    let activeRole = 'jogador';

    if (forcedRole) {
      activeRole = forcedRole;
    } else if (isGestorOnly) {
      activeRole = 'gestor';
    } else if (isJogadorOnly) {
      activeRole = 'jogador';
    } else {
      // Duplo acesso (tipo = 'ambos' ou perfil compartilhado)
      const ultimoPerfil = localStorage.getItem('ultimo_perfil') || player.ultimo_perfil || null;
      if (ultimoPerfil && (ultimoPerfil === 'gestor' || ultimoPerfil === 'jogador')) {
        activeRole = ultimoPerfil;
      } else {
        // Exibir Tela de Seleção de Perfil!
        localStorage.setItem('currentUser', JSON.stringify(player));
        const expiryTime = Date.now() + (12 * 60 * 60 * 1000);
        localStorage.setItem('session_expiry', String(expiryTime));
        return Router.navigate('#/selecionar-perfil');
      }
    }

    this._selectedRole = activeRole;
    player.gestor = (activeRole === 'gestor');

    // Sincronizar ou simular grupo
    const groups = Api.getGroups();
    const myGroup = groups.find(g => String(g.gestor_id) === String(player.id)) || groups[0];
    this.currentGroup = myGroup || null;

    // Salvar no localStorage para manter a sessão no refresh
    localStorage.setItem('currentUser', JSON.stringify(player));
    if (this.currentGroup) {
      localStorage.setItem('currentGroup', JSON.stringify(this.currentGroup));
    } else {
      localStorage.removeItem('currentGroup');
    }

    // Expiração de 12 horas para a sessão
    const expiryTime = Date.now() + (12 * 60 * 60 * 1000); 
    localStorage.setItem('session_expiry', String(expiryTime));

    Utils.toast(`Acessando como ${activeRole === 'gestor' ? 'Gestor 🏆' : 'Jogador ⚽'}!`, 'success');

    if (activeRole === 'gestor') {
      Router.navigate('#/gestor/atletas');
    } else {
      Router.navigate('#/jogador/dashboard');
    }
  },

  checkSavedSession() {
    try {
      const token = localStorage.getItem('token');
      const playerRaw = localStorage.getItem('currentUser');
      const groupRaw = localStorage.getItem('currentGroup');
      const expiry = localStorage.getItem('session_expiry');

      if (!token || !playerRaw) {
        return false;
      }

      // Se a sessão expirou, desloga automaticamente
      if (expiry && Date.now() > parseInt(expiry)) {
        console.log('[Auth] Sessão expirou por tempo de inatividade.');
        this.logout();
        return false;
      }

      // Restaura dados da sessão em memória
      this.currentUser = JSON.parse(playerRaw);
      this.currentGroup = groupRaw ? JSON.parse(groupRaw) : null;
      
      const isGestor = (this.currentUser.tipo === 'gestor');
      this.currentUser.gestor = isGestor;
      this._selectedRole = isGestor ? 'gestor' : 'jogador';

      // Renova a expiração por mais 12 horas a cada interação/refresh do usuário (sessão deslizante)
      const newExpiry = Date.now() + (12 * 60 * 60 * 1000);
      localStorage.setItem('session_expiry', String(newExpiry));

      return true;
    } catch (e) {
      console.error('[Auth] Falha ao recuperar sessão do localStorage:', e);
      this.logout();
      return false;
    }
  },

  // --- Logout -------------------------------------------------------------
  logout() {
    this.currentUser  = null;
    this.currentGroup = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentGroup');
    localStorage.removeItem('session_expiry');
    Router.navigate('#/login');
  }
};

window.Auth = Auth;
window.App = window.App || {};
window.App.selectRole = function(role) { Auth.selectRole(role); };
