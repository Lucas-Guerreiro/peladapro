// ==========================================================================
// PÁGINA: SELEÇÃO DE PERFIL - DUPLO ACESSO (selecionar_perfil.js)
// PeladaPro · Fundacional
// ==========================================================================

window.App = window.App || {};

window.App.initSelecionarPerfil = function() {
  const skeleton = document.getElementById("profile-skeleton");
  const errorBox = document.getElementById("profile-error");
  const cards = document.getElementById("profile-cards");
  const chkRemember = document.getElementById("chk-remember-profile");

  if (!Auth.currentUser) {
    if (errorBox) errorBox.classList.remove("hidden");
    if (cards) cards.classList.add("hidden");
    return;
  }

  // Se o usuário possui preferência salva previamente no localStorage
  const savedProfile = localStorage.getItem("ultimo_perfil");
  if (savedProfile && chkRemember) {
    chkRemember.checked = true;
  }

  // Suporte a atalhos de acessibilidade (Enter/Espaço)
  const cardGestor = document.getElementById("card-profile-gestor");
  const cardJogador = document.getElementById("card-profile-jogador");

  if (cardGestor) {
    cardGestor.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.App.selectRole("gestor");
      }
    };
  }

  if (cardJogador) {
    cardJogador.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.App.selectRole("jogador");
      }
    };
  }
};

window.App.selectRole = function(role) {
  if (!role || (role !== "gestor" && role !== "jogador")) return;

  const chkRemember = document.getElementById("chk-remember-profile");
  const remember = chkRemember ? chkRemember.checked : false;

  if (remember) {
    localStorage.setItem("ultimo_perfil", role);
  } else {
    localStorage.removeItem("ultimo_perfil");
  }

  // Define o papel selecionado no módulo de autenticação e navega para o dashboard
  if (window.Auth && window.Auth.selectRole) {
    window.Auth.selectRole(role);
  }
};
