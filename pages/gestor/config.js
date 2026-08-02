// ==========================================================================
// PÁGINA: GESTOR - CONFIGURAÇÕES (config.js)
// ==========================================================================

let pushSelectedAthletes = [];

window.App.initConfig = function () {
  pushSelectedAthletes = [];
  loadConfigs();
  loadGestorGroups().then(() => {
    loadDrawnDates();
  });
  loadGestorLocations();

  // Sincroniza atletas e popula o select
  if (window.App.syncAthletesList) {
    window.App.syncAthletesList().then(() => {
      populatePushAthleteSelect();
    });
  } else {
    populatePushAthleteSelect();
  }

  // Expor a função de recarregamento para o modal partida_config
  window.App.syncDrawnDates = loadDrawnDates;

  // Escutar criação de nova pelada pelo modal criar_pelada
  document.addEventListener("pelada:created", async function (e) {
    await loadGestorGroups();

    // Selecionar o novo grupo no dropdown
    if (e.detail && e.detail.id) {
      const select = document.getElementById("select-schedule-group");
      if (select) {
        select.value = e.detail.id;
        // Atualizar grupo ativo com os dados retornados
        const grupos = window.App.gestorGroups || [];
        const novoGrupo = grupos.find(g => g.id === e.detail.id);
        if (novoGrupo) {
          window.App.currentGroup = novoGrupo;
          loadConfigs();
        }
      }
    }

    await loadDrawnDates();
  });

  const selectGroup = document.getElementById("select-schedule-group");
  if (selectGroup) {
    selectGroup.onchange = async () => {
      const selectedId = parseInt(selectGroup.value);
      const grupos = window.App.gestorGroups || [];
      const selectedGroup = grupos.find(g => g.id === selectedId);
      if (selectedGroup) {
        window.App.currentGroup = selectedGroup;
        if (window.Auth) window.Auth.currentGroup = selectedGroup;
        localStorage.setItem('currentGroup', JSON.stringify(selectedGroup));
        loadConfigs();
      }
      await loadDrawnDates();
    };
  }

  document.getElementById("btn-create-new-group").onclick = handleCreateGroup;
  document.getElementById("btn-schedule-match").onclick = handleScheduleMatch;

  document.getElementById("btn-save-location").onclick = handleSaveLocation;
  document.getElementById("btn-cancel-location-edit").onclick = handleCancelLocationEdit;

  const btnActivate = document.getElementById("btn-activate-license");
  if (btnActivate) btnActivate.onclick = handleActivateLicense;

  const btnSendPush = document.getElementById("btn-send-custom-push");
  if (btnSendPush) btnSendPush.onclick = handleSendCustomPush;

  const btnAddPushAthlete = document.getElementById("btn-push-add-athlete");
  if (btnAddPushAthlete) btnAddPushAthlete.onclick = handleAddPushAthlete;

  if (window.feather) feather.replace();
};

async function handleSendCustomPush() {
  const titleInput = document.getElementById("push-title-input");
  const bodyInput = document.getElementById("push-body-input");
  const targetTabSelect = document.getElementById("push-target-tab");

  const title = titleInput ? titleInput.value.trim() : "";
  const body = bodyInput ? bodyInput.value.trim() : "";
  const targetUrl = targetTabSelect ? targetTabSelect.value : "/#/jogador/convocacao";

  if (!title || !body) {
    window.App.showToast("Preencha o título e a mensagem do aviso.", "warning");
    return;
  }

  const payload = {
    title: title,
    body: body,
    url: targetUrl
  };

  // UX Failsafe: Se o usuário selecionou um atleta no dropdown mas esqueceu de clicar em "Adicionar",
  // nós incluímos esse atleta automaticamente no envio.
  const selectAthlete = document.getElementById("push-select-athlete");
  let targetUserIds = pushSelectedAthletes.map(a => a.id);
  if (selectAthlete && selectAthlete.value) {
    const val = parseInt(selectAthlete.value);
    if (val && !targetUserIds.includes(val)) {
      targetUserIds.push(val);
    }
  }

  // Se houver atletas selecionados na lista, envia direcionado
  if (targetUserIds.length > 0) {
    payload.usuarioIds = targetUserIds;
  }

  try {
    window.App.showToast("Disparando notificação push...", "info");
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      window.App.showToast(`Notificação enviada com sucesso para ${data.successCount || 0} dispositivo(s)! 🚀`, "success");
      if (titleInput) titleInput.value = "";
      if (bodyInput) bodyInput.value = "";
      if (selectAthlete) selectAthlete.value = "";
      
      // Limpa os selecionados
      pushSelectedAthletes = [];
      renderSelectedPushAthletes();
    } else {
      window.App.showToast(data.error || "Erro ao disparar notificação.", "error");
    }
  } catch (e) {
    console.error(e);
    window.App.showToast("Erro ao conectar ao servidor de push.", "error");
  }
}

