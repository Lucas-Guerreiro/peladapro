// --- INTERCEPTADOR DO LOCALSTORAGE PARA EVITAR QUOTAEXCEEDEDERROR ---
(function() {
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    try {
      originalSetItem.apply(this, arguments);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
        console.warn('[Storage] Cota do localStorage excedida. Tentando liberar espaço limpando caches não-essenciais...');
        const keysToClear = ['players', 'transactions', 'groupEmblems', 'performanceData'];
        keysToClear.forEach(k => {
          try { localStorage.removeItem(k); } catch(err) {}
        });
        
        try {
          originalSetItem.apply(this, arguments);
          console.log(`[Storage] Chave '${key}' salva após limpeza de cache.`);
        } catch (retryErr) {
          console.error(`[Storage] Falha crítica ao salvar '${key}' mesmo após limpeza. O dado não foi salvo localmente:`, retryErr);
        }
      } else {
        console.error(`[Storage] Erro ao salvar no localStorage para '${key}':`, e);
      }
    }
  };
})();

// --- ESCOPO GLOBAL DA SPA ---
window.App = {
  currentUser: null,
  currentGroup: null,
  activeTabId: null,
  liveMatch: {
    teamA: "Time Azul",
    teamB: "Time Amarelo",
    scoreA: 0,
    scoreB: 0,
    isPlaying: false,
    timerSeconds: 0,
    rules: "Ambos permanecem | Limite 2 Vitórias"
  },
  waitingQueue: ["Time Vermelho", "Time Verde"],
  presentPlayers: [],
  drawnTeams: [],
  
  // Funções Globais expostas
  showToast,
  openModal,
  closeModal,
  renderGroupSelectors,
  triggerAbaNavigation,
  loadScript,
  safeLocalStorageSetItem
};

// --- FUNÇÃO PARA CARREGAR SCRIPT DINÂMICO CLÁSSICO ---
function loadScript(src, callback) {
  const old = document.querySelector(`script[data-dynamic="${src}"]`);
  if (old) old.remove();

  const s = document.createElement("script");
  s.src = src + "?v=" + Date.now();
  s.setAttribute("data-dynamic", src);
  s.onload = () => {
    if (callback) callback();
  };
  s.onerror = (err) => console.error(`Erro ao carregar script ${src}:`, err);
  document.head.appendChild(s);
}

// --- INICIALIZAÇÃO DE DADOS MOCKADOS VIA FETCH ---
async function checkAndInitDatabase() {
  const keys = ["groups", "players", "peladas", "configs", "transactions"];
  const missing = keys.some(k => !localStorage.getItem(k));

  if (missing) {
    try {
      const [groups, players, peladas, configs, transactions] = await Promise.all([
        fetch("./assets/data/groups.json").then(r => r.json()),
        fetch("./assets/data/players.json").then(r => r.json()),
        fetch("./assets/data/peladas.json").then(r => r.json()),
        fetch("./assets/data/configs.json").then(r => r.json()),
        fetch("./assets/data/transactions.json").then(r => r.json())
      ]);

      localStorage.setItem("groups", JSON.stringify(groups));
      localStorage.setItem("players", JSON.stringify(players));
      localStorage.setItem("peladas", JSON.stringify(peladas));
      localStorage.setItem("configs", JSON.stringify(configs));
      localStorage.setItem("transactions", JSON.stringify(transactions));
      localStorage.setItem("teams", JSON.stringify([]));
      localStorage.setItem("matches", JSON.stringify([]));
      
      console.log("Banco de dados local inicializado.");
    } catch (err) {
      console.error("Erro ao ler dados mockados:", err);
    }
  }
}

// --- BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", async () => {
  await checkAndInitDatabase();
  initAuthEvents();
  initFormMasks();
  renderGroupSelectors();
  feather.replace();
});

// --- RENDERIZAR GRUPOS NO SELETOR GLOBAL ---
function renderGroupSelectors() {
  const groups = JSON.parse(localStorage.getItem("groups")) || [];
  const globalSelector = document.getElementById("global-group-selector");
  if (!globalSelector) return;

  globalSelector.innerHTML = "";
  groups.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.nome;
    globalSelector.appendChild(opt);
  });

  if (!window.App.currentGroup && groups.length > 0) {
    window.App.currentGroup = groups[0];
  }

  if (window.App.currentGroup) {
    globalSelector.value = window.App.currentGroup.id;
  }
}

