// ==========================================================================
// pages/jogador/financeiro.js — Lógica de Finanças do Atleta
// ==========================================================================

var FinanceiroAtleta = {

  init: function() {
    this.renderBalanceAndAlerts();
    this.loadTransactions();
  },

  // --- Renderizar Saldo e Alertas de Pix ---
  renderBalanceAndAlerts: async function() {
    const user = Auth.currentUser;
    const balanceEl = document.getElementById('player-wallet-balance');
    const debtAlert = document.getElementById('player-wallet-debt-alert');
    const pixBox = document.getElementById('player-wallet-pix-box');
    const pixKeyEl = document.getElementById('player-wallet-pix-key');
    const btnCopyPix = document.getElementById('btn-player-wallet-copy-pix');

    if (!user) return;

    // 1. Atualizar Saldo
    const saldo = parseFloat(user.saldo || 0);
    if (balanceEl) {
      balanceEl.textContent = window.Utils ? window.Utils.formatCurrency(saldo) : `R$ ${saldo.toFixed(2).replace('.', ',')}`;
      balanceEl.style.color = saldo < 0 ? 'var(--danger)' : '#059669';
    }

    // 2. Tratar Alertas e Pix se Devedor
    if (saldo < 0) {
      if (debtAlert) debtAlert.style.display = 'flex';
      
      // Buscar chave Pix do grupo configurada em alguma pelada
      const group = Auth.currentGroup;
      if (group && group.id) {
        try {
          const peladas = Api.getPeladas() || [];
          const peladasDoGrupo = peladas.filter(p => String(p.grupo_id) === String(group.id));
          
          // Achar alguma pelada com chave Pix
          const peladaComPix = peladasDoGrupo.find(p => p.chave_pix);
          
          if (peladaComPix && pixKeyEl && pixBox) {
            pixKeyEl.textContent = peladaComPix.chave_pix;
            pixBox.style.display = 'flex';

            if (btnCopyPix) {
              btnCopyPix.onclick = function() {
                navigator.clipboard.writeText(peladaComPix.chave_pix).then(() => {
                  window.Utils ? window.Utils.toast('Chave Pix copiada! 📋', 'success') : alert('Chave Pix copiada!');
                }).catch(() => {
                  window.Utils ? window.Utils.toast('Erro ao copiar automaticamente.', 'warning') : null;
                });
              };
            }
          }
        } catch (e) {
          console.warn('[FinanceiroAtleta] Erro ao carregar chave Pix do grupo:', e);
        }
      }
    } else {
      if (debtAlert) debtAlert.style.display = 'none';
      if (pixBox) pixBox.style.display = 'none';
    }
  },

  // --- Carregar Histórico de Transações Pessoais ---
  loadTransactions: async function() {
    const tbody = document.getElementById('player-finance-transactions-body');
    if (!tbody) return;

    const group = Auth.currentGroup;
    const user = Auth.currentUser;

    if (!group || !group.id || !user || !user.id) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-caption);">Nenhum grupo ativo selecionado.</td></tr>`;
      return;
    }

    try {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-caption);">Carregando lançamentos...</td></tr>`;

      // 1. Chamar a API comum de transações do grupo
      const dbTx = await Api.listarTransacoesDoGrupo(group.id);

      if (!Array.isArray(dbTx) || dbTx.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-caption);">Nenhuma transação registrada.</td></tr>`;
        return;
      }

      // 2. Filtrar transações apenas do jogador logado
      const transacoesJogador = dbTx.filter(t => String(t.usuario_id) === String(user.id));

      if (transacoesJogador.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-caption);">Nenhuma movimentação em sua carteira ainda.</td></tr>`;
        return;
      }

      // 3. Renderizar transações
      let html = '';
      transacoesJogador.forEach(t => {
        const dateFormatted = window.Utils ? window.Utils.formatDate(t.data) : (t.data ? new Date(t.data).toLocaleDateString("pt-BR") : '—');
        
        let valColor = "var(--text-caption)";
        let sign = "";
        
        // Na carteira do jogador: créditos entram como entrada (+), débitos como gasto (-)
        if (t.tipo === "credito") {
          valColor = "#059669"; // Verde
          sign = "+";
        } else if (t.tipo === "debito") {
          valColor = "var(--danger)"; // Vermelho
          sign = "-";
        }

        const valNum = isNaN(parseFloat(t.valor)) ? 0 : parseFloat(t.valor);
        const valText = window.Utils ? window.Utils.formatCurrency(valNum) : `R$ ${valNum.toFixed(2).replace(".", ",")}`;

        // Se a descrição for de comprovante Pix, a gente limpa a string ou exibe como Recarga
        let desc = t.descricao || 'Lançamento';
        if (desc.startsWith("Recarga Pix") || desc.startsWith("Presença de")) {
          // Mantém ou formata para exibição amigável
          desc = t.descricao;
        }

        html += `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 14px 20px; font-size: 13px; color: #475569;">${dateFormatted}</td>
            <td style="padding: 14px 20px;">
              <span style="font-weight: 600; font-size: 13px; display:block; color: #0F172A;">${desc}</span>
            </td>
            <td style="padding: 14px 20px; text-align: right; font-weight: bold; color: ${valColor}; font-size: 14px;">
              ${sign} ${valText}
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;

    } catch (err) {
      console.error('[FinanceiroAtleta] Erro ao carregar transações:', err);
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--danger);">Erro ao carregar histórico.</td></tr>`;
    }
  }

};

// --- Ponto de entrada do Roteador ---
window.App.initFinanceiro = function() {
  FinanceiroAtleta.init();
};