function populatePushAthleteSelect() {
  const select = document.getElementById("push-select-athlete");
  if (!select) return;

  select.innerHTML = `<option value="">-- Selecione um atleta para adicionar --</option>`;

  const players = JSON.parse(localStorage.getItem("players")) || [];
  const approved = players.filter(p => p.verificado === true);

  approved.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nome + (p.apelido ? ` (${p.apelido})` : "");
    select.appendChild(opt);
  });
}

function handleAddPushAthlete() {
  const select = document.getElementById("push-select-athlete");
  if (!select) return;

  const val = select.value;
  if (!val) return;

  if (pushSelectedAthletes.some(a => String(a.id) === String(val))) {
    window.App.showToast("Atleta já adicionado à lista.", "warning");
    return;
  }

  const players = JSON.parse(localStorage.getItem("players")) || [];
  const player = players.find(p => String(p.id) === String(val));
  if (player) {
    pushSelectedAthletes.push({ id: player.id, nome: player.nome });
    renderSelectedPushAthletes();
    select.value = ""; // limpa o select
  }
}

function renderSelectedPushAthletes() {
  const container = document.getElementById("push-selected-athletes-container");
  if (!container) return;
  container.innerHTML = "";

  pushSelectedAthletes.forEach(a => {
    const badge = document.createElement("span");
    badge.style.cssText = `
      background: rgba(2, 132, 199, 0.1);
      color: #0284C7;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: 'Inter', sans-serif;
    `;

    badge.innerHTML = `
      ${a.nome}
      <span style="cursor: pointer; color: #ef4444; font-size: 16px; line-height: 1; font-weight: bold;" title="Remover atleta">&times;</span>
    `;

    badge.querySelector("span").onclick = () => {
      pushSelectedAthletes = pushSelectedAthletes.filter(x => String(x.id) !== String(a.id));
      renderSelectedPushAthletes();
    };

    container.appendChild(badge);
  });
}

function loadConfigs() {
  if (!window.App.currentGroup || !window.App.currentGroup.id) return;
  const config = window.App.currentGroup;

  const radio = document.querySelector(`input[name="config-tie"][value="${config.criterio_empate}"]`);
  if (radio) radio.checked = true;

  const winsVal = document.getElementById("config-wins-val");
  if (winsVal) winsVal.textContent = config.vitorias_para_sair || 2;

  const playersVal = document.getElementById("config-players-val");
  if (playersVal) playersVal.textContent = config.jogadores_por_time || 7;

  const teamsVal = document.getElementById("config-teams-val");
  if (teamsVal) teamsVal.textContent = config.quantidade_times || 2;

  const exitRuleSelect = document.getElementById("config-exit-rule");
  if (exitRuleSelect) exitRuleSelect.value = config.regra_saida || "final_fila";

  updateLicenseUI();
}