// --- LOGIN E NAVEGAÇÃO ---
let currentLoginRole = "player";
let selectedRegisterRating = 0;

function initAuthEvents() {
  document.getElementById("tab-login-player").onclick = () => switchLoginRole("player");
  document.getElementById("tab-login-manager").onclick = () => switchLoginRole("manager");

  document.getElementById("link-goto-register").onclick = (e) => {
    e.preventDefault();
    document.getElementById("auth-login-form").classList.add("hidden");
    document.getElementById("auth-register-form").classList.remove("hidden");
  };

  document.getElementById("link-goto-login").onclick = (e) => {
    e.preventDefault();
    document.getElementById("auth-register-form").classList.add("hidden");
    document.getElementById("auth-login-form").classList.remove("hidden");
  };

  const regStars = document.querySelectorAll("#register-stars-selector .rating-star");
  regStars.forEach(star => {
    star.onclick = () => {
      const val = parseInt(star.getAttribute("data-value"));
      selectedRegisterRating = val;
      regStars.forEach((s, idx) => {
        if (idx < val) s.classList.add("active");
        else s.classList.remove("active");
      });
      validateRegisterForm();
    };
  });

  document.getElementById("btn-submit-login").onclick = handleLogin;
  document.getElementById("btn-submit-register").onclick = handleRegister;

  document.getElementById("btn-quick-player").onclick = () => {
    const players = JSON.parse(localStorage.getItem("players")) || [];
    window.App.currentUser = players[0];
    showToast(`Logado como: ${window.App.currentUser.nome}`);
    enterDashboard("player");
  };

  document.getElementById("btn-quick-manager").onclick = () => {
    window.App.currentUser = { id: "u-gestor", nome: "Gestor Master", gestor: true };
    showToast("Logado como Gestor");
    enterDashboard("manager");
  };

  document.getElementById("btn-logout").onclick = () => {
    window.App.currentUser = null;
    document.getElementById("main-header").classList.add("hidden");
    document.getElementById("main-view-container").classList.add("hidden");
    document.getElementById("view-auth").classList.remove("hidden");
    showToast("Sessão encerrada.");
  };

  document.getElementById("global-group-selector").onchange = (e) => {
    const groups = JSON.parse(localStorage.getItem("groups"));
    window.App.currentGroup = groups.find(g => g.id === e.target.value);
    showToast(`Grupo alterado: ${window.App.currentGroup.nome}`);
    
    if (window.App.activeTabId) {
      loadActiveSubPage();
    }
  };
}

function switchLoginRole(role) {
  currentLoginRole = role;
  const tabPlayer = document.getElementById("tab-login-player");
  const tabManager = document.getElementById("tab-login-manager");
  const label = document.getElementById("label-login-identifier");
  const input = document.getElementById("login-identifier");

  if (role === "player") {
    tabPlayer.classList.add("active");
    tabManager.classList.remove("active");
    label.textContent = "E-mail ou CPF";
    input.placeholder = "Digite seu CPF ou E-mail";
  } else {
    tabPlayer.classList.remove("active");
    tabManager.classList.add("active");
    label.textContent = "Código do Gestor ou E-mail";
    input.placeholder = "Digite seu Código de Gestor";
  }
}

function handleLogin() {
  const idValue = document.getElementById("login-identifier").value.trim();
  if (!idValue) {
    showToast("Preencha o campo de identificação.", "error");
    return;
  }

  if (currentLoginRole === "player") {
    const players = JSON.parse(localStorage.getItem("players")) || [];
    const player = players.find(p => p.cpf === idValue || p.nome.toLowerCase().includes(idValue.toLowerCase()));
    
    if (player) {
      if (!player.ativo) {
        showToast("Jogador inativo.", "error");
        return;
      }
      window.App.currentUser = player;
      showToast(`Bem-vindo, ${player.nome}!`);
      enterDashboard("player");
    } else {
      showToast("Jogador não encontrado.", "error");
    }
  } else {
    if (idValue === "gestor" || idValue === "u-gestor" || idValue.toLowerCase().includes("gestor")) {
      window.App.currentUser = { id: "u-gestor", nome: "Gestor Master", gestor: true };
      showToast("Painel Administrativo Acessado!");
      enterDashboard("manager");
    } else {
      showToast("Código de gestor inválido.", "error");
    }
  }
}

