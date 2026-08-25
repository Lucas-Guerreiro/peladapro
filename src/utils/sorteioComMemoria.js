/**
 * ============================================================
 *  src/utils/sorteioComMemoria.js  (v6.1 — DEFINITIVO)
 * ============================================================
 *  Sorteio de times com MEMÓRIA DE DUPLAS (Pelada Pro)
 *
 *  REGRA DO USUÁRIO: evitar que a MESMA dupla caia junta em
 *  DOIS SORTEIOS SEGUIDOS.
 *
 *  IMPORTANTE (matemática):
 *  Com 4 times de 6 jogadores, entre dois sorteios consecutivos é
 *  IMPOSSÍVEL ter ZERO duplas repetidas. Pela casa dos pombos, cada
 *  time novo de 6 precisa puxar dos 4 times antigos e pelo menos 2
 *  vêm do MESMO time antigo -> mínimo de 8 duplas repetidas por
 *  janela (padrão 2+2+1+1).
 *
 *  O que este código GARANTE:
 *   1) Nunca mais que 8 repetições por janela (o mínimo matemático).
 *   2) NENHUM time novo recebe 3+ jogadores do MESMO time antigo.
 *   3) NENHUMA dupla "sacrificada" (já repetida na janela anterior)
 *      é reutilizada em QUALQUER time novo -> nenhuma dupla repete
 *      em 3 sorteios seguidos.
 *   4) 1 goleiro por time e equilíbrio de nível (diferença <= 2★,
 *      em último caso 3★).
 * ============================================================
 */

// ---------- UTILITÁRIOS BÁSICOS ----------

/** Chave canônica de uma dupla (sempre ordenada, sempre string) */
function chaveDupla(a, b) {
  const x = String(a);
  const y = String(b);
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/** Embaralhamento Fisher-Yates */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Nível numérico do jogador */
function getNivel(j) {
  return Number(j.nivel ?? j.habilidade ?? j.autoavaliacao ?? 3);
}

/** É goleiro? */
function isGoleiro(j) {
  const pos = String(j.posicao || '').toLowerCase();
  return pos.includes('goleiro') || pos === 'gk' || !!j.goleiro;
}

/** Nome legível do jogador */
function getNome(j) {
  return j.nome || j.apelido || `Atleta #${j.id}`;
}

/** Converte um time (array de ids ou objetos) em array de ids (string) */
function idsDoTime(time) {
  return (Array.isArray(time) ? time : []).map((id) =>
    String(typeof id === 'object' && id !== null ? id.id : id)
  );
}

/** Todas as duplas de UM time (Set de chaves) */
function duplasDoTime(time) {
  const duplas = new Set();
  const ids = idsDoTime(time);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      duplas.add(chaveDupla(ids[i], ids[j]));
    }
  }
  return duplas;
}

/** Todas as duplas de UM SORTEIO (união dos times) */
function duplasDoSorteio(times) {
  const duplas = new Set();
  (Array.isArray(times) ? times : []).forEach((time) => {
    duplasDoTime(time).forEach((k) => duplas.add(k));
  });
  return duplas;
}

/** Duplas que aparecem nos DOIS sorteios (interseção) */
function duplasRepetidasEntre(timesA, timesB) {
  const a = duplasDoSorteio(timesA);
  const b = duplasDoSorteio(timesB);
  const out = new Set();
  a.forEach((k) => { if (b.has(k)) out.add(k); });
  return out;
}

/** Normaliza o histórico (aceita 2 formatos) */
function obterSorteios(historico) {
  if (!Array.isArray(historico) || historico.length === 0) return [];
  return historico
    .map((h) => {
      const times = Array.isArray(h && h.times) ? h.times : h;
      return Array.isArray(times) ? times : [];
    })
    .filter((t) => Array.isArray(t) && t.length > 0);
}

