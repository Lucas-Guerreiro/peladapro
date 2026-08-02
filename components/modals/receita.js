// ==========================================================================
// MODAL: REGISTRAR RECEITA / VERBA (receita.js)
// ==========================================================================

window.App.initModalReceita = function() {
  const btnClose = document.getElementById("btn-close-income-modal");
  if (btnClose) btnClose.onclick = window.App.closeModal;

  const btnSave = document.getElementById("btn-save-income");
  if (btnSave) btnSave.onclick = handleSaveIncome;
};

async function handleSaveIncome() {
  const desc = document.getElementById("income-description").value.trim();
  const val = parseFloat(document.getElementById("income-value").value);

  if (!desc || isNaN(val) || val <= 0) {
    window.App.showToast("Preencha a descrição e um valor válido para a entrada.", "warning");
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
    window.App.showToast("Registrando verba no banco remoto...", "info");
    const res = await window.Api.criarTransacaoManual(group.id, val, 'credito', desc);
    if (res.error) {
      window.App.showToast(res.error, "error");
      return;
    }
    window.App.showToast("Verba/Receita registrada no caixa com sucesso!", "success");
    
    window.App.closeModal();
    if (window.App.renderFinanceiroData) {
      window.App.renderFinanceiroData();
    }
  } catch (err) {
    console.error('[handleSaveIncome]', err);
    window.App.showToast("Erro ao conectar ao servidor para salvar a receita.", "error");
  }
}
