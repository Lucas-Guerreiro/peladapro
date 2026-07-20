// ==========================================================================
// PÁGINA: GESTOR - FINANCEIRO (financeiro.js)
// ==========================================================================

window.App.initFinanceiro = function() {
  window.App.renderFinanceiroData();

  document.getElementById("btn-open-expense-modal").onclick = () => window.App.openModal("despesa");
  
  window.manualFinanceSettlement = manualFinanceSettlement;
};

window.App.renderFinanceiroData = function() {
  const transactions = JSON.parse(localStorage.getItem("transactions")) || [];
  const players = JSON.parse(localStorage.getItem("players")) || [];

  let receipts = 0;
  let expenses = 0;

  transactions.forEach(t => {
    if (t.sinal === "credito") receipts += t.value;
    else expenses += t.value;
  });

  const net = receipts - expenses;

  document.getElementById("finances-receipts").textContent = `R$ ${receipts.toFixed(2).replace(".", ",")}`;
  document.getElementById("finances-expenses").textContent = `R$ ${expenses.toFixed(2).replace(".", ",")}`;
  
  const netEl = document.getElementById("finances-net");
  netEl.textContent = `R$ ${net.toFixed(2).replace(".", ",")}`;
  netEl.style.color = net >= 0 ? "var(--success)" : "var(--danger)";

  const transBody = document.getElementById("finances-transactions-body");
  if (transBody) {
    transBody.innerHTML = "";
    if (transactions.length === 0) {
      transBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-caption);">Nenhum lançamento.</td></tr>`;
    } else {
      [...transactions].reverse().slice(0, 15).forEach(t => {
        const tr = document.createElement("tr");
        const dateFormatted = new Date(t.data).toLocaleDateString("pt-BR");
        const valColor = t.sinal === "credito" ? "var(--success)" : "var(--danger)";
        const sign = t.sinal === "credito" ? "+" : "-";

        tr.innerHTML = `
          <td>${dateFormatted}</td>
          <td>
            <span style="font-weight: 500; font-size:13px; display:block;">${t.descricao}</span>
            <span style="font-size:11px; color:var(--text-caption);">${t.tipo}</span>
          </td>
          <td style="text-align: right; font-weight: bold; color: ${valColor};">${sign} R$ ${t.value.toFixed(2)}</td>
        `;
        transBody.appendChild(tr);
      });
    }
  }

  const balBody = document.getElementById("finances-athlete-balances-body");
  if (balBody) {
    balBody.innerHTML = "";
    const sorted = [...players].sort((a,b) => a.saldo - b.saldo);

    sorted.forEach(p => {
      const tr = document.createElement("tr");
      const balanceColor = p.saldo >= 0 ? "var(--success)" : "var(--danger)";
      
      let btnCobrar = "";
      if (p.saldo < 0) {
        const whatsMsg = window.encodeURIComponent(`Olá ${p.nome.split(" ")[0]}! Seu saldo no Pelada Pro está em R$ ${p.saldo.toFixed(2).replace(".", ",")}. Quando puder, realize o acerto via Pix. Obrigado!`);
        const linkWhats = `https://api.whatsapp.com/send?phone=55${p.whatsapp.replace(/\D/g, "")}&text=${whatsMsg}`;
        btnCobrar = `
          <a href="${linkWhats}" target="_blank" class="btn btn-sm btn-outline" style="text-decoration:none; padding:4px 8px; border-color:var(--accent); color:var(--accent); font-size:11px; height:24px;">Cobrar</a>
        `;
      }

      tr.innerHTML = `
        <td style="font-weight: 500;">${p.nome} ${p.goleiro ? '🧤' : ''}</td>
        <td style="text-align: right; font-weight: bold; color: ${balanceColor};">R$ ${p.saldo.toFixed(2).replace(".", ",")}</td>
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
};

function manualFinanceSettlement(playerId) {
  const players = JSON.parse(localStorage.getItem("players")) || [];
  const p = players.find(x => x.id === playerId);
  if (!p) return;

  const inputAmount = window.prompt(`Ajuste de Saldo para ${p.nome}.\nDigite um valor positivo para crédito, ou negativo para débito:`, "0");
  const amt = parseFloat(inputAmount);

  if (isNaN(amt) || amt === 0) return;

  p.saldo += amt;

  const transactions = JSON.parse(localStorage.getItem("transactions")) || [];
  transactions.push({
    id: "t_" + Date.now(),
    pelada_id: null,
    jogador_id: p.id,
    tipo: "acerto",
    descricao: `Acerto manual: ${p.nome}`,
    value: Math.abs(amt),
    sinal: amt > 0 ? "credito" : "debito",
    data: new Date().toISOString()
  });

  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("transactions", JSON.stringify(transactions));

  window.App.showToast(`Ajuste de R$ ${amt.toFixed(2)} realizado.`);
  window.App.renderFinanceiroData();
}
