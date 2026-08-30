// ==========================================================================
// MODAL: REGISTRAR RECEITA / INJETAR VERBA (receita.js)
// ==========================================================================

window.App.initModalReceita = async function() {
  const btnClose = document.getElementById("btn-close-income-modal");
  if (btnClose) btnClose.onclick = window.App.closeModal;

  const btnSave = document.getElementById("btn-save-income");
  if (btnSave) btnSave.onclick = handleSaveIncome;

  const selectStatus = document.getElementById("income-status-select");
  const partialContainer = document.getElementById("income-partial-container");
  if (selectStatus && partialContainer) {
    selectStatus.onchange = function() {
      if (selectStatus.value === 'parcial') {
        partialContainer.style.display = 'block';
      } else {
        partialContainer.style.display = 'none';
      }
    };
  }

  // Carrega opções de peladas para vínculo opcional
  const selectPelada = document.getElementById("income-pelada-select");
  if (selectPelada) {
    selectPelada.innerHTML = `<option value="">Nenhuma (Entrada Geral)</option>`;
    const group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
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
        console.warn("[ModalReceita] Erro ao carregar peladas:", e);
      }
    }
  }
};

async function handleSaveIncome() {
  const motivo = document.getElementById("income-description").value.trim();
  const val = parseFloat(document.getElementById("income-value").value);
  const categoria = document.getElementById("income-category") ? document.getElementById("income-category").value : "Aporte";
  const peladaVinculada = document.getElementById("income-pelada-select") ? document.getElementById("income-pelada-select").value : "";
  const status = document.getElementById("income-status-select") ? document.getElementById("income-status-select").value : "efetivado";
  const paidValInput = document.getElementById("income-paid-value");

  if (!motivo || isNaN(val) || val <= 0) {
    window.App.showToast("Informe o valor e o motivo da entrada de verba.", "warning");
    return;
  }

  let descricaoFinal = `Verba injetada - ${motivo}`;
  if (peladaVinculada) {
    descricaoFinal += ` (Pelada ${peladaVinculada})`;
  }

  if (status === "pendente") {
    descricaoFinal += ` [NÃO EFETIVADO]`;
  } else if (status === "parcial") {
    let paidVal = parseFloat(paidValInput ? paidValInput.value : 0);
    if (isNaN(paidVal) || paidVal < 0) paidVal = 0;
    if (paidVal > val) paidVal = val;
    descricaoFinal += ` [PAGO:${paidVal.toFixed(2)}/${val.toFixed(2)}]`;
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
    window.App.showToast("Injetando verba no caixa...", "info");
    const res = await window.Api.criarTransacaoManual(group.id, val, 'credito', descricaoFinal);
    if (res.error) {
      window.App.showToast(res.error, "error");
      return;
    }
    window.App.showToast("Verba injetada no caixa com sucesso!", "success");
    
    window.App.closeModal();
    if (window.App.renderFinanceiroData) {
      window.App.renderFinanceiroData();
    }
  } catch (err) {
    console.error('[handleSaveIncome]', err);
    window.App.showToast("Erro ao salvar entrada de verba.", "error");
  }
}
