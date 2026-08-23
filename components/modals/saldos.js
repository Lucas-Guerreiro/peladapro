// ==========================================================================
// MODAL: SITUAÇÃO DE SALDOS DOS ATLETAS (saldos.js)
// ==========================================================================

window.App.initModalSaldos = async function() {
  const btnClose = document.getElementById("btn-close-saldos-modal");
  if (btnClose) btnClose.onclick = window.App.closeModal;

  const inputSearch = document.getElementById("filter-saldos-input");
  if (inputSearch) {
    inputSearch.oninput = (e) => renderTabelaSaldos(e.target.value);
  }

  let players = [];
  try {
    players = JSON.parse(localStorage.getItem("players")) || [];
  } catch (e) {}

  if ((!players || players.length === 0) && window.Api && window.Api.getPlayers) {
    try {
      players = await window.Api.getPlayers();
      if (Array.isArray(players)) {
        localStorage.setItem("players", JSON.stringify(players));
      }
    } catch (e) {}
  }

  window._modalSaldosPlayersList = players || [];
  renderTabelaSaldos("");
};

function renderTabelaSaldos(termoBusca = "") {
  const tbody = document.getElementById("saldos-modal-table-body");
  const summaryEl = document.getElementById("saldos-modal-summary");
  if (!tbody) return;

  const players = window._modalSaldosPlayersList || [];
  const termo = termoBusca.toLowerCase().trim();

  const filtrados = players.filter(p => {
    if (p.ativo === false) return false;
    if (!termo) return true;
    const nome = (p.nome || "").toLowerCase();
    const apelido = (p.apelido || "").toLowerCase();
    return nome.includes(termo) || apelido.includes(termo);
  });

  // Ordena por saldo (devedores primeiro)
  filtrados.sort((a, b) => {
    const sA = parseFloat(a.saldo || 0);
    const sB = parseFloat(b.saldo || 0);
    return sA - sB;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-caption);">Nenhum atleta encontrado.</td></tr>`;
    if (summaryEl) summaryEl.textContent = `Total: 0 atletas`;
    return;
  }

  let totalEmConta = 0;
  let totalDevedores = 0;
  let qtdDevedores = 0;

  let html = "";
  filtrados.forEach(p => {
    const saldoNum = parseFloat(p.saldo || 0);
    if (saldoNum > 0) totalEmConta += saldoNum;
    if (saldoNum < 0) {
      totalDevedores += Math.abs(saldoNum);
      qtdDevedores++;
    }

    const nomeDisplay = p.apelido || p.nome || "Atleta";
    const nomeSub = p.apelido && p.nome && p.apelido !== p.nome ? `<span style="font-size: 11px; color: var(--text-caption); display: block;">${p.nome}</span>` : "";

    let statusBadge = `<span style="font-size: 11px; font-weight: 700; background: #ECFDF5; color: #047857; padding: 3px 8px; border-radius: 12px;">✅ Em Dia</span>`;
    let saldoColor = "#047857";

    if (saldoNum < 0) {
      statusBadge = `<span style="font-size: 11px; font-weight: 700; background: #FEF2F2; color: #DC2626; padding: 3px 8px; border-radius: 12px;">🔴 Pendência</span>`;
      saldoColor = "#DC2626";
    } else if (saldoNum > 0) {
      statusBadge = `<span style="font-size: 11px; font-weight: 700; background: #EEF2FF; color: #4338CA; padding: 3px 8px; border-radius: 12px;">💳 Com Crédito</span>`;
      saldoColor = "#4338CA";
    }

    const valorFmt = window.Utils ? window.Utils.formatCurrency(saldoNum) : `R$ ${saldoNum.toFixed(2).replace('.', ',')}`;

    html += `
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 10px 14px;">
          <span style="font-weight: 700; color: #0F172A;">${nomeDisplay}</span>
          ${nomeSub}
        </td>
        <td style="padding: 10px 14px; text-align: center;">
          ${statusBadge}
        </td>
        <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: ${saldoColor};">
          ${valorFmt}
        </td>
        <td style="padding: 10px 14px; text-align: center;">
          <button class="btn btn-sm btn-secondary" onclick="window.App.closeModal(); setTimeout(() => manualFinanceSettlement('${p.id}'), 200);" style="font-size: 11px; padding: 4px 8px; height: 26px; border-radius: 6px; cursor: pointer;">
            Ajustar
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  if (summaryEl) {
    summaryEl.innerHTML = `<strong>${filtrados.length}</strong> atletas exibidos · <span style="color: #DC2626; font-weight: 700;">${qtdDevedores} em débito</span> (Total a receber: R$ ${totalDevedores.toFixed(2).replace('.', ',')})`;
  }
}
