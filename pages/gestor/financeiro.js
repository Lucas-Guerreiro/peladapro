// ==========================================================================
// PÁGINA: GESTOR - FINANCEIRO (financeiro.js)
// ==========================================================================

window.App.initFinanceiro = async function() {
  await window.App.renderFinanceiroData();

  const btnExpense = document.getElementById("btn-open-expense-modal");
  if (btnExpense) {
    btnExpense.onclick = () => window.App.openModal("despesa");
  }
  
  window.manualFinanceSettlement = manualFinanceSettlement;
};

window.App.renderFinanceiroData = async function() {
  let transactions = [];
  let players = [];

  try { transactions = JSON.parse(localStorage.getItem("transactions")) || []; } catch(e) {}
  try { players = JSON.parse(localStorage.getItem("players")) || []; } catch(e) {}

  // Carrega lista atualizada de atletas via API se a memória local estiver vazia ou nula
  if ((!players || players.length === 0) && window.Api && window.Api.getPlayers) {
    try {
      players = await window.Api.getPlayers();
      if (Array.isArray(players)) {
        localStorage.setItem("players", JSON.stringify(players));
      }
    } catch(e) {}
  }

  let receipts = 0;
  let expenses = 0;

  (transactions || []).forEach(t => {
    const rawVal = t.valor !== undefined && t.valor !== null ? t.valor : t.value;
    const parsedVal = parseFloat(rawVal);
    const numVal = isNaN(parsedVal) ? 0 : parsedVal;

    if (t.sinal === "credito") receipts += numVal;
    else expenses += numVal;
  });

  const net = receipts - expenses;

  const recEl = document.getElementById("finances-receipts");
  const expEl = document.getElementById("finances-expenses");
  const netEl = document.getElementById("finances-net");

  if (recEl) recEl.textContent = window.Utils ? window.Utils.formatCurrency(receipts) : `R$ ${receipts.toFixed(2).replace(".", ",")}`;
  if (expEl) expEl.textContent = window.Utils ? window.Utils.formatCurrency(expenses) : `R$ ${expenses.toFixed(2).replace(".", ",")}`;
  if (netEl) {
    netEl.textContent = window.Utils ? window.Utils.formatCurrency(net) : `R$ ${net.toFixed(2).replace(".", ",")}`;
    netEl.style.color = net >= 0 ? "var(--success)" : "var(--danger)";
  }

  const transBody = document.getElementById("finances-transactions-body");
  if (transBody) {
    transBody.innerHTML = "";
    if (!transactions || transactions.length === 0) {
      transBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-caption);">Nenhum lançamento registrado.</td></tr>`;
    } else {
      [...transactions].reverse().slice(0, 15).forEach(t => {
        const tr = document.createElement("tr");
        const dateFormatted = window.Utils ? window.Utils.formatDate(t.data) : (t.data ? new Date(t.data).toLocaleDateString("pt-BR") : '—');
        const valColor = t.sinal === "credito" ? "var(--success)" : "var(--danger)";
        const sign = t.sinal === "credito" ? "+" : "-";

        const rawVal = t.valor !== undefined && t.valor !== null ? t.valor : t.value;
        const valNum = isNaN(parseFloat(rawVal)) ? 0 : parseFloat(rawVal);
        const valText = window.Utils ? window.Utils.formatCurrency(valNum) : `R$ ${valNum.toFixed(2).replace(".", ",")}`;

        tr.innerHTML = `
          <td>${dateFormatted}</td>
          <td>
            <span style="font-weight: 500; font-size:13px; display:block;">${t.descricao || 'Lançamento'}</span>
            <span style="font-size:11px; color:var(--text-caption);">${t.tipo || 'Geral'}</span>
          </td>
          <td style="text-align: right; font-weight: bold; color: ${valColor};">${sign} ${valText}</td>
        `;
        transBody.appendChild(tr);
      });
    }
  }

  const balBody = document.getElementById("finances-athlete-balances-body");
  if (balBody) {
    balBody.innerHTML = "";
    const sorted = [...(players || [])].sort((a,b) => {
      const sA = isNaN(parseFloat(a.saldo)) ? 0 : parseFloat(a.saldo);
      const sB = isNaN(parseFloat(b.saldo)) ? 0 : parseFloat(b.saldo);
      return sA - sB;
    });

    if (sorted.length === 0) {
      balBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-caption);">Nenhum atleta cadastrado.</td></tr>`;
    } else {
      sorted.forEach(p => {
        const tr = document.createElement("tr");
        const sNum = isNaN(parseFloat(p.saldo)) ? 0 : parseFloat(p.saldo);
        const balanceColor = sNum >= 0 ? "var(--success)" : "var(--danger)";
        const balanceFmt = window.Utils ? window.Utils.formatCurrency(sNum) : `R$ ${sNum.toFixed(2).replace(".", ",")}`;

        let btnCobrar = "";
        if (sNum < 0) {
          const nomeStr = (p.nome || p.apelido || 'Atleta').split(" ")[0];
          const whatsMsg = window.encodeURIComponent(`Olá ${nomeStr}! Seu saldo no Pelada Pro está em ${balanceFmt}. Quando puder, realize o acerto via Pix. Obrigado!`);
          const phone = (p.whatsapp || '').replace(/\D/g, "");
          const linkWhats = phone ? `https://api.whatsapp.com/send?phone=55${phone}&text=${whatsMsg}` : '#';
          btnCobrar = `
            <a href="${linkWhats}" ${phone ? 'target="_blank"' : ''} class="btn btn-sm btn-outline" style="text-decoration:none; padding:4px 8px; border-color:var(--accent); color:var(--accent); font-size:11px; height:24px;">Cobrar</a>
          `;
        }

        tr.innerHTML = `
          <td style="font-weight: 500;">${p.nome || p.apelido || 'Atleta'} ${p.goleiro ? '🧤' : ''}</td>
          <td style="text-align: right; font-weight: bold; color: ${balanceColor};">${balanceFmt}</td>
          <td style="text-align: center;">
            <div style="display:flex; gap:6px; justify-content:center;">
              ${btnCobrar}
              <button class="btn btn-sm btn-secondary" onclick="manualFinanceSettlement('${p.id}')" style="font-size:11px; padding:4px 8px; height:24px;">Ajustar</button>
            </div>
          </td>
        `;
        balBody.appendChild(tr);
      });
    }
  }
};