// --- Carrega os grupos (peladas) do gestor para agendamento ---------------
async function loadGestorGroups() {
  const select = document.getElementById("select-schedule-group");

  try {
    const grupos = await Api.getGruposDoGestor();
    window.App.gestorGroups = grupos; // Armazena em cache no global
    if (select) select.innerHTML = "";

    if (grupos.length === 0) {
      if (select) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "Nenhuma pelada criada";
        select.appendChild(opt);
      }
      return;
    }

    // Se o currentGroup estiver nulo ou pertencer a outro gestor, selecionar o primeiro grupo retornado
    const gestorId = window.Auth && window.Auth.currentUser ? window.Auth.currentUser.id : null;
    const belongsToMe = window.App.currentGroup && gestorId && String(window.App.currentGroup.gestor_id) === String(gestorId);

    if (grupos.length > 0 && (!window.App.currentGroup || !belongsToMe)) {
      window.App.currentGroup = grupos[0];
      if (window.Auth) window.Auth.currentGroup = grupos[0];
      localStorage.setItem('currentGroup', JSON.stringify(grupos[0]));

      // Carrega configurações correspondentes
      loadConfigs();
    }

    if (select) {
      grupos.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = g.nome;
        if (window.App.currentGroup && g.id === window.App.currentGroup.id) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Erro ao carregar grupos:", err);
  }
}

// --- Carrega e lista as datas agendadas da pelada selecionada ----------
async function loadDrawnDates() {
  const select = document.getElementById("select-schedule-group");
  const listContainer = document.getElementById("scheduled-dates-list");
  if (!select || !listContainer) return;

  const grupoId = select.value;
  if (!grupoId) {
    listContainer.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-caption);" class="text-inter">Selecione uma pelada para listar as datas.</div>`;
    return;
  }

  try {
    listContainer.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-caption);" class="text-inter">Carregando datas...</div>`;
    const datas = await Api.listarDatasDoGrupo(grupoId);

    if (datas.length === 0) {
      listContainer.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-caption);" class="text-inter">Nenhuma partida agendada.</div>`;
      return;
    }

    let html = "";
    datas.forEach(d => {
      const dataFormatada = Utils.formatDate(d.data);
      // Serializa os dados da partida em string para passar no clique do botão de configs
      const stringifiedData = encodeURIComponent(JSON.stringify(d));

      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-color); gap: 12px;">
          <div style="flex: 1;">
            <p class="text-inter" style="font-size: 14px; font-weight: 600; color: var(--text-heading);">
              📅 ${dataFormatada} às ${d.horario || '--:--'}
            </p>
            <p class="text-inter" style="font-size: 12px; color: var(--text-caption);">
              📍 ${d.local || 'Local indefinido'} | R$ ${d.valor_convocacao ? parseFloat(d.valor_convocacao).toFixed(2).replace('.', ',') : '0,00'}
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-sm btn-edit-date-configs" data-partida="${stringifiedData}" style="padding: 4px 8px; border: none; background: transparent; cursor: pointer; color: var(--primary); font-size: 16px;" title="Editar Regras da Partida">
              ⚙️
            </button>
            <button class="btn btn-sm btn-delete-date" data-id="${d.id}" style="padding: 4px 8px; border: none; background: transparent; cursor: pointer; color: var(--danger); font-size: 16px;" title="Excluir data">
              🗑️
            </button>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;

    // Vincula cliques nas engrenagens de configurações específicas por data
    listContainer.querySelectorAll(".btn-edit-date-configs").forEach(btn => {
      btn.onclick = (e) => {
        const rawData = e.currentTarget.getAttribute("data-partida");
        const partidaInfo = JSON.parse(decodeURIComponent(rawData));
        window.App.openModal("partida_config", partidaInfo);
      };
    });

    // Vincula evento de exclusão
    listContainer.querySelectorAll(".btn-delete-date").forEach(btn => {
      btn.onclick = async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        if (confirm("Tem certeza que deseja excluir esta partida agendada? Todas as convocações vinculadas a ela serão perdidas permanentemente!")) {
          try {
            window.App.showToast("Excluindo partida...", "info");
            const res = await Api.deletarData(id);
            if (res.error) {
              window.App.showToast(res.error, "error");
            } else {
              window.App.showToast("Partida excluída com sucesso!", "success");
              await loadDrawnDates();
            }
          } catch (err) {
            console.error(err);
            window.App.showToast("Erro ao deletar partida.", "error");
          }
        }
      };
    });
  } catch (err) {
    console.error("Erro ao listar datas:", err);
    listContainer.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--danger);" class="text-inter">Erro ao carregar datas.</div>`;
  }
}

