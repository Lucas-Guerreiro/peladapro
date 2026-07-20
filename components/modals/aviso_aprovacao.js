// ==========================================================================
// MODAL: AVISO APROVACAO (aviso_aprovacao.js)
// ==========================================================================

window.App.initModalAviso_aprovacao = function(data) {
  const nome = data.nome || 'Atleta';
  const nomeEl = document.getElementById('aviso-aprovacao-atleta');
  if (nomeEl) nomeEl.textContent = nome;

  const btnEntendi = document.getElementById('btn-entendi-aviso-aprovacao');
  if (btnEntendi) {
    btnEntendi.onclick = function() {
      // Fecha o modal
      window.App.closeModal();

      // Força a exibição do formulário de login (ocultando o de cadastro)
      const regForm = document.getElementById('auth-register-form');
      const loginForm = document.getElementById('auth-login-form');
      if (regForm && loginForm) {
        regForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
      }
    };
  }

  // Inicializar ícones Feather no modal
  if (window.feather) {
    feather.replace();
  }
};
