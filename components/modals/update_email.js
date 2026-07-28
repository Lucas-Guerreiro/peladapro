// ==========================================================================
// MODAL: ATUALIZAÇÃO OBRIGATÓRIA DE E-MAIL (update_email.js)
// ==========================================================================

window.App = window.App || {};

window.App.initModalUpdate_email = function(data) {
  const form = document.getElementById('form-update-email');
  const btn = document.getElementById('btn-submit-update-email');
  const input = document.getElementById('input-new-real-email');

  if (input) {
    setTimeout(() => input.focus(), 150);
  }

  if (btn) {
    btn.onclick = function(e) {
      if (e) e.preventDefault();
      window.App.submitUpdatedEmail();
    };
  }

  if (form) {
    form.onsubmit = function(e) {
      if (e) e.preventDefault();
      window.App.submitUpdatedEmail();
    };
  }
};
