// ==========================================================================
// MODAL: REGISTRAR DESPESA (despesa.js)
// ==========================================================================

window.App.initModalDespesa = async function() {
  const btnClose = document.getElementById("btn-close-expense-modal");
  if (btnClose) btnClose.onclick = window.App.closeModal;

  const btnSave = document.getElementById("btn-save-expense");
  if (btnSave) btnSave.onclick = handleSaveExpense;

  const selectStatus = document.getElementById("expense-status-select");
  const partialContainer = document.getElementById("expense-partial-container");
  if (selectStatus && partialContainer) {
    selectStatus.onchange = function() {
      if (selectStatus.value === 'parcial') {
        partialContainer.style.display = 'block';
      } else {
        partialContainer.style.display = 'none';
      }
    };
  }

  // Carrega categorias customizadas salvas previamente para o grupo
  const selectCat = document.getElementById("expense-category");
  const customCatContainer = document.getElementById("expense-category-custom-container");
  const customCatInput = document.getElementById("expense-category-custom-input");

  const group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  const groupId = group ? group.id : "default";

  if (selectCat) {
    // Restaura categorias customizadas do LocalStorage
    let customCats = [];
    try {
      customCats = JSON.parse(localStorage.getItem(`custom_expense_categories_${groupId}`)) || [];
    } catch (e) {}

    // Injeta opções customizadas antes de "__nova_categoria__" se já não existirem
    customCats.forEach(cName => {
      if (!Array.from(selectCat.options).some(opt => opt.value.toLowerCase() === cName.toLowerCase())) {
        const opt = document.createElement("option");
        opt.value = cName;
        opt.textContent = `✨ ${cName}`;
        selectCat.insertBefore(opt, selectCat.options[selectCat.options.length - 1]);
      }
    });

    selectCat.onchange = function() {
      if (selectCat.value === '__nova_categoria__') {
        if (customCatContainer) customCatContainer.style.display = 'block';
        if (customCatInput) customCatInput.focus();
      } else {
        if (customCatContainer) customCatContainer.style.display = 'none';
      }
    };
  }

  // Carrega opções de peladas para vínculo opcional
  const selectPelada = document.getElementById("expense-pelada-select");
  if (selectPelada) {
    selectPelada.innerHTML = `<option value="">Nenhuma (Despesa Geral)</option>`;
    if (group && group.id && window.Api && window.Api.listarDatasDoGrupo) {
      try {
        const peladas = await window.Api.listarDatasDoGrupo(group.id);
        if (Array.isArray(peladas) && peladas.length > 0) {
          peladas.forEach(p => {
            const rawDate = p.data ? String(p.data).split("T")[0] : "";
            const dataFmt = window.Utils ? window.Utils.formatDate(rawDate || p.data) : (rawDate || "Data");
            const opt = document.createElement("option");
            opt.value = dataFmt;
            opt.textContent = `📅 Pelada ${dataFmt} (${p.horario || ""})`;
            selectPelada.appendChild(opt);
          });
        }
      } catch (e) {
        console.warn("[ModalDespesa] Erro ao carregar peladas:", e);
      }
    }
  }
};

async function handleSaveExpense() {
  const val = parseFloat(document.getElementById("expense-value").value);
  const selectCat = document.getElementById("expense-category");
  const customInput = document.getElementById("expense-category-custom-input");

  let cat = selectCat ? selectCat.value : "Outros";

  // Se o gestor escolheu a opção de digitar nova categoria
  if (cat === '__nova_categoria__' || (customInput && customInput.value.trim() && selectCat && selectCat.value === '__nova_categoria__')) {
    const novaCatDigitada = customInput ? customInput.value.trim() : "";
    if (!novaCatDigitada) {
      window.App.showToast("Por favor, digite o nome da nova categoria de despesa.", "warning");
      if (customInput) customInput.focus();
      return;
    }
    cat = novaCatDigitada;

    // Salva a nova categoria no localStorage do grupo para reuso futuro
    let group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    const groupId = group ? group.id : "default";
    try {
      let customCats = JSON.parse(localStorage.getItem(`custom_expense_categories_${groupId}`)) || [];
      if (!customCats.some(c => c.toLowerCase() === cat.toLowerCase())) {
        customCats.push(cat);
        localStorage.setItem(`custom_expense_categories_${groupId}`, JSON.stringify(customCats));
      }
    } catch (e) {}
  }

  const desc = document.getElementById("expense-description").value.trim();
  const peladaVinculada = document.getElementById("expense-pelada-select") ? document.getElementById("expense-pelada-select").value : "";
  const statusPayment = document.getElementById("expense-status-select") ? document.getElementById("expense-status-select").value : "efetivado";

  if (isNaN(val) || val <= 0 || !desc) {
    window.App.showToast("Informe o valor e a descrição da despesa.", "warning");
    return;
  }

  // Formata a descrição no padrão: "[categoria] - [descrição]"
  let descricaoFinal = `[${cat}] - ${desc}`;
  if (peladaVinculada) {
    descricaoFinal += ` (Pelada ${peladaVinculada})`;
  }
  if (statusPayment === 'pendente') {
    descricaoFinal += ` [NÃO EFETIVADO]`;
  } else if (statusPayment === 'parcial') {
    const valPagoInput = document.getElementById("expense-paid-value");
    let valPago = parseFloat(valPagoInput ? valPagoInput.value : 0);
    if (isNaN(valPago) || valPago < 0) valPago = 0;
    if (valPago > val) valPago = val;
    descricaoFinal += ` [PAGO:${valPago.toFixed(2)}/${val.toFixed(2)}]`;
  }

  let group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  if (!group || !group.id) {
    try {
      group = JSON.parse(localStorage.getItem("currentGroup"));
    } catch (e) {}
  }

  if (!group || !group.id) {
    window.App.showToast("Grupo de referência não encontrado.", "error");
    return;
  }

  try {
    window.App.showToast("Registrando despesa no caixa...", "info");
    const res = await window.Api.criarTransacaoManual(group.id, val, 'debito', descricaoFinal);
    if (res.error) {
      window.App.showToast(res.error, "error");
      return;
    }
    window.App.showToast("Despesa registrada com sucesso!", "success");
    
    window.App.closeModal();
    if (window.App.renderFinanceiroData) {
      window.App.renderFinanceiroData();
    }
  } catch (err) {
    console.error('[handleSaveExpense]', err);
    window.App.showToast("Erro ao salvar a despesa.", "error");
  }
}
