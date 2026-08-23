// ==========================================================================
// pages/jogador/financeiro.js — Lógica de Finanças do Grupo para o Atleta
// ==========================================================================

var FinanceiroAtleta = {

  init: function() {
    this.renderKPIs();
  },

  // --- Renderizar os 3 Cards de KPIs Financeiros do Grupo ---
  renderKPIs: async function() {
    const elCaixa = document.getElementById('player-kpi-caixa');
    const elArrecadado = document.getElementById('player-kpi-arrecadado');
    const elDespesas = document.getElementById('player-kpi-despesas');

    let group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    if (!group || !group.id) {
      try { group = JSON.parse(localStorage.getItem("currentGroup")); } catch (e) {}
    }

    if (!group || !group.id) {
      if (elCaixa) elCaixa.textContent = "R$ 0,00";
      if (elArrecadado) elArrecadado.textContent = "R$ 0,00";
      if (elDespesas) elDespesas.textContent = "R$ 0,00";
      return;
    }

    try {
      let rawTransactions = [];
      if (window.Api && window.Api.listarTransacoesDoGrupo) {
        const dbTx = await window.Api.listarTransacoesDoGrupo(group.id);
        if (Array.isArray(dbTx)) rawTransactions = dbTx;
      }

      // Normaliza valores estritamente: créditos = Entradas, débitos = Despesas
      let totalArrecadadoGeral = 0;
      let totalDespesasGeral = 0;

      rawTransactions.forEach(t => {
        const rawVal = parseFloat(t.valor || 0);
        if (t.tipo === 'credito') {
          totalArrecadadoGeral += rawVal;
        } else if (t.tipo === 'debito') {
          totalDespesasGeral += rawVal;
        }
      });

      const caixaAtual = totalArrecadadoGeral - totalDespesasGeral;

      const formatBRL = (val) => {
        return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };

      if (elCaixa) elCaixa.textContent = formatBRL(caixaAtual);
      if (elArrecadado) elArrecadado.textContent = formatBRL(totalArrecadadoGeral);
      if (elDespesas) elDespesas.textContent = formatBRL(totalDespesasGeral);

    } catch (err) {
      console.error('[FinanceiroAtleta.renderKPIs]', err);
    }
  }

};

window.App.initJogadorFinanceiro = function() {
  FinanceiroAtleta.init();
};
