// ==========================================================================
// js/core/auth.js — Autenticação e Sessão com Integração Real ao Backend
// PeladaPro · Fundacional
// ==========================================================================

const Auth = {
  currentUser: null,
  currentGroup: null,
  _selectedRole: 'jogador',  // 'jogador' | 'gestor'

  // --- Estado -------------------------------------------------------------
  isLoggedIn() {
    if (this.currentUser !== null) return true;
    return this.checkSavedSession();
  },

  setRole(role) {
    this._selectedRole = role;
    document.querySelectorAll('.login-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === role);
    });

    const userLabel = document.getElementById('login-user-label');
    const userInput = document.getElementById('login-user');
    if (userInput) {
      if (userLabel) userLabel.textContent = 'E-mail *';
      userInput.placeholder = 'Ex.: atleta@gmail.com';
    }
  },

  // --- Login Real (conecta ao Backend Node.js / Supabase) -----------------
  async login() {
    const userInput = document.getElementById('login-user');
    const passInput = document.getElementById('login-pass');

    if (!userInput || !passInput) return;

    const emailInput = userInput.value.trim().toLowerCase();
    const password = passInput.value ? passInput.value.trim() : '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailInput || !emailRegex.test(emailInput)) {
      Utils.toast('O campo de e-mail é obrigatório e deve conter um e-mail válido (ex: usuario@gmail.com).', 'warning');
      return;
    }

    if (!password) {
      Utils.toast('Por favor, informe sua senha.', 'warning');
      return;
    }

    try {
      Utils.toast('Autenticando...', 'info', 1000);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, cpf: emailInput, senha: password })
      });

      const data = await response.json();
      if (!response.ok) {
        Utils.toast(data.error || 'Credenciais inválidas.', 'error');
        return;
      }

      // Se a conta está pendente de aprovação do gestor
      if (data.status === 'aprovacao_pendente') {
        Utils.toast(data.message || 'Cadastro pendente de aprovação pelo gestor.', 'warning');
        Router.openModal('aviso_aprovacao', { nome: data.nome });
        return;
      }

      // Salva token JWT
      localStorage.setItem('token', data.token);

      // Sincroniza jogadores
      await this._syncDataFromBackend(data.token);

      // Inicia a sessão com o usuário retornado
      this._startSession(data.usuario);
    } catch (err) {
      console.error(err);
      Utils.toast('Erro ao conectar ao servidor backend.', 'error');
    }
  },

  // --- Solicitar Código de Recuperação de Senha ---------------------------
  async solicitarCodigo() {
    const emailInput = document.getElementById('recover-email');
    if (!emailInput) return;
    const email = emailInput.value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      Utils.toast('Informe um e-mail válido.', 'warning');
      return;
    }
    try {
      Utils.toast('Gerando código de recuperação...', 'info', 1000);
      const response = await fetch('/api/auth/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      const data = await response.json();
      if (!response.ok) {
        Utils.toast(data.error || 'Não foi possível gerar o código.', 'error');
        return;
      }
      // Exibe o código na tela (o gestor repassa ao atleta)
      const codigoBox = document.getElementById('recover-codigo-box');
      if (codigoBox) codigoBox.classList.remove('hidden');
      const codigoDisplay = document.getElementById('recover-codigo-display');
      if (codigoDisplay) codigoDisplay.textContent = data.codigo || 'XXXXXX';
      Utils.toast('Código gerado! Repasse ao atleta.', 'success');
    } catch (err) {
      console.error(err);
      Utils.toast('Erro ao conectar ao servidor.', 'error');
    }
  },

  // --- Redefinir Senha com Código ------------------------------------------
  async redefinirSenha() {
    const emailInput = document.getElementById('recover-email');
    const codigoInput = document.getElementById('recover-codigo');
    const newPassInput = document.getElementById('recover-new-pass');
    const confirmPassInput = document.getElementById('recover-confirm-pass');
    if (!emailInput || !codigoInput || !newPassInput || !confirmPassInput) return;
    const email = emailInput.value.trim().toLowerCase();
    const codigo = codigoInput.value.trim();
    const novaSenha = newPassInput.value ? newPassInput.value.trim() : '';
    const confirm = confirmPassInput.value ? confirmPassInput.value.trim() : '';
    if (!email || !codigo || codigo.length !== 6) {
      Utils.toast('Informe o e-mail e o código de 6 dígitos.', 'warning');
      return;
    }
    if (!novaSenha || novaSenha.length < 6) {
      Utils.toast('A nova senha deve ter pelo menos 6 caracteres.', 'warning');
      return;
    }
    if (novaSenha !== confirm) {
      Utils.toast('As senhas não conferem.', 'warning');
      return;
    }
    try {
      Utils.toast('Redefinindo senha...', 'info', 1000);
      const response = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, codigo: codigo, novaSenha: novaSenha })
      });
      const data = await response.json();
      if (!response.ok) {
        Utils.toast(data.error || 'Não foi possível redefinir a senha.', 'error');
        return;
      }
      Utils.toast('Senha redefinida com sucesso! Faça login.', 'success');
      // Volta para o formulário de login
      document.getElementById('auth-recover-form').classList.add('hidden');
      document.getElementById('auth-login-form').classList.remove('hidden');
      // Limpa os campos
      if (emailInput) emailInput.value = '';
      if (codigoInput) codigoInput.value = '';
      if (newPassInput) newPassInput.value = '';
      if (confirmPassInput) confirmPassInput.value = '';
    } catch (err) {
      console.error(err);
      Utils.toast('Erro ao conectar ao servidor.', 'error');
    }
  },

  // --- Cadastro Real (registra no Supabase) --------------------------------
  async register() {
    const nome = document.getElementById('register-name')?.value.trim();
    const email = document.getElementById('register-email')?.value.trim().toLowerCase();
    const password = document.getElementById('register-password')?.value;
    const confirmPassword = document.getElementById('register-confirm-password')?.value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nome) {
      Utils.toast('Informe seu Nome Completo.', 'warning');
      return;
    }

    if (!email || !emailRegex.test(email)) {
      Utils.toast('O campo de e-mail é obrigatório e deve ser um e-mail válido.', 'warning');
      return;
    }

    if (!password || !confirmPassword) {
      Utils.toast('Defina sua senha e confirmação.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      Utils.toast('As senhas digitadas não conferem.', 'warning');
      return;
    }

    try {
      Utils.toast('Criando sua conta...', 'info', 1000);

      const response = await fetch('/api/auth/registrar', {
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
      Router.openModal('aviso_aprovacao', { nome: nome });

    } catch (err) {
      console.error(err);
      Utils.toast('Erro ao conectar ao servidor para registro.', 'error');
    }
  },

  async solicitarCodigo() {
    const email = document.getElementById('recover-email').value.trim();
    if (!email) {
      alert('Informe seu e-mail cadastrado.');
      return;
    }
    try {
      const res = await fetch('/api/auth/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao gerar código. Tente novamente.');
        return;
      }
      // Mostra o box com código + nova senha
      document.getElementById('recover-codigo-box').classList.remove('hidden');
      // Mostra o código para o gestor repassar ao atleta
      alert('Código de recuperação: ' + data.codigo + '\n\nVálido por 15 minutos.\nRepasse este código ao atleta pelo WhatsApp.');
    } catch (e) {
      console.error('[SOLICITAR CODIGO] Erro:', e);
      alert('Erro ao solicitar código. Tente novamente.');
    }
  },

  async redefinirSenha() {
    const email = document.getElementById('recover-email').value.trim();
    const codigo = document.getElementById('recover-codigo').value.trim();
    const novaSenha = document.getElementById('recover-new-pass').value;
    const confirmPass = document.getElementById('recover-confirm-pass').value;

    if (!email || !codigo || !novaSenha) {
      alert('Preencha e-mail, código e nova senha.');
      return;
    }
    if (novaSenha !== confirmPass) {
      alert('As senhas não conferem.');
      return;
    }
    if (novaSenha.length < 6) {
      alert('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      const res = await fetch('/api/auth/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo, novaSenha })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao redefinir senha.');
        return;
      }
      alert(data.message || 'Senha redefinida com sucesso!');
      // Volta para o formulário de login
      document.getElementById('auth-recover-form').classList.add('hidden');
      document.getElementById('auth-login-form').classList.remove('hidden');
      document.getElementById('recover-codigo-box').classList.add('hidden');
    } catch (e) {
      console.error('[REDEFINIR SENHA] Erro:', e);
      alert('Erro ao redefinir senha. Tente novamente.');
    }
  },

  // --- Sincronizar dados do banco real para o localStorage local ----------
  async _syncDataFromBackend(token) {
    try {
      const res = await fetch('/api/usuarios', {
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

  // --- Acesso Rápido de Testes ---------------------------------------------
  async testAccess(role) {
    const r = role || this._selectedRole;
    const cpf = r === 'gestor' ? '111.222.333-44' : '222.333.444-55';
    this._selectedRole = r;

    try {
      Utils.toast('Autenticando acesso rápido...', 'info', 1000);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf, senha: 'senha123' })
      });

      const data = await response.json();
      if (!response.ok) {
        Utils.toast(data.error || 'Erro no acesso rápido.', 'error');
        return;
      }

      localStorage.setItem('token', data.token);
      await this._syncDataFromBackend(data.token);

      this._startSession(data.usuario);
    } catch (err) {
      console.error(err);
      Utils.toast('Erro ao conectar ao banco de dados.', 'error');
    }
  },

  hasDualRole() {
    if (!this.currentUser) return false;
    return this.currentUser.tipo === 'ambos' || this.currentUser.tipo === 'duplo';
  },

  toggleRole() {
    const current = this._selectedRole || 'jogador';
    const nextRole = current === 'gestor' ? 'jogador' : 'gestor';
    this.selectRole(nextRole);
  },

  selectRole(role) {
    this._selectedRole = role;
    if (this.currentUser) {
      this.currentUser.gestor = (role === 'gestor');
      localStorage.setItem('ultimo_perfil', role);
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      Utils.toast(`Perfil alterado para ${role === 'gestor' ? 'Gestor' : 'Jogador'}!`, 'info');

      if (role === 'gestor') {
        Router.navigate('#/gestor/atletas');
      } else {
        Router.navigate('#/jogador/dashboard');
      }
    }
  },

  // --- Inicializar Sessão -------------------------------------------------
  _startSession(player, forcedRole = null) {
    this.currentUser = player;

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
      const ultimoPerfil = localStorage.getItem('ultimo_perfil') || player.ultimo_perfil || null;
      if (ultimoPerfil && (ultimoPerfil === 'gestor' || ultimoPerfil === 'jogador')) {
        activeRole = ultimoPerfil;
      } else {
        localStorage.setItem('currentUser', JSON.stringify(player));
        const expiryTime = Date.now() + (12 * 60 * 60 * 1000);
        localStorage.setItem('session_expiry', String(expiryTime));
        return Router.navigate('#/selecionar-perfil');
      }
    }

    this._selectedRole = activeRole;
    player.gestor = (activeRole === 'gestor');

    const groups = Api.getGroups();
    const myGroup = groups.find(g => String(g.gestor_id) === String(player.id)) || groups[0];
    this.currentGroup = myGroup || null;

    localStorage.setItem('currentUser', JSON.stringify(player));
    if (this.currentGroup) {
      localStorage.setItem('currentGroup', JSON.stringify(this.currentGroup));
    } else {
      localStorage.removeItem('currentGroup');
    }

    // Expiração de 30 dias para a sessão no PWA
    const expiryTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
    localStorage.setItem('session_expiry', String(expiryTime));

    Utils.toast(`Acessando como ${activeRole === 'gestor' ? 'Gestor 🏆' : 'Jogador ⚽'}!`, 'success');

    if (activeRole === 'gestor') {
      Router.navigate('#/gestor/atletas');
    } else {
      Router.navigate('#/jogador/dashboard');
    }

    // Sincroniza subscrição de notificação push com o novo token de sessão
    if (window.PWAPush && window.PWAPush.subscribeUserSilently) {
      window.PWAPush.subscribeUserSilently();
    }

    // Verifica se o e-mail cadastrado é temporário (@teste.com)
    this.checkUserEmailTest();
  },

  // --- Verificar se o E-mail é temporário (@teste.com) ------------------
  checkUserEmailTest() {
    const user = this.currentUser;
    if (!user || !user.email) return false;
    const lowerEmail = String(user.email).toLowerCase().trim();
    if (lowerEmail.includes('@teste.com') || lowerEmail.includes('@teste.')) {
      setTimeout(() => {
        Router.openModal('update_email');
      }, 400);
      return true;
    }
    return false;
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

      if (expiry && Date.now() > parseInt(expiry)) {
        console.log('[Auth] Sessão de 30 dias expirou.');
        this.logout();
        return false;
      }

      this.currentUser = JSON.parse(playerRaw);
      this.currentGroup = groupRaw ? JSON.parse(groupRaw) : null;

      const savedRole = localStorage.getItem('ultimo_perfil');
      if (savedRole === 'gestor' || savedRole === 'jogador') {
        this._selectedRole = savedRole;
        this.currentUser.gestor = (savedRole === 'gestor');
      } else {
        const isGestor = (this.currentUser.tipo === 'gestor');
        this.currentUser.gestor = isGestor;
        this._selectedRole = isGestor ? 'gestor' : 'jogador';
      }

      // Renova a expiração por mais 30 dias a cada interação (sessão deslizante)
      const newExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
      localStorage.setItem('session_expiry', String(newExpiry));

      // Valida o token de 30 dias junto ao backend (/api/auth/verify)
      this.verifySessionWithServer();

      return true;
    } catch (e) {
      console.error('[Auth] Falha ao recuperar sessão do localStorage:', e);
      this.logout();
      return false;
    }
  },

  async verifySessionWithServer() {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      const res = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.valid && data.usuario) {
          this.currentUser = { ...this.currentUser, ...data.usuario, saldo: parseFloat(data.usuario.saldo || 0) };
          localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
          this.checkUserEmailTest();
          return true;
        }
      }

      if (res.status === 401) {
        console.warn('[Auth] Token rejeitado pelo servidor (401). Efetuando logout.');
        this.logout();
        return false;
      }
    } catch (e) {
      console.warn('[Auth] Erro ao verificar token no servidor:', e);
    }
    return true;
  },

  async refreshCurrentUser() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/usuarios/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const user = await res.json();
        if (user && user.id) {
          this.currentUser = { ...this.currentUser, ...user, saldo: parseFloat(user.saldo || 0) };
          localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
          this.checkUserEmailTest();
        }
      }
    } catch (e) {
      console.warn('[Auth] Erro ao atualizar perfil/saldo do usuário:', e);
    }
  },

  // --- Logout -------------------------------------------------------------
  logout() {
    this.currentUser = null;
    this.currentGroup = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentGroup');
    localStorage.removeItem('session_expiry');
    Router.navigate('#/login');
  }
};

