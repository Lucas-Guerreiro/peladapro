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
    return this.currentUser !== null;
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
    // Redireciona o navegador para o provedor de autenticação Google configurado no Supabase
    window.location.href = 'https://xgsdaavryzhqxkwsonkk.supabase.co/auth/v1/authorize?provider=google&redirect_to=http://localhost:8082/';
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

  _startSession(player) {
    this.currentUser = player;

    // Roteamento baseado estritamente no tipo de usuário do banco de dados (Supabase)
    const isGestor = (player.tipo === 'gestor');
    player.gestor = isGestor;
    this._selectedRole = isGestor ? 'gestor' : 'jogador';

    // Sincronizar ou simular grupo
    const groups = Api.getGroups();
    const myGroup = groups.find(g => String(g.gestor_id) === String(player.id)) || groups[0];
    this.currentGroup = myGroup || null;

    Utils.toast(`Bem-vindo, ${player.nome || player.email}! 🏆`, 'success');

    if (isGestor) {
      Router.navigate('#/gestor/atletas');
    } else {
      Router.navigate('#/jogador/dashboard');
    }
  },

  // --- Logout -------------------------------------------------------------
  logout() {
    this.currentUser  = null;
    this.currentGroup = null;
    localStorage.removeItem('token');
    Router.navigate('#/login');
  }
};

window.Auth = Auth;
