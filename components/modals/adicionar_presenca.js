// ==========================================================================
// MODAL: ADICIONAR PRESENÇA (adicionar_presenca.js)
// Permite adicionar atletas cadastrados ou novos convidados diretamente
// ==========================================================================

window.App.initModalAdicionar_presenca = function (data = {}) {
  const peladaId = data.peladaId;
  if (!peladaId) {
    window.App.showToast("Erro: ID da pelada não fornecido.", "error");
    window.App.closeModal();
    return;
  }

  // --- Elementos do DOM ---
  const tabRegistered = document.getElementById("tab-add-registered");
  const tabGuest = document.getElementById("tab-add-guest");
  const contentRegistered = document.getElementById("content-add-registered");
  const contentGuest = document.getElementById("content-add-guest");
  const selectAthlete = document.getElementById("select-add-athlete");
  
  const inputGuestName = document.getElementById("input-guest-name");
  const checkGuestGk = document.getElementById("check-guest-gk");
  const starSelector = document.getElementById("guest-stars-selector");
  const stars = document.querySelectorAll("#guest-stars-selector .guest-star");

  const btnSubmit = document.getElementById("btn-submit-presence");

  let activeTab = "registered"; // "registered" | "guest"

  // --- Controle dos Meios de Pagamento ---
  const radioSaldo = document.getElementById("radio-pay-saldo");
  const radioPix = document.getElementById("radio-pay-pix");
  const labelSaldo = document.getElementById("label-pay-saldo");
  const labelPix = document.getElementById("label-pay-pix");

  function updatePaymentUI() {
    if (!radioSaldo || !radioPix || !labelSaldo || !labelPix) return;
    
    if (radioSaldo.checked) {
      labelSaldo.style.border = "1.5px solid var(--primary)";
      labelSaldo.style.background = "rgba(2, 132, 199, 0.04)";
      labelSaldo.style.color = "var(--primary)";
      
      labelPix.style.border = "1.5px solid var(--border-color)";
      labelPix.style.background = "#FFFFFF";
      labelPix.style.color = "var(--text-body)";
    } else {
      labelPix.style.border = "1.5px solid var(--primary)";
      labelPix.style.background = "rgba(2, 132, 199, 0.04)";
      labelPix.style.color = "var(--primary)";
      
      labelSaldo.style.border = "1.5px solid var(--border-color)";
      labelSaldo.style.background = "#FFFFFF";
      labelSaldo.style.color = "var(--text-body)";
    }
  }

  if (radioSaldo && radioPix) {
    radioSaldo.onchange = updatePaymentUI;
    radioPix.onchange = updatePaymentUI;
  }

  // --- Controle das Abas ---
  if (tabRegistered && tabGuest && contentRegistered && contentGuest) {
    tabRegistered.onclick = () => {
      activeTab = "registered";
      tabRegistered.classList.add("active");
      tabGuest.classList.remove("active");
      contentRegistered.style.display = "block";
      contentGuest.style.display = "none";
    };

    tabGuest.onclick = () => {
      activeTab = "guest";
      tabGuest.classList.add("active");
      tabRegistered.classList.remove("active");
      contentGuest.style.display = "block";
      contentRegistered.style.display = "none";
    };
  }

  // --- Seletor de Estrelas Interativo ---
  if (stars && starSelector) {
    stars.forEach(star => {
      star.onclick = () => {
        const val = parseInt(star.getAttribute("data-value"));
        starSelector.dataset.value = val;
        stars.forEach((s, idx) => {
          s.style.color = idx < val ? "var(--warning)" : "#ccc";
        });
      };
    });
  }

  // --- Carregar Atletas do Banco ---
  async function loadAthletes() {
    if (!selectAthlete) return;
    selectAthlete.innerHTML = "<option>Carregando atletas...</option>";

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/usuarios", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        selectAthlete.innerHTML = "<option value=''>Erro ao carregar atletas</option>";
        return;
      }

      const allAthletes = await res.json();

      // Puxa a lista atual de convocados confirmados desta pelada
      const convocadosRes = await fetch(`/api/convocacoes/pelada/${peladaId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      let presentIds = [];
      if (convocadosRes.ok) {
        const convocados = await convocadosRes.json();
        // Atletas que já estão confirmados e presentes
        presentIds = convocados.filter(c => c.status === "confirmado").map(c => String(c.id));
      }

      // Filtra os atletas que não sejam gestores puros e que não estejam na lista de presentes
      const availableAthletes = allAthletes.filter(athlete => {
        const isPlayer = athlete.tipo === "jogador" || athlete.tipo === "ambos";
        const isAlreadyPresent = presentIds.includes(String(athlete.id));
        return isPlayer && !isAlreadyPresent;
      });

      selectAthlete.innerHTML = "";

      if (availableAthletes.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Todos os atletas já estão presentes";
        selectAthlete.appendChild(opt);
        selectAthlete.disabled = true;
      } else {
        selectAthlete.disabled = false;
        
        // Option default em branco
        const defOpt = document.createElement("option");
        defOpt.value = "";
        defOpt.textContent = " Selecione um atleta... ";
        selectAthlete.appendChild(defOpt);

        availableAthletes.forEach(athlete => {
          const opt = document.createElement("option");
          opt.value = athlete.id;
          opt.textContent = athlete.apelido
            ? `${athlete.nome} (${athlete.apelido})`
            : athlete.nome;
          selectAthlete.appendChild(opt);
        });
      }
    } catch (err) {
      console.error("[ModalAdicionarPresenca] Erro ao carregar atletas:", err);
      selectAthlete.innerHTML = "<option value=''>Falha de conexão com servidor</option>";
    }
  }

  loadAthletes();

  // --- Submeter Cadastro de Presença ---
  if (btnSubmit) {
    btnSubmit.onclick = async () => {
      btnSubmit.disabled = true;
      const originalText = btnSubmit.innerHTML;
      btnSubmit.innerHTML = "Adicionando...";

      try {
        const token = localStorage.getItem("token");
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || "saldo";
        let bodyPayload = {
          pelada_id: parseInt(peladaId),
          forma_pagamento: paymentMethod
        };

        if (activeTab === "registered") {
          const usuarioId = selectAthlete ? selectAthlete.value : "";
          if (!usuarioId) {
            window.App.showToast("Selecione um atleta da lista.", "warning");
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
            return;
          }
          bodyPayload.usuario_id = parseInt(usuarioId);
        } else {
          const nomeConvidado = inputGuestName ? inputGuestName.value.trim() : "";
          if (!nomeConvidado) {
            window.App.showToast("Informe o nome do convidado.", "warning");
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
            return;
          }
          const rating = starSelector ? parseInt(starSelector.dataset.value) : 3;

          bodyPayload.convidado = {
            nome: nomeConvidado,
            goleiro: !!(checkGuestGk && checkGuestGk.checked),
            autoavaliacao: rating
          };
        }

        const response = await fetch("/api/convocacoes/adicionar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(bodyPayload)
        });

        const resData = await response.json();
        if (!response.ok) {
          window.App.showToast(resData.error || "Erro ao adicionar jogador.", "error");
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = originalText;
          return;
        }

        window.App.showToast("Jogador adicionado com sucesso! ⚽", "success");
        window.App.closeModal();

        // Força a re-renderização da lista de presença na tela do gestor
        // A função reside no escopo global ou de window.App
        if (window.App.updateCheckinPlayersList) {
          await window.App.updateCheckinPlayersList(peladaId);
        } else {
          // Fallback se estivermos em outra tela
          window.location.reload();
        }

      } catch (err) {
        console.error("[ModalAdicionarPresenca] Erro ao salvar:", err);
        window.App.showToast("Erro ao conectar no servidor.", "error");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
      }
    };
  }
};
