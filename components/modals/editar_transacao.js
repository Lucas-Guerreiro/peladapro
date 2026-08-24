// ==========================================================================
// MODAL: EDITAR / DELETAR TRANSAÇÃO DE CAIXA (editar_transacao.js)
// ==========================================================================

window.App.initModalEditar_transacao = function (data = {}) {
  const txData = data.transaction || data;
  if (!txData || !txData.id) {
    window.App.showToast("Erro: Transação não identificada.", "error");
    window.App.closeModal();
    return;
  }

  const inputVal = document.getElementById("edit-tx-value");
  const inputDesc = document.getElementById("edit-tx-description");
  const radioCredito = document.getElementById("radio-edit-credito");
  const radioDebito = document.getElementById("radio-edit-debito");
  const labelCredito = document.getElementById("label-edit-credito");
  const labelDebito = document.getElementById("label-edit-debito");

  const btnSave = document.getElementById("btn-save-edit-tx");
  const btnDelete = document.getElementById("btn-delete-edit-tx");

  // Preenche dados atuais
  if (inputVal) inputVal.value = Math.abs(parseFloat(txData.valor || 0)).toFixed(2);
  if (inputDesc) inputDesc.value = txData.descricao || "";

  const isCredito = (txData.tipoOriginal === "credito" || txData.tipo === "credito" || txData.isEntrada);
  if (radioCredito && radioDebito) {
    if (isCredito) {
      radioCredito.checked = true;
    } else {
      radioDebito.checked = true;
    }
  }

  function updateTypeUI() {
    if (!radioCredito || !radioDebito || !labelCredito || !labelDebito) return;
    if (radioCredito.checked) {
      labelCredito.style.border = "1.5px solid #047857";
      labelCredito.style.background = "#ECFDF5";
      labelCredito.style.color = "#047857";

      labelDebito.style.border = "1.5px solid #E2E8F0";
      labelDebito.style.background = "#FFFFFF";
      labelDebito.style.color = "var(--text-body)";
    } else {
      labelDebito.style.border = "1.5px solid #DC2626";
      labelDebito.style.background = "#FEF2F2";
      labelDebito.style.color = "#DC2626";

      labelCredito.style.border = "1.5px solid #E2E8F0";
      labelCredito.style.background = "#FFFFFF";
      labelCredito.style.color = "var(--text-body)";
    }
  }

  if (radioCredito && radioDebito) {
    radioCredito.onchange = updateTypeUI;
    radioDebito.onchange = updateTypeUI;
    updateTypeUI();
  }

  // --- Salvar Edição ---
  if (btnSave) {
    btnSave.onclick = async () => {
      const val = parseFloat(inputVal ? inputVal.value : 0);
      const desc = inputDesc ? inputDesc.value.trim() : "";
      const tipo = radioCredito && radioCredito.checked ? "credito" : "debito";

      if (isNaN(val) || val <= 0 || !desc) {
        window.App.showToast("Informe um valor válido e a descrição da transação.", "warning");
        return;
      }

      try {
        btnSave.disabled = true;
        btnSave.textContent = "Salvando...";
        window.App.showToast("Atualizando lançamento...", "info");

        const res = await window.Api.editarTransacao(txData.id, val, tipo, desc);
        if (res && res.error) {
          window.App.showToast(res.error, "error");
          btnSave.disabled = false;
          btnSave.textContent = "💾 Salvar Alterações";
          return;
        }

        window.App.showToast("Lançamento atualizado com sucesso! 💰", "success");
        window.App.closeModal();

        if (window.App.renderFinanceiroData) {
          await window.App.renderFinanceiroData();
        }
      } catch (err) {
        console.error("[ModalEditarTransacao] Erro ao editar:", err);
        window.App.showToast("Erro ao atualizar a transação.", "error");
        btnSave.disabled = false;
        btnSave.textContent = "💾 Salvar Alterações";
      }
    };
  }

  // --- Deletar Lançamento ---
  if (btnDelete) {
    btnDelete.onclick = async () => {
      const confirmDel = confirm(`Tem certeza que deseja apagar este lançamento de "${txData.descricao}" (R$ ${Math.abs(txData.valor).toFixed(2)})?`);
      if (!confirmDel) return;

      try {
        btnDelete.disabled = true;
        btnDelete.textContent = "Excluindo...";

        const res = await window.Api.deletarTransacao(txData.id);
        if (res && res.error) {
          window.App.showToast(res.error, "error");
          btnDelete.disabled = false;
          btnDelete.textContent = "🗑️ Excluir";
          return;
        }

        window.App.showToast("Lançamento excluído do caixa com sucesso!", "success");
        window.App.closeModal();

        if (window.App.renderFinanceiroData) {
          await window.App.renderFinanceiroData();
        }
      } catch (err) {
        console.error("[ModalEditarTransacao] Erro ao deletar:", err);
        window.App.showToast("Erro ao excluir a transação.", "error");
        btnDelete.disabled = false;
        btnDelete.textContent = "🗑️ Excluir";
      }
    };
  }
};
