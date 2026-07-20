// ==========================================================================
// MODAL: CONFIGURACOES DA PARTIDA (partida_config.js)
// ==========================================================================

window.App.initModalPartida_config = function(data) {
  if (!data || !data.id) {
    window.App.showToast("Dados da partida inválidos.", "error");
    window.App.closeModal();
    return;
  }

  // Preencher os dados no modal
  document.getElementById("partida-config-id").value = data.id;
  document.getElementById("partida-config-tie").value = data.criterio_empate || "ambos_permanecem";
  document.getElementById("partida-config-wins").value = data.vitorias_para_sair || 2;
  document.getElementById("partida-config-exit-rule").value = data.regra_saida || "final_fila";
  document.getElementById("partida-config-players").value = data.jogadores_por_time || 7;
  document.getElementById("partida-config-teams").value = data.quantidade_times || 2;
  document.getElementById("partida-config-value").value = data.valor_convocacao ? parseFloat(data.valor_convocacao).toFixed(2) : "20.00";

  // Ligar eventos de fechamento
  document.getElementById("btn-close-partida-config").onclick = () => window.App.closeModal();
  document.getElementById("btn-cancel-partida-config").onclick = () => window.App.closeModal();

  // Ligar evento de salvamento
  document.getElementById("btn-save-partida-config").onclick = async function() {
    const id = document.getElementById("partida-config-id").value;
    const tie = document.getElementById("partida-config-tie").value;
    const wins = parseInt(document.getElementById("partida-config-wins").value);
    const exitRule = document.getElementById("partida-config-exit-rule").value;
    const players = parseInt(document.getElementById("partida-config-players").value);
    const teams = parseInt(document.getElementById("partida-config-teams").value);
    const value = parseFloat(document.getElementById("partida-config-value").value) || 20.00;

    // Validações
    if (wins < 2 || wins > 5) {
      window.App.showToast("O limite de vitórias deve ser entre 2 e 5.", "warning");
      return;
    }
    if (players < 4 || players > 11) {
      window.App.showToast("Os jogadores por time devem ser entre 4 e 11.", "warning");
      return;
    }
    if (teams < 2 || teams > 10) {
      window.App.showToast("A quantidade de times deve ser entre 2 e 10.", "warning");
      return;
    }

    try {
      window.App.showToast("Salvando regras específicas da partida...", "info");
      const res = await Api.atualizarConfigPartida(id, {
        criterio_empate: tie,
        vitorias_para_sair: wins,
        regra_saida: exitRule,
        jogadores_por_time: players,
        quantidade_times: teams,
        valor_convocacao: value
      });

      if (res.error) {
        window.App.showToast(res.error, "error");
        return;
      }

      window.App.showToast("Regras específicas da partida salvas!", "success");
      window.App.closeModal();

      // Recarrega a listagem de datas se a página atual possuir a função exposta
      if (window.App.syncDrawnDates) {
        await window.App.syncDrawnDates();
      }
    } catch (err) {
      console.error(err);
      window.App.showToast("Erro ao se conectar ao servidor.", "error");
    }
  };

  // Inicializar Feather Icons
  if (window.feather) {
    feather.replace();
  }
};
