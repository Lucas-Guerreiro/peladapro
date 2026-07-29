// ==========================================================================
// COMPONENTE MODAL: CONFIRMAÇÃO DE E-MAIL OTP (otp.js)
// ==========================================================================

window.OtpModal = {
  _email: null,
  _senha: null, // Mantido apenas para permitir fluxo de reenvio simulado
  _resolvePromise: null,

  async show(email, senha) {
    return new Promise((resolve) => {
      this._email = email;
      this._senha = senha;
      this._resolvePromise = resolve;

      fetch('components/modals/otp.html')
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
    // Definir texto de e-mail alvo
    const emailEl = document.getElementById("otp-target-email");
    if (emailEl) emailEl.textContent = this._email;

    const inputs = document.querySelectorAll("#otp-inputs-container .otp-digit-input");
    const confirmBtn = document.getElementById("btn-confirm-otp");
    const resendBtn = document.getElementById("btn-resend-otp");
    const cancelBtn = document.getElementById("btn-cancel-otp");

    // Lógica para navegação automática dos 6 inputs OTP
    inputs.forEach((input, index) => {
      input.oninput = (e) => {
        // Permitir apenas números
        e.target.value = e.target.value.replace(/[^0-9]/g, '');

        if (e.target.value.length === 1 && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      };

      input.onkeydown = (e) => {
        if (e.key === "Backspace" && e.target.value.length === 0 && index > 0) {
          inputs[index - 1].focus();
        }
      };
    });

    if (confirmBtn) {
      confirmBtn.onclick = () => this.handleConfirm();
    }

    if (resendBtn) {
      resendBtn.onclick = () => this.handleResend();
    }

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.close();
        if (this._resolvePromise) this._resolvePromise(false);
      };
    }

    // Focar no primeiro input
    if (inputs[0]) inputs[0].focus();
  },

  async handleConfirm() {
    const inputs = document.querySelectorAll("#otp-inputs-container .otp-digit-input");
    let codigo = "";
    inputs.forEach(input => codigo += input.value.trim());

    if (codigo.length < 6) {
      window.App.showToast("Por favor, digite os 6 dígitos do código de confirmação.", "warning");
      return;
    }

    try {
      window.App.showToast("Confirmando e-mail...", "info");
      const res = await Api.verificarCodigo(this._email, codigo);

      if (res.error) {
        window.App.showToast(res.error, "error");
        return;
      }

      window.App.showToast("E-mail confirmado com sucesso!", "success");

      // Salva token e sincroniza dados do banco
      localStorage.setItem('token', res.token);
      await Auth._syncDataFromBackend(res.token);

      this.close();

      // Inicia sessão
      Auth._startSession(res.usuario);

      if (this._resolvePromise) this._resolvePromise(true);

    } catch (err) {
      console.error(err);
      window.App.showToast("Falha ao confirmar o e-mail.", "error");
    }
  },

  async handleResend() {
    try {
      window.App.showToast("Reenviando código...", "info");

      // Simula uma tentativa de login para re-gerar e reenviar o código OTP
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: this._email, senha: this._senha || 'senha123' })
      });

      const data = await res.json();
      if (res.ok && data.status === 'verificacao_pendente') {
        window.App.showToast("Novo código enviado por e-mail (verifique o console)!", "success");

        // Limpar inputs de código e focar no primeiro
        const inputs = document.querySelectorAll("#otp-inputs-container .otp-digit-input");
        inputs.forEach(i => i.value = "");
        if (inputs[0]) inputs[0].focus();
      } else {
        window.App.showToast(data.error || "Erro ao reenviar código.", "error");
      }
    } catch (err) {
      console.error(err);
      window.App.showToast("Falha na conexão ao reenviar código.", "error");
    }
  },

  close() {
    const backdrop = document.getElementById("modal-otp-backdrop");
    if (backdrop) {
      backdrop.remove();
    }
  }
};
