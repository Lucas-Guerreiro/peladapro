// ==========================================================================
// MODAL: CRIAR E CONFIGURAR PELADA (criar_pelada.js)
// ==========================================================================

window.App.initModalCriar_pelada = function(data) {
  const nomeInicial = (data && data.nome) ? data.nome : '';
  const nameInput = document.getElementById("create-pelada-name");
  if (nameInput) nameInput.value = nomeInicial;

  // Ligar eventos de fechamento
  document.getElementById("btn-close-criar-pelada").onclick = () => window.App.closeModal();
  document.getElementById("btn-cancel-criar-pelada").onclick = () => window.App.closeModal();

  // Controladores de Steppers locais
  function bindStepper(type, min, max) {
    const valEl = document.getElementById(`create-pelada-${type}-val`);
    if (!valEl) return;
    const btnMinus = document.getElementById(`btn-create-${type}-minus`);
    const btnPlus  = document.getElementById(`btn-create-${type}-plus`);
    if (btnMinus) btnMinus.onclick = () => {
      let v = parseInt(valEl.textContent);
      if (v > min) valEl.textContent = v - 1;
    };
    if (btnPlus) btnPlus.onclick = () => {
      let v = parseInt(valEl.textContent);
      if (v < max) valEl.textContent = v + 1;
    };
  }

  bindStepper("wins", 2, 5);
  bindStepper("players", 4, 11);
  bindStepper("teams", 2, 10);

  // Ligar evento de criação
  const btnSubmit = document.getElementById("btn-submit-criar-pelada");
  if (btnSubmit) {
    btnSubmit.onclick = async function() {
      const nome     = document.getElementById("create-pelada-name").value.trim();
      const tie      = document.getElementById("create-pelada-tie").value;
      const wins     = parseInt(document.getElementById("create-pelada-wins-val").textContent);
      const exitRule = document.getElementById("create-pelada-exit-rule").value;
      const players  = parseInt(document.getElementById("create-pelada-players-val").textContent);
      const teams    = parseInt(document.getElementById("create-pelada-teams-val").textContent);

      if (!nome) {
        window.App.showToast("Informe o nome da pelada.", "warning");
        return;
      }

      // Desabilitar botão para evitar duplo clique
      btnSubmit.disabled = true;
      btnSubmit.textContent = "Criando...";

      try {
        window.App.showToast("Criando pelada...", "info");
        const res = await Api.criarGrupo(nome, {
          criterio_empate:  tie,
          vitorias_para_sair: wins,
          regra_saida:      exitRule,
          jogadores_por_time: players,
          quantidade_times: teams,
          valor_convocacao: 20.00
        });

        if (res.error) {
          window.App.showToast(res.error, "error");
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Criar Pelada e Salvar Regras";
          return;
        }

        // Atualizar grupo ativo globalmente
        if (res.grupo) {
          window.App.currentGroup = Object.assign({}, res.grupo, {
            criterio_empate:    tie,
            vitorias_para_sair: wins,
            regra_saida:        exitRule,
            jogadores_por_time: players,
            quantidade_times:   teams,
            valor_convocacao:   20.00
          });
        }

        window.App.showToast("Pelada criada com sucesso!", "success");
        window.App.closeModal();

        // Limpar o input de nome no painel
        const newGroupNameEl = document.getElementById("new-group-name");
        if (newGroupNameEl) newGroupNameEl.value = "";

        // Disparar evento customizado para o config.js recarregar grupos e datas
        document.dispatchEvent(new CustomEvent("pelada:created", { detail: res.grupo }));

      } catch (err) {
        console.error("[criar_pelada]", err);
        window.App.showToast("Erro ao criar pelada.", "error");
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Criar Pelada e Salvar Regras";
      }
    };
  }

  // Inicializar Feather Icons
  if (window.feather) feather.replace();
};