function updateStep(type, diff) {
  const el = document.getElementById(`config-${type}-val`);
  if (!el) return;
  let val = parseInt(el.textContent);
  val += diff;

  if (type === "wins" && (val < 2 || val > 3)) return;
  if (type === "players" && (val < 4 || val > 11)) return;
  if (type === "teams" && (val < 2 || val > 10)) return;

  el.textContent = val;
}

function handleSave() {
  if (!window.App.currentGroup || !window.App.currentGroup.id) {
    window.App.showToast("Crie e selecione uma pelada para salvar configurações.", "warning");
    return;
  }

  const tieEl = document.querySelector('input[name="config-tie"]:checked');
  const tie = tieEl ? tieEl.value : "ambos_permanecem";
  const wins = parseInt(document.getElementById("config-wins-val").textContent);
  const players = parseInt(document.getElementById("config-players-val").textContent);
  const teams = parseInt(document.getElementById("config-teams-val").textContent);
  const exitRule = document.getElementById("config-exit-rule").value;
  const cost = parseFloat(document.getElementById("config-convocation-value").value) || 20.00;

  const configs = JSON.parse(localStorage.getItem("configs")) || [];
  let config = configs.find(c => c.grupo_id === window.App.currentGroup.id);

  if (!config) {
    config = { grupo_id: window.App.currentGroup.id };
    configs.push(config);
  }

  config.criterio_empate = tie;
  config.vitorias_para_sair = wins;
  config.jogadores_por_time = players;
  config.quantidade_times = teams;
  config.regra_saida = exitRule;
  config.valor_convocacao = cost;

  localStorage.setItem("configs", JSON.stringify(configs));
  window.App.showToast("Configurações do grupo atualizadas!");
}

// --- Criação de nova pelada principal (Grupo) ----------------------------
async function handleCreateGroup() {
  const nameInput = document.getElementById("new-group-name");
  const nome = nameInput.value.trim();

  if (!nome) {
    window.App.showToast("Informe o nome da pelada.", "warning");
    return;
  }

  // Abre o pop-up para o gestor escolher as configurações padrões da pelada
  window.App.openModal("criar_pelada", { nome });
}

// --- Agendamento de partidas e disparo de notificações -------------------
async function handleScheduleMatch() {
  const grupoId = document.getElementById("select-schedule-group").value;
  const data = document.getElementById("schedule-date").value;
  const horario = document.getElementById("schedule-time").value;
  const localSelect = document.getElementById("schedule-local");
  const local = localSelect ? localSelect.value : "";
  const valorConvocacao = parseFloat(document.getElementById("schedule-value").value) || 20.00;
  const chavePix = document.getElementById("schedule-pix-key") ? document.getElementById("schedule-pix-key").value : "";
  const chavePixNome = document.getElementById("schedule-pix-name") ? document.getElementById("schedule-pix-name").value : "";

  if (!grupoId || !data || !horario || !local) {
    window.App.showToast("Preencha todos os campos (selecione um local cadastrado).", "warning");
    return;
  }

  try {
    window.App.showToast("Agendando no Supabase...", "info");
    const responseData = await Api.agendarPelada(grupoId, data, horario, local, valorConvocacao, 20, chavePix, chavePixNome);

    if (responseData.error) {
      window.App.showToast(responseData.error, "error");
      return;
    }

    window.App.showToast(`Notificações enviadas via WhatsApp para ${responseData.totalNotificados} atletas ativos!`, "success");
    window.App.showToast("Partida agendada e convocação aberta!");

    // Limpa campos e recarrega lista de datas
    document.getElementById("schedule-date").value = "";
    document.getElementById("schedule-time").value = "";
    await loadDrawnDates();
  } catch (err) {
    console.error(err);
    window.App.showToast("Erro ao agendar partida.", "error");
  }
}

