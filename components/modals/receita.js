// ==========================================================================
// MODAL: REGISTRAR RECEITA / INJETAR VERBA (receita.js)
// ==========================================================================

window.App.initModalReceita = function() {
  const btnClose = document.getElementById("btn-close-income-modal");
  if (btnClose) btnClose.onclick = window.App.closeModal;

  const btnSave = document.getElementById("btn-save-income");
  if (btnSave) btnSave.onclick = handleSaveIncome;
};

async function handleSaveIncome() {
  const motivo = document.getElementById("income-description").value.trim();
  const val = parseFloat(document.getElementById("income-value").value);
  const categoria = document.getElementById("income-category") ? document.getElementById("income-category").value : "Aporte";

  if (!motivo || isNaN(val) || val <= 0) {
    window.App.showToast("Informe o valor e o motivo da entrada de verba.", "warning");
    return;
  }

  const descricaoFinal = `Verba injetada - ${motivo}`;

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
