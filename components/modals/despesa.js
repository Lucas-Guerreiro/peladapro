// ==========================================================================
// MODAL: REGISTRAR DESPESA (despesa.js)
// ==========================================================================

window.App.initModalDespesa = function() {
  document.getElementById("btn-close-expense-modal").onclick = window.App.closeModal;
  document.getElementById("btn-save-expense").onclick = handleSaveExpense;
};

function handleSaveExpense() {
  const desc = document.getElementById("expense-description").value.trim();
  const val = parseFloat(document.getElementById("expense-value").value);
  const cat = document.getElementById("expense-category").value;

  if (!desc || isNaN(val) || val <= 0) {
    window.App.showToast("Preencha os campos da despesa.", "error");
    return;
  }

  const transactions = JSON.parse(localStorage.getItem("transactions")) || [];
  transactions.push({
    id: "t_" + Date.now(),
    pelada_id: null,
    jogador_id: null,
    tipo: "despesa",
    descricao: desc,
    value: val,
    sinal: "debito",
    data: new Date().toISOString(),
    categoria: cat
  });

  localStorage.setItem("transactions", JSON.stringify(transactions));
  window.App.showToast("Despesa registrada!");
  
  window.App.closeModal();
  window.App.renderFinanceiroData();
}
