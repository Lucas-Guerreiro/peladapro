// ==========================================================================
// MODAL: EDITAR / REMANEJAR TRANSAÇÃO DE CAIXA (editar_transacao.js)
// ==========================================================================

window.App.initModalEditar_transacao = async function (data = {}) {
  const txData = data.transaction || data;
  if (!txData || !txData.id) {
    window.App.showToast("Erro: Transação não identificada.", "error");
    window.App.closeModal();
    return;
  }

  const inputVal = document.getElementById("edit-tx-value");
  const inputDesc = document.getElementById("edit-tx-description");
  const selectPelada = document.getElementById("edit-tx-pelada-select");
  const selectCategory = document.getElementById("edit-tx-category-select");

  const radioCredito = document.getElementById("radio-edit-credito");
  const radioDebito = document.getElementById("radio-edit-debito");
  const labelCredito = document.getElementById("label-edit-credito");
  const labelDebito = document.getElementById("label-edit-debito");

  const btnSave = document.getElementById("btn-save-edit-tx");
  const btnDelete = document.getElementById("btn-delete-edit-tx");

  // Popula peladas do grupo
  if (selectPelada) {
    selectPelada.innerHTML = `<option value="">Nenhuma (Caixa Fixo Geral / Vaquinhas)</option>`;
    const group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    if (group && group.id && window.Api && window.Api.listarDatasDoGrupo) {
      try {
        const peladas = await window.Api.listarDatasDoGrupo(group.id);
        if (Array.isArray(peladas) && peladas.length > 0) {
          peladas.forEach(p => {
            const rawDate = p.data ? String(p.data).split("T")[0] : "";
            const parts = rawDate.split("-");
            let dataFmt = rawDate;
            if (parts.length === 3) dataFmt = `${parts[2]}/${parts[1]}/${parts[0]}`;
            const opt = document.createElement("option");
            opt.value = dataFmt;
            opt.textContent = `📅 Pelada ${dataFmt} (${p.horario || ""})`;
            selectPelada.appendChild(opt);
          });
        }
      } catch (e) {
        console.warn("[ModalEditarTransacao] Erro ao carregar peladas:", e);
      }
    }
  }

  const selectStatus = document.getElementById("edit-tx-status-select");
  const partialEditContainer = document.getElementById("edit-tx-partial-container");
  const inputPaidVal = document.getElementById("edit-tx-paid-value");

  if (selectStatus && partialEditContainer) {
    selectStatus.onchange = function() {
      if (selectStatus.value === 'parcial') {
        partialEditContainer.style.display = 'block';
      } else {
        partialEditContainer.style.display = 'none';
      }
    };
  }

  // Preenche dados atuais
  if (inputVal) inputVal.value = Math.abs(parseFloat(txData.valor || 0)).toFixed(2);
  
  const fullDesc = txData.descricao || "";

  // Detecta tag de pagamento parcial ex: [PAGO:80.00/200.00]
  const matchParcial = fullDesc.match(/\[PAGO:([\d.]+)\/([\d.]+)\]/i);
  if (matchParcial && selectStatus) {
    selectStatus.value = "parcial";
    if (partialEditContainer) partialEditContainer.style.display = "block";
    if (inputPaidVal) inputPaidVal.value = parseFloat(matchParcial[1] || 0).toFixed(2);
  } else if (selectStatus) {
    if (fullDesc.includes("[NÃO EFETIVADO]") || fullDesc.includes("[PENDENTE]") || fullDesc.toLowerCase().includes("não efetivado")) {
      selectStatus.value = "pendente";
      if (partialEditContainer) partialEditContainer.style.display = "none";
    } else {
      selectStatus.value = "efetivado";
      if (partialEditContainer) partialEditContainer.style.display = "none";
    }
  }
  
  // Detecta vínculo de pelada existente na descrição (ex: "(Pelada 24/08/2026)")
  let currentPeladaMatch = fullDesc.match(/dia\s+(\d{2}\/\d{2}(?:\/\d{4})?)/i) || fullDesc.match(/pelada\s+(\d{2}\/\d{2}(?:\/\d{4})?)/i);
  if (currentPeladaMatch && currentPeladaMatch[1] && selectPelada) {
    let matchData = currentPeladaMatch[1];
    if (matchData.length === 5) matchData += '/2026';
    selectPelada.value = matchData;
  }

  // Limpa sufixos de pelada, tags de efetivação e prefixos para deixar a descrição limpa no input
  let cleanDesc = fullDesc
    .replace(/\s*\(Pelada\s+\d{2}\/\d{2}(?:\/\d{4})?\)/gi, "")
    .replace(/\s*\[PAGO:[\d.]+\/[\d.]+\]/gi, "")
    .replace(/\s*\[NÃO EFETIVADO\]/gi, "")
    .replace(/\s*\[PENDENTE\]/gi, "")
    .replace(/^Pagamento Pix Atleta - /gi, "")
    .replace(/^Verba injetada - /gi, "")
    .replace(/^\[[^\]]+\] - /gi, "")
    .trim();

  if (inputDesc) inputDesc.value = cleanDesc || fullDesc;

  // Detecta tipo e categoria original
  const isCredito = (txData.tipoOriginal === "credito" || txData.tipo === "credito" || txData.isEntrada);
  if (radioCredito && radioDebito) {
    if (isCredito) {
      radioCredito.checked = true;
    } else {
      radioDebito.checked = true;
    }
  }

  if (selectCategory) {
    if (!isCredito) {
      selectCategory.value = "Despesa";
    } else if (fullDesc.includes("Pix") || fullDesc.toLowerCase().includes("atleta")) {
      selectCategory.value = "Pix Atleta";
    } else if (fullDesc.includes("Verba") || fullDesc.includes("Aporte") || fullDesc.includes("Patrocínio")) {
      selectCategory.value = "Verba / Aporte";
    } else {
      selectCategory.value = "Crédito Carteira";
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
      
      if (selectCategory && selectCategory.value === "Despesa") {
        selectCategory.value = "Pix Atleta";
      }
    } else {
      labelDebito.style.border = "1.5px solid #DC2626";
      labelDebito.style.background = "#FEF2F2";
      labelDebito.style.color = "#DC2626";
      
      if (selectCategory) {
        selectCategory.value = "Despesa";
      }
    }
  }

  if (radioCredito && radioDebito) {
    radioCredito.onchange = updateTypeUI;
    radioDebito.onchange = updateTypeUI;
    updateTypeUI();
  }

  // --- Salvar e Remanejar Edição ---
  if (btnSave) {
    btnSave.onclick = async () => {
      const val = parseFloat(inputVal ? inputVal.value : 0);
      const rawDesc = inputDesc ? inputDesc.value.trim() : "";
      const tipo = radioCredito && radioCredito.checked ? "credito" : "debito";
      const peladaSel = selectPelada ? selectPelada.value : "";
      const catSel = selectCategory ? selectCategory.value : "Outros";
      const statusSel = selectStatus ? selectStatus.value : "efetivado";

      if (isNaN(val) || val <= 0 || !rawDesc) {
        window.App.showToast("Informe um valor válido e a descrição do lançamento.", "warning");
        return;
      }

      // Formata descrição com a categoria e o vínculo de remanejamento da pelada
      let descFinal = rawDesc;
      if (tipo === "credito") {
        if (catSel === "Pix Atleta" && !descFinal.toLowerCase().startsWith("pagamento pix")) {
          descFinal = `Pagamento Pix Atleta - ${descFinal}`;
        } else if (catSel === "Verba / Aporte" && !descFinal.toLowerCase().startsWith("verba")) {
          descFinal = `Verba injetada - ${descFinal}`;
        }
      } else {
        if (!descFinal.startsWith("[")) {
          descFinal = `[${catSel}] - ${descFinal}`;
        }
      }

      if (peladaSel) {
        descFinal += ` (Pelada ${peladaSel})`;
      }

      if (statusSel === "pendente") {
        descFinal += ` [NÃO EFETIVADO]`;
      } else if (statusSel === "parcial") {
        let valPago = parseFloat(inputPaidVal ? inputPaidVal.value : 0);
        if (isNaN(valPago) || valPago < 0) valPago = 0;
        if (valPago > val) valPago = val;
        descFinal += ` [PAGO:${valPago.toFixed(2)}/${val.toFixed(2)}]`;
      }

      try {
        btnSave.disabled = true;
        btnSave.textContent = "Remanejando...";
        window.App.showToast("Remanejando lançamento no caixa...", "info");

        const res = await window.Api.editarTransacao(txData.id, val, tipo, descFinal);
        if (res && res.error) {
          window.App.showToast(res.error, "error");
          btnSave.disabled = false;
          btnSave.textContent = "💾 Salvar / Remanejar";
          return;
        }

        window.App.showToast("Lançamento remanejado com sucesso! 💰", "success");
        window.App.closeModal();

        if (window.App.renderFinanceiroData) {
          await window.App.renderFinanceiroData();
        }
      } catch (err) {
        console.error("[ModalEditarTransacao] Erro ao remanejar:", err);
        window.App.showToast("Erro ao remanejar a transação.", "error");
        btnSave.disabled = false;
        btnSave.textContent = "💾 Salvar / Remanejar";
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
