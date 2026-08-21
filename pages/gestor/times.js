// ==========================================================================
// PÁGINA: GERENCIAMENTO DE NOMES DE TIMES (CRUD) (pages/gestor/times.js)
// ==========================================================================

window.App.initTimes = async function () {
  const currentGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  const groupId = currentGroup ? currentGroup.id : null;

  const gridEl = document.getElementById("manager-team-catalog-list") || document.getElementById("manager-team-catalog-grid");
  const summaryTotalEl = document.getElementById("summary-catalog-total");
  const summaryCustomEl = document.getElementById("summary-catalog-custom");
  const summaryDefaultEl = document.getElementById("summary-catalog-default");
  const searchInput = document.getElementById("team-catalog-search-input");
  const btnOpenAddModal = document.getElementById("btn-open-create-team-name-modal");

  // --- INJETA O MODAL NO BODY (para garantir posicionamento correto com position:fixed) ---
  let modalEl = document.getElementById("modal-edit-catalog-team");
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = "modal-edit-catalog-team";
    modalEl.className = "modal-backdrop";
    modalEl.innerHTML = `
      <div class="modal-sheet" style="max-width: 440px;">
        <div class="modal-header">
          <h3 id="modal-catalog-title" class="modal-title" style="font-size: 18px; font-weight: 800; color: #0F172A;">
            ➕ Cadastrar Nome de Time
          </h3>
          <button class="modal-close-btn" id="btn-close-edit-catalog-modal">✕</button>
        </div>
        <form id="form-edit-catalog-team" onsubmit="return false;" style="padding: 16px 20px;">
          <input type="hidden" id="edit-catalog-team-id">
          <div style="margin-bottom: 16px;">
            <label for="edit-catalog-team-nome" class="form-label" style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; display: block;">
              Nome do Time <span style="color: #EF4444;">*</span>
            </label>
            <input type="text" id="edit-catalog-team-nome" class="form-control" placeholder="Ex: Flamengo, Colete Verde, Real Madrid..." required style="font-weight: 700; font-size: 14px;">
          </div>
          <div style="margin-bottom: 16px;">
            <label for="edit-catalog-team-cor" class="form-label" style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; display: block;">
              Cor Principal do Time
            </label>
            <div style="display: flex; align-items: center; gap: 12px; background: #F8FAFC; padding: 10px; border-radius: 10px; border: 1px solid #E2E8F0;">
              <input type="color" id="edit-catalog-team-cor" value="#0284C7" style="width: 40px; height: 32px; border: none; cursor: pointer; background: transparent;">
              <span id="edit-catalog-color-preview-text" style="font-size: 13px; font-weight: 700; color: #0F172A;">#0284C7</span>
            </div>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-edit-catalog-modal" style="flex: 1;">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="btn-save-edit-catalog-team" style="flex: 1.5; font-weight: 800; background: linear-gradient(135deg, #0284C7, #0369A1); border: none;">
              Salvar Nome 💾
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  // Os elementos do modal são lidos dinamicamente após o appendChild (ver uso abaixo)

  const DEFAULT_FALLBACK_ITEMS = [
    { id: "default_1", nome: "Time A", cor: "#2196F3", isDb: true },
    { id: "default_2", nome: "Time B", cor: "#FFC107", isDb: true },
    { id: "default_3", nome: "Time C", cor: "#FF1744", isDb: true },
    { id: "default_4", nome: "Time D", cor: "#00C853", isDb: true },
    { id: "default_5", nome: "Time E", cor: "#FF6D00", isDb: true },
    { id: "default_6", nome: "Time F", cor: "#9C27B0", isDb: true }
  ];

  let cachedCatalog = [...DEFAULT_FALLBACK_ITEMS];

  // --- 1. ABRIR E FECHAR MODAL ---
  const closeModal = () => {
    if (modalEl) modalEl.classList.remove("active");
    const fEl = document.getElementById("form-edit-catalog-team");
    if (fEl) fEl.reset();
  };

  const openAddModal = () => {
    const titleEl = document.getElementById("modal-catalog-title");
    const idEl = document.getElementById("edit-catalog-team-id");
    const nomeEl = document.getElementById("edit-catalog-team-nome");
    const corEl = document.getElementById("edit-catalog-team-cor");
    const corTextEl = document.getElementById("edit-catalog-color-preview-text");
    if (idEl) idEl.value = "";
    if (nomeEl) nomeEl.value = "";
    if (corEl) corEl.value = "#0284C7";
    if (corTextEl) corTextEl.textContent = "#0284C7";
    if (titleEl) titleEl.textContent = "➕ Cadastrar Novo Nome de Time";
    if (modalEl) modalEl.classList.add("active");
    setTimeout(() => {
      const focusEl = document.getElementById("edit-catalog-team-nome");
      if (focusEl) focusEl.focus();
    }, 50);
  };

  if (btnOpenAddModal) btnOpenAddModal.onclick = openAddModal;
  if (modalEl) modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });

  // Fecha pelo X e pelo Cancelar (vinculados após o modal estar no DOM)
  const btnCloseModal = document.getElementById("btn-close-edit-catalog-modal");
  const btnCancelModal = document.getElementById("btn-cancel-edit-catalog-modal");
  if (btnCloseModal) btnCloseModal.onclick = closeModal;
  if (btnCancelModal) btnCancelModal.onclick = closeModal;

  // Atualiza preview de cor ao selecionar
  const inputCorEl = document.getElementById("edit-catalog-team-cor");
  const previewCorTextEl = document.getElementById("edit-catalog-color-preview-text");
  if (inputCorEl && previewCorTextEl) {
    inputCorEl.oninput = (e) => {
      previewCorTextEl.textContent = e.target.value;
    };
  }

  // --- 2. RENDERIZAR LISTA DE TIMES DA PELADA ---
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
      if (btnEmptyAdd) btnEmptyAdd.onclick = openAddModal;
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
                <span style="font-size: 10px; font-weight: 700; color: #10B981; background: rgba(16, 185, 129, 0.12); padding: 2px 8px; border-radius: 12px; text-transform: uppercase;">
                  ⚡ Banco PostgreSQL
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

    // Adiciona Listeners de Clique para Botões Editar e Excluir
    gridEl.querySelectorAll(".btn-edit-catalog-item").forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.dataset.id;
        const target = cachedCatalog.find(i => String(i.id) === String(id));
        if (!target) return;

        const idEl = document.getElementById("edit-catalog-team-id");
        const nomeEl = document.getElementById("edit-catalog-team-nome");
        const corEl = document.getElementById("edit-catalog-team-cor");
        const corTextEl = document.getElementById("edit-catalog-color-preview-text");
        const titleEl = document.getElementById("modal-catalog-title");
        if (idEl) idEl.value = target.id;
        if (nomeEl) nomeEl.value = target.nome;
        if (corEl) corEl.value = target.cor || "#0284C7";
        if (corTextEl) corTextEl.textContent = target.cor || "#0284C7";
        if (titleEl) titleEl.textContent = `✏️ Editar Nome de Time: ${target.nome}`;
        if (modalEl) modalEl.classList.add("active");
        setTimeout(() => { if (nomeEl) nomeEl.focus(); }, 50);
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
            } catch(err) {
              console.warn('[initTimes] Erro ao excluir no banco:', err);
            }
          }

          cachedCatalog = cachedCatalog.filter(i => String(i.id) !== String(id));
          if (window.App.showToast) window.App.showToast(`Time "${nome}" removido do banco de dados!`, "success");
          renderCatalog(searchInput ? searchInput.value : '');
        }
      };
    });
  };

  // --- 3. SUBMIT DO FORMULÁRIO (Criar e Editar) ---
  const formElRef = document.getElementById("form-edit-catalog-team");
  if (formElRef) {
    formElRef.onsubmit = async (e) => {
      e.preventDefault();
      const id = (document.getElementById("edit-catalog-team-id") || {}).value || "";
      const nomeVal = ((document.getElementById("edit-catalog-team-nome") || {}).value || "").trim();
      const corVal = (document.getElementById("edit-catalog-team-cor") || {}).value || "#0284C7";

      // groupId resolvido no momento do submit (mais seguro)
      const activeGroup = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
      const activeGroupId = (activeGroup ? activeGroup.id : null) || groupId;

      console.log('[initTimes] Submit — id:', id, '| nome:', nomeVal, '| groupId:', activeGroupId);

      if (!nomeVal) {
        if (window.App.showToast) window.App.showToast("Informe o nome do time!", "warning");
        return;
      }

      // Valida duplicata na lista
      const isDup = cachedCatalog.some(i => String(i.id) !== String(id) && i.nome.toLowerCase() === nomeVal.toLowerCase());
      if (isDup) {
        if (window.App.showToast) window.App.showToast(`⚠️ Já existe um time cadastrado com o nome "${nomeVal}".`, "warning");
        return;
      }

      // Botão de salvar: mostra loading
      const btnSave = document.getElementById("btn-save-edit-catalog-team");
      const originalBtnText = btnSave ? btnSave.textContent : '';
      if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'Salvando...'; }

      const itemTarget = cachedCatalog.find(i => String(i.id) === String(id));

      if (itemTarget) {
        // EDITAR
        itemTarget.nome = nomeVal;
        itemTarget.cor = corVal;

        if (itemTarget.db_id && window.Api && window.Api.atualizarNomeTime) {
          try {
            const res = await window.Api.atualizarNomeTime(itemTarget.db_id, { nome: nomeVal, cor: corVal });
            console.log('[initTimes] Resultado atualizar:', res);
            if (res && res.error) {
              if (window.App.showToast) window.App.showToast(`❌ Erro ao salvar: ${res.error}`, "error");
              if (btnSave) { btnSave.disabled = false; btnSave.textContent = originalBtnText; }
              return;
            }
          } catch(err) {
            console.error('[initTimes] Erro ao atualizar no banco:', err);
            if (window.App.showToast) window.App.showToast(`❌ Falha de conexão ao atualizar: ${err.message}`, "error");
            if (btnSave) { btnSave.disabled = false; btnSave.textContent = originalBtnText; }
            return;
          }
        }

        closeModal();
        if (window.App.showToast) window.App.showToast(`✅ Nome "${nomeVal}" atualizado!`, "success");
        renderCatalog(searchInput ? searchInput.value : '');

      } else {
        // CADASTRAR NOVO
        let newDbId = null;
        if (window.Api && window.Api.cadastrarNomeTime) {
          try {
            const res = await window.Api.cadastrarNomeTime(activeGroupId, { nome: nomeVal, cor: corVal });
            console.log('[initTimes] Resultado cadastrar:', res);
            if (res && res.error) {
              if (window.App.showToast) window.App.showToast(`❌ Erro ao cadastrar: ${res.error}`, "error");
              if (btnSave) { btnSave.disabled = false; btnSave.textContent = originalBtnText; }
              return;
            }
            if (res && res.id) newDbId = res.id;
          } catch(err) {
            console.error('[initTimes] Erro ao cadastrar no banco:', err);
            if (window.App.showToast) window.App.showToast(`❌ Falha de conexão: ${err.message}`, "error");
            if (btnSave) { btnSave.disabled = false; btnSave.textContent = originalBtnText; }
            return;
          }
        } else {
          console.warn('[initTimes] window.Api.cadastrarNomeTime não encontrado!');
        }

        if (!newDbId) {
          if (window.App.showToast) window.App.showToast(`❌ Não foi possível salvar no banco. Verifique o console.`, "error");
          if (btnSave) { btnSave.disabled = false; btnSave.textContent = originalBtnText; }
          return;
        }

        cachedCatalog.push({
          id: `db_${newDbId}`,
          db_id: newDbId,
          nome: nomeVal,
          cor: corVal,
          isDb: true
        });

        closeModal();
        if (window.App.showToast) window.App.showToast(`✅ Time "${nomeVal}" cadastrado no banco!`, "success");
        renderCatalog(searchInput ? searchInput.value : '');
      }

      if (btnSave) { btnSave.disabled = false; btnSave.textContent = originalBtnText; }
    };
  }

  if (searchInput) {
    searchInput.oninput = (e) => {
      renderCatalog(e.target.value);
    };
  }

  // --- 4. CARREGAR DADOS DO BANCO DE DADOS DE FORMA RESILIENTE ---
  renderCatalog(); // Renderiza estado inicial imediatamente

  try {
    if (window.Api && window.Api.getCatalogoTimes) {
      const dbItems = await window.Api.getCatalogoTimes(groupId);
      if (Array.isArray(dbItems) && dbItems.length > 0) {
        const items = [];
        const seen = new Set();
        dbItems.forEach(dbItem => {
          if (dbItem && dbItem.nome && !seen.has(dbItem.nome.trim().toLowerCase())) {
            seen.add(dbItem.nome.trim().toLowerCase());
            items.push({
              id: `db_${dbItem.id}`,
              db_id: dbItem.id,
              nome: dbItem.nome.trim(),
              cor: dbItem.cor || "#0284C7",
              isDb: true
            });
          }
        });
        if (items.length > 0) {
          cachedCatalog = items;
          renderCatalog(searchInput ? searchInput.value : '');
        }
      }
    }
  } catch(err) {
    console.warn('[initTimes] Erro ao buscar lista do banco:', err);
  }
};