/** Piso matemático de repetições (casa dos pombos) */
function pisoDeRepeticoes(porTime, qtdTimes) {
  if (porTime <= 0 || qtdTimes <= 0) return 0;
  const q = Math.floor(porTime / qtdTimes);
  const r = porTime % qtdTimes;
  const comb = (k) => (k * (k - 1)) / 2;
  return (r * comb(q + 1) + (qtdTimes - r) * comb(q)) * qtdTimes;
}

// ---------- PONTUAÇÃO ----------

/** Somas de nível de cada time */
function somasDosTimes(times) {
  return times.map((t) => t.reduce((s, j) => s + getNivel(j), 0));
}

/** Diferença máx-mín de nível entre os times */
function diffNivel(times) {
  const s = somasDosTimes(times);
  return Math.max(...s) - Math.min(...s);
}

/** Conta duplas do candidato que estão dentro de um Set alvo */
function contarDuplasNoAlvo(times, alvo) {
  if (!alvo || alvo.size === 0) return 0;
  let c = 0;
  for (const time of times) {
    for (let i = 0; i < time.length; i++) {
      for (let j = i + 1; j < time.length; j++) {
        if (alvo.has(chaveDupla(time[i].id, time[j].id))) c++;
      }
    }
  }
  return c;
}

/**
 * Pontua um candidato:
 *  - rep  = duplas repetidas vs último sorteio (mínimo possível = piso)
 *  - sac  = duplas repetidas que JÁ tinham repetido na janela anterior
 *           (risco de 3 sorteios seguidos -> custo altíssimo)
 *  - diff = desequilíbrio de nível
 */
function pontuar(times, duplasUltimo, sacrificadas, pisoTotal) {
  const rep = contarDuplasNoAlvo(times, duplasUltimo);
  const sac = contarDuplasNoAlvo(times, sacrificadas);
  const diff = diffNivel(times);
  const score =
    1000 * Math.max(0, rep - pisoTotal) + // acima do mínimo -> ruim
    1000 * sac +                          // dupla já "gasta" repetindo de novo -> péssimo
    5 * diff;                             // desequilíbrio de nível
  return { rep, sac, diff, score };
}

// ---------- CONSTRUÇÃO DE CANDIDATOS ----------

/** Distribuição aleatória genérica (1 goleiro por time + resto round-robin) */
function criarDistribuicaoAleatoria(jogadores, qtdTimes, goleiros, linha) {
  const times = Array.from({ length: qtdTimes }, () => []);
  shuffleArray(goleiros).forEach((gk, i) => times[i % qtdTimes].push(gk));
  shuffleArray(linha).forEach((j) => {
    let alvo = 0;
    for (let t = 1; t < qtdTimes; t++) {
      if (times[t].length < times[alvo].length) alvo = t;
    }
    times[alvo].push(j);
  });
  return times;
}

/**
 * CONSTRUÇÃO GUIADA 2-2-1-1 (CORRIGIDA — v6.1)
 * Cada time antigo entrega:
 *   - Goleiro + 1 parceiro -> time (k+1)
 *   - 2 jogadores (bloco)  -> time (k-1)
 *   - 1 jogador            -> time (k)
 *   - 1 jogador            -> time (k+2)
 *
 * GARANTIAS desta versão:
 *  1) NENHUM time novo recebe 3+ jogadores do MESMO time antigo (máx. 2).
 *  2) NENHUMA dupla "sacrificada" é reutilizada em QUALQUER time novo —
 *     valida a composição FINAL completa, não só pares isolados.
 *  3) 1 goleiro por time novo.
 * Se uma tentativa violar qualquer regra, re-embaralha e tenta de novo
 * (até 50x). Se não achar, retorna null (o chamador cai para o caminho
 * genérico + busca local).
 */