function handleRegister() {
  const name = document.getElementById("register-name").value.trim();
  const dob = document.getElementById("register-dob").value;
  const cpf = document.getElementById("register-cpf").value;
  const whatsapp = document.getElementById("register-whatsapp").value;
  const isGk = document.getElementById("register-is-gk").checked;

  const players = JSON.parse(localStorage.getItem("players")) || [];

  if (players.some(p => p.cpf === cpf)) {
    showToast("CPF já cadastrado.", "error");
    return;
  }

  const newPlayer = {
    id: "p_" + Date.now(),
    nome: name,
    data_nascimento: dob,
    cpf: cpf,
    whatsapp: whatsapp,
    goleiro: isGk,
    autoavaliacao: selectedRegisterRating,
    ativo: true,
    saldo: 0.00,
    gols: 0,
    partidas: 0,
    avaliacao_media: selectedRegisterRating
  };

  players.push(newPlayer);
  localStorage.setItem("players", JSON.stringify(players));
  showToast("Conta criada com sucesso!");

  // Reset
  document.getElementById("register-name").value = "";
  document.getElementById("register-dob").value = "";
  document.getElementById("register-cpf").value = "";
  document.getElementById("register-whatsapp").value = "";
  document.getElementById("register-is-gk").checked = false;
  selectedRegisterRating = 0;
  document.querySelectorAll("#register-stars-selector .rating-star").forEach(s => s.classList.remove("active"));
  
  document.getElementById("auth-register-form").classList.add("hidden");
  document.getElementById("auth-login-form").classList.remove("hidden");
}

async function enterDashboard(role) {
  document.getElementById("view-auth").classList.add("hidden");
  document.getElementById("main-header").classList.remove("hidden");
  document.getElementById("header-user-name").textContent = window.App.currentUser.nome;

  const viewContainer = document.getElementById("main-view-container");
  viewContainer.classList.remove("hidden");

  if (role === "player") {
    const res = await fetch("./pages/jogador/layout.html");
    viewContainer.innerHTML = await res.text();
    setupLayoutAbas("player");
    triggerAbaNavigation("jogador/dashboard.html", "dashboard");
  } else {
    const res = await fetch("./pages/gestor/layout.html");
    viewContainer.innerHTML = await res.text();
    setupLayoutAbas("manager");
    triggerAbaNavigation("gestor/atletas.html", "atletas");
  }
}

function setupLayoutAbas(role) {
  const tabs = document.querySelectorAll(".tabs-navigation .tab-btn");
  tabs.forEach(btn => {
    btn.onclick = () => {
      tabs.forEach(t => t.classList.remove("active"));
      btn.classList.add("active");

      const target = btn.getAttribute("data-target");
      const name = btn.getAttribute("data-name");
      triggerAbaNavigation(target, name);
    };
  });
}

