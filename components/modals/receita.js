// ==========================================================================
// MODAL: REGISTRAR RECEITA / VERBA (receita.js)
// ==========================================================================

window.App.initModalReceita = function() {
  const btnClose = document.getElementById("btn-close-income-modal");
  if (btnClose) btnClose.onclick = window.App.closeModal;

  const btnSave = document.getElementById("btn-save-income");
  if (btnSave) btnSave.onclick = handleSaveIncome;
};

function handleSaveIncome() {
  const desc = document.getElementById("income-description").value.trim();
  const val = parseFloat(document.getElementById("income-value").value);
  const cat = document.getElementById("income-category").value;

  if (!desc || isNaN(val) || val <= 0) {
    window.App.showToast("Preencha a descrição e um valor válido para a entrada.", "warning");
    return;
  }

  const transactions = JSON.parse(localStorage.getItem("transactions")) || [];
  transactions.push({
    id: "t_" + Date.now(),
    pelada_id: null,
    jogador_id: null,
    tipo: "receita",
    descricao: desc,
    valor: val,
    value: val,
    sinal: "credito",
    data: new Date().toISOString(),
    categoria: cat
  });

  localStorage.setItem("transactions", JSON.stringify(transactions));
  window.App.showToast("Verba/Receita registrada no caixa com sucesso!", "success");
  
  window.App.closeModal();
  if (window.App.renderFinanceiroData) {
    window.App.renderFinanceiroData();
  }
}