// --- Gerenciamento de Locais (CRUD) --------------------------------------
async function loadGestorLocations() {
  const select = document.getElementById("schedule-local");
  const listContainer = document.getElementById("locations-list-container");
  if (!select || !listContainer) return;

  try {
    const rawLocais = await Api.listarLocais();
    const locais = Array.isArray(rawLocais) ? rawLocais : (rawLocais?.locais || []);
    select.innerHTML = "";
    listContainer.innerHTML = "";

    if (locais.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Nenhum local cadastrado";
      select.appendChild(opt);

      listContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-caption);" class="text-inter">
          Nenhum local cadastrado. Use o painel ao lado para cadastrar!
        </div>
      `;
      return;
    }

    let html = "";
    locais.forEach(l => {
      // Popula o select do agendamento
      const opt = document.createElement("option");
      opt.value = l.nome; // Salva o nome na pelada para compatibilidade com o front legado
      opt.textContent = l.nome + (l.endereco ? ` (${l.endereco})` : "");
      select.appendChild(opt);

      // Renderiza na lista de locais
      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border-color); gap: 12px;">
          <div style="flex: 1;">
            <p class="text-inter" style="font-size: 14px; font-weight: 600; color: var(--text-heading);">
              📍 ${l.nome}
            </p>
            <p class="text-inter" style="font-size: 12px; color: var(--text-caption);">
              ${l.endereco || 'Sem endereço informado'}
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-edit-location" data-id="${l.id}" data-nome="${l.nome}" data-endereco="${l.endereco || ''}" style="border: none; background: transparent; cursor: pointer; color: var(--primary); font-size: 15px;" title="Editar local">
              ✏️
            </button>
            <button class="btn-delete-location" data-id="${l.id}" data-nome="${l.nome}" style="border: none; background: transparent; cursor: pointer; color: var(--danger); font-size: 15px;" title="Excluir local">
              🗑️
            </button>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;

    // Vincular cliques de editar e excluir locais
    listContainer.querySelectorAll(".btn-edit-location").forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const nome = e.currentTarget.getAttribute("data-nome");
        const endereco = e.currentTarget.getAttribute("data-endereco");
        editLocation(id, nome, endereco);
      };
    });

    listContainer.querySelectorAll(".btn-delete-location").forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const nome = e.currentTarget.getAttribute("data-nome");
        deleteLocation(id, nome);
      };
    });

  } catch (err) {
    console.error("Erro ao carregar locais:", err);
    listContainer.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--danger);" class="text-inter">Erro ao carregar locais.</div>`;
  }
}

function editLocation(id, nome, endereco) {
  document.getElementById("edit-location-id").value = id;
  document.getElementById("location-name").value = nome;
  document.getElementById("location-address").value = endereco;

  document.getElementById("location-form-title").textContent = "✏️ Editar Local";
  document.getElementById("btn-cancel-location-edit").classList.remove("hidden");
}

function handleCancelLocationEdit() {
  document.getElementById("edit-location-id").value = "";
  document.getElementById("location-name").value = "";
  document.getElementById("location-address").value = "";

  document.getElementById("location-form-title").textContent = "➕ Adicionar Local";
  document.getElementById("btn-cancel-location-edit").classList.add("hidden");
}

async function handleSaveLocation() {
  const id = document.getElementById("edit-location-id").value;
  const nome = document.getElementById("location-name").value.trim();
  const endereco = document.getElementById("location-address").value.trim();

  if (!nome) {
    window.App.showToast("Informe o nome do local.", "warning");
    return;
  }

  try {
    window.App.showToast("Salvando local...", "info");
    let res;
    if (id) {
      res = await Api.atualizarLocal(id, nome, endereco);
    } else {
      res = await Api.criarLocal(nome, endereco);
    }

    if (res.error) {
      window.App.showToast(res.error, "error");
      return;
    }

    window.App.showToast(id ? "Local atualizado com sucesso!" : "Local cadastrado com sucesso!", "success");
    handleCancelLocationEdit();
    await loadGestorLocations();
  } catch (err) {
    console.error(err);
    window.App.showToast("Erro ao salvar local.", "error");
  }
}

