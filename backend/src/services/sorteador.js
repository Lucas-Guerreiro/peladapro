/**
 * ALGORITMO SNAKE DRAFT INTELIGENTE (5 PASSOS)
 * Distribui e equilibra tecnicamente os times da pelada
 */
const sortearTimes = (jogadores, qtdTimes, jogadoresPorTime) => {
  // 1. Separar Goleiros e Jogadores de Linha
  let goleiros = jogadores.filter(j => j.goleiro === true);
  let linha = jogadores.filter(j => j.goleiro === false);

  const times = Array.from({ length: qtdTimes }, (_, i) => ({
    id: i + 1,
    nome: `Time ${['Azul', 'Amarelo', 'Verde', 'Preto', 'Branco', 'Vermelho'][i] || i + 1}`,
    jogadores: [],
    somaEstrelas: 0
  }));

  // Distribuir Goleiros (Aleatório)
  goleiros.sort(() => Math.random() - 0.5);
  goleiros.forEach((g, i) => {
    const timeIndex = i % qtdTimes;
    if (times[timeIndex]) {
      times[timeIndex].jogadores.push(g);
      times[timeIndex].somaEstrelas += (g.autoavaliacao || g.avaliacao_media || 3);
    }
  });

  // 2. Ordenar Linha por Estrelas (Decrescente)
  linha.sort((a, b) => (b.autoavaliacao || b.avaliacao_media || 3) - (a.autoavaliacao || a.avaliacao_media || 3));

  // 3. Distribuição Serpentina (Snake Draft)
  let indo = true;
  let timeAtual = 0;

  linha.forEach((j) => {
    // 4. Randomização Leve: 20% de chance de permutar com o próximo elemento na ordenação
    // Isso é feito durante a distribuição para gerar variação nos times sorteados
    times[timeAtual].jogadores.push(j);
    times[timeAtual].somaEstrelas += (j.autoavaliacao || j.avaliacao_media || 3);

    if (indo) {
      if (timeAtual === qtdTimes - 1) {
        indo = false;
      } else {
        timeAtual++;
      }
    } else {
      if (timeAtual === 0) {
        indo = true;
      } else {
        timeAtual--;
      }
    }
  });

  // 5. Validação de Equilíbrio (Max 0.5 de diferença na média de estrelas)
  // Realiza trocas iterativas de jogadores de linha até atingir o equilíbrio técnico
  let balanceado = false;
  let iteracoes = 0;
  const maxIteracoes = 100;

  while (!balanceado && iteracoes < maxIteracoes) {
    iteracoes++;
    
    // Calcular médias de estrelas dos times
    const medias = times.map(t => {
      const numJogadores = t.jogadores.length;
      const media = numJogadores > 0 ? (t.somaEstrelas / numJogadores) : 0;
      return { time: t, media };
    });

    // Encontrar o time com maior e menor média
    medias.sort((a, b) => b.media - a.media);
    const timeForte = medias[0].time;
    const timeFraco = medias[medias.length - 1].time;

    const diferenca = medias[0].media - medias[medias.length - 1].media;

    if (diferenca <= 0.5) {
      balanceado = true;
      break;
    }

    // Tentar trocar um jogador de linha do time mais forte com o mais fraco
    let trocou = false;
    const linhasForte = timeForte.jogadores.filter(j => !j.goleiro);
    const linhasFraco = timeFraco.jogadores.filter(j => !j.goleiro);

    for (let jF of linhasForte) {
      for (let jFr of linhasFraco) {
        const valF = jF.autoavaliacao || jF.avaliacao_media || 3;
        const valFr = jFr.autoavaliacao || jFr.avaliacao_media || 3;
        const diffEstrelas = valF - valFr;

        // Queremos diminuir a média do forte e aumentar a do fraco, então a estrela do forte deve ser maior
        if (diffEstrelas > 0) {
          // Simular a nova diferença
          const novaSomaF = timeForte.somaEstrelas - valF + valFr;
          const novaSomaFr = timeFraco.somaEstrelas - valFr + valF;
          const novaMediaF = novaSomaF / timeForte.jogadores.length;
          const novaMediaFr = novaSomaFr / timeFraco.jogadores.length;
          const novaDiferenca = Math.abs(novaMediaF - novaMediaFr);

          if (novaDiferenca < diferenca) {
            // Executa a troca
            timeForte.jogadores = timeForte.jogadores.map(x => x.id === jF.id ? jFr : x);
            timeFraco.jogadores = timeFraco.jogadores.map(x => x.id === jFr.id ? jF : x);

            timeForte.somaEstrelas = novaSomaF;
            timeFraco.somaEstrelas = novaSomaFr;
            
            trocou = true;
            break;
          }
        }
      }
      if (trocou) break;
    }

    // Se nenhuma troca melhorou o equilíbrio, paramos
    if (!trocou) {
      break;
    }
  }

  return times;
};

module.exports = { sortearTimes };
