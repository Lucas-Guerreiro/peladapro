// ==========================================================================
// PÁGINA: JOGADOR - ARRECADAÇÕES / VAQUINHA (arrecadacao.js)
// ==========================================================================

window.App.initArrecadacao = async function() {
  await renderCampanhasArrecadacao();
};

async function renderCampanhasArrecadacao() {
  const container = document.getElementById("arrecadacoes-cards-container");
  const headerTotalEl = document.getElementById("arrecadacao-header-total");
  if (!container) return;

  let group = (window.Auth && window.Auth.currentGroup) || window.App.currentGroup;
  if (!group || !group.id) {
    try { group = JSON.parse(localStorage.getItem("currentGroup")); } catch (e) {}
  }

  if (!group || !group.id) {
    container.innerHTML = `
      <div class="card" style="padding: 32px; text-align: center; background: #FFFFFF; border-radius: 16px;">
        <p style="color: var(--text-caption); margin: 0;">Selecione um grupo para visualizar as campanhas.</p>
      </div>
    `;
    return;
  }

  try {
    const campanhas = await window.Api.listarArrecadacoes(group.id);

    if (!Array.isArray(campanhas) || campanhas.length === 0) {
      container.innerHTML = `
        <div class="card" style="padding: 48px 24px; text-align: center; background: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
          <div style="font-size: 40px; margin-bottom: 12px;">🏆</div>
          <h3 style="margin: 0 0 6px 0; font-size: 17px; font-weight: 800; color: #0F172A;">Nenhuma vaquinha ativa no momento</h3>
          <p style="margin: 0; font-size: 13px; color: var(--text-caption); max-width: 420px; margin: 0 auto;">
            Quando o gestor abrir uma arrecadação para compra de bolas, coletes ou troféus, ela aparecerá aqui para você apoiar diretamente via Pix!
          </p>
        </div>
      `;
      if (headerTotalEl) headerTotalEl.textContent = "Nenhuma Ativa";
      return;
    }

    let totalGeralArrecadado = 0;
    let htmlCards = "";

    campanhas.forEach(camp => {
      const meta = parseFloat(camp.meta_valor || 0);
      const arrecadado = parseFloat(camp.total_arrecadado || 0);
      totalGeralArrecadado += arrecadado;

      const pct = meta > 0 ? Math.min(100, Math.round((arrecadado / meta) * 100)) : 0;
      const isConcluida = (camp.status === 'concluida') || (pct >= 100);

      // Apoiadores
      const apoiadores = Array.isArray(camp.contribuicoes) ? camp.contribuicoes : [];
      let apoiadoresHtml = "";

      if (apoiadores.length === 0) {
        apoiadoresHtml = `
          <div style="background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 14px; text-align: center;">
            <span style="font-size: 13px; color: #64748B; font-weight: 500;">Seja o primeiro atleta a contribuir com esta meta!</span>
          </div>
        `;
      } else {
        apoiadoresHtml = `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 13px; font-weight: 700; color: #1E293B; display: flex; align-items: center; gap: 6px;">
                <i data-feather="users" style="width: 15px; height: 15px; color: #0284C7;"></i>
                Atletas que já apoiaram (${apoiadores.length})
              </span>
              <span style="font-size: 12px; font-weight: 800; color: #059669;">
                Total: R$ ${arrecadado.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <!-- GRID ELEGANTE DE ATLETAS APOIADORES -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; max-height: 180px; overflow-y: auto; padding-right: 4px;">
              ${apoiadores.map(a => {
                const nomeDisplay = a.apelido || a.nome || "Atleta";
                const inicial = nomeDisplay.charAt(0).toUpperCase();
                const valorFormatado = parseFloat(a.valor || 0).toFixed(2).replace('.', ',');
                const temFoto = a.foto && a.foto.trim().length > 0;
                
                const avatarHtml = temFoto 
                  ? `<img src="${a.foto}" alt="${nomeDisplay}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1.5px solid #0284C7;">`
                  : `<div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #0284C7, #0369A1); color: #FFFFFF; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${inicial}</div>`;

                return `
                  <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; transition: all 0.2s ease;">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                      ${avatarHtml}
                      <span style="font-size: 12px; font-weight: 700; color: #1E293B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${nomeDisplay}">
                        ${nomeDisplay}
                      </span>
                    </div>
                    <span style="font-size: 12px; font-weight: 800; color: #059669; background: #ECFDF5; border: 1px solid #A7F3D0; padding: 2px 8px; border-radius: 12px; white-space: nowrap;">
                      +R$ ${valorFormatado}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      // Ícone por Categoria usando Feather Icons vazados
      let iconeCatFeather = "package";
      if (camp.categoria === 'Troféus / Premiações') iconeCatFeather = "award";
      else if (camp.categoria === 'Coletes / Uniformes') iconeCatFeather = "shield";
      else if (camp.categoria === 'Churrasco') iconeCatFeather = "coffee";
      else if (camp.categoria === 'Equipamentos') iconeCatFeather = "box";
      else if (camp.categoria === 'Material' || camp.categoria === 'Materiais') iconeCatFeather = "target";

      htmlCards += `
        <div class="card" style="padding: 24px; border-radius: 16px; background: #FFFFFF; border: 1px solid #E2E8F0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04); display: flex; flex-direction: column; gap: 18px;">
          
          <!-- TOPO DO CARD -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(2, 132, 199, 0.08); color: #0284C7; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(2, 132, 199, 0.15);">
                <i data-feather="${iconeCatFeather}" style="width: 22px; height: 22px;"></i>
              </div>
              <div>
                <span style="font-size: 11px; font-weight: 800; color: #0284C7; text-transform: uppercase; letter-spacing: 0.5px;">${camp.categoria || 'Material'}</span>
                <h3 style="margin: 2px 0 4px 0; font-size: 18px; font-weight: 800; color: #0F172A; font-family: 'Inter', sans-serif;">
                  ${camp.titulo}
                </h3>
                <p style="margin: 0; font-size: 13px; color: var(--text-caption); line-height: 1.4;">
                  ${camp.descricao || 'Contribuição para aquisição de novos materiais para o grupo.'}
                </p>
              </div>
            </div>

            <!-- STATUS BADGE -->
            <div>
              ${isConcluida ? `
                <span style="background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; font-size: 12px; font-weight: 800; padding: 6px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
                  <i data-feather="check-circle" style="width: 14px; height: 14px;"></i> Meta Atingida!
                </span>
              ` : `
                <span style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-size: 12px; font-weight: 800; padding: 6px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 6px;">
                  <i data-feather="activity" style="width: 14px; height: 14px;"></i> Vaquinha Ativa
                </span>
              `}
            </div>
          </div>

          <!-- BARRA DE PROGRESSO E VALORES -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <span style="font-size: 11px; color: var(--text-caption); text-transform: uppercase; font-weight: 700; display: block;">Arrecadado até agora</span>
                <strong style="font-size: 22px; font-weight: 900; color: #059669;">
                  R$ ${arrecadado.toFixed(2).replace('.', ',')}
                </strong>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 11px; color: var(--text-caption); text-transform: uppercase; font-weight: 700; display: block;">Meta do Grupo</span>
                <strong style="font-size: 16px; font-weight: 800; color: #0F172A;">
                  R$ ${meta.toFixed(2).replace('.', ',')}
                </strong>
              </div>
            </div>

            <!-- BARRA DE PORCENTAGEM -->
            <div style="width: 100%; height: 12px; background: #E2E8F0; border-radius: 10px; overflow: hidden; position: relative;">
              <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #10B981 0%, #059669 100%); border-radius: 10px; transition: width 0.5s ease;"></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: var(--text-caption);">
              <span>${pct}% concluído</span>
              <span>Faltam R$ ${Math.max(0, meta - arrecadado).toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <!-- LISTA DE APOIADORES -->
          ${apoiadoresHtml}

          <!-- BOTÃO DE CONTRIBUIÇÃO VIA PIX -->
          <div style="padding-top: 4px;">
            <button class="btn btn-md btn-accent btn-apoiar-vaquinha" data-camp-id="${camp.id}" style="width: 100%; height: 46px; font-size: 15px; font-weight: 800; background: #0284C7; border: none; border-radius: 10px; color: #FFFFFF; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);">
              <i data-feather="zap" style="width: 16px; height: 16px;"></i>
              <span>Contribuir via Pix</span>
            </button>
          </div>

        </div>
      `;
    });

    container.innerHTML = htmlCards;
    if (headerTotalEl) headerTotalEl.textContent = `R$ ${totalGeralArrecadado.toFixed(2).replace('.', ',')}`;

    if (window.feather) feather.replace();

    // Listener para abrir o modal de contribuição
    document.querySelectorAll(".btn-apoiar-vaquinha").forEach(btn => {
      btn.onclick = () => {
        const campId = btn.getAttribute("data-camp-id");
        const campObj = campanhas.find(c => String(c.id) === String(campId));
        if (campObj) {
          window.App.openModal("contribuir_vaquinha", { arrecadacao: campObj });
        }
      };
    });

  } catch (err) {
    console.error('[renderCampanhasArrecadacao]', err);
    container.innerHTML = `
      <div class="card" style="padding: 32px; text-align: center; color: var(--danger); background: #FFFFFF; border-radius: 16px;">
        Erro ao carregar campanhas de arrecadação.
      </div>
    `;
  }
}
