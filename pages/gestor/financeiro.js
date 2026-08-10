// ==========================================================================
// PÁGINA: GESTOR - FINANCEIRO (financeiro.js)
// ==========================================================================

window.App.initFinanceiro = async function() {
  await window.App.renderFinanceiroData();
  await window.renderPixAuditoria();

  const btnExpense = document.getElementById("btn-open-expense-modal");
  if (btnExpense) {
    btnExpense.onclick = () => window.App.openModal("despesa");
  }

  const btnIncome = document.getElementById("btn-open-income-modal");
  if (btnIncome) {
    btnIncome.onclick = () => window.App.openModal("receita");
  }
  
  window.manualFinanceSettlement = manualFinanceSettlement;
};

window.App.renderFinanceiroData = async function() {
  let transactions = [];
  let players = [];

  try {
    let group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    if (!group || !group.id) {
      try {
        group = JSON.parse(localStorage.getItem("currentGroup"));
      } catch (e) {}
    }
    let rawTx = [];

    if (group && group.id && window.Api && window.Api.listarTransacoesDoGrupo) {
      try {
        const dbTx = await window.Api.listarTransacoesDoGrupo(group.id);
        if (Array.isArray(dbTx)) {
          const dbTxFiltrado = dbTx.filter(t => {
            // Se usuario_id for nulo, exibe sempre (receitas e despesas manuais do gestor)
            if (!t.usuario_id) return true;

            // Se usuario_id estiver preenchido, exibimos apenas:
            // 1. Débitos de atletas correspondentes ao pagamento da convocação (descrição começa com "Presença de")
            // 2. Créditos de atletas correspondentes ao estorno da presença (descrição começa com "Estorno de presença")
            const desc = t.descricao || "";
            if (t.tipo === 'debito' && desc.startsWith("Presença de")) return true;
            if (t.tipo === 'credito' && desc.startsWith("Estorno de presença")) return true;

            return false;
          });

          rawTx = dbTxFiltrado.map(t => {
            let sinal = 'neutro';
            let tipo = 'Geral';
            
            if (!t.usuario_id) {
              if (t.tipo === 'credito') {
                sinal = 'credito';
                tipo = 'Receita';
              } else if (t.tipo === 'debito') {
                sinal = 'debito';
                tipo = 'Despesa';
              }
            } else {
              // Transações de atletas: invertemos o sinal para representar o caixa da pelada
              if (t.tipo === 'debito') {
                sinal = 'credito'; // O débito do atleta vira crédito/receita para a pelada
                tipo = 'Presença';
              } else if (t.tipo === 'credito') {
                sinal = 'debito'; // O crédito/estorno para o atleta vira débito/saída para a pelada
                tipo = 'Estorno Presença';
              }
            }

            return {
              id: t.id,
              pelada_id: t.pelada_id,
              valor: parseFloat(t.valor),
              value: parseFloat(t.valor),
              jogador_id: t.usuario_id,
              tipo: tipo,
              descricao: t.descricao || `Lançamento: ${tipo}`,
              sinal: sinal,
              data: t.data
            };
          });
        }
      } catch (err) {
        console.error('[renderFinanceiroData] Erro ao carregar transações da API:', err);
      }
    }

    const localTx = JSON.parse(localStorage.getItem("transactions")) || [];
    const localManuais = localTx.filter(t => t.tipo === "despesa" || t.tipo === "receita" || t.tipo === "acerto" || String(t.id).startsWith("t_"));
    const idsBanco = new Set(rawTx.map(t => String(t.id)));
    const manuaisUnicas = localManuais.filter(t => !idsBanco.has(String(t.id)));

    transactions = [...rawTx, ...manuaisUnicas];

    transactions = transactions.filter(t => t.id !== "t1" && t.id !== "t2" && t.id !== "t3" &&
      !String(t.descricao).includes("Carlos Henrique") &&
      !String(t.descricao).includes("Bruno Henrique") &&
      !String(t.descricao).includes("Mensalidade do Campo Society"));

    localStorage.setItem("transactions", JSON.stringify(transactions));
  } catch (e) {
    console.error('[renderFinanceiroData]', e);
  }
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
    else if (t.sinal === "debito") expenses += numVal;
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
      [...transactions].reverse().forEach(t => {
        const tr = document.createElement("tr");
        const dateFormatted = window.Utils ? window.Utils.formatDate(t.data) : (t.data ? new Date(t.data).toLocaleDateString("pt-BR") : '—');
        let valColor = "var(--text-caption)";
        let sign = "";
        if (t.sinal === "credito") {
          valColor = "var(--success)";
          sign = "+";
        } else if (t.sinal === "debito") {
          valColor = "var(--danger)";
          sign = "-";
        } else if (t.sinal === "neutro") {
          valColor = "var(--text-caption)";
          sign = "-";
        }

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
    const ativos = (players || []).filter(p => p.ativo !== false);
    const sorted = [...ativos].sort((a,b) => {
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

// window.manualFinanceSettlement é definido globalmente em api.js

window.renderPixAuditoria = async function() {
  const bodyEl = document.getElementById("finances-pix-auditoria-body");
  if (!bodyEl) return;

  try {
    bodyEl.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-caption);">Carregando comprovantes Pix...</td></tr>`;

    const comprobantes = await Api.listarComprovantesPix();

    if (!Array.isArray(comprobantes) || comprobantes.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-caption);">Nenhum comprovante Pix enviado até o momento.</td></tr>`;
      return;
    }

    let html = "";
    comprobantes.forEach(c => {
      const dataFmt = c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") + " " + new Date(c.created_at).toLocaleTimeString("pt-BR", {hour:'2-digit', minute:'2-digit'}) : "—";
      const atletaNome = c.atleta_nome || c.atleta_apelido || c.atleta_email;
      const valorFmt = window.Utils ? window.Utils.formatCurrency(c.valor) : `R$ ${parseFloat(c.valor).toFixed(2)}`;
      
      let statusBadge = "";
      let btnEstornar = "";

      if (c.status === 'estornado_pelo_gestor') {
        statusBadge = `<span class="badge-status cortado" style="font-size:11px;">🚨 Estornado</span>`;
        btnEstornar = `<span style="font-size:11px; color:#94A3B8;">Estornado</span>`;
      } else {
        statusBadge = `<span class="badge-status confirmado" style="font-size:11px;">✅ Aprovado</span>`;
        btnEstornar = `
          <button class="btn btn-sm btn-danger btn-estornar-pix" data-id="${c.id}" data-atleta="${atletaNome}" data-valor="${valorFmt}" style="font-size:11px; padding:4px 8px; height:24px;">
            🚨 Desfazer Crédito
          </button>
        `;
      }

      html += `
        <tr>
          <td style="font-size:12px;">${dataFmt}</td>
          <td style="font-weight:600; font-size:13px;">${atletaNome}</td>
          <td style="font-family:monospace; font-size:11px; color:#0284C7;">${c.e2e_id || '—'}</td>
          <td style="text-align:right; font-weight:700; color:#059669;">${valorFmt}</td>
          <td style="text-align:center;">${statusBadge}</td>
          <td style="text-align:center;">${btnEstornar}</td>
        </tr>
      `;
    });

    bodyEl.innerHTML = html;

    // Vincular botões de estorno
    bodyEl.querySelectorAll(".btn-estornar-pix").forEach(btn => {
      btn.onclick = async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const atleta = e.currentTarget.getAttribute("data-atleta");
        const valor = e.currentTarget.getAttribute("data-valor");

        if (!confirm(`⚠️ DESFAZER TRANSAÇÃO PIX:\n\nDeseja estornar o crédito de ${valor} do atleta ${atleta}?\nO saldo do atleta será debitado no valor do Pix.`)) {
          return;
        }

        try {
          window.App.showToast("Estornando transação no servidor...", "info");
          const res = await Api.estornarTransacaoPix(id);

          if (res.error) {
            window.App.showToast(res.error, "error");
            return;
          }

          window.App.showToast("Transação estornada e saldo revertido com sucesso!", "success");

          // Atualiza saldo em memória do usuário e do elenco local
          if (window.Auth && window.Auth.refreshCurrentUser) {
            await window.Auth.refreshCurrentUser();
          }
          if (window.Api && window.Api.getPlayers) {
            try {
              const updatedPlayers = await window.Api.getPlayers();
              if (Array.isArray(updatedPlayers)) {
                localStorage.setItem("players", JSON.stringify(updatedPlayers));
              }
            } catch(e) {}
          }

          window.renderPixAuditoria();
          window.App.renderFinanceiroData();
        } catch(err) {
          console.error(err);
          window.App.showToast("Erro ao estornar transação.", "error");
        }
      };
    });

  } catch(e) {
    console.error('[FinanceiroPix]', e);
    bodyEl.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">Erro ao carregar auditoria Pix.</td></tr>`;
  }
};

