// ==========================================================================
// PÁGINA: GESTOR - FINANCEIRO (financeiro.js)
// Reestruturação em 3 Níveis: KPIs, Demonstrativo Agrupado por Pelada e Ações/Filtros
// ==========================================================================

window.App._financeiroFilter = "este_mes"; // "este_mes" | "ultimos_30" | "tudo"
window.App._financeiroPeladaFilter = "todas"; // "todas" | "Pelada_24/08" etc.

window.App.initFinanceiro = async function() {
  await window.App.renderFinanceiroData();

  // 1. Botões de Ação do Nível 3
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

    if (group && group.id && window.Api) {
      // 1. Busca transações do grupo
      if (window.Api.listarTransacoesDoGrupo) {
        try {
          const dbTx = await window.Api.listarTransacoesDoGrupo(group.id);
          if (Array.isArray(dbTx)) rawTransactions = dbTx;
        } catch (e) {
          console.error("[Financeiro] Erro ao carregar transações:", e);
        }
      }

      // 2. Busca datas/peladas cadastradas do grupo
      if (window.Api.listarDatasDoGrupo) {
        try {
          const peladas = await window.Api.listarDatasDoGrupo(group.id);
          if (Array.isArray(peladas)) peladasList = peladas;
        } catch (e) {}
      }

      // 2.1 Busca campanhas de arrecadação/vaquinha do grupo
      if (window.Api.listarArrecadacoes) {
        try {
          const arrs = await window.Api.listarArrecadacoes(group.id);
          if (Array.isArray(arrs)) window._financeiroArrecadacoesList = arrs;
        } catch (e) {}
      }

      // 3. Busca atletas para saldo
      if (window.Api.getPlayers) {
        try {
          const players = await window.Api.getPlayers();
          if (Array.isArray(players)) playersList = players;
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error("[Financeiro] Erro geral ao sincronizar:", err);
  }

  // Normaliza transações considerando estritamente créditos como Entradas e débitos como Despesas
  let normalizedTx = rawTransactions.map(t => {
    const rawVal = parseFloat(t.valor || 0);
    const atletaNome = t.usuario_apelido || t.usuario_nome || "";
    const desc = t.descricao || "";
    
    let categoriaExibicao = "Entrada";
    let isEntrada = (t.tipo === "credito");

    if (t.tipo === "credito") {
      isEntrada = true;
      if (!t.usuario_id) {
        categoriaExibicao = "Verba / Receita";
      } else if (desc.startsWith("Pagamento Pix")) {
        categoriaExibicao = "Pix Atleta";
      } else {
        categoriaExibicao = "Crédito Carteira";
      }
    } else {
      isEntrada = false;
      if (!t.usuario_id) {
        categoriaExibicao = "Despesa";
      } else if (desc.startsWith("Presença de")) {
        categoriaExibicao = "Débito Presença";
      } else {
        categoriaExibicao = "Saída";
      }
    }

    return {
      id: t.id,
      usuario_id: t.usuario_id,
      grupo_id: t.grupo_id,
      atletaNome: atletaNome,
      valor: rawVal,
      tipoOriginal: t.tipo,
      isEntrada: isEntrada,
      categoria: categoriaExibicao,
      descricao: desc,
      data: t.data ? new Date(t.data) : new Date()
    };
  });

  // Para o painel financeiro do gestor:
  // As entradas são os créditos reais (Pix pago, verbas injetadas)
  // As despesas são os débitos manuais lançados pelo gestor (quadra, coletes, etc.)
  const gestorTx = normalizedTx.filter(t => {
    // Se for crédito: exibe todos (Pix dos atletas + verbas do gestor)
    if (t.isEntrada) return true;
    // Se for débito: exibe apenas despesas do grupo (usuario_id null ou estorno de presença)
    if (!t.usuario_id || t.descricao.startsWith("Estorno")) return true;
    return false;
  });

  // Filtra por período selecionado
  const agora = new Date();
  const filtro = window.App._financeiroFilter || "este_mes";

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

  // =========================================================================
  // NÍVEL 1: CÁLCULO E RENDERIZAÇÃO DOS CARTÕES DE RESUMO (KPIs)
  // =========================================================================
  let totalArrecadado = 0;
  let totalDespesas = 0;

  filteredTx.forEach(t => {
    if (t.isEntrada) totalArrecadado += t.valor;
    else totalDespesas += t.valor;
  });

  // Saldo geral acumulado de todas as transações da história (Caixa Atual)
  let caixaAtualTotal = 0;
  gestorTx.forEach(t => {
    if (t.isEntrada) caixaAtualTotal += t.valor;
    else caixaAtualTotal -= t.valor;
  });

  const saldoLiquidoPeriodo = totalArrecadado - totalDespesas;

  // Atualiza elementos DOM dos KPIs
  const elCaixa = document.getElementById("finances-kpi-caixa");
  const elArrecadado = document.getElementById("finances-kpi-arrecadado");
  const elDespesas = document.getElementById("finances-kpi-despesas");
  const elSaldo = document.getElementById("finances-kpi-saldo");
  const elSaldoSub = document.getElementById("finances-kpi-saldo-sub");
  const elSaldoCard = document.getElementById("finances-kpi-saldo-card");
  const elSaldoIcon = document.getElementById("finances-kpi-saldo-icon");

  if (elCaixa) elCaixa.textContent = formatCurrencyBRL(caixaAtualTotal);
  if (elArrecadado) elArrecadado.textContent = formatCurrencyBRL(totalArrecadado);
  if (elDespesas) elDespesas.textContent = formatCurrencyBRL(totalDespesas);

  if (elSaldo) {
    elSaldo.textContent = (saldoLiquidoPeriodo >= 0 ? "+ " : "- ") + formatCurrencyBRL(Math.abs(saldoLiquidoPeriodo));
    if (saldoLiquidoPeriodo >= 0) {
      elSaldo.style.color = "#1D9E75";
      if (elSaldoCard) elSaldoCard.style.borderLeftColor = "#1D9E75";
      if (elSaldoIcon) {
        elSaldoIcon.style.color = "#1D9E75";
        elSaldoIcon.style.background = "rgba(29, 158, 117, 0.12)";
      }
      if (elSaldoSub) elSaldoSub.textContent = "Lucro no período selecionado";
    } else {
      elSaldo.style.color = "#E74C3C";
      if (elSaldoCard) elSaldoCard.style.borderLeftColor = "#E74C3C";
      if (elSaldoIcon) {
        elSaldoIcon.style.color = "#E74C3C";
        elSaldoIcon.style.background = "rgba(231, 76, 60, 0.12)";
      }
      if (elSaldoSub) elSaldoSub.textContent = "Prejuízo no período selecionado";
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
    const hasPeladaVinculada = desc.match(/dia\s+\d{2}\/\d{2}/i) || desc.match(/pelada\s+\d{2}\/\d{2}/i) || desc.includes("Convocação");

    if (isVaquinha) {
      txGerais.push({ ...t, subTipo: 'vaquinha' });
    } else if (hasPeladaVinculada) {
      txPeladas.push(t);
    } else {
      txGerais.push({ ...t, subTipo: 'avulso' });
    }
  });

  // --- RENDERIZAR CARD DE CAIXA GERAL & VAQUINHAS (NÃO VINCULADOS A PELADAS) ---
  if (geralContainer) {
    const totalGeraisEntradas = txGerais.filter(t => t.isEntrada).reduce((acc, t) => acc + t.valor, 0);
    const totalGeraisDespesas = txGerais.filter(t => !t.isEntrada).reduce((acc, t) => acc + t.valor, 0);
    const saldoGerais = totalGeraisEntradas - totalGeraisDespesas;

    let entradasGeraisHtml = "";
    const entradasGeraisList = txGerais.filter(t => t.isEntrada);
    if (entradasGeraisList.length === 0) {
      entradasGeraisHtml = `<div style="font-size: 12px; color: var(--text-caption); padding: 8px 0;">Nenhuma entrada de vaquinha ou aporte no período.</div>`;
    } else {
      entradasGeraisHtml = entradasGeraisList.map(e => {
        const horaFmt = e.data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
        const dataFmt = e.data.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
        const badgeIcon = e.subTipo === 'vaquinha' ? '🏆' : '💵';
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #E2E8F0; font-size: 13px;">
            <div style="min-width: 0; flex: 1; padding-right: 8px;">
              <span style="color: #0F172A; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${badgeIcon} <strong>${e.descricao}</strong></span>
              <span style="font-size: 10px; color: #64748B;">${e.categoria} · ${dataFmt} às ${horaFmt}</span>
            </div>
            <span style="font-weight: 700; color: #0284C7; white-space: nowrap;">+ ${formatCurrencyBRL(e.valor)}</span>
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
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #FEE2E2; font-size: 13px;">
            <div style="min-width: 0; flex: 1; padding-right: 8px;">
              <span style="color: #0F172A; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🛍️ <strong>${d.descricao}</strong></span>
              <span style="font-size: 10px; color: #64748B;">${d.categoria} · ${dataFmt} às ${horaFmt}</span>
            </div>
            <span style="font-weight: 700; color: #DC2626; white-space: nowrap;">- ${formatCurrencyBRL(d.valor)}</span>
          </div>
        `;
      }).join('');
    }

    // Informações das campanhas de arrecadação cadastradas
    const campanhas = window._financeiroArrecadacoesList || [];
    let campanhasProgressoHtml = "";

    if (campanhas.length > 0) {
      campanhasProgressoHtml = campanhas.map(c => {
        const meta = parseFloat(c.meta_valor || 0);
        const arrecadado = parseFloat(c.total_arrecadado || 0);
        const pct = meta > 0 ? Math.min(100, Math.round((arrecadado / meta) * 100)) : 0;
        const restante = Math.max(0, meta - arrecadado);
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

            <!-- VALORES: ARRECADADO X ESTIPULADO (META) -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px;">
              <div>
                <span style="font-size: 10px; color: var(--text-caption); text-transform: uppercase; font-weight: 700; display: block;">Total Arrecadado</span>
                <strong style="font-size: 18px; font-weight: 900; color: #0284C7;">
                  ${formatCurrencyBRL(arrecadado)}
                </strong>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 10px; color: var(--text-caption); text-transform: uppercase; font-weight: 700; display: block;">Meta Estipulada</span>
                <strong style="font-size: 16px; font-weight: 800; color: #0F172A;">
                  ${formatCurrencyBRL(meta)}
                </strong>
              </div>
            </div>

            <!-- BARRA DE PROGRESSO -->
            <div style="width: 100%; height: 10px; background: #E2E8F0; border-radius: 6px; overflow: hidden; margin-bottom: 4px;">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #0284C7 0%, #10B981 100%); border-radius: 6px; transition: width 0.4s ease;"></div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #64748B;">
              <span>${pct}% atingido</span>
              <span>${restante > 0 ? `Faltam ${formatCurrencyBRL(restante)}` : 'Meta Concluída!'}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    geralContainer.innerHTML = `
      <div class="card" style="padding: 18px 20px; border-left: 4px solid #0284C7; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
        
        <!-- CABEÇALHO DO CARD GERAL -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 14px;">
          <div>
            <span style="font-size: 11px; font-weight: 800; color: #0284C7; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Caixa Fixo & Arrecadações Extras</span>
            <h4 style="margin: 2px 0 0 0; font-size: 16px; font-weight: 800; color: #0F172A; display: flex; align-items: center; gap: 8px;">
              🏆 Vaquinhas, Materiais & Entradas/Saídas Avulsas
            </h4>
          </div>

          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
            <span style="font-size: 12px; color: #475569;">
              Arrecadado: <strong style="color: #0284C7;">${formatCurrencyBRL(totalGeraisEntradas)}</strong>
            </span>
            <span style="font-size: 12px; color: #475569;">
              Despesas: <strong style="color: #DC2626;">${formatCurrencyBRL(totalGeraisDespesas)}</strong>
            </span>
            <span style="font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 6px; background: #EFF6FF; color: #1D4ED8;">
              Saldo: ${(saldoGerais >= 0 ? "+ " : "- ") + formatCurrencyBRL(Math.abs(saldoGerais))}
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
                ${formatCurrencyBRL(totalGeraisEntradas)}
              </span>
            </div>
            <div style="max-height: 220px; overflow-y: auto;">
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
                ${formatCurrencyBRL(totalGeraisDespesas)}
              </span>
            </div>
            <div style="max-height: 220px; overflow-y: auto;">
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

    const matchDia = t.descricao.match(/dia\s+(\d{2}\/\d{2}(?:\/\d{4})?)/i) || t.descricao.match(/pelada\s+(\d{2}\/\d{2}(?:\/\d{4})?)/i);
    if (matchDia && matchDia[1]) {
      const encontrada = matchDia[1];
      if (encontrada.length === 5) peladaDataIdentificada = `${encontrada}/2026`;
      else peladaDataIdentificada = encontrada;
    } else {
      peladaDataIdentificada = defaultDataPelada;
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
        totalEntradas: 0,
        totalDespesas: 0,
        dataMaisRecente: t.data
      };
    }

    if (t.data > groupsMap[groupKey].dataMaisRecente) {
      groupsMap[groupKey].dataMaisRecente = t.data;
    }

    if (t.isEntrada) {
      groupsMap[groupKey].entradas.push(t);
      groupsMap[groupKey].totalEntradas += t.valor;
    } else {
      groupsMap[groupKey].despesas.push(t);
      groupsMap[groupKey].totalDespesas += t.valor;
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
            totalEntradas: 0,
            totalDespesas: 0,
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
    const saldoGrupo = grp.totalEntradas - grp.totalDespesas;
    
    // Indicador visual: Verde (Lucro), Vermelho (Prejuízo), Cinza (Pendente/Neutro)
    let badgeStatusColor = "#10B981";
    let badgeStatusBg = "#ECFDF5";
    let badgeStatusText = "🟢 Lucro";
    let borderAccent = "#10B981";

    if (saldoGrupo < 0) {
      badgeStatusColor = "#EF4444";
      badgeStatusBg = "#FEF2F2";
      badgeStatusText = "🔴 Prejuízo";
      borderAccent = "#EF4444";
    } else if (saldoGrupo === 0 && grp.totalEntradas === 0 && grp.totalDespesas === 0) {
      badgeStatusColor = "#64748B";
      badgeStatusBg = "#F1F5F9";
      badgeStatusText = "⚪ Neutro";
      borderAccent = "#94A3B8";
    }

    const saldoFormatado = (saldoGrupo >= 0 ? "+ " : "- ") + formatCurrencyBRL(Math.abs(saldoGrupo));

    // Renderiza Lista de Entradas do Grupo
    let entradasHtml = "";
    if (grp.entradas.length === 0) {
      entradasHtml = `<div style="font-size: 12px; color: var(--text-caption); padding: 8px 0;">Nenhuma entrada registrada nesta pelada.</div>`;
    } else {
      entradasHtml = grp.entradas.map(e => {
        const horaFmt = e.data.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
        const nomeOuDesc = e.atletaNome ? `⚽ <strong>${e.atletaNome}</strong> <span style="font-size:11px; color:var(--text-caption);">(${e.descricao})</span>` : e.descricao;
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #F1F5F9; font-size: 13px;">
            <div style="min-width: 0; flex: 1; padding-right: 8px;">
              <span style="color: #0F172A; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nomeOuDesc}</span>
              <span style="font-size: 10px; color: #94A3B8;">${e.categoria} · ${horaFmt}</span>
            </div>
            <span style="font-weight: 700; color: #059669; white-space: nowrap;">+ ${formatCurrencyBRL(e.valor)}</span>
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
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #F1F5F9; font-size: 13px;">
            <div style="min-width: 0; flex: 1; padding-right: 8px;">
              <span style="color: #0F172A; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${d.descricao}</span>
              <span style="font-size: 10px; color: #94A3B8;">${d.categoria} · ${horaFmt}</span>
            </div>
            <span style="font-weight: 700; color: #DC2626; white-space: nowrap;">- ${formatCurrencyBRL(d.valor)}</span>
          </div>
        `;
      }).join('');
    }

    htmlCards += `
      <div class="card" style="padding: 18px 20px; border-left: 4px solid ${borderAccent}; background: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
        
        <!-- CABEÇALHO DO GRUPO (Data e 3 Totais) -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px; margin-bottom: 14px;">
          <div>
            <h4 style="margin: 0; font-size: 16px; font-weight: 800; color: #0F172A; display: flex; align-items: center; gap: 8px;">
              📅 ${grp.title}
            </h4>
          </div>

          <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
            <span style="font-size: 12px; color: #475569;">
              Arrecadado: <strong style="color: #059669;">${formatCurrencyBRL(grp.totalEntradas)}</strong>
            </span>
            <span style="font-size: 12px; color: #475569;">
              Despesas: <strong style="color: #DC2626;">${formatCurrencyBRL(grp.totalDespesas)}</strong>
            </span>
            <span style="font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 6px; background: ${badgeStatusBg}; color: ${badgeStatusColor};">
              Saldo: ${saldoFormatado} (${badgeStatusText})
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
                ${formatCurrencyBRL(grp.totalEntradas)}
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
                ${formatCurrencyBRL(grp.totalDespesas)}
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
