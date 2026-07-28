// ==========================================================================
// MODAL: ATUALIZAÇÃO OBRIGATÓRIA DE E-MAIL (update_email.js)
// ==========================================================================

window.App = window.App || {};

window.App.initModalUpdate_email = function(data) {
  const input = document.getElementById('input-new-real-email');
  if (input) {
    input.focus();
  }
};