async function deleteLocation(id, nome) {
  if (!confirm(`Deseja realmente excluir o local "${nome}"?`)) return;

  try {
    window.App.showToast("Excluindo local...", "info");
    const res = await Api.deletarLocal(id);
    if (res.error) {
      window.App.showToast(res.error, "error");
      return;
    }

    window.App.showToast("Local excluído com sucesso!", "success");
    await loadGestorLocations();
  } catch (err) {
    console.error(err);
    window.App.showToast("Erro ao excluir local.", "error");
  }
}

function updateLicenseUI() {
  const statusLabel = document.getElementById("license-status-label");
  const expiryLabel = document.getElementById("license-expiry-label");
  const expiryDate = document.getElementById("license-expiry-date");

  if (!statusLabel) return;

  const config = window.App.currentGroup;
  if (!config) {
    statusLabel.textContent = "Nenhum Grupo";
    statusLabel.style.background = "rgba(255,255,255,0.1)";
    statusLabel.style.color = "var(--text-main)";
    if (expiryLabel) expiryLabel.style.display = "none";
    return;
  }

  // Verifica se a licença está ativa
  if (config.licenca_status === 'ativa' && config.licenca_expira_em) {
    const expDate = new Date(config.licenca_expira_em);

    // Se a data já passou, está expirada
    if (expDate < new Date()) {
      statusLabel.textContent = "Expirada";
      statusLabel.style.background = "rgba(255, 23, 68, 0.1)";
      statusLabel.style.color = "var(--danger)";
      if (expiryLabel) expiryLabel.style.display = "none";
    } else {
      statusLabel.textContent = "Ativa";
      statusLabel.style.background = "rgba(0, 230, 118, 0.1)";
      statusLabel.style.color = "var(--primary)";

      if (expiryLabel && expiryDate) {
        expiryDate.textContent = expDate.toLocaleDateString('pt-BR');
        expiryLabel.style.display = "block";
      }
    }
  } else {
    statusLabel.textContent = "Gratuito";
    statusLabel.style.background = "rgba(255, 214, 0, 0.1)";
    statusLabel.style.color = "#FFD600";
    if (expiryLabel) expiryLabel.style.display = "none";
  }
}

async function handleActivateLicense() {
  const keyInput = document.getElementById("license-key-input");
  if (!keyInput) return;

  const key = keyInput.value.trim();
  if (!key) {
    window.App.showToast("Digite o código da licença para ativar.", "warning");
    return;
  }

  if (!window.App.currentGroup || !window.App.currentGroup.id) {
    window.App.showToast("Crie ou selecione uma pelada primeiro.", "warning");
    return;
  }

  try {
    window.App.showToast("Ativando licença...", "info");

    const token = localStorage.getItem('token');
    const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? '/api'
      : '/api';

    const res = await fetch(`${apiBase}/vendas/ativar-manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        grupo_id: window.App.currentGroup.id,
        codigo_licenca: key
      })
    });

    const data = await res.json();
    if (!res.ok) {
      window.App.showToast(data.error || "Erro ao ativar licença.", "error");
      return;
    }

    window.App.showToast("Licença ativada com sucesso!", "success");
    keyInput.value = "";

    // Atualiza o grupo ativo em cache
    window.App.currentGroup.licenca_codigo = data.grupo.licenca_codigo;
    window.App.currentGroup.licenca_expira_em = data.grupo.licenca_expira_em;
    window.App.currentGroup.licenca_status = data.grupo.licenca_status;

    // Atualiza o gestorGroups cacheado
    if (window.App.gestorGroups) {
      const idx = window.App.gestorGroups.findIndex(g => g.id === window.App.currentGroup.id);
      if (idx >= 0) {
        window.App.gestorGroups[idx] = { ...window.App.currentGroup };
      }
    }

    // Atualiza o Auth.currentGroup e salva no localStorage
    if (window.Auth) {
      window.Auth.currentGroup = { ...window.App.currentGroup };
      localStorage.setItem('currentGroup', JSON.stringify(window.Auth.currentGroup));
    }

    updateLicenseUI();
  } catch (err) {
    console.error(err);
    window.App.showToast("Erro ao conectar com o servidor.", "error");
  }
}