// Submissão da atualização obrigatória de e-mail
window.App = window.App || {};
window.App.submitUpdatedEmail = async function () {
  const input = document.getElementById('input-new-real-email');
  if (!input) {
    console.error('[submitUpdatedEmail] Elemento #input-new-real-email não encontrado.');
    return;
  }
  const newEmail = input.value.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!newEmail || !emailRegex.test(newEmail)) {
    Utils.toast('Por favor, informe um e-mail válido (ex: seuemail@gmail.com).', 'warning');
    return;
  }

  if (newEmail.includes('@teste.com') || newEmail.includes('@teste.')) {
    Utils.toast('O novo e-mail não pode conter @teste.com. Digite seu e-mail verdadeiro.', 'error');
    return;
  }

  try {
    Utils.toast('Atualizando seu e-mail no servidor...', 'info');
    const token = localStorage.getItem('token');
    const res = await fetch('/api/usuarios/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email: newEmail })
    });

    const data = await res.json();
    if (!res.ok) {
      Utils.toast(data.error || 'Erro ao atualizar e-mail.', 'error');
      return;
    }

    if (Auth.currentUser) {
      Auth.currentUser.email = newEmail;
      localStorage.setItem('currentUser', JSON.stringify(Auth.currentUser));
    }

    Utils.toast('E-mail atualizado com sucesso! 🎉', 'success');

    // Fecha e remove o modal
    const backdrop = document.getElementById('modal-update-email-backdrop') || document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
    const root = document.getElementById('modal-container-root');
    if (root) root.innerHTML = '';
  } catch (err) {
    console.error(err);
    Utils.toast('Erro de conexão ao atualizar e-mail.', 'error');
  }
};

window.Auth = Auth;
window.App.selectRole = function (role) { Auth.selectRole(role); };
