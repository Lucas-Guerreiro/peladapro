// ==========================================================================
// MODAL: REGISTRAR DESPESA (despesa.js)
// ==========================================================================

window.App.initModalDespesa = async function() {
  const btnClose = document.getElementById("btn-close-expense-modal");
  if (btnClose) btnClose.onclick = window.App.closeModal;

  const btnSave = document.getElementById("btn-save-expense");
  if (btnSave) btnSave.onclick = handleSaveExpense;

  // Carrega opções de peladas para vínculo opcional
  const selectPelada = document.getElementById("expense-pelada-select");
  if (selectPelada) {
    selectPelada.innerHTML = `<option value="">Nenhuma (Despesa Geral)</option>`;
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
        console.warn("[ModalDespesa] Erro ao carregar peladas:", e);
      }
    }
  }
};

async function handleSaveExpense() {
  const val = parseFloat(document.getElementById("expense-value").value);
  const cat = document.getElementById("expense-category") ? document.getElementById("expense-category").value : "Outros";
  const desc = document.getElementById("expense-description").value.trim();
  const peladaVinculada = document.getElementById("expense-pelada-select") ? document.getElementById("expense-pelada-select").value : "";
  const statusPayment = document.getElementById("expense-status-select") ? document.getElementById("expense-status-select").value : "efetivado";

  if (isNaN(val) || val <= 0 || !desc) {
    window.App.showToast("Informe o valor e a descrição da despesa.", "warning");
    return;
  }

  // Formata a descrição no padrão: "[categoria] - [descrição]" ou "[categoria] - [descrição] (Pelada DD/MM/AAAA) [NÃO EFETIVADO]"
  let descricaoFinal = `[${cat}] - ${desc}`;
  if (peladaVinculada) {
    descricaoFinal += ` (Pelada ${peladaVinculada})`;
  }
  if (statusPayment === 'pendente') {
    descricaoFinal += ` [NÃO EFETIVADO]`;
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
