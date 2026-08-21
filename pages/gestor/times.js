// ==========================================================================
// PÁGINA: GERENCIAMENTO DE NOMES DE TIMES (POSTGRESQL PURO) (pages/gestor/times.js)
// ==========================================================================

window.App.initTimes = async function () {
  const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  const groupId = currentGroup ? currentGroup.id : null;

  const gridEl = document.getElementById("manager-team-catalog-list") || document.getElementById("manager-team-catalog-grid");
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

  const DEFAULT_FALLBACK_ITEMS = [
    { id: "default_1", nome: "Time A", cor: "#2196F3", isDb: false },
    { id: "default_2", nome: "Time B", cor: "#FFC107", isDb: false },
    { id: "default_3", nome: "Time C", cor: "#FF1744", isDb: false },
    { id: "default_4", nome: "Time D", cor: "#00C853", isDb: false }
  ];

  let cachedCatalog = [];

  // 1. Carregar Catálogo diretamente do Banco de Dados PostgreSQL
  const fetchCatalogFromDB = async () => {
    let dbItems = [];
    if (window.Api && window.Api.getCatalogoTimes) {
      try {
        dbItems = await window.Api.getCatalogoTimes(groupId);
      } catch (e) {
        console.warn('[initTimes] Erro ao buscar do banco PostgreSQL:', e);
      }
    }

    const items = [];
    const seenNames = new Set();

    if (Array.isArray(dbItems) && dbItems.length > 0) {
      dbItems.forEach((dbItem) => {
        if (dbItem && dbItem.nome && !seenNames.has(dbItem.nome.trim().toLowerCase())) {
          seenNames.add(dbItem.nome.trim().toLowerCase());
          items.push({
            id: `db_${dbItem.id}`,
            db_id: dbItem.id,
            nome: dbItem.nome.trim(),
            cor: dbItem.cor || "#0284C7",
            isDb: true
          });
        }
      });
    }

    // Se o banco retornar 0 registros, usa os fallbacks padrão
    if (items.length === 0) {
      DEFAULT_FALLBACK_ITEMS.forEach(fallback => {
        items.push({ ...fallback });
      });
    }

    cachedCatalog = items;

    // Sincroniza lista local para o seletor do sorteio
    try {
      const simpleNames = cachedCatalog.map(i => i.nome);
      if (groupId) localStorage.setItem(`customTeamNames_${groupId}`, JSON.stringify(simpleNames));
      localStorage.setItem('customTeamNames', JSON.stringify(simpleNames));
    } catch(e) {}

    return cachedCatalog;
  };

  // 2. Renderizar Lista e Resumos
  const renderCatalog = (filterText = '') => {
    if (!gridEl) return;
    const query = filterText.toLowerCase().trim();

    const filtered = cachedCatalog.filter(item => item.nome.toLowerCase().includes(query));
    const totalCount = cachedCatalog.length;
    const dbCount = cachedCatalog.filter(i => i.isDb).length;
    const fallbackCount = cachedCatalog.filter(i => !i.isDb).length;

    if (summaryTotalEl) summaryTotalEl.textContent = totalCount;
    if (summaryCustomEl) summaryCustomEl.textContent = dbCount;
    if (summaryDefaultEl) summaryDefaultEl.textContent = fallbackCount;

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔍</div>
          <h4 style="font-weight: 800; color: var(--text-heading); font-size: 16px; margin-bottom: 4px;">Nenhum time encontrado</h4>
          <p style="font-size: 13px; color: var(--text-caption); margin-bottom: 16px;">Tente pesquisar por outro nome ou cadastre um novo time no banco de dados.</p>
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
        <div class="card" style="padding: 14px 18px; border-left: 5px solid ${itemCor}; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
          <!-- Lado Esquerdo: Ícone/Emblema + Nome + Cor + Badge -->
          <div style="display: flex; align-items: center; gap: 14px; flex: 1; min-width: 220px;">
            <div style="width: 36px; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              ${emblemSvg}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h4 style="font-size: 16px; font-weight: 800; color: var(--text-heading); margin: 0; line-height: 1.2;">
                  ${item.nome}
                </h4>
                <span style="font-size: 10px; font-weight: 700; color: ${item.isDb ? '#10B981' : '#8B5CF6'}; background: ${item.isDb ? 'rgba(16, 185, 129, 0.12)' : 'rgba(139, 92, 246, 0.12)'}; padding: 2px 8px; border-radius: 12px; text-transform: uppercase;">
                  ${item.isDb ? '⚡ Banco PostgreSQL' : 'Fallback'}
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="width: 12px; height: 12px; border-radius: 50%; background: ${itemCor}; display: inline-block; border: 1px solid rgba(0,0,0,0.15);"></span>
                <span style="font-size: 12px; font-weight: 600; color: var(--text-caption);">${itemCor}</span>
              </div>
            </div>
          </div>

          <!-- Lado Direito: Botões de Ação ao Lado -->
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <button 
              type="button" 
              class="btn btn-sm btn-outline btn-edit-catalog-item" 
              data-id="${item.id}"
              style="font-weight: 700; font-size: 12px; border-color: #0284C7; color: #0284C7; padding: 6px 14px; border-width: 1.5px;"
            >
              ✏️ Editar
            </button>
            
            <button 
              type="button" 
              class="btn btn-sm btn-danger btn-delete-catalog-item" 
              data-id="${item.id}"
              data-db-id="${item.db_id || ''}"
              data-nome="${item.nome}"
              style="font-weight: 700; font-size: 12px; padding: 6px 12px;"
              title="Excluir do Banco de Dados"
            >
              🗑️ Excluir
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach Listeners
    gridEl.querySelectorAll(".btn-edit-catalog-item").forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.dataset.id;
        const target = cachedCatalog.find(i => String(i.id) === String(id));
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
      btn.onclick = async (e) => {
        const id = e.currentTarget.dataset.id;
        const dbId = e.currentTarget.dataset.dbId;
        const nome = e.currentTarget.dataset.nome;

        if (confirm(`Tem certeza que deseja excluir o nome "${nome}" do banco de dados?`)) {
          if (dbId && window.Api && window.Api.excluirNomeTime) {
            try {
              await window.Api.excluirNomeTime(dbId);
            } catch(e) {
              console.warn('[initTimes] Erro ao excluir no banco:', e);
            }
          }

          if (window.App.showToast) window.App.showToast(`Time "${nome}" removido do banco de dados!`, "success");
          await fetchCatalogFromDB();
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
    formEl.onsubmit = async (e) => {
      e.preventDefault();
      const id = inputId ? inputId.value : "";
      const nomeVal = inputNome ? (inputNome.value || "").trim() : "";
      const corVal = inputCor ? inputCor.value : "#0284C7";

      if (!nomeVal) {
        if (window.App.showToast) window.App.showToast("Informe o nome do time!", "warning");
        return;
      }

      // Valida se o nome já existe em outro item
      const isDup = cachedCatalog.some(i => String(i.id) !== String(id) && i.nome.toLowerCase() === nomeVal.toLowerCase());
      if (isDup) {
        if (window.App.showToast) window.App.showToast(`⚠️ Já existe um time cadastrado com o nome "${nomeVal}".`, "warning");
        return;
      }

      const itemTarget = cachedCatalog.find(i => String(i.id) === String(id));
      if (itemTarget && itemTarget.db_id) {
        // Modo Edição no PostgreSQL
        if (window.Api && window.Api.atualizarNomeTime) {
          try {
            await window.Api.atualizarNomeTime(itemTarget.db_id, { nome: nomeVal, cor: corVal });
          } catch(e) {}
        }
      } else {
        // Modo Criação no PostgreSQL
        if (window.Api && window.Api.cadastrarNomeTime) {
          try {
            await window.Api.cadastrarNomeTime(groupId, { nome: nomeVal, cor: corVal });
          } catch(e) {
            console.warn('[initTimes] Erro ao cadastrar no banco:', e);
          }
        }
      }

      closeModal();
      if (window.App.showToast) window.App.showToast(`✅ Nome de time "${nomeVal}" salvo no banco de dados!`, "success");
      await fetchCatalogFromDB();
      renderCatalog(searchInput ? searchInput.value : '');
    };
  }

  if (searchInput) {
    searchInput.oninput = (e) => {
      renderCatalog(e.target.value);
    };
  }

  await fetchCatalogFromDB();
  renderCatalog();
};
