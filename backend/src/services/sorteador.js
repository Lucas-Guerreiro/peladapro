/**
 * ALGORITMO SNAKE DRAFT ESTOCÁSTICO (20 SIMULAÇÕES + PENALIDADE DE HISTÓRICO DE PARES)
 * Distribui e equilibra tecnicamente os times da pelada
 */
const sortearTimes = (jogadores, qtdTimes, jogadoresPorTime, historicoPares = {}) => {
  const pesoEquilibrio = 3;
  const pesoRepeticao = 1;

  // 1. Separar Goleiros e Jogadores de Linha
  const goleiros = jogadores.filter(j => j.goleiro === true);
  const linha = jogadores.filter(j => j.goleiro === false);

  const nomesPadrao = ['Azul', 'Amarelo', 'Verde', 'Preto', 'Branco', 'Vermelho', 'Laranja', 'Cinza'];

  // Função auxiliar para calcular repetições de pares entre atletas no mesmo time
  const calcularRepeticaoPares = (timesList) => {
    let score = 0;
    timesList.forEach(t => {
      const pIds = t.jogadores.map(p => String(p.id));
      for (let a = 0; a < pIds.length; a++) {
        for (let b = a + 1; b < pIds.length; b++) {
          const pairKey = pIds[a] < pIds[b] ? `${pIds[a]}_${pIds[b]}` : `${pIds[b]}_${pIds[a]}`;
          if (historicoPares[pairKey]) {
            score += historicoPares[pairKey];
          }
        }
      }
    });
    return score;
  };

  const calcularForcaTotal = (t) => {
    return t.jogadores.reduce((sum, p) => sum + (parseInt(p.autoavaliacao || p.avaliacao_media) || 3), 0);
  };

  const calcularScoreEquilibrio = (timesList) => {
    if (timesList.length <= 1) return 0;
    const forcas = timesList.map(calcularForcaTotal);
    return Math.max(...forcas) - Math.min(...forcas);
  };

  const shuffle = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Executa uma simulação candidata
  const simularCandidato = () => {
    const times = Array.from({ length: qtdTimes }, (_, i) => ({
      id: i + 1,
      nome: `Time ${nomesPadrao[i] || i + 1}`,
      jogadores: [],
      somaEstrelas: 0
    }));

    // 1. Goleiros: 1 por time aleatoriamente
    const gksShuffled = shuffle(goleiros);
    gksShuffled.forEach((g, i) => {
      const timeIndex = i % qtdTimes;
      times[timeIndex].jogadores.push(g);
      times[timeIndex].somaEstrelas += (g.autoavaliacao || g.avaliacao_media || 3);
    });

    // 2. Ordena jogadores de linha por habilidade (5★ → 1★)
    let ordenados = [...linha].sort((a, b) => {
      const notaA = parseInt(a.autoavaliacao || a.avaliacao_media) || 3;
      const notaB = parseInt(b.autoavaliacao || b.avaliacao_media) || 3;
      if (notaB === notaA) return Math.random() - 0.5;
      return notaB - notaA;
    });

    // 3. Snake Draft com Aleatoriedade Controlada (Pool de 2 a 3 de força similar)
    let serpente = true;
    let timeAtual = 0;

    while (ordenados.length > 0) {
      const poolSize = Math.min(ordenados.length, Math.max(2, Math.min(3, qtdTimes)));
      const poolIdx = Math.floor(Math.random() * poolSize);
      const escolhido = ordenados.splice(poolIdx, 1)[0];

      times[timeAtual].jogadores.push(escolhido);
      times[timeAtual].somaEstrelas += (escolhido.autoavaliacao || escolhido.avaliacao_media || 3);

      if (serpente) {
        if (timeAtual === qtdTimes - 1) {
          serpente = false;
        } else {
          timeAtual++;
        }
      } else {
        if (timeAtual === 0) {
          serpente = true;
        } else {
          timeAtual--;
        }
      }
    }

    const diffForca = calcularScoreEquilibrio(times);
    const repeticoes = calcularRepeticaoPares(times);
    const totalScore = (pesoEquilibrio * diffForca) + (pesoRepeticao * repeticoes);

    return {
      times,
      score: totalScore,
      diffForca,
      repeticoes
    };
  };

  // Gera 20 candidatos e pega o melhor
  const candidatos = [];
  for (let tentativa = 1; tentativa <= 20; tentativa++) {
    candidatos.push(simularCandidato());
  }

  candidatos.sort((a, b) => a.score - b.score);
  return candidatos[0].times;
};

module.exports = { sortearTimes };
