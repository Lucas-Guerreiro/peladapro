// ==========================================================================
// PÁGINA: GERENCIAMENTO DE NOMES DE TIMES (CRUD) (pages/gestor/times.js)
// ==========================================================================

window.App.initTimes = async function () {
  const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  const groupId = currentGroup ? currentGroup.id : null;
  const catalogKey = groupId ? `customTeamCatalog_${groupId}` : 'customTeamCatalog';
  const selectedNamesKey = groupId ? `customTeamNames_${groupId}` : 'customTeamNames';

  const gridEl = document.getElementById("manager-team-catalog-grid");
  const summaryTotalEl = document.getElementById("summary-catalog-total");
  const summaryCustomEl = document.getElementById("summary-catalog-custom");
  const summaryDefaultEl = document.getElementById("summary-catalog-default");
  const searchInput = document.getElementById("team-catalog-search-input");

  const modalEl = document.getElementById("modal-edit-catalog-team");
  const modalTitleEl = document.getElementById("modal-catalog-title");
  const formEl = document.getElementById("form-edit-catalog-team");
  const inputId = document.getElementById("edit-catalog-team-id");
  const inputNome = document.getElementById("edit-catalog-team-nome");
  const inputCor = document.getElementById("edit-catalog-team-cor");
  const previewCorText = document.getElementById("edit-catalog-color-preview-text");

  const btnOpenAddModal = document.getElementById("btn-open-create-team-name-modal");
  const btnCloseModal = document.getElementById("btn-close-edit-catalog-modal");
  const btnCancelModal = document.getElementById("btn-cancel-edit-catalog-modal");

  // Catálogo Padrão Inicial
  const DEFAULT_ITEMS = [
    { id: "default_1", nome: "Time A", cor: "#2196F3", isDefault: true },
    { id: "default_2", nome: "Time B", cor: "#FFC107", isDefault: true },
    { id: "default_3", nome: "Time C", cor: "#FF1744", isDefault: true },
    { id: "default_4", nome: "Time D", cor: "#00C853", isDefault: true },
    { id: "default_5", nome: "Time E", cor: "#FF6D00", isDefault: true },
    { id: "default_6", nome: "Time F", cor: "#9C27B0", isDefault: true }
  ];

  // 1. Carregar Catálogo
  const getCatalog = () => {
    let raw = [];
    try {
      raw = JSON.parse(localStorage.getItem(catalogKey)) || JSON.parse(localStorage.getItem('customTeamCatalog')) || [];
    } catch(e) {}

    const catalog = [...DEFAULT_ITEMS];
    const seenNames = new Set(DEFAULT_ITEMS.map(i => i.nome.toLowerCase()));

    raw.forEach((item, idx) => {
      let obj = typeof item === 'string' 
        ? { id: `custom_${idx}_${Date.now()}`, nome: item.trim(), cor: "#0284C7", isDefault: false }
        : item;

      if (obj && obj.nome && !seenNames.has(obj.nome.trim().toLowerCase())) {
        seenNames.add(obj.nome.trim().toLowerCase());
        catalog.push({
          id: obj.id || `custom_${idx}_${Date.now()}`,
          nome: obj.nome.trim(),
          cor: obj.cor || "#0284C7",
          isDefault: !!obj.isDefault
        });
      }
    });

    return catalog;
  };

  const saveCustomCatalog = (catalog) => {
    // Salva apenas os itens que não são os defaults estáticos
    const customItems = catalog.filter(i => !i.isDefault);
    try {
      if (groupId) localStorage.setItem(`customTeamCatalog_${groupId}`, JSON.stringify(customItems));
      localStorage.setItem('customTeamCatalog', JSON.stringify(customItems));

      // Também atualiza lista simples de nomes para o sorteio
      const simpleNames = catalog.map(i => i.nome);
      if (groupId) localStorage.setItem(`customTeamNames_${groupId}`, JSON.stringify(simpleNames));
      localStorage.setItem('customTeamNames', JSON.stringify(simpleNames));
    } catch(e) {}
  };

  // 2. Renderizar Grid e Resumos
  const renderCatalog = (filterText = '') => {
    if (!gridEl) return;
    const catalog = getCatalog();
    const query = filterText.toLowerCase().trim();

    const filtered = catalog.filter(item => item.nome.toLowerCase().includes(query));
    const totalCount = catalog.length;
    const customCount = catalog.filter(i => !i.isDefault).length;
    const defaultCount = catalog.filter(i => i.isDefault).length;

    if (summaryTotalEl) summaryTotalEl.textContent = totalCount;
    if (summaryCustomEl) summaryCustomEl.textContent = customCount;
    if (summaryDefaultEl) summaryDefaultEl.textContent = defaultCount;

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <h4 style="font-weight: 800; color: var(--text-heading); font-size: 16px; margin-bottom: 4px;">Nenhum time encontrado</h4>
          <p style="font-size: 13px; color: var(--text-caption); margin-bottom: 16px;">Tente pesquisar por outro nome ou cadastre um novo time.</p>
          <button id="btn-empty-add-team" class="btn btn-primary" style="font-weight: 800;">➕ Cadastrar Nome</button>
        </div>
      `;
      const btnEmptyAdd = document.getElementById("btn-empty-add-team");
      if (btnEmptyAdd && btnOpenAddModal) btnEmptyAdd.onclick = btnOpenAddModal.onclick;
      return;
    }

    gridEl.innerHTML = filtered.map(item => {
      const itemCor = item.cor || "#0284C7";
      let emblemSvg = '';
      if (window.TeamEmblems) {
        emblemSvg = window.TeamEmblems.forTeam({ nome: item.nome, cor: itemCor });
      } else {
        emblemSvg = `<div style="width: 36px; height: 36px; border-radius: 50%; background: ${itemCor}; color: #FFF; font-weight: 800; display: flex; align-items: center; justify-content: center;">${item.nome.charAt(0)}</div>`;
      }

      return `
        <div class="card" style="border-top: 4px solid ${itemCor}; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 38px; display: flex; align-items: center; justify-content: center;">
                  ${emblemSvg}
                </div>
                <div>
                  <h4 style="font-size: 16px; font-weight: 800; color: var(--text-heading); margin: 0; line-height: 1.2;">
                    ${item.nome}
                  </h4>
                  <span style="font-size: 10px; font-weight: 700; color: ${item.isDefault ? '#8B5CF6' : '#10B981'}; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; margin-top: 2px;">
                    ${item.isDefault ? '• Padrão do Sistema' : '• Customizado do Grupo'}
                  </span>
                </div>
              </div>
            </div>

            <!-- Preview da Cor -->
            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-body, #F8FAFC); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, #E2E8F0);">
              <span style="font-size: 11px; font-weight: 700; color: var(--text-caption);">Cor Principal:</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 14px; height: 14px; border-radius: 50%; background: ${itemCor}; display: inline-block; border: 1px solid rgba(0,0,0,0.2);"></span>
                <span style="font-size: 11px; font-weight: 700; color: var(--text-heading);">${itemCor}</span>
              </div>
            </div>
          </div>

          <!-- Ações do Card -->
          <div style="display: flex; gap: 8px; border-top: 1px solid var(--border-color, #E2E8F0); padding-top: 10px;">
            <button 
              type="button" 
              class="btn btn-sm btn-outline btn-edit-catalog-item" 
              data-id="${item.id}"
              style="flex: 1; font-weight: 700; font-size: 12px; border-color: #0284C7; color: #0284C7;"
            >
              ✏️ Editar
            </button>
            
            ${!item.isDefault ? `
              <button 
                type="button" 
                class="btn btn-sm btn-danger btn-delete-catalog-item" 
                data-id="${item.id}"
                data-nome="${item.nome}"
                style="font-weight: 700; font-size: 12px; padding: 6px 10px;"
                title="Excluir do Catálogo"
              >
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Attach Listeners
    gridEl.querySelectorAll(".btn-edit-catalog-item").forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.dataset.id;
        const catalog = getCatalog();
        const target = catalog.find(i => String(i.id) === String(id));
        if (!target) return;

        if (inputId) inputId.value = target.id;
        if (inputNome) inputNome.value = target.nome;
        if (inputCor) inputCor.value = target.cor || "#0284C7";
        if (previewCorText) previewCorText.textContent = target.cor || "#0284C7";
        if (modalTitleEl) modalTitleEl.textContent = `✏️ Editar Nome de Time: ${target.nome}`;

        if (modalEl) modalEl.style.display = "flex";
      };
    });

    gridEl.querySelectorAll(".btn-delete-catalog-item").forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.dataset.id;
        const nome = e.currentTarget.dataset.nome;

        if (confirm(`Tem certeza que deseja excluir o nome "${nome}" do catálogo?`)) {
          let catalog = getCatalog();
          catalog = catalog.filter(i => String(i.id) !== String(id));
          saveCustomCatalog(catalog);

          if (window.App.showToast) window.App.showToast(`Time "${nome}" removido do catálogo!`, "success");
          renderCatalog(searchInput ? searchInput.value : '');
        }
      };
    });
  };

  // 3. Handlers de Modal e Formulário
  const closeModal = () => {
    if (modalEl) modalEl.style.display = "none";
    if (formEl) formEl.reset();
  };

  if (btnOpenAddModal) {
    btnOpenAddModal.onclick = () => {
      if (inputId) inputId.value = "";
      if (inputNome) inputNome.value = "";
      if (inputCor) inputCor.value = "#0284C7";
      if (previewCorText) previewCorText.textContent = "#0284C7";
      if (modalTitleEl) modalTitleEl.textContent = "➕ Cadastrar Novo Nome de Time";
      if (modalEl) modalEl.style.display = "flex";
      if (inputNome) inputNome.focus();
    };
  }

  if (btnCloseModal) btnCloseModal.onclick = closeModal;
  if (btnCancelModal) btnCancelModal.onclick = closeModal;

  if (inputCor && previewCorText) {
    inputCor.oninput = (e) => {
      previewCorText.textContent = e.target.value;
    };
  }

  if (formEl) {
    formEl.onsubmit = (e) => {
      e.preventDefault();
      const id = inputId ? inputId.value : "";
      const nomeVal = inputNome ? (inputNome.value || "").trim() : "";
      const corVal = inputCor ? inputCor.value : "#0284C7";

      if (!nomeVal) {
        if (window.App.showToast) window.App.showToast("Informe o nome do time!", "warning");
        return;
      }

      let catalog = getCatalog();

      // Valida se o nome já existe em outro item
      const isDup = catalog.some(i => String(i.id) !== String(id) && i.nome.toLowerCase() === nomeVal.toLowerCase());
      if (isDup) {
        if (window.App.showToast) window.App.showToast(`⚠️ Já existe um time cadastrado com o nome "${nomeVal}".`, "warning");
        return;
      }

      if (id) {
        // Modo Edição
        const item = catalog.find(i => String(i.id) === String(id));
        if (item) {
          item.nome = nomeVal;
          item.cor = corVal;
        }
      } else {
        // Modo Criação
        catalog.push({
          id: `custom_${Date.now()}`,
          nome: nomeVal,
          cor: corVal,
          isDefault: false
        });
      }

      saveCustomCatalog(catalog);
      closeModal();
      if (window.App.showToast) window.App.showToast(`✅ Nome de time "${nomeVal}" salvo no catálogo!`, "success");
      renderCatalog(searchInput ? searchInput.value : '');
    };
  }

  if (searchInput) {
    searchInput.oninput = (e) => {
      renderCatalog(e.target.value);
    };
  }

  renderCatalog();
};