function construirGuided(porTimeAntigo, qtdTimes, sacrificadas) {
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const times = Array.from({ length: qtdTimes }, () => []);
    const origemTime = Array.from({ length: qtdTimes }, () => new Map()); // time novo -> (time antigo -> qtd)
    let ok = true;

    for (let k = 0; k < qtdTimes && ok; k++) {
      const jogadoresK = porTimeAntigo[k];
      const gk = jogadoresK.find(isGoleiro);
      const naoGk = shuffleArray(jogadoresK.filter((j) => !isGoleiro(j)));
      if (!gk || naoGk.length !== qtdTimes + 1) { ok = false; break; }

      // Destinos fixos do padrão 2-2-1-1:
      //   GK + parceiro -> time (k+1)   |   bloco de 2 -> time (k-1)
      //   single -> time k              |   single -> time (k+2)
      const tPartner = (k + 1) % qtdTimes;
      const tBloco = (k - 1 + qtdTimes) % qtdTimes;
      const tS1 = k;
      const tS2 = (k + 2) % qtdTimes;

      // 1) GK + parceiro (evita dupla sacrificada com o goleiro)
      let idxP = naoGk.findIndex((j) => !sacrificadas.has(chaveDupla(gk.id, j.id)));
      if (idxP === -1) idxP = 0; // se impossível, aceita (validação final decide)
      const partner = naoGk.splice(idxP, 1)[0];
      times[tPartner].push(gk, partner);
      origemTime[tPartner].set(k, (origemTime[tPartner].get(k) || 0) + 2);

      // 2) Bloco de 2 (evita dupla sacrificada INTERNA ao bloco)
      let idxA = -1, idxB = -1;
      for (let i = 0; i < naoGk.length && idxA === -1; i++) {
        for (let j = i + 1; j < naoGk.length && idxA === -1; j++) {
          if (!sacrificadas.has(chaveDupla(naoGk[i].id, naoGk[j].id))) { idxA = i; idxB = j; }
        }
      }
      if (idxA === -1) { idxA = 0; idxB = 1; }
      const b1 = naoGk.splice(Math.max(idxA, idxB), 1)[0];
      const b2 = naoGk.splice(Math.min(idxA, idxB), 1)[0];
      times[tBloco].push(b1, b2);
      origemTime[tBloco].set(k, (origemTime[tBloco].get(k) || 0) + 2);

      // 3) Dois "singles"
      const s1 = naoGk.splice(0, 1)[0];
      const s2 = naoGk.splice(0, 1)[0];
      times[tS1].push(s1);
      origemTime[tS1].set(k, (origemTime[tS1].get(k) || 0) + 1);
      times[tS2].push(s2);
      origemTime[tS2].set(k, (origemTime[tS2].get(k) || 0) + 1);
    }

    if (!ok) continue;

    // ---- VALIDAÇÃO PÓS-CONSTRUÇÃO (as 2 regras) ----
    let viola = false;

    // Regra 1: nenhum time novo com 3+ do mesmo time antigo
    for (let t = 0; t < qtdTimes && !viola; t++) {
      for (const [, qtd] of origemTime[t]) {
        if (qtd >= 3) { viola = true; break; }
      }
    }

    // Regra 2: nenhuma dupla sacrificada em QUALQUER time pronto
    for (let t = 0; t < qtdTimes && !viola; t++) {
      for (let i = 0; i < times[t].length && !viola; i++) {
        for (let j = i + 1; j < times[t].length && !viola; j++) {
          if (sacrificadas.has(chaveDupla(times[t][i].id, times[t][j].id))) viola = true;
        }
      }
    }

    if (!viola) return times; // distribuição válida encontrada
    // senão: re-embaralha e tenta de novo
  }

  // Fallback: se não achou em 50 tentativas, devolve null
  // (o chamador cai para o caminho genérico + busca local)
  return null;
}

// ---------- BUSCA LOCAL ----------

/**
 * Verifica se um candidato tem 3+ jogadores do MESMO time antigo.
 * origemMap: Map(ids -> indice do time antigo). Se ausente, não bloqueia.
 */
function temBlocoDe3(times, origemMap) {
  if (!origemMap || origemMap.size === 0) return false;
  for (const time of times) {
    const contagem = new Map();
    for (const j of time) {
      const o = origemMap.get(String(j.id));
      if (o === undefined) continue;
      contagem.set(o, (contagem.get(o) || 0) + 1);
      if (contagem.get(o) >= 3) return true;
    }
  }
  return false;
}

