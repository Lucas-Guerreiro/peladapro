// ==========================================================================
// COMPONENTE MODAL: COMPLEMENTO CADASTRAL (complemento.js)
// ==========================================================================

window.ComplementoModal = {
  _currentRating: 0,
  _resolvePromise: null,

  async show() {
    return new Promise((resolve) => {
      this._resolvePromise = resolve;
      
      fetch('components/modals/complemento.html')
        .then(res => res.text())
        .then(html => {
          // Injetar no root do container de modais
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
    this._currentRating = 0;

    // Aplicar máscaras automáticas nos inputs
    const cpfInput = document.getElementById("comp-cpf");
    const whatsappInput = document.getElementById("comp-whatsapp");
    const saveBtn = document.getElementById("btn-save-complemento");

    if (cpfInput) {
      cpfInput.oninput = (e) => {
        e.target.value = Utils.maskCPF(e.target.value);
      };
    }

    if (whatsappInput) {
      whatsappInput.oninput = (e) => {
        e.target.value = Utils.maskPhone(e.target.value);
      };
    }

    if (saveBtn) {
      saveBtn.onclick = () => this.handleSave();
    }
  },

  setStars(n) {
    this._currentRating = n;
    const stars = document.querySelectorAll("#comp-stars-selector .comp-rating-star");
    stars.forEach((s, idx) => {
      s.style.color = idx < n ? "var(--warning)" : "#ccc";
    });
  },

  async handleSave() {
    const nome = document.getElementById("comp-name").value.trim();
    const dob = document.getElementById("comp-dob").value;
    const cpf = document.getElementById("comp-cpf").value.trim();
    const whatsapp = document.getElementById("comp-whatsapp").value.trim();
    const goleiro = document.getElementById("comp-is-gk").checked;

    if (!nome || !dob || !cpf || !whatsapp) {
      window.App.showToast("Por favor, preencha todos os campos obrigatórios.", "warning");
      return;
    }

    if (cpf.length < 14) {
      window.App.showToast("Por favor, informe um CPF válido.", "warning");
      return;
    }

    if (whatsapp.length < 14) {
      window.App.showToast("Por favor, informe um WhatsApp válido.", "warning");
      return;
    }

    try {
      window.App.showToast("Salvando informações...", "info");
      
      const res = await Api.atualizarPerfil({
        nome,
        data_nascimento: dob,
        cpf,
        whatsapp,
        goleiro,
        autoavaliacao: this._currentRating || 3
      });

      if (res.error) {
        window.App.showToast(res.error, "error");
        return;
      }

      window.App.showToast("Cadastro concluído com sucesso!", "success");

      // Atualizar dados de sessão locais
      const updatedUser = res.usuario;
      Auth.currentUser = updatedUser;

      // Sincronizar localmente na lista de jogadores do localStorage para o frontend legado
      const players = Api.getPlayers();
      const idx = players.findIndex(p => String(p.id) === String(updatedUser.id));
      if (idx !== -1) {
        players[idx] = { ...players[idx], ...updatedUser };
      } else {
        players.push(updatedUser);
      }
      Api.savePlayers(players);

      this.close();
      if (this._resolvePromise) this._resolvePromise(true);

    } catch (err) {
      console.error(err);
      window.App.showToast("Erro ao salvar o complemento cadastral.", "error");
    }
  },

  close() {
    const backdrop = document.getElementById("modal-complemento-backdrop");
    if (backdrop) {
      backdrop.remove();
    }
  }
};