function manualFinanceSettlement(playerId) {
  const players = JSON.parse(localStorage.getItem("players")) || [];
  const p = players.find(x => String(x.id) === String(playerId));
  if (!p) return;

  const inputAmount = window.prompt(`Ajuste de Saldo para ${p.nome || 'Atleta'}.\nDigite um valor positivo para crédito (ex: 20 ou +20), ou negativo para débito (ex: -20):`, "0");
  if (inputAmount === null) return;

  const amt = parseFloat(inputAmount.replace(",", "."));
  if (isNaN(amt) || amt === 0) return;

  const currentSaldo = isNaN(parseFloat(p.saldo)) ? 0 : parseFloat(p.saldo);
  p.saldo = currentSaldo + amt;

  const transactions = JSON.parse(localStorage.getItem("transactions")) || [];
  transactions.push({
    id: "t_" + Date.now(),
    pelada_id: null,
    valor: Math.abs(amt),
    value: Math.abs(amt),
    jogador_id: p.id,
    tipo: "acerto",
    descricao: `Acerto manual: ${p.nome || 'Atleta'}`,
    sinal: amt > 0 ? "credito" : "debito",
    data: new Date().toISOString()
  });

  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("transactions", JSON.stringify(transactions));

  const toastVal = window.Utils ? window.Utils.formatCurrency(amt) : `R$ ${amt.toFixed(2)}`;
  window.App.showToast(`Ajuste de ${toastVal} realizado.`);
  window.App.renderFinanceiroData();
}

