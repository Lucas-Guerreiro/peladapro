// ==========================================================================
// PÁGINA: GESTOR - FINANCEIRO (financeiro.js)
// Reestruturação em 3 Níveis: KPIs, Demonstrativo Agrupado por Pelada e Ações/Filtros
// ==========================================================================

function parseSafeDate(d) {
  if (!d) return new Date();
  if (d instanceof Date) return isNaN(d.getTime()) ? new Date() : d;
  const str = String(d).replace(' ', 'T');
  const dt = new Date(str);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

window.App._financeiroFilter = "este_mes"; // "este_mes" | "ultimos_30" | "tudo"
window.App._financeiroPeladaFilter = "todas"; // "todas" | "Pelada_24/08" etc.

function agruparContribuicoesPorAtleta(contribuicoesList) {
  const map = new Map();
  (Array.isArray(contribuicoesList) ? contribuicoesList : []).forEach(a => {
    const key = String(a.usuario_id || a.nome || a.apelido || 'atleta').toLowerCase().trim();
    const val = parseFloat(a.valor || 0);

    if (!map.has(key)) {
      map.set(key, {
        id: a.id,
        usuario_id: a.usuario_id,
        nome: a.nome,
        apelido: a.apelido,
        foto: a.foto,
        valorTotal: val,
        qtdContribuicoes: 1,
        created_at: a.created_at,
        status: a.status
      });
    } else {
      const existing = map.get(key);
      existing.valorTotal += val;
      existing.qtdContribuicoes += 1;
      const dtA = a.created_at ? new Date(a.created_at) : null;
      const dtE = existing.created_at ? new Date(existing.created_at) : null;
      if (dtA && (!dtE || dtA > dtE)) {
        existing.created_at = a.created_at;
      }
    }
  });

  const list = Array.from(map.values());
  list.sort((a, b) => b.valorTotal - a.valorTotal);
  return list;
}

window.App.initFinanceiro = async function() {
  // 1. Botões de Ação do Nível 3 (Vincula imediatamente)
  const btnExpense = document.getElementById("btn-open-expense-modal");
  if (btnExpense) {
    btnExpense.onclick = () => window.App.openModal("despesa");
  }

  const btnIncome = document.getElementById("btn-open-income-modal");
  if (btnIncome) {
    btnIncome.onclick = () => window.App.openModal("receita");
  }

  const btnSaldos = document.getElementById("btn-open-saldos-modal");
  if (btnSaldos) {
    btnSaldos.onclick = () => window.App.openModal("saldos");
  }

  const btnCriarArr = document.getElementById("btn-open-criar-arrecadacao-modal");
  if (btnCriarArr) {
    btnCriarArr.onclick = () => window.App.openModal("criar_arrecadacao");
  }

  try {
    await window.App.renderFinanceiroData();
  } catch (err) {
    console.error("[Financeiro] Erro ao renderizar dados do financeiro:", err);
  }

  // 2. Select de Filtragem por Pelada Específica
  const selectPelada = document.getElementById("finances-select-pelada");
  if (selectPelada) {
    selectPelada.onchange = (e) => {
      window.App._financeiroPeladaFilter = e.target.value;
      window.App.renderFinanceiroData();
    };
  }

  // 3. Chips de Filtro de Período
  document.querySelectorAll(".finance-filter-chip").forEach(btn => {
    btn.onclick = (e) => {
      document.querySelectorAll(".finance-filter-chip").forEach(b => {
        b.classList.remove("active");
        b.style.background = "#F8FAFC";
        b.style.color = "#475569";
        b.style.border = "1.5px solid #CBD5E1";
      });
      const target = e.currentTarget;
      target.classList.add("active");
      target.style.background = "var(--primary)";
      target.style.color = "#FFF";
      target.style.border = "1.5px solid var(--primary)";

      window.App._financeiroFilter = target.getAttribute("data-filter") || "este_mes";
      window.App.renderFinanceiroData();
    };
  });

  window.manualFinanceSettlement = manualFinanceSettlement;

  window.App.abrirEditarTransacao = function(txId) {
    const isAthleteView = window.location.hash.startsWith('#/jogador') || (window.Auth && window.Auth.getUserRole && window.Auth.getUserRole() === 'jogador');
    if (isAthleteView) {
      if (window.App.showToast) window.App.showToast("Modo de visualização do atleta (apenas leitura).", "info");
      return;
    }
    const tx = (window._financeiroTransactionsMap || {})[String(txId)];
    if (!tx) {
      window.App.showToast("Lançamento não encontrado para edição.", "warning");
      return;
    }
    window.App.openModal("editar_transacao", { transaction: tx });
  };

  window.App.efetivarTransacaoDireta = async function(txId) {
    const isAthleteView = window.location.hash.startsWith('#/jogador') || (window.Auth && window.Auth.getUserRole && window.Auth.getUserRole() === 'jogador');
    if (isAthleteView) {
      if (window.App.showToast) window.App.showToast("Modo de visualização do atleta (apenas leitura).", "info");
      return;
    }
    const tx = (window._financeiroTransactionsMap || {})[String(txId)];
    if (!tx) {
      window.App.showToast("Lançamento não encontrado.", "error");
      return;
    }

    const descLimpa = tx.descricao
      .replace(/\s*\[PAGO:[\d.]+\/[\d.]+\]/gi, "")
      .replace(/\s*\[NÃO EFETIVADO\]/gi, "")
      .replace(/\s*\[PENDENTE\]/gi, "")
      .trim();

    const tipoLabel = tx.isEntrada ? "da entrada/receita" : "da despesa";
    const confirmEfetivar = confirm(`Confirmar a EFETIVAÇÃO (100% PAGO/RECEBIDO) ${tipoLabel}:\n\n"${descLimpa}"\nValor Total: R$ ${tx.valor.toFixed(2)}?`);
    if (!confirmEfetivar) return;

    try {
      window.App.showToast("Efetivando lançamento no caixa...", "info");
      const res = await window.Api.editarTransacao(tx.id, tx.valor, tx.tipoOriginal || (tx.isEntrada ? 'credito' : 'debito'), descLimpa);
      if (res && res.error) {
        window.App.showToast(res.error, "error");
        return;
      }

      window.App.showToast("Lançamento EFETIVADO com sucesso! ⚡✅", "success");
      if (window.App.renderFinanceiroData) {
        await window.App.renderFinanceiroData();
      }
    } catch (err) {
      console.error("[efetivarTransacaoDireta] Erro:", err);
      window.App.showToast("Erro ao efetivar a transação.", "error");
    }
  };
  window.App.efetivarDespesaDireta = window.App.efetivarTransacaoDireta;
};

// --- RENDERIZAÇÃO COMPLETA DO PAINEL FINANCEIRO REESTRUTURADO ---
window.App.renderFinanceiroData = async function() {
  let rawTransactions = [];
  let peladasList = [];
  let playersList = [];

  try {
    let group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
    if (!group || !group.id) {
      try { group = JSON.parse(localStorage.getItem("currentGroup")); } catch (e) {}
    }
    if ((!group || !group.id) && window.Api && window.Api.listarGrupos) {
      try {
        const grupos = await window.Api.listarGrupos();
        if (Array.isArray(grupos) && grupos.length > 0) {
          group = grupos[0];
          if (window.Auth) window.Auth.currentGroup = group;
          if (window.App) window.App.currentGroup = group;
          try { localStorage.setItem("currentGroup", JSON.stringify(group)); } catch (e) {}
        }
      } catch (e) {}
    }

    const allTxMap = new Map();

    // 1. Inicia com transações do LocalStorage se existirem
    if (window.Api && window.Api.getTransactions) {
      try {
        const localTxs = window.Api.getTransactions() || [];
        localTxs.forEach(t => { if (t && t.id != null) allTxMap.set(String(t.id), t); });
      } catch (e) {}
    }

    // 2. Mescla com transações do Backend se disponível
    if (group && group.id && window.Api && window.Api.listarTransacoesDoGrupo) {
      try {
        const dbTx = await window.Api.listarTransacoesDoGrupo(group.id);
        if (Array.isArray(dbTx)) {
          dbTx.forEach(t => { if (t && t.id != null) allTxMap.set(String(t.id), t); });
        }
      } catch (e) {
        console.error("[Financeiro] Erro ao carregar transações do backend:", e);
      }

      // 2.1 Busca datas/peladas cadastradas do grupo
      if (window.Api.listarDatasDoGrupo) {
        try {
          const peladas = await window.Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladas)) peladasList = peladas;
        } catch (e) {}
      }

      // 2.2 Busca campanhas de arrecadação/vaquinha do grupo
      if (window.Api.listarArrecadacoes) {
        try {
          const groupId = (group && (group.id || group.grupo_id)) ? (group.id || group.grupo_id) : 'me';
          const arrs = await window.Api.listarArrecadacoes(groupId);
          if (Array.isArray(arrs)) window._financeiroArrecadacoesList = arrs;
        } catch (e) {}
      }

      // 3. Busca atletas para saldo
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const resUsers = await fetch('/api/usuarios', { headers: { 'Authorization': `Bearer ${token}` } });
          if (resUsers.ok) {
            const dbUsers = await resUsers.json();
            if (Array.isArray(dbUsers) && dbUsers.length > 0) {
              playersList = dbUsers;
            }
          }
        } catch (e) {}
      }
      if ((!playersList || playersList.length === 0) && window.Api.getPlayers) {
        try {
          const players = await window.Api.getPlayers();
          if (Array.isArray(players)) playersList = players;
        } catch (e) {}
      }
    }

    rawTransactions = Array.from(allTxMap.values());
  } catch (err) {
    console.error("[Financeiro] Erro geral ao sincronizar:", err);
  }

  // Normaliza transações considerando presenças/convocações como entradas/receitas da pelada
  let normalizedTx = rawTransactions.map(t => {
    const rawVal = parseFloat(t.valor || 0);
    const atletaNome = t.usuario_apelido || t.usuario_nome || "";
    const desc = t.descricao || "";
    const tipoLower = String(t.tipo || '').toLowerCase();
    const descLower = desc.toLowerCase();

    const isPresencaOuConvocacao = desc.startsWith("Presença de") || descLower.includes("mensalidade") || descLower.includes("convocação");
    const isEstorno = desc.startsWith("Estorno") || descLower.includes("estorno");

    let isEntrada = (tipoLower === "credito" || tipoLower === "entrada" || tipoLower === "receita" || isPresencaOuConvocacao) && !isEstorno;

    let categoriaExibicao = "Entrada";

    if (isEntrada) {
      if (!t.usuario_id) {
        categoriaExibicao = "Verba / Receita";
      } else if (desc.startsWith("Pagamento Pix")) {
        categoriaExibicao = "Pix Atleta";
      } else if (desc.startsWith("Presença de") || descLower.includes("convocação")) {
        categoriaExibicao = "Pagamento Pelada";
      } else {
        categoriaExibicao = "Crédito Carteira";
      }
    } else {
      if (!t.usuario_id) {
        categoriaExibicao = "Despesa Quadra/Grupo";
      } else if (isEstorno) {
        categoriaExibicao = "Estorno Atleta";
      } else {
        categoriaExibicao = "Saída";
      }
    }

    const matchParcial = desc.match(/\[PAGO:([\d.]+)\/([\d.]+)\]/i);
    let isEfetivado = !(desc.includes('[NÃO EFETIVADO]') || desc.includes('[PENDENTE]') || descLower.includes('não efetivado'));
    let isParcial = false;
    let valPago = rawVal;
    let valRestante = 0;

    if (matchParcial) {
      isParcial = true;
      isEfetivado = false;
      valPago = parseFloat(matchParcial[1] || 0);
      valRestante = Math.max(0, rawVal - valPago);
    } else if (!isEfetivado) {
      valPago = 0;
      valRestante = rawVal;
    }

    const txObj = {
      id: t.id,
      usuario_id: t.usuario_id,
      grupo_id: t.grupo_id,
      atletaNome: atletaNome,
      valor: rawVal,
      tipoOriginal: t.tipo,
      isEntrada: isEntrada,
      isEfetivado: isEfetivado,
      isParcial: isParcial,
      valPago: valPago,
      valRestante: valRestante,
      categoria: categoriaExibicao,
      descricao: desc,
      data: parseSafeDate(t.data)
    };
    if (!window._financeiroTransactionsMap) window._financeiroTransactionsMap = {};
    window._financeiroTransactionsMap[String(t.id)] = txObj;
    return txObj;
  });

  // Para o painel financeiro do gestor:
  // Exibe todas as entradas (Pix, presenças de atletas, vaquinhas, verbas) e despesas do grupo/estornos
  const gestorTx = normalizedTx.filter(t => {
    if (t.isEntrada) return true;
    if (!t.usuario_id || t.descricao.startsWith("Estorno") || t.descricao.toLowerCase().includes("estorno")) return true;
    return false;
  });

  const isAthleteView = window.location.hash.startsWith('#/jogador') || (window.Auth && window.Auth.getUserRole && window.Auth.getUserRole() === 'jogador');

  // Filtra por período selecionado com fallback automático para "tudo" se o mês atual for vazio
  const agora = new Date();
  let filtro = window.App._financeiroFilter || "este_mes";

  let filteredTx = gestorTx.filter(t => {
    if (filtro === "tudo") return true;
    const txDate = t.data;
    if (filtro === "este_mes") {
      return txDate.getFullYear() === agora.getFullYear() && txDate.getMonth() === agora.getMonth();
    }
    if (filtro === "ultimos_30") {
      const trintaDiasAtras = new Date(agora.getTime() - (30 * 24 * 60 * 60 * 1000));
      return txDate >= trintaDiasAtras;
    }
    return true;
  });

  if (filteredTx.length === 0 && gestorTx.length > 0 && filtro === "este_mes") {
    filtro = "tudo";
    window.App._financeiroFilter = "tudo";
    filteredTx = gestorTx;
  }

  // Atualiza destaque estético dos chips de filtro no DOM
  document.querySelectorAll(".finance-filter-chip").forEach(b => {
    const f = b.getAttribute("data-filter");
    if (f === filtro) {
      b.classList.add("active");
      b.style.background = "var(--primary)";
      b.style.color = "#FFF";
      b.style.border = "1.5px solid var(--primary)";
    } else {
      b.classList.remove("active");
      b.style.background = "#F8FAFC";
      b.style.color = "#475569";
      b.style.border = "1.5px solid #CBD5E1";
    }
  });

  // =========================================================================
  // NÍVEL 1: CÁLCULO E RENDERIZAÇÃO DOS CARTÕES DE RESUMO (KPIs)
  // =========================================================================
  let totalArrecadadoPrevisto = 0;
  let totalArrecadadoConsolidado = 0;
  let totalArrecadadoPendente = 0;

  let totalDespesasPrevistas = 0;
  let totalDespesasConsolidadas = 0;
  let totalDespesasPendentes = 0;

  filteredTx.forEach(t => {
    if (t.isEntrada) {
      totalArrecadadoPrevisto += t.valor;
      if (t.isEfetivado) {
        totalArrecadadoConsolidado += t.valor;
      } else if (t.isParcial) {
        totalArrecadadoConsolidado += t.valPago;
        totalArrecadadoPendente += t.valRestante;
      } else {
        totalArrecadadoPendente += t.valor;
      }
    } else {
      totalDespesasPrevistas += t.valor;
      if (t.isEfetivado) {
        totalDespesasConsolidadas += t.valor;
      } else if (t.isParcial) {
        totalDespesasConsolidadas += t.valPago;
        totalDespesasPendentes += t.valRestante;
      } else {
        totalDespesasPendentes += t.valor;
      }
    }
  });

  // Saldo geral acumulado de todas as transações da história (Caixa Real em Conta)
  // IMPORTANTE: Entradas não efetivadas (0% pago) NÃO somam no Caixa Real nem no Saldo da Pelada!
  let caixaAtualTotal = 0;
  gestorTx.forEach(t => {
    // Pagamentos de presença em pelada efetuados via saldo interno não adicionam dinheiro físico novo na conta bancária,
    // apenas transferem fundos da carteira do atleta para o saldo da pelada.
    const isPagamentoSaldoInterno = t.isEntrada && t.usuario_id && t.descricao.startsWith("Presença de");

    if (t.isEntrada) {
      if (!isPagamentoSaldoInterno) {
        if (t.isEfetivado) {
          caixaAtualTotal += t.valor;
        } else if (t.isParcial) {
          caixaAtualTotal += t.valPago;
        }
      }
    } else {
      if (t.isEfetivado) {
        caixaAtualTotal -= t.valor;
      } else if (t.isParcial) {
        caixaAtualTotal -= t.valPago;
      }
    }
  });

  // 1. Calcula o Saldo Total Acumulado nas carteiras de todos os atletas do grupo
  let totalSaldoAtletas = 0;
  if (Array.isArray(playersList)) {
    playersList.forEach(p => {
      const s = parseFloat(p.saldo || p.usuario_saldo || 0);
      totalSaldoAtletas += s;
    });
  }

  // 2. Saldo Pelada = Caixa Total - Saldo Total dos Atletas
  const saldoPelada = caixaAtualTotal - totalSaldoAtletas;

  // Atualiza elementos DOM dos 5 KPIs
  const elCaixa = document.getElementById("finances-kpi-caixa");
  const elArrecadado = document.getElementById("finances-kpi-arrecadado");
  const elArrecadadoSub = document.getElementById("finances-kpi-arrecadado-sub");
  const elDespesas = document.getElementById("finances-kpi-despesas");
  const elDespesasSub = document.getElementById("finances-kpi-despesas-sub");

  const elSaldoAtletas = document.getElementById("finances-kpi-saldo-atletas") || document.getElementById("finances-kpi-saldo");
  const elSaldoAtletasSub = document.getElementById("finances-kpi-saldo-atletas-sub") || document.getElementById("finances-kpi-saldo-sub");

  const elSaldoPelada = document.getElementById("finances-kpi-saldo-pelada");
  const elSaldoPeladaSub = document.getElementById("finances-kpi-saldo-pelada-sub");
  const elSaldoPeladaCard = document.getElementById("finances-kpi-saldo-pelada-card");
  const elSaldoPeladaIcon = document.getElementById("finances-kpi-saldo-pelada-icon");

  if (elCaixa) elCaixa.textContent = formatCurrencyBRL(caixaAtualTotal);
  if (elArrecadado) elArrecadado.textContent = formatCurrencyBRL(totalArrecadadoConsolidado);
  if (elArrecadadoSub) elArrecadadoSub.textContent = `Previsto: ${formatCurrencyBRL(totalArrecadadoPrevisto)} · A Receber: ${formatCurrencyBRL(totalArrecadadoPendente)}`;
  
  if (elDespesas) elDespesas.textContent = formatCurrencyBRL(totalDespesasConsolidadas);
  if (elDespesasSub) elDespesasSub.textContent = `Previstas: ${formatCurrencyBRL(totalDespesasPrevistas)} · Pendente: ${formatCurrencyBRL(totalDespesasPendentes)}`;

  if (elSaldoAtletas) elSaldoAtletas.textContent = (totalSaldoAtletas >= 0 ? "+ " : "- ") + formatCurrencyBRL(Math.abs(totalSaldoAtletas));
  if (elSaldoAtletasSub) elSaldoAtletasSub.textContent = `🔒 Saldo seguro (${playersList ? playersList.length : 0} atletas) · Usado só em convocação via saldo`;

  if (elSaldoPelada) {
    elSaldoPelada.textContent = (saldoPelada >= 0 ? "+ " : "- ") + formatCurrencyBRL(Math.abs(saldoPelada));
    if (elSaldoPeladaSub) elSaldoPeladaSub.textContent = `Caixa Total (${formatCurrencyBRL(caixaAtualTotal)}) - Atletas (${formatCurrencyBRL(totalSaldoAtletas)})`;

    if (saldoPelada >= 0) {
      elSaldoPelada.style.color = "#1D9E75";
      if (elSaldoPeladaCard) elSaldoPeladaCard.style.borderLeftColor = "#1D9E75";
      if (elSaldoPeladaIcon) {
        elSaldoPeladaIcon.style.color = "#1D9E75";
        elSaldoPeladaIcon.style.background = "rgba(29, 158, 117, 0.12)";
      }
    } else {
      elSaldoPelada.style.color = "#E74C3C";
      if (elSaldoPeladaCard) elSaldoPeladaCard.style.borderLeftColor = "#E74C3C";
      if (elSaldoPeladaIcon) {
        elSaldoPeladaIcon.style.color = "#E74C3C";
        elSaldoPeladaIcon.style.background = "rgba(231, 76, 60, 0.12)";
      }
    }
  }

  // =========================================================================
  // NÍVEL 2: SEPARAÇÃO ENTRE CAIXA GERAL / VAQUINHAS E DEMONSTRATIVO DE PELADAS
  // =========================================================================
  const geralContainer = document.getElementById("finances-geral-card-container");
  const groupedContainer = document.getElementById("finances-peladas-grouped-container");
  const countBadge = document.getElementById("finances-count-badge");

  // 1. Separar transações em dois universos:
  // - Transações de Pelada: pagamentos Pix de convocação ("Presença de", "Pagamento Pix Convocação") ou despesas/verbas com "(Pelada DD/MM...)"
  // - Transações Gerais/Vaquinha: Arrecadações ("Arrecadação:"), Verbas avulsas sem vínculo e Despesas avulsas sem vínculo
  const txPeladas = [];
  const txGerais = [];

  filteredTx.forEach(t => {
    const desc = t.descricao || "";
    const isVaquinha = desc.startsWith("Arrecadação:") || desc.toLowerCase().includes("vaquinha");
    const hasPeladaVinculada = desc.match(/(?:dia|pelada)\s+\d{2}\/\d{2}/i) || 
                               desc.match(/\(\s*Pelada\s+\d{2}\/\d{2}/i) || 
                               desc.includes("Convocação") || 
                               desc.startsWith("Presença de") || 
                               desc.toLowerCase().includes("mensalidade");

    if (isVaquinha) {
      txGerais.push({ ...t, subTipo: 'vaquinha' });
    } else if (hasPeladaVinculada) {
      txPeladas.push(t);
    } else {
      txGerais.push({ ...t, subTipo: 'avulso' });
    }
  });

  // --- RENDERIZAR CARD DE CAMPANHAS DE VAQUINHA & ARRECADAÇÕES DO GRUPO ---
  const vaquinhasContainer = document.getElementById("finances-vaquinhas-card-container");
  if (vaquinhasContainer) {
    const arrecadacoesList = window._financeiroArrecadacoesList || [];
    if (arrecadacoesList.length === 0) {
      vaquinhasContainer.innerHTML = "";
    } else {
      let vaqHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 4px;">
          <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: #0F172A; display: flex; align-items: center; gap: 8px;">
            <i data-feather="heart" style="width: 18px; height: 18px; color: #0284C7;"></i> Relatório de Vaquinhas & Arrecadações (${arrecadacoesList.length})
          </h3>
        </div>
      `;

      arrecadacoesList.forEach(camp => {
        const meta = parseFloat(camp.meta_valor || 0);
        const arrecadado = parseFloat(camp.total_arrecadado || 0);
        const taxaMP = arrecadado * 0.01;
        const arrecadadoLiquido = arrecadado - taxaMP;
        const pct = meta > 0 ? Math.min(100, Math.round((arrecadado / meta) * 100)) : 0;
        const isConcluida = (camp.status === 'concluida') || (pct >= 100);
        // Agrupa e soma contribuições por atleta caso um atleta tenha feito mais de 1 contribuição na mesma vaquinha
        const apoiadores = agruparContribuicoesPorAtleta(camp.contribuicoes);

        let apoiadoresListHtml = "";
        if (apoiadores.length === 0) {
          apoiadoresListHtml = `
            <div style="font-size: 12px; color: #64748B; padding: 10px; background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; text-align: center;">
              Nenhum atleta contribuiu com esta vaquinha ainda.
            </div>
          `;
        } else {
          apoiadoresListHtml = `
            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; padding-right: 4px;">
              ${apoiadores.map((a, idx) => {
                const nomeDisplay = a.apelido || a.nome || "Atleta";
                const inicial = nomeDisplay.charAt(0).toUpperCase();
                const valFmt = parseFloat(a.valorTotal || 0).toFixed(2).replace('.', ',');
                const dt = a.created_at ? new Date(a.created_at) : null;
                const horaFmt = dt ? dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
                const dataFmt = dt ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
                const temFoto = a.foto && a.foto.trim().length > 0;
                const avatarHtml = temFoto
                  ? `<img src="${a.foto}" alt="${nomeDisplay}" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 1.5px solid #0284C7; flex-shrink: 0;">`
                  : `<div style="width: 26px; height: 26px; border-radius: 50%; background: #0284C7; color: #FFF; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${inicial}</div>`;

                const subInfoStr = (a.qtdContribuicoes > 1)
                  ? `${a.qtdContribuicoes} contribuições · 📅 Última: ${dataFmt} às ${horaFmt}`
                  : (dataFmt && horaFmt ? `📅 ${dataFmt} às ${horaFmt}` : '');

                return `
                  <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 12px; font-size: 13px;">
                    <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                      <span style="font-weight: 800; color: #64748B; width: 20px; text-align: center; flex-shrink: 0; font-size: 12px;">${idx + 1}º</span>
                      ${avatarHtml}
                      <div style="display: flex; flex-direction: column; min-width: 0;">
                        <strong style="color: #0F172A; font-weight: 800; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${nomeDisplay}</strong>
                        ${subInfoStr ? `<span style="font-size: 10px; color: #64748B; margin-top: 1px;">${subInfoStr}</span>` : ''}
                      </div>
                    </div>
                    <span style="font-weight: 900; font-size: 13px; color: #047857; background: #ECFDF5; border: 1.5px solid #A7F3D0; padding: 4px 12px; border-radius: 12px; white-space: nowrap; flex-shrink: 0; box-shadow: 0 1px 3px rgba(4, 120, 87, 0.1);">
                      R$ ${valFmt} ✅
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }

        vaqHtml += `
          <div class="card" style="padding: 20px; border-left: 4px solid #0284C7; background: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 14px;">
            
            <!-- TOPO DA ARRECADAÇÃO -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="font-size: 10px; font-weight: 800; color: #0284C7; background: #E0F2FE; border: 1px solid #BAE6FD; padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">
                    ${camp.categoria || 'Vaquinha'}
                  </span>
                  <span style="font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px; ${isConcluida ? 'background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0;' : 'background: #FEF3C7; color: #B45309; border: 1px solid #FCD34D;'}">
                    ${isConcluida ? '✅ Meta Atingida / Concluída' : '⚡ Ativa'}
                  </span>
                </div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #0F172A;">${camp.titulo}</h3>
                ${camp.descricao ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #64748B;">${camp.descricao}</p>` : ''}
              </div>

              <!-- BOTÕES DE AÇÃO E EXPORTAÇÃO EXCLUSIVOS DO GESTOR -->
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <button onclick="window.App.exportVaquinhaWhatsApp('${camp.id}')" class="btn btn-sm" style="background: #DCFCE7; color: #166534; border: 1px solid #86EFAC; font-weight: 700; font-size: 12px; border-radius: 8px; padding: 6px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(22, 101, 52, 0.1);" title="Copiar e compartilhar relatório no WhatsApp">
                  📲 Exportar WhatsApp
                </button>
                <button onclick="window.App.exportVaquinhaExcel('${camp.id}')" class="btn btn-sm" style="background: #F0F9FF; color: #0369A1; border: 1px solid #BAE6FD; font-weight: 700; font-size: 12px; border-radius: 8px; padding: 6px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(3, 105, 161, 0.1);" title="Baixar planilha Excel (CSV) dos contribuintes">
                  📊 Exportar Excel (CSV)
                </button>
                <button onclick="window.App.alternarStatusVaquinha('${camp.id}', '${isConcluida ? 'ativa' : 'concluida'}')" class="btn btn-sm" style="background: #F8FAFC; color: #475569; border: 1px solid #CBD5E1; font-weight: 600; font-size: 11px; border-radius: 8px; padding: 6px 10px; cursor: pointer;" title="Alterar status da vaquinha">
                  ${isConcluida ? '🔄 Reabrir' : '🔒 Encerrar'}
                </button>
              </div>
            </div>

            <!-- VALORES E PROGRESSO -->
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 10px;">
                <div>
                  <span style="font-size: 10px; color: #64748B; font-weight: 700; text-transform: uppercase; display: block;">Total Arrecadado</span>
                  <strong style="font-size: 16px; font-weight: 900; color: #0284C7;">${formatCurrencyBRL(arrecadado)}</strong>
                </div>
                <div>
                  <span style="font-size: 10px; color: #DC2626; font-weight: 700; text-transform: uppercase; display: block;">Taxa MP (1%)</span>
                  <strong style="font-size: 13px; font-weight: 800; color: #DC2626;">- ${formatCurrencyBRL(taxaMP)}</strong>
                </div>
                <div>
                  <span style="font-size: 10px; color: #047857; font-weight: 700; text-transform: uppercase; display: block;">Líquido em Conta</span>
                  <strong style="font-size: 16px; font-weight: 900; color: #047857;">${formatCurrencyBRL(arrecadadoLiquido)}</strong>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 10px; color: #64748B; font-weight: 700; text-transform: uppercase; display: block;">Meta do Grupo</span>
                  <strong style="font-size: 15px; font-weight: 800; color: #0F172A;">${formatCurrencyBRL(meta)}</strong>
                </div>
              </div>

              <!-- BARRA DE PROGRESSO -->
              <div style="width: 100%; height: 10px; background: #E2E8F0; border-radius: 8px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #10B981 0%, #059669 100%); border-radius: 8px; transition: width 0.4s ease;"></div>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #64748B;">
                <span>${pct}% concluído</span>
                <span>Faltam ${formatCurrencyBRL(Math.max(0, meta - arrecadadoLiquido))} (Líquido)</span>
              </div>
            </div>

            <!-- SEÇÃO DE CONTRIBUINTES -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 6px;">
                <h4 style="margin: 0; font-size: 14px; font-weight: 800; color: #1E293B; display: flex; align-items: center; gap: 6px;">
                  👥 Lista dos Atletas que Contribuíram (${apoiadores.length})
                </h4>
                ${apoiadores.length > 0 ? `
                  <span style="font-size: 11px; font-weight: 700; color: #0284C7; background: #F0F9FF; border: 1px solid #BAE6FD; padding: 3px 10px; border-radius: 12px;">
                    📊 Média: R$ ${(arrecadado / apoiadores.length).toFixed(2).replace('.', ',')} / atleta
                  </span>
                ` : ''}
              </div>
              ${apoiadoresListHtml}
            </div>

          </div>
        `;
      });

      vaquinhasContainer.innerHTML = vaqHtml;
    }
  }

  // --- RENDERIZAR CARD DE CAIXA GERAL & LANÇAMENTOS AVULSOS (NÃO VINCULADOS A PELADAS) ---
  if (geralContainer) {
    const totalGeraisEntradasBruto = txGerais.filter(t => t.isEntrada).reduce((acc, t) => acc + t.valor, 0);
    const totalGeraisEntradasConsolidadas = txGerais.filter(t => t.isEntrada).reduce((acc, t) => acc + (t.isEfetivado ? t.valor : (t.isParcial ? t.valPago : 0)), 0);
    const totalGeraisDespesasConsolidadas = txGerais.filter(t => !t.isEntrada).reduce((acc, t) => acc + (t.isEfetivado ? t.valor : (t.isParcial ? t.valPago : 0)), 0);
    const totalGeraisDespesasBruto = txGerais.filter(t => !t.isEntrada).reduce((acc, t) => acc + t.valor, 0);

    let entradasGeraisHtml = "";
    const entradasGeraisList = txGerais.filter(t => t.isEntrada);
    if (entradasGeraisList.length === 0) {
      entradasGeraisHtml = `<div style="font-size: 12px; color: var(--text-caption); padding: 8px 0;">Nenhuma entrada de vaquinha ou aporte no período.</div>`;
    } else {
      entradasGeraisHtml = entradasGeraisList.map(e => {
        const horaFmt = e.data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
        const dataFmt = e.data.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
        const badgeIcon = e.subTipo === 'vaquinha' ? '🏆' : '💵';
        const descLimpa = e.descricao.replace(/\s*\[PAGO:[\d.]+\/[\d.]+\]/gi, '').replace(/\s*\[NÃO EFETIVADO\]/gi, '').replace(/\s*\[PENDENTE\]/gi, '');
        
        let badgeEfetivado = '';
        let valExibicaoStr = '';
        if (e.isParcial) {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(2, 132, 199, 0.15); color: #0284C7; border: 1px solid rgba(2, 132, 199, 0.4); margin-left: 6px;">🌗 Recebido ${formatCurrencyBRL(e.valPago)} de ${formatCurrencyBRL(e.valor)}</span>`;
          valExibicaoStr = `+ ${formatCurrencyBRL(e.valPago)}`;
        } else if (e.isEfetivado) {
          valExibicaoStr = `+ ${formatCurrencyBRL(e.valor)}`;
        } else {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(245, 158, 11, 0.15); color: #B45309; border: 1px solid rgba(245, 158, 11, 0.4); margin-left: 6px;">⏳ Não Efetivado</span>`;
          valExibicaoStr = `+ R$ 0,00 <span style="font-size:10px; color:#64748B;">(${formatCurrencyBRL(e.valor)})</span>`;
        }

        const btnEfetivar = (!e.isEfetivado && !isAthleteView)
          ? `<button onclick="window.App.efetivarTransacaoDireta('${e.id}')" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFFFFF; border: none; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25); white-space: nowrap;" title="Marcar esta entrada como 100% EFETIVADA (Recebido)">⚡ Efetivar</button>`
          : '';
        const btnEditar = !isAthleteView
          ? `<button onclick="window.App.abrirEditarTransacao('${e.id}')" style="background: #F1F5F9; border: 1px solid #CBD5E1; cursor: pointer; color: #475569; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Editar lançamento">✏️ Editar</button>`
          : '';

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #E2E8F0; font-size: 13px; flex-wrap: wrap; gap: 6px;">
            <div style="min-width: 140px; flex: 1; padding-right: 8px;">
              <span style="color: #0F172A; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">${badgeIcon} <strong>${descLimpa}</strong>${badgeEfetivado}</span>
              <span style="font-size: 10px; color: #64748B;">${e.categoria} · ${dataFmt} às ${horaFmt}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
              <span style="font-weight: 700; color: #0284C7; white-space: nowrap;">${valExibicaoStr}</span>
              ${btnEfetivar}
              ${btnEditar}
            </div>
          </div>
        `;
      }).join('');
    }

    let despesasGeraisHtml = "";
    const despesasGeraisList = txGerais.filter(t => !t.isEntrada);
    if (despesasGeraisList.length === 0) {
      despesasGeraisHtml = `<div style="font-size: 12px; color: var(--text-caption); padding: 8px 0;">Nenhuma saída ou compra avulsa no período.</div>`;
    } else {
      despesasGeraisHtml = despesasGeraisList.map(d => {
        const horaFmt = d.data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
        const dataFmt = d.data.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
        const descLimpa = d.descricao.replace(/\s*\[PAGO:[\d.]+\/[\d.]+\]/gi, '').replace(/\s*\[NÃO EFETIVADO\]/gi, '').replace(/\s*\[PENDENTE\]/gi, '');
        let badgeEfetivado = '';
        if (d.isParcial) {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(2, 132, 199, 0.15); color: #0284C7; border: 1px solid rgba(2, 132, 199, 0.4); margin-left: 6px;">🌗 Pago ${formatCurrencyBRL(d.valPago)} de ${formatCurrencyBRL(d.valor)} (Falta ${formatCurrencyBRL(d.valRestante)})</span>`;
        } else if (d.isEfetivado) {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); margin-left: 6px;">✅ Efetivado</span>`;
        } else {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(245, 158, 11, 0.15); color: #B45309; border: 1px solid rgba(245, 158, 11, 0.4); margin-left: 6px;">⏳ Não Efetivado</span>`;
        }
        const btnEfetivar = (!d.isEfetivado && !isAthleteView)
          ? `<button onclick="window.App.efetivarDespesaDireta('${d.id}')" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFFFFF; border: none; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25); white-space: nowrap;" title="Marcar esta despesa como 100% EFETIVADA (Pago)">⚡ Efetivar</button>`
          : '';
        const btnEditar = !isAthleteView
          ? `<button onclick="window.App.abrirEditarTransacao('${d.id}')" style="background: #F1F5F9; border: 1px solid #CBD5E1; cursor: pointer; color: #475569; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Editar lançamento">✏️ Editar</button>`
          : '';
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #FEE2E2; font-size: 13px; flex-wrap: wrap; gap: 6px;">
            <div style="min-width: 140px; flex: 1; padding-right: 8px;">
              <span style="color: #0F172A; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">🛍️ <strong>${descLimpa}</strong>${badgeEfetivado}</span>
              <span style="font-size: 10px; color: #64748B;">${d.categoria} · ${dataFmt} às ${horaFmt}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
              <span style="font-weight: 800; color: #DC2626; white-space: nowrap; font-size: 14px;">- ${formatCurrencyBRL(d.valor)}</span>
              ${btnEfetivar}
              ${btnEditar}
            </div>
          </div>
        `;
      }).join('');
    }

    // Informações das campanhas de arrecadação cadastradas com exibição explícita da Taxa do Mercado Pago (1%)
    const campanhas = window._financeiroArrecadacoesList || [];
    let campanhasProgressoHtml = "";

    if (campanhas.length > 0) {
      campanhasProgressoHtml = campanhas.map(c => {
        const meta = parseFloat(c.meta_valor || 0);
        const arrecadadoBruto = parseFloat(c.total_arrecadado || 0);
        const taxaMP = parseFloat((arrecadadoBruto * 0.01).toFixed(2));
        const arrecadadoLiquido = Math.max(0, arrecadadoBruto - taxaMP);

        const pct = meta > 0 ? Math.min(100, Math.round((arrecadadoLiquido / meta) * 100)) : 0;
        const restante = Math.max(0, meta - arrecadadoLiquido);
        const isAtingida = (c.status === 'concluida') || (pct >= 100);

        return `
          <div style="background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
              <div>
                <span style="font-size: 10px; font-weight: 800; color: #0284C7; text-transform: uppercase; letter-spacing: 0.5px;">${c.categoria || 'Vaquinha'}</span>
                <h5 style="margin: 0; font-size: 15px; font-weight: 800; color: #0F172A;">🏆 ${c.titulo}</h5>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; background: ${isAtingida ? '#ECFDF5' : '#EFF6FF'}; color: ${isAtingida ? '#047857' : '#1D4ED8'};">
                  ${isAtingida ? '✅ Meta Atingida' : '🟢 Em Andamento'}
                </span>
              </div>
            </div>

            <!-- VALORES: ARRECADADO BRUTO X TAXA MP 1% X LÍQUIDO DISPONÍVEL X META -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px; flex-wrap: wrap; gap: 10px;">
              <div>
                <span style="font-size: 10px; color: var(--text-caption); text-transform: uppercase; font-weight: 700; display: block;">Total Arrecadado</span>
                <strong style="font-size: 17px; font-weight: 900; color: #0284C7;">
                  ${formatCurrencyBRL(arrecadadoBruto)}
                </strong>
              </div>
              <div>
                <span style="font-size: 10px; color: #DC2626; text-transform: uppercase; font-weight: 700; display: block;">Taxa MP (1%)</span>
                <strong style="font-size: 14px; font-weight: 800; color: #DC2626;">
                  - ${formatCurrencyBRL(taxaMP)}
                </strong>
              </div>
              <div>
                <span style="font-size: 10px; color: #047857; text-transform: uppercase; font-weight: 700; display: block;">Líquido em Conta</span>
                <strong style="font-size: 17px; font-weight: 900; color: #047857;">
                  ${formatCurrencyBRL(arrecadadoLiquido)}
                </strong>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 10px; color: var(--text-caption); text-transform: uppercase; font-weight: 700; display: block;">Meta Estipulada</span>
                <strong style="font-size: 15px; font-weight: 800; color: #0F172A;">
                  ${formatCurrencyBRL(meta)}
                </strong>
              </div>
            </div>

            <!-- BARRA DE PROGRESSO -->
            <div style="width: 100%; height: 10px; background: #E2E8F0; border-radius: 6px; overflow: hidden; margin-bottom: 4px;">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #0284C7 0%, #10B981 100%); border-radius: 6px; transition: width 0.4s ease;"></div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #64748B;">
              <span>${pct}% atingido (líquido)</span>
              <span>${restante > 0 ? `Faltam ${formatCurrencyBRL(restante)}` : 'Meta Concluída!'}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    const taxaMPGerais = parseFloat((totalGeraisEntradasConsolidadas * 0.01).toFixed(2));
    const saldoGeraisLiquido = totalGeraisEntradasConsolidadas - taxaMPGerais - totalGeraisDespesasConsolidadas;

    geralContainer.innerHTML = `
      <div class="card" style="padding: 18px 20px; border-left: 4px solid #0284C7; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        
        <!-- CABEÇALHO DO CARD GERAL COM EXIBIÇÃO DA TAXA MP 1% -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 14px;">
          <div>
            <span style="font-size: 11px; font-weight: 800; color: #0284C7; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Caixa Fixo & Arrecadações Extras</span>
            <h4 style="margin: 2px 0 0 0; font-size: 16px; font-weight: 800; color: #0F172A; display: flex; align-items: center; gap: 8px;">
              🏆 Vaquinhas, Materiais & Entradas/Saídas Avulsas
            </h4>
          </div>

          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span style="font-size: 12px; color: #475569;">
              Arrecadado: <strong style="color: #0284C7;">${formatCurrencyBRL(totalGeraisEntradasBruto)}</strong>
            </span>
            <span style="font-size: 12px; color: #DC2626;">
              Taxa MP (1%): <strong style="color: #DC2626;">- ${formatCurrencyBRL(taxaMPGerais)}</strong>
            </span>
            <span style="font-size: 12px; color: #475569;">
              Despesas Pagas: <strong style="color: #DC2626;">- ${formatCurrencyBRL(totalGeraisDespesasConsolidadas)}</strong>
            </span>
            <span style="font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 6px; background: #ECFDF5; color: #047857;">
              Saldo Líquido: ${(saldoGeraisLiquido >= 0 ? "+ " : "- ") + formatCurrencyBRL(Math.abs(saldoGeraisLiquido))}
            </span>
          </div>
        </div>

        <!-- PAINEL DE METAS / ESTIPULADO VS ARRECADADO DAS VAQUINHAS -->
        ${campanhasProgressoHtml}

        <!-- CORPO: ENTRADAS DA VAQUINHA X COMPRAS DE MATERIAIS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          <!-- Coluna 1: Entradas da Vaquinha / Aportes -->
          <div style="background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #0284C7; text-transform: uppercase;">
                📥 Entradas / Apoios (${entradasGeraisList.length})
              </span>
              <span style="font-size: 12px; font-weight: 800; color: #0284C7;">
                ${formatCurrencyBRL(totalGeraisEntradasConsolidadas)}
              </span>
            </div>
            <div style="max-height: 600px; overflow-y: auto;">
              ${entradasGeraisHtml}
            </div>
          </div>

          <!-- Coluna 2: Despesas e Compras com a Vaquinha -->
          <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #DC2626; text-transform: uppercase;">
                📤 Saídas / Compras (${despesasGeraisList.length})
              </span>
              <span style="font-size: 12px; font-weight: 800; color: #DC2626;">
                ${formatCurrencyBRL(totalGeraisDespesasConsolidadas)}
              </span>
            </div>
            <div style="max-height: 600px; overflow-y: auto;">
              ${despesasGeraisHtml}
            </div>
          </div>
        </div>

      </div>
    `;
  }

  // --- RENDERIZAR DEMONSTRATIVO EXCLUSIVO DE PELADAS / JOGOS ---
  if (!groupedContainer) return;

  if (txPeladas.length === 0 && (!peladasList || peladasList.length === 0)) {
    groupedContainer.innerHTML = `
      <div class="card" style="padding: 36px 20px; text-align: center; background: #FFFFFF; border-radius: 8px;">
        <i data-feather="inbox" style="width: 40px; height: 40px; color: var(--text-caption); display: block; margin: 0 auto 12px auto;"></i>
        <h4 style="margin: 0 0 6px 0; font-size: 15px; color: var(--text-heading);">Nenhum lançamento de pelada no período</h4>
      </div>
    `;
    if (countBadge) countBadge.textContent = "0 lançamentos";
    if (window.feather) feather.replace();
    return;
  }

  // Agrupar transações vinculadas estritamente à data de cada Pelada
  const groupsMap = {};

  const ultimaPeladaCadastrada = peladasList && peladasList.length > 0 ? peladasList[0] : null;
  let defaultDataPelada = "24/08/2026";
  if (ultimaPeladaCadastrada && ultimaPeladaCadastrada.data) {
    const pD = String(ultimaPeladaCadastrada.data).split("T")[0].split("-");
    if (pD.length === 3) defaultDataPelada = `${pD[2]}/${pD[1]}/${pD[0]}`;
  }

  txPeladas.forEach(t => {
    let peladaDataIdentificada = null;

    // 1. Busca por datas explícitas na descrição (ex: "dia 24/08", "Pelada 24/08/2026", "24/08", etc)
    const matchDia = t.descricao.match(/(?:dia|pelada)?\s*(\d{2}\/\d{2}(?:\/\d{4})?)/i) || 
                     t.descricao.match(/(\d{2}\/\d{2}(?:\/\d{4})?)/);

    if (matchDia && matchDia[1]) {
      const encontrada = matchDia[1];
      if (encontrada.length === 5) peladaDataIdentificada = `${encontrada}/2026`;
      else peladaDataIdentificada = encontrada;
    } else {
      // 2. Se a descrição não tiver data explicita, associa com a pelada cuja data é mais próxima da data de lançamento da transação (t.data)
      let peladaMaisProxima = null;
      let menorDiferenca = Infinity;

      (peladasList || []).forEach(p => {
        if (p.data) {
          const pDate = new Date(p.data);
          const diff = Math.abs(t.data.getTime() - pDate.getTime());
          if (diff < menorDiferenca) {
            menorDiferenca = diff;
            peladaMaisProxima = p;
          }
        }
      });

      if (peladaMaisProxima && peladaMaisProxima.data) {
        const parts = String(peladaMaisProxima.data).split("T")[0].split("-");
        if (parts.length === 3) peladaDataIdentificada = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      if (!peladaDataIdentificada) {
        peladaDataIdentificada = defaultDataPelada;
      }
    }

    const groupKey = `Pelada_${peladaDataIdentificada.replace(/\//g, '-')}`;
    const groupTitle = `Pelada do dia ${peladaDataIdentificada}`;

    if (!groupsMap[groupKey]) {
      groupsMap[groupKey] = {
        key: groupKey,
        title: groupTitle,
        dataPelada: peladaDataIdentificada,
        entradas: [],
        despesas: [],
        totalEntradasConsolidadas: 0,
        totalEntradasPrevistas: 0,
        totalDespesasPrevistas: 0,
        totalDespesasConsolidadas: 0,
        dataMaisRecente: t.data
      };
    }

    if (t.data > groupsMap[groupKey].dataMaisRecente) {
      groupsMap[groupKey].dataMaisRecente = t.data;
    }

    if (t.isEntrada) {
      groupsMap[groupKey].entradas.push(t);
      groupsMap[groupKey].totalEntradasPrevistas += t.valor;
      if (t.isEfetivado) {
        groupsMap[groupKey].totalEntradasConsolidadas += t.valor;
      } else if (t.isParcial) {
        groupsMap[groupKey].totalEntradasConsolidadas += t.valPago;
      }
    } else {
      groupsMap[groupKey].despesas.push(t);
      groupsMap[groupKey].totalDespesasPrevistas += t.valor;
      if (t.isEfetivado) {
        groupsMap[groupKey].totalDespesasConsolidadas += t.valor;
      } else if (t.isParcial) {
        groupsMap[groupKey].totalDespesasConsolidadas += t.valPago;
      }
    }
  });

  // Também garante que peladas cadastradas sem movimentação ainda apareçam no select
  (peladasList || []).forEach(p => {
    const rawDate = p.data ? String(p.data).split("T")[0] : "";
    if (rawDate) {
      const parts = rawDate.split("-");
      if (parts.length === 3) {
        const diaMesAno = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const gKey = `Pelada_${diaMesAno.replace(/\//g, '-')}`;
        if (!groupsMap[gKey]) {
          groupsMap[gKey] = {
            key: gKey,
            title: `Pelada do dia ${diaMesAno}`,
            dataPelada: diaMesAno,
            entradas: [],
            despesas: [],
            totalEntradasConsolidadas: 0,
            totalEntradasPrevistas: 0,
            totalDespesasPrevistas: 0,
            totalDespesasConsolidadas: 0,
            dataMaisRecente: new Date(p.data)
          };
        }
      }
    }
  });

  // Popula o Select de Peladas exibindo apenas as Datas das Peladas
  const selectPeladaEl = document.getElementById("finances-select-pelada");
  if (selectPeladaEl) {
    const currentVal = window.App._financeiroPeladaFilter || "todas";
    const availableKeys = Object.keys(groupsMap);
    
    let selectOpts = `<option value="todas">📋 Todas as Peladas (${availableKeys.length})</option>`;
    availableKeys.forEach(k => {
      const isSelected = (k === currentVal) ? "selected" : "";
      const labelData = groupsMap[k].dataPelada ? `📅 ${groupsMap[k].dataPelada}` : `📅 ${groupsMap[k].title}`;
      selectOpts += `<option value="${k}" ${isSelected}>${labelData}</option>`;
    });
    selectPeladaEl.innerHTML = selectOpts;
  }

  // Filtra os grupos conforme a seleção do select de peladas
  let displayGroups = Object.values(groupsMap);
  const selectedPeladaKey = window.App._financeiroPeladaFilter || "todas";
  if (selectedPeladaKey !== "todas") {
    displayGroups = displayGroups.filter(g => g.key === selectedPeladaKey);
  }

  // Ordena os grupos por data da pelada (mais recente primeiro)
  const sortedGroups = displayGroups.sort((a, b) => b.dataMaisRecente - a.dataMaisRecente);

  let htmlCards = "";

  sortedGroups.forEach(grp => {
    const saldoGrupoConsolidado = grp.totalEntradasConsolidadas - grp.totalDespesasConsolidadas;
    const saldoGrupoPrevisto = grp.totalEntradasPrevistas - grp.totalDespesasPrevistas;
    
    // Indicador visual: Verde (Lucro), Vermelho (Prejuízo), Cinza (Pendente/Neutro)
    let badgeStatusColor = "#10B981";
    let badgeStatusBg = "#ECFDF5";
    let badgeStatusText = "🟢 Lucro Real";
    let borderAccent = "#10B981";

    if (saldoGrupoConsolidado < 0) {
      badgeStatusColor = "#EF4444";
      badgeStatusBg = "#FEF2F2";
      badgeStatusText = "🔴 Prejuízo Real";
      borderAccent = "#EF4444";
    } else if (saldoGrupoConsolidado === 0 && grp.totalEntradasConsolidadas === 0 && grp.totalDespesasConsolidadas === 0) {
      badgeStatusColor = "#64748B";
      badgeStatusBg = "#F1F5F9";
      badgeStatusText = "⚪ Neutro";
      borderAccent = "#94A3B8";
    }

    const saldoFormatado = (saldoGrupoConsolidado >= 0 ? "+ " : "- ") + formatCurrencyBRL(Math.abs(saldoGrupoConsolidado));
    const saldoPrevistoFmt = (saldoGrupoPrevisto >= 0 ? "+ " : "- ") + formatCurrencyBRL(Math.abs(saldoGrupoPrevisto));

    // Renderiza Lista de Entradas do Grupo
    let entradasHtml = "";
    if (grp.entradas.length === 0) {
      entradasHtml = `<div style="font-size: 12px; color: var(--text-caption); padding: 8px 0;">Nenhuma entrada registrada nesta pelada.</div>`;
    } else {
      entradasHtml = grp.entradas.map(e => {
        const dataPagFmt = e.data ? `${e.data.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })} às ${e.data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}` : '';
        const descLimpa = e.descricao.replace(/\s*\[PAGO:[\d.]+\/[\d.]+\]/gi, '').replace(/\s*\[NÃO EFETIVADO\]/gi, '').replace(/\s*\[PENDENTE\]/gi, '');
        const nomeOuDesc = e.atletaNome ? `⚽ <strong>${e.atletaNome}</strong> <span style="font-size:11px; color:var(--text-caption);">(${descLimpa})</span>` : descLimpa;
        
        let badgeEfetivado = '';
        let valExibicaoStr = '';
        if (e.isParcial) {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(2, 132, 199, 0.15); color: #0284C7; border: 1px solid rgba(2, 132, 199, 0.4); margin-left: 6px;">🌗 Recebido ${formatCurrencyBRL(e.valPago)} de ${formatCurrencyBRL(e.valor)}</span>`;
          valExibicaoStr = `+ ${formatCurrencyBRL(e.valPago)}`;
        } else if (e.isEfetivado) {
          valExibicaoStr = `+ ${formatCurrencyBRL(e.valor)}`;
        } else {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(245, 158, 11, 0.15); color: #B45309; border: 1px solid rgba(245, 158, 11, 0.4); margin-left: 6px;">⏳ Não Efetivado</span>`;
          valExibicaoStr = `+ R$ 0,00 <span style="font-size:10px; color:#64748B;">(${formatCurrencyBRL(e.valor)})</span>`;
        }

        const btnEfetivar = (!e.isEfetivado && !isAthleteView)
          ? `<button onclick="window.App.efetivarTransacaoDireta('${e.id}')" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFFFFF; border: none; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25); white-space: nowrap;" title="Marcar esta entrada como 100% EFETIVADA (Recebido)">⚡ Efetivar</button>`
          : '';
        const btnEditar = !isAthleteView
          ? `<button onclick="window.App.abrirEditarTransacao('${e.id}')" style="background: #F1F5F9; border: 1px solid #CBD5E1; cursor: pointer; color: #475569; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Editar lançamento">✏️ Editar</button>`
          : '';

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #F1F5F9; font-size: 13px; flex-wrap: wrap; gap: 6px;">
            <div style="min-width: 140px; flex: 1; padding-right: 8px;">
              <span style="color: #0F172A; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">${nomeOuDesc}${badgeEfetivado}</span>
              <span style="font-size: 10px; color: #64748B;">${e.categoria} · 📅 Pago em <strong>${dataPagFmt}</strong></span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
              <span style="font-weight: 700; color: #059669; white-space: nowrap;">${valExibicaoStr}</span>
              ${btnEfetivar}
              ${btnEditar}
            </div>
          </div>
        `;
      }).join('');
    }

    // Renderiza Lista de Despesas do Grupo
    let despesasHtml = "";
    if (grp.despesas.length === 0) {
      despesasHtml = `<div style="font-size: 12px; color: var(--text-caption); padding: 8px 0;">Nenhuma despesa lançada nesta pelada.</div>`;
    } else {
      despesasHtml = grp.despesas.map(d => {
        const horaFmt = d.data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
        const descLimpa = d.descricao.replace(/\s*\[PAGO:[\d.]+\/[\d.]+\]/gi, '').replace(/\s*\[NÃO EFETIVADO\]/gi, '').replace(/\s*\[PENDENTE\]/gi, '');
        let badgeEfetivado = '';
        if (d.isParcial) {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(2, 132, 199, 0.15); color: #0284C7; border: 1px solid rgba(2, 132, 199, 0.4); margin-left: 6px;">🌗 Pago ${formatCurrencyBRL(d.valPago)} de ${formatCurrencyBRL(d.valor)} (Falta ${formatCurrencyBRL(d.valRestante)})</span>`;
        } else if (d.isEfetivado) {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.3); margin-left: 6px;">✅ Efetivado</span>`;
        } else {
          badgeEfetivado = `<span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(245, 158, 11, 0.15); color: #B45309; border: 1px solid rgba(245, 158, 11, 0.4); margin-left: 6px;">⏳ Não Efetivado</span>`;
        }
        const btnEfetivar = (!d.isEfetivado && !isAthleteView)
          ? `<button onclick="window.App.efetivarTransacaoDireta('${d.id}')" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFFFFF; border: none; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25); white-space: nowrap;" title="Marcar esta despesa como 100% EFETIVADA (Pago)">⚡ Efetivar</button>`
          : '';
        const btnEditar = !isAthleteView
          ? `<button onclick="window.App.abrirEditarTransacao('${d.id}')" style="background: #F1F5F9; border: 1px solid #CBD5E1; cursor: pointer; color: #475569; font-size: 11px; padding: 4px 8px; border-radius: 6px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Editar lançamento">✏️ Editar</button>`
          : '';
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #F1F5F9; font-size: 13px; flex-wrap: wrap; gap: 6px;">
            <div style="min-width: 140px; flex: 1; padding-right: 8px;">
              <span style="color: #0F172A; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">${descLimpa}${badgeEfetivado}</span>
              <span style="font-size: 10px; color: #94A3B8;">${d.categoria} · ${horaFmt}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap;">
              <span style="font-weight: 800; color: #DC2626; white-space: nowrap; font-size: 14px;">- ${formatCurrencyBRL(d.valor)}</span>
              ${btnEfetivar}
              ${btnEditar}
            </div>
          </div>
        `;
      }).join('');
    }

    htmlCards += `
      <div class="card" style="padding: 18px 20px; border-left: 4px solid ${borderAccent}; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
        
        <!-- CABEÇALHO DO GRUPO (Data e Totais Reais vs Previstos) -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 14px;">
          <div>
            <h4 style="margin: 0; font-size: 16px; font-weight: 800; color: #0F172A; display: flex; align-items: center; gap: 8px;">
              📅 ${grp.title}
            </h4>
          </div>

          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
            <span style="font-size: 12px; color: #475569;">
              Arrecadado: <strong style="color: #059669;">${formatCurrencyBRL(grp.totalEntradasConsolidadas)}</strong> <span style="font-size: 10px; color: #64748B;">(Previsto: ${formatCurrencyBRL(grp.totalEntradasPrevistas)})</span>
            </span>
            <span style="font-size: 12px; color: #475569;">
              Despesas Pagas: <strong style="color: #DC2626;">${formatCurrencyBRL(grp.totalDespesasConsolidadas)}</strong> <span style="font-size: 10px; color: #64748B;">(Previstas: ${formatCurrencyBRL(grp.totalDespesasPrevistas)})</span>
            </span>
            <span style="font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 6px; background: ${badgeStatusBg}; color: ${badgeStatusColor};">
              Saldo Real: ${saldoFormatado} <span style="font-weight: 600; font-size: 11px;">(Projetado: ${saldoPrevistoFmt})</span>
            </span>
          </div>
        </div>

        <!-- CORPO DAS SUBSEÇÕES: ENTRADAS X DESPESAS LADO A LADO -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          <!-- Coluna 1: Entradas -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #059669; text-transform: uppercase;">
                📥 Entradas (${grp.entradas.length})
              </span>
              <span style="font-size: 12px; font-weight: 800; color: #059669;">
                ${formatCurrencyBRL(grp.totalEntradasConsolidadas)}
              </span>
            </div>
            <div style="max-height: 220px; overflow-y: auto;">
              ${entradasHtml}
            </div>
          </div>

          <!-- Coluna 2: Despesas -->
          <div style="background: #FDF2F2; border: 1px solid #FEE2E2; border-radius: 8px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 12px; font-weight: 800; color: #DC2626; text-transform: uppercase;">
                📤 Despesas (${grp.despesas.length})
              </span>
              <span style="font-size: 12px; font-weight: 800; color: #DC2626;">
                ${formatCurrencyBRL(grp.totalDespesasConsolidadas)}
              </span>
            </div>
            <div style="max-height: 220px; overflow-y: auto;">
              ${despesasHtml}
            </div>
          </div>
        </div>

      </div>
    `;
  });

  groupedContainer.innerHTML = htmlCards;
  if (window.feather) feather.replace();
};

function formatCurrencyBRL(val) {
  const num = isNaN(parseFloat(val)) ? 0 : parseFloat(val);
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

// =========================================================================
// RELATÓRIO DA VAQUINHA: EXPORTAÇÃO (WHATSAPP & EXCEL / CSV) - GESTOR
// =========================================================================
window.App.exportVaquinhaWhatsApp = function(arrecadacaoId) {
  const campanhas = window._financeiroArrecadacoesList || [];
  const camp = campanhas.find(c => String(c.id) === String(arrecadacaoId));

  if (!camp) {
    if (window.App.showToast) window.App.showToast("Campanha de vaquinha não encontrada.", "warning");
    return;
  }

  const meta = parseFloat(camp.meta_valor || 0);
  const arrecadado = parseFloat(camp.total_arrecadado || 0);
  const taxaMP = arrecadado * 0.01;
  const arrecadadoLiquido = arrecadado - taxaMP;
  const pct = meta > 0 ? Math.min(100, Math.round((arrecadado / meta) * 100)) : 0;
  const apoiadores = agruparContribuicoesPorAtleta(camp.contribuicoes);

  let text = `🏆 *RELATÓRIO DA VAQUINHA — ${camp.titulo.toUpperCase()}*\n`;
  if (camp.categoria) text += `📌 Categoria: ${camp.categoria}\n`;
  text += `----------------------------------\n`;
  text += `🎯 Meta do Grupo: R$ ${meta.toFixed(2).replace('.', ',')}\n`;
  text += `💰 Total Arrecadado: R$ ${arrecadado.toFixed(2).replace('.', ',')} (${pct}% da meta)\n`;
  text += `💳 Taxa MP (1%): -R$ ${taxaMP.toFixed(2).replace('.', ',')}\n`;
  text += `✅ Líquido em Conta: R$ ${arrecadadoLiquido.toFixed(2).replace('.', ',')}\n\n`;

  if (apoiadores.length === 0) {
    text += `👥 *LISTA DE CONTRIBUINTES:* Nenhuma contribuição registrada ainda.\n`;
  } else {
    text += `👥 *LISTA DE CONTRIBUINTES QUE JÁ APOIARAM (${apoiadores.length}):*\n`;
    apoiadores.forEach((a, idx) => {
      const nomeDisplay = a.apelido || a.nome || "Atleta";
      const valFmt = parseFloat(a.valorTotal || 0).toFixed(2).replace('.', ',');
      const extraContribStr = a.qtdContribuicoes > 1 ? ` (${a.qtdContribuicoes}x)` : '';
      text += `${idx + 1}. ⚽ *${nomeDisplay}* — R$ ${valFmt}${extraContribStr}\n`;
    });
  }

  text += `\n*PeladaPro* · Transparência & Gestão 💚`;

  if (navigator.clipboard && text) {
    navigator.clipboard.writeText(text).then(() => {
      if (window.App.showToast) window.App.showToast("Relatório da vaquinha copiado para o WhatsApp com sucesso! 📲", "success");
      const encoded = encodeURIComponent(text);
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }).catch(() => {
      const encoded = encodeURIComponent(text);
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    });
  } else {
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  }
};

window.App.exportVaquinhaExcel = function(arrecadacaoId) {
  const campanhas = window._financeiroArrecadacoesList || [];
  const camp = campanhas.find(c => String(c.id) === String(arrecadacaoId));

  if (!camp) {
    if (window.App.showToast) window.App.showToast("Campanha de vaquinha não encontrada.", "warning");
    return;
  }

  const apoiadores = agruparContribuicoesPorAtleta(camp.contribuicoes);

  if (apoiadores.length === 0) {
    if (window.App.showToast) window.App.showToast("Nenhuma contribuição registrada para exportar nesta vaquinha.", "warning");
    return;
  }

  let csv = "\uFEFF"; // BOM para acentuação no Excel em PT-BR
  csv += `RELATÓRIO DA VAQUINHA: ${camp.titulo}\n`;
  csv += `Meta: R$ ${parseFloat(camp.meta_valor || 0).toFixed(2)};Total Arrecadado: R$ ${parseFloat(camp.total_arrecadado || 0).toFixed(2)};Total Atletas Contribuintes: ${apoiadores.length}\n\n`;
  csv += "#;Nome do Atleta;Apelido;Valor Total Contribuído (R$);Qtd Contribuições;Status\n";

  apoiadores.forEach((a, idx) => {
    const num = idx + 1;
    const nome = (a.nome || "").replace(/;/g, ",");
    const apelido = (a.apelido || "").replace(/;/g, ",");
    const valFmt = parseFloat(a.valorTotal || 0).toFixed(2).replace('.', ',');
    const status = (a.status === 'approved' || a.status === 'aprovado') ? 'Aprovado' : (a.status || 'Confirmado');

    csv += `${num};${nome};${apelido};R$ ${valFmt};${a.qtdContribuicoes};${status}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const titleClean = camp.titulo.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `Relatorio_Vaquinha_${titleClean}.csv`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (window.App.showToast) window.App.showToast("Relatório em Excel (CSV) exportado com sucesso! 📊", "success");
};

window.App.alternarStatusVaquinha = async function(arrecadacaoId, novoStatus) {
  const confirmMsg = novoStatus === 'concluida'
    ? "Deseja encerrar esta vaquinha? Ela continuará visível no histórico com a lista final de apoiadores."
    : "Deseja reabrir esta vaquinha para receber novas contribuições?";
  if (!confirm(confirmMsg)) return;

  try {
    const res = await window.Api.atualizarStatusArrecadacao(arrecadacaoId, novoStatus);
    if (res && res.error) {
      if (window.App.showToast) window.App.showToast(res.error, "error");
      return;
    }

    if (window.App.showToast) window.App.showToast(`Status da vaquinha atualizado para '${novoStatus === 'concluida' ? 'Concluída' : 'Ativa'}'!`, "success");
    if (window.App.renderFinanceiroData) {
      await window.App.renderFinanceiroData();
    }
  } catch (err) {
    console.error("[alternarStatusVaquinha]", err);
    if (window.App.showToast) window.App.showToast("Erro ao atualizar status da vaquinha.", "error");
  }
};