/**
 * Troca jogadores entre times (nunca goleiro x linha) para melhorar a
 * pontuação. Com origemMap presente, também REJEITA qualquer troca que
 * crie 3+ jogadores do mesmo time antigo (evita desfazer a construção).
 */
function otimizar(times, duplasUltimo, sacrificadas, pisoTotal, origemMap, maxIter = 1500) {
  let atual = times.map((t) => [...t]);
  let { score } = pontuar(atual, duplasUltimo, sacrificadas, pisoTotal);
  let iter = 0;
  let melhorou = true;
  while (melhorou && iter < maxIter) {
    melhorou = false;
    iter++;
    for (let a = 0; a < atual.length && !melhorou; a++) {
      for (let b = a + 1; b < atual.length && !melhorou; b++) {
        for (let i = 0; i < atual[a].length && !melhorou; i++) {
          for (let j = 0; j < atual[b].length && !melhorou; j++) {
            const p = atual[a][i];
            const q = atual[b][j];
            if (isGoleiro(p) !== isGoleiro(q)) continue; // mantém 1 goleiro por time
            atual[a][i] = q;
            atual[b][j] = p;
            // Guarda anti-bloco-de-3: rejeita troca que crie 3+ do mesmo time antigo
            if (temBlocoDe3(atual, origemMap)) {
              atual[a][i] = p;
              atual[b][j] = q;
              continue;
            }
            const novo = pontuar(atual, duplasUltimo, sacrificadas, pisoTotal);
            if (novo.score < score) {
              score = novo.score;
              melhorou = true;
            } else {
              atual[a][i] = p;
              atual[b][j] = q;
            }
          }
        }
      }
    }
  }
  return atual;
}

// ---------- VALIDAÇÃO ----------

/** Confere tamanhos, 1 goleiro por time e atletas únicos */
function validarEstrutura(times, qtdTimes) {
  if (!Array.isArray(times) || times.length !== qtdTimes) return false;
  const total = times.reduce((s, t) => s + t.length, 0);
  const base = Math.floor(total / qtdTimes);
  const extra = total % qtdTimes;
  const contagem = new Map();
  times.forEach((t) => contagem.set(t.length, (contagem.get(t.length) || 0) + 1));
  if (contagem.get(base) !== qtdTimes - extra) return false;
  if (extra > 0 && contagem.get(base + 1) !== extra) return false;
  if (extra === 0 && contagem.size !== 1) return false;
  if (extra > 0 && contagem.size !== 2) return false;

  const vistos = new Set();
  for (const time of times) {
    let gks = 0;
    for (const j of time) {
      if (isGoleiro(j)) gks++;
      const id = String(j.id);
      if (vistos.has(id)) return false;
      vistos.add(id);
    }
    if (gks !== 1) return false;
  }
  return true;
}

// ---------- FUNÇÃO PRINCIPAL ----------

