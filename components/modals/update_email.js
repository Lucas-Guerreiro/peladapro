// ==========================================================================
// MODAL: ATUALIZAÇÃO OBRIGATÓRIA DE E-MAIL (update_email.js)
// ==========================================================================

window.App = window.App || {};

window.App.submitUpdatedEmail = async function() {
  const input = document.getElementById('input-new-real-email');
  if (!input) {
    console.error('[submitUpdatedEmail] Elemento #input-new-real-email não encontrado.');
    return;
  }
  const newEmail = input.value.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!newEmail || !emailRegex.test(newEmail)) {
    if (window.Utils) Utils.toast('Por favor, informe um e-mail válido (ex: seuemail@gmail.com).', 'warning');
    else alert('Por favor, informe um e-mail válido.');
    return;
  }

  if (newEmail.includes('@teste.com') || newEmail.includes('@teste.')) {
    if (window.Utils) Utils.toast('O novo e-mail não pode conter @teste.com. Digite seu e-mail verdadeiro.', 'error');
    else alert('O novo e-mail não pode conter @teste.com.');
    return;
  }

  try {
    if (window.Utils) Utils.toast('Atualizando seu e-mail no servidor...', 'info');
    const token = localStorage.getItem('token');
    const res = await fetch('/api/usuarios/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email: newEmail })
    });

    const data = await res.json();
    if (!res.ok) {
      if (window.Utils) Utils.toast(data.error || 'Erro ao atualizar e-mail.', 'error');
      else alert(data.error || 'Erro ao atualizar e-mail.');
      return;
    }

    if (window.Auth && window.Auth.currentUser) {
      window.Auth.currentUser.email = newEmail;
      localStorage.setItem('currentUser', JSON.stringify(window.Auth.currentUser));
    }

    if (window.Utils) Utils.toast('E-mail atualizado com sucesso! 🎉', 'success');
    
    // Fecha e remove o modal
    const backdrop = document.getElementById('modal-update-email-backdrop') || document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
    const root = document.getElementById('modal-container-root');
    if (root) root.innerHTML = '';
  } catch(err) {
    console.error(err);
    if (window.Utils) Utils.toast('Erro de conexão ao atualizar e-mail.', 'error');
    else alert('Erro de conexão ao atualizar e-mail.');
  }
};

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
