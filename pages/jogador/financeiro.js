// ==========================================================================
// pages/jogador/financeiro.js — Espelho Completo do Financeiro para o Atleta
// ==========================================================================

window.App = window.App || {};

window.App.initFinanceiro = window.App.initFinanceiro || async function() {
  if (window.Router && window.Router._loadScript) {
    window.Router._loadScript(`pages/gestor/financeiro.js?v=${Date.now()}`, async () => {
      if (window.App && window.App.renderFinanceiroData) {
        await window.App.initFinanceiro();
      }
    });
  }
};

// Se o script pages/gestor/financeiro.js já foi ou precisa ser carregado:
if (typeof window.App.renderFinanceiroData !== 'function') {
  const script = document.createElement('script');
  script.src = `pages/gestor/financeiro.js?v=${Date.now()}`;
  script.onload = () => {
    if (window.App && window.App.initFinanceiro) {
      window.App.initFinanceiro();
    }
  };
  document.head.appendChild(script);
} else {
  setTimeout(() => {
    if (window.App && window.App.initFinanceiro) {
      window.App.initFinanceiro();
    }
  }, 50);
}