async function triggerAbaNavigation(targetHtmlPath, tabName) {
  window.App.activeTabId = tabName;
  const isGestor = window.App.currentUser.gestor;
  const container = document.getElementById(isGestor ? "manager-tab-content-container" : "player-tab-content-container");
  if (!container) return;

  container.innerHTML = `
    <div class="card" style="padding: 32px;">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text" style="width: 80%;"></div>
      <div class="skeleton skeleton-text" style="width: 90%;"></div>
    </div>
  `;

  try {
    const res = await fetch(`./pages/${targetHtmlPath}?v=${Date.now()}`);
    container.innerHTML = await res.text();

    // Carregar script de forma clássica injetada
    const jsPath = `./pages/${targetHtmlPath.replace(".html", ".js")}`;
    loadScript(jsPath, () => {
      // Executa o init da página que registrou-se no window.App.Pages
      const initName = `init${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
      if (window.App[initName]) {
        window.App[initName]();
      }
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="padding:20px; color:var(--danger)">Erro ao carregar aba.</p>`;
  }
  feather.replace();
}

function loadActiveSubPage() {
  const activeBtn = document.querySelector(".tabs-navigation .tab-btn.active");
  if (activeBtn) {
    const target = activeBtn.getAttribute("data-target");
    const name = activeBtn.getAttribute("data-name");
    triggerAbaNavigation(target, name);
  }
}

// --- GERENCIADOR DE MODAIS CLÁSSICOS ---
async function openModal(modalName, data = {}) {
  try {
    const root = document.getElementById("modal-container-root");
    const res = await fetch(`./components/modals/${modalName}.html`);
    root.innerHTML = await res.text();

    const jsPath = `./components/modals/${modalName}.js`;
    loadScript(jsPath, () => {
      const initName = `initModal${modalName.charAt(0).toUpperCase() + modalName.slice(1)}`;
      if (window.App[initName]) {
        window.App[initName](data);
      }
    });

    const backdrop = root.querySelector(".modal-backdrop");
    if (backdrop) {
      setTimeout(() => backdrop.classList.add("active"), 10);
    }
  } catch (err) {
    console.error(err);
  }
}

function closeModal() {
  const root = document.getElementById("modal-container-root");
  const backdrop = root.querySelector(".modal-backdrop");
  if (backdrop) {
    backdrop.classList.remove("active");
    setTimeout(() => {
      root.innerHTML = "";
    }, 300);
  }
}

// --- MÁSCARAS E TOASTS ---
function initFormMasks() {
  const cpf = document.getElementById("register-cpf");
  const wa = document.getElementById("register-whatsapp");

  if (cpf) {
    cpf.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 9) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
      else if (v.length > 6) v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
      else if (v.length > 3) v = `${v.slice(0, 3)}.${v.slice(3)}`;
      e.target.value = v;
      validateRegisterForm();
    });
  }

  if (wa) {
    wa.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 11);
      if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      else if (v.length > 0) v = `(${v}`;
      e.target.value = v;
      validateRegisterForm();
    });
  }
}

function validateRegisterForm() {
  const name = document.getElementById("register-name").value.trim();
  const dob = document.getElementById("register-dob").value;
  const cpf = document.getElementById("register-cpf").value;
  const whatsapp = document.getElementById("register-whatsapp").value;
  const btn = document.getElementById("btn-submit-register");

  let ageValid = false;
  if (dob) {
    const birthday = new Date(dob);
    const age = Math.abs(new Date(Date.now() - birthday.getTime()).getUTCFullYear() - 1970);
    ageValid = age >= 16;
  }

  const formValid = name.length >= 3 && ageValid && cpf.length === 14 && whatsapp.length === 15 && selectedRegisterRating > 0;
  if (btn) btn.disabled = !formValid;
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container") || (window.Utils && window.Utils._getContainer());
  if (!container) return;

  // Limpa toasts anteriores acumulados para exibir apenas 1 aviso por vez
  container.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "check-circle";
  if (type === "warning") icon = "alert-triangle";
  if (type === "error") icon = "x-octagon";
  if (type === "info") icon = "info";

  toast.innerHTML = `
    <i data-feather="${icon}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  if (window.feather) feather.replace();

  setTimeout(() => {
    toast.style.animation = "toastOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function safeLocalStorageSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
      console.warn('[Storage] Cota do localStorage excedida. Tentando liberar espaço limpando caches não-essenciais...');
      const keysToClear = ['players', 'transactions', 'groupEmblems', 'performanceData'];
      
      keysToClear.forEach(k => {
        try { localStorage.removeItem(k); } catch(err) {}
      });
      
      try {
        localStorage.setItem(key, value);
        console.log(`[Storage] Chave '${key}' salva com sucesso após limpeza de cache.`);
        return true;
      } catch (retryErr) {
        console.error(`[Storage] Falha crítica ao salvar '${key}' mesmo após limpeza:`, retryErr);
        return false;
      }
    }
    console.error(`[Storage] Erro ao salvar no localStorage para '${key}':`, e);
    return false;
  }
  return true;
}
