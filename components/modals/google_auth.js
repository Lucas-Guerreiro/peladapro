// ==========================================================================
// COMPONENTE MODAL: SIMULAÇÃO DE GOOGLE AUTHENTICATION (google_auth.js)
// ==========================================================================

window.GoogleAuthModal = {
  _resolvePromise: null,

  async show() {
    return new Promise((resolve) => {
      this._resolvePromise = resolve;

      fetch('components/modals/google_auth.html')
        .then(res => res.text())
        .then(html => {
          let root = document.getElementById("modal-container-root");
          if (!root) {
            root = document.createElement("div");
            root.id = "modal-container-root";
            document.body.appendChild(root);
          }
          root.innerHTML = html;

          this.init();
        });
    });
  },

  init() {
    const emailInput = document.getElementById("google-email-input");
    const cancelBtn = document.getElementById("btn-google-cancel");
    const nextBtn = document.getElementById("btn-google-next");

    if (emailInput) {
      emailInput.focus();
    }

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.close();
        if (this._resolvePromise) this._resolvePromise(null);
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => this.handleNext();
    }
  },

  async handleNext() {
    const emailInput = document.getElementById("google-email-input");
    const email = emailInput.value.trim();

    if (!email) {
      window.App.showToast("Digite seu e-mail do Google.", "warning");
      return;
    }

    // Validar formato de e-mail básico
    if (!email.includes("@") || !email.includes(".")) {
      window.App.showToast("Insira um e-mail do Google válido.", "error");
      return;
    }

    const mockPassword = "google_oauth_secure_password";

    try {
      window.App.showToast("Conectando ao Google Accounts...", "info");

      // 1. Tenta registrar o usuário com e-mail do Google
      const regResponse = await fetch('/api/auth/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha: mockPassword })
      });

      const regData = await regResponse.json();

      if (!regResponse.ok) {
        // Se já estiver cadastrado, tenta fazer login para forçar a geração de código ou autenticar
        const logResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpf: email, senha: mockPassword })
        });

        const logData = await logResponse.json();

        if (logData.status === 'verificacao_pendente') {
          // Se já existe e a verificação de segurança do e-mail do Google está pendente
          this.close();
          Router._loadScript('components/modals/otp.js', () => {
            window.OtpModal.show(email, mockPassword);
          });
          return;
        }

        // Se já estiver cadastrado e verificado com a senha do Google
        if (regResponse.status === 400 && regData.error.includes("já está cadastrado")) {
          // Faz login e entra direto!
          const logConfirmRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf: email, senha: mockPassword })
          });
          const confirmData = await logConfirmRes.json();
          if (logConfirmRes.ok) {
            localStorage.setItem('token', confirmData.token);
            await Auth._syncDataFromBackend(confirmData.token);
            this.close();
            Auth._startSession(confirmData.usuario);
            return;
          }
        }

        window.App.showToast(regData.error || "Erro ao conectar com Google Accounts.", "error");
        return;
      }

      // Se o cadastro simplificado com Google deu sucesso, ele está pendente de verificação (OTP)
      window.App.showToast("Google Accounts: Verificação de segurança necessária!", "warning");
      this.close();

      // Abrir o modal de digitação de código para o Gmail digitado
      Router._loadScript('components/modals/otp.js', () => {
        window.OtpModal.show(email, mockPassword);
      });

    } catch (err) {
      console.error(err);
      window.App.showToast("Falha na autenticação do Google Accounts.", "error");
    }
  },

  close() {
    const backdrop = document.getElementById("modal-google-backdrop");
    if (backdrop) {
      backdrop.remove();
    }
  }
};
