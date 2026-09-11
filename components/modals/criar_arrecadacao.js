// ==========================================================================
// MODAL: CRIAR ARRECADAÇÃO (criar_arrecadacao.js)
// ==========================================================================

window.App.initModalCriar_arrecadacao = function() {
  const btnClose = document.getElementById("btn-close-criar-arrecadacao-modal");
  if (btnClose) btnClose.onclick = window.App.closeModal;

  const btnSave = document.getElementById("btn-save-nova-arrecadacao");
  if (btnSave) btnSave.onclick = handleSaveArrecadacao;
};

async function handleSaveArrecadacao() {
  const titulo = document.getElementById("arr-title").value.trim();
  const meta = parseFloat(document.getElementById("arr-meta").value);
  const sugerido = parseFloat(document.getElementById("arr-sugerido").value);
  const categoria = document.getElementById("arr-category").value;
  const desc = document.getElementById("arr-desc").value.trim();

  if (!titulo || isNaN(meta) || meta <= 0) {
    window.App.showToast("Informe o título e uma meta de valor válida.", "warning");
    return;
  }

  let group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  if (!group || !group.id) {
    try { group = JSON.parse(localStorage.getItem("currentGroup")); } catch (e) {}
  }

  if (!group || !group.id) {
    window.App.showToast("Grupo de referência não encontrado.", "error");
    return;
  }

  const btnSave = document.getElementById("btn-save-nova-arrecadacao");
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = "Criando campanha...";
  }

  try {
    const payload = {
      grupo_id: group.id,
      titulo: titulo,
      descricao: desc,
      meta_valor: meta,
      valor_sugerido: isNaN(sugerido) ? 15.00 : sugerido,
      categoria: categoria
    };

    const res = await window.Api.criarArrecadacao(payload);
    if (res.error) {
      window.App.showToast(res.error, "error");
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = "🚀 Lançar Campanha no App";
      }
      return;
    }

    window.App.showToast("Campanha de arrecadação lançada com sucesso!", "success");
    window.App.closeModal();

    if (window.App.renderFinanceiroData) {
      window.App.renderFinanceiroData();
    }
  } catch (err) {
    console.error('[handleSaveArrecadacao]', err);
    window.App.showToast("Erro ao criar campanha de arrecadação.", "error");
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = "🚀 Lançar Campanha no App";
    }
  }
}
