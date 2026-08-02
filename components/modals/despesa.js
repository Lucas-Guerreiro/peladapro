// ==========================================================================
// MODAL: REGISTRAR DESPESA (despesa.js)
// ==========================================================================

window.App.initModalDespesa = function() {
  document.getElementById("btn-close-expense-modal").onclick = window.App.closeModal;
  document.getElementById("btn-save-expense").onclick = handleSaveExpense;
};

async function handleSaveExpense() {
  const desc = document.getElementById("expense-description").value.trim();
  const val = parseFloat(document.getElementById("expense-value").value);

  if (!desc || isNaN(val) || val <= 0) {
    window.App.showToast("Preencha a descrição e um valor válido para a despesa.", "warning");
    return;
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
    window.App.showToast("Registrando despesa no banco remoto...", "info");
    const res = await window.Api.criarTransacaoManual(group.id, val, 'debito', desc);
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
    window.App.showToast("Erro ao conectar ao servidor para salvar a despesa.", "error");
  }
}