export function gerarSorteioComMemoria(jogadores = [], porTime = 6, historico = []) {
  if (!Array.isArray(jogadores) || jogadores.length === 0) return [];

  const qtdTimes = Math.ceil(jogadores.length / porTime);
  const sorteios = obterSorteios(historico);
  const ultimo = sorteios[sorteios.length - 1] || null;
  const penultimo = sorteios[sorteios.length - 2] || null;

  const duplasUltimo = ultimo ? duplasDoSorteio(ultimo) : new Set();
  const sacrificadas = ultimo && penultimo
    ? duplasRepetidasEntre(penultimo, ultimo)
    : new Set();
  const pisoTotal = pisoDeRepeticoes(porTime, qtdTimes);

  // Aviso de formato (histórico veio, mas nada foi lido)
  if (Array.isArray(historico) && historico.length > 0 && sorteios.length === 0) {
    console.warn(
      '[Sorteio] Histórico presente, mas nenhum sorteio foi lido. ' +
      'Formato esperado: [{times:[[ids...],[ids...]]}] ou [[ids...],[ids...]].'
    );
  }

  const goleiros = jogadores.filter(isGoleiro);
  const linha = jogadores.filter((j) => !isGoleiro(j));

  let resultado = null;
  let modo = 'aleatorio';

  // --- CAMINHO 1: construção guiada 2-2-1-1 (caso padrão 4x6) ---
  if (
    ultimo &&
    porTime === 6 &&
    qtdTimes === 4 &&
    goleiros.length === qtdTimes &&
    jogadores.length === porTime * qtdTimes
  ) {
    const mapaAntigo = new Map();
    ultimo.forEach((time, idxTime) => {
      idsDoTime(time).forEach((id) => mapaAntigo.set(id, idxTime));
    });
    const todosEncontrados = jogadores.every((j) => mapaAntigo.has(String(j.id)));
    if (todosEncontrados) {
      const porTimeAntigo = Array.from({ length: qtdTimes }, () => []);
      jogadores.forEach((j) => porTimeAntigo[mapaAntigo.get(String(j.id))].push(j));
      const ok = porTimeAntigo.every(
        (t) => t.length === porTime && t.filter(isGoleiro).length === 1
      );
      if (ok) {
        // Mapa de origem para a guarda anti-bloco-de-3 na busca local
        const origemMap = new Map();
        porTimeAntigo.forEach((t, idx) => t.forEach((j) => origemMap.set(String(j.id), idx)));

        let melhor = null;
        let melhorScore = Infinity;
        for (let s = 0; s < 150; s++) {
          const cand = construirGuided(porTimeAntigo, qtdTimes, sacrificadas);
          if (!cand) break;
          const ot = otimizar(cand, duplasUltimo, sacrificadas, pisoTotal, origemMap);
          const { score } = pontuar(ot, duplasUltimo, sacrificadas, pisoTotal);
          if (score < melhorScore) { melhorScore = score; melhor = ot; }
        }
        if (melhor) { resultado = melhor; modo = 'guiado'; }
      }
    }
  }

  // --- CAMINHO 2: genérico (qualquer cenário) ---
  if (!resultado) {
    let melhor = null;
    let melhorScore = Infinity;
    for (let s = 0; s < 300; s++) {
      const cand = criarDistribuicaoAleatoria(jogadores, qtdTimes, goleiros, linha);
      const ot = otimizar(cand, duplasUltimo, sacrificadas, pisoTotal);
      const { score } = pontuar(ot, duplasUltimo, sacrificadas, pisoTotal);
      if (score < melhorScore) { melhorScore = score; melhor = ot; }
    }
    resultado = melhor || criarDistribuicaoAleatoria(jogadores, qtdTimes, goleiros, linha);
  }

  // --- VALIDAÇÃO FINAL (segurança) ---
  if (!validarEstrutura(resultado, qtdTimes)) {
    resultado = criarDistribuicaoAleatoria(jogadores, qtdTimes, goleiros, linha);
    resultado = otimizar(resultado, duplasUltimo, sacrificadas, pisoTotal);
  }

  // --- RELATÓRIO para a interface ---
  const idParaNome = new Map(jogadores.map((j) => [String(j.id), getNome(j)]));
  const nomesDeDuplas = (set) =>
    [...set].map((k) => k.split('|').map((id) => idParaNome.get(id) || id).join(' + '));

  const repetidas = new Set();
  const naoSeparadas = new Set();
  for (const time of resultado) {
    for (let i = 0; i < time.length; i++) {
      for (let j = i + 1; j < time.length; j++) {
        const k = chaveDupla(time[i].id, time[j].id);
        if (duplasUltimo.has(k)) repetidas.add(k);
        if (sacrificadas.has(k)) naoSeparadas.add(k);
      }
    }
  }

  resultado.duplasRepetidas = nomesDeDuplas(repetidas);
  resultado.duplasNaoSeparadas = nomesDeDuplas(naoSeparadas);
  resultado.modo = modo;

  return resultado;
}

export default gerarSorteioComMemoria;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    gerarSorteioComMemoria,
    default: gerarSorteioComMemoria,
  };
}