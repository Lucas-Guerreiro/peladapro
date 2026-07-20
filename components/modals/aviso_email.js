// ==========================================================================
// MODAL: AVISO EMAIL (aviso_email.js)
// ==========================================================================

window.App.initModalAviso_email = function(data) {
  const email = data.email || 'seu e-mail';
  const emailEl = document.getElementById('aviso-email-destinatario');
  if (emailEl) emailEl.textContent = email;

  const btnEntendi = document.getElementById('btn-entendi-aviso-email');
  if (btnEntendi) {
    btnEntendi.onclick = function() {
      // Fecha o modal
      window.App.closeModal();

      // Certifica que exibe o formulário de login (ocultando o de cadastro)
      const regForm = document.getElementById('auth-register-form');
      const loginForm = document.getElementById('auth-login-form');
      if (regForm && loginForm) {
        regForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
      }
    };
  }

  // Ativar ícones Feather no modal
  if (window.feather) {
    feather.replace();
  }
};
