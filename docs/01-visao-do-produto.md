# Pelada Pro — Visão do Produto

> Documento 01/12 · Data: 06/09/2026 · Status: aprovado
> Objetivo: definir QUEM usa o sistema e QUAL problema cada módulo resolve.
> Critério de aprovação: você consegue explicar o produto em uma página.

---

## 1. Resumo em uma frase

A Pelada Pro é uma plataforma que organiza **peladas de futebol amador** de ponta a
ponta: convoca os jogadores, confirma presença, monta os times (com regra de não
repetir duplas), controla o placar, faz o rateio financeiro e mantém o ranking.

---

## 2. Para quem é o produto

| Perfil | O que faz no sistema | O que ganha |
|---|---|---|
| **Organizador (gestor)** | Cria peladas, convoca, confirma presença, sorteia times, controla placar e caixa | Deixa de usar planilhas e WhatsApp para gerenciar tudo |
| **Jogador (atleta)** | Confirma presença, vê seu time, acompanha estatísticas e paga via PIX | Saber quando joga, em qual time e quanto deve |
| **Tesoureiro (papel separado)** | Registra entradas e despesas, cobra devedores (quando delegado) | Caixa transparente e sem erro de conta |

> **Decisão do organizador:** hoje organizador e tesoureiro são a mesma pessoa, mas
> o sistema deve suportar **papéis separados** desde o início, para permitir delegar
> o financeiro a outra pessoa no futuro sem dar acesso a tudo.

---

## 3. Problemas que o produto resolve

1. **Sorteio injusto / repetido** — times montados na mão ou aleatórios repetiam as
   mesmas duplas toda rodada. A Pelada Pro sorteia com **memória de duplas**: nenhuma
   dupla cai junta em dois sorteios seguidos, com equilíbrio de nível.
2. **Confirmação de presença caótica** — ninguém sabia quem ia jogar. Agora cada
   atleta confirma no app e o gestor vê a lista em tempo real.
3. **Financeiro no escuro** — rateio, devedores e despesas eram anotados à parte.
   Agora o caixa é fechado por pelada, com saldo e cobrança.
4. **Sem histórico** — não havia registro de quem jogou, quantos gols, presença.
   Agora há ranking e estatísticas por atleta.

---

## 4. Módulos do produto (visão geral)

| Módulo | O que entrega | Prioridade |
|---|---|---|
| **Grupos e Jogadores** | Cadastro de grupo, atletas, perfil, posição, nível | P0 — essencial |
| **Peladas e Presença** | Criar rodada, convocar, confirmar/recusar, fila de espera | P0 — essencial |
| **Sorteio de Times** | Montagem automática com memória de duplas + ajuste manual | P0 — essencial |
| **Partidas ao Vivo** | Placar, cronômetro, gols, assistências, cartões | P1 — importante |
| **Torneios** | Fase de grupos, ida/volta, mata-mata, pontos corridos | P1 — importante |
| **Financeiro** | Rateio, entradas, despesas, saldo, devedores, PIX | P1 — importante |
| **Ranking e Estatísticas** | Artilheiros, presença, desempenho por atleta | P2 — desejável |
| **Card Premium** | Destaque do atleta (MVP, medalha, perfil) + cobrança futura | P1 — importante |

> P0 = sem isso o produto não funciona. P1 = é esperado. P2 = agrega valor depois.

---

## 5. Plataformas

- **Web (gestor)** — tela grande para organizar: peladas, presença, sorteio, placar,
  financeiro. É a "central de comando".
- **Mobile (jogador)** — app para confirmar presença, ver time, estatísticas e pagar.
- **Princípio:** uma única fonte de verdade no servidor (banco de dados); o
  dispositivo usa cache local apenas para velocidade, nunca como autoridade.

> **Decisão do organizador:** o mobile deve funcionar **offline** no futuro (o jogador
> confirma presença sem internet e sincroniza ao reconectar). Recomenda-se começar
> online e adicionar offline como melhoria priorizada (P1).

---

## 6. Regras de negócio críticas (não negociáveis)

1. **Memória de duplas no sorteio:** nenhuma dupla de jogadores deve cair junta em
   dois sorteios seguidos. (Limite matemático: com 4 times de 6, o piso é 8 duplas
   repetidas por janela — o algoritmo busca exatamente esse mínimo.)
2. **Equilíbrio de nível:** times com diferença de força ≤ 2 estrelas (tolerância 3).
3. **1 goleiro por time.**
4. **Financeiro auditável:** nenhum lançamento é apagado silenciosamente; correções
   são feitas por estorno/ajuste registrado.

---

## 7. O que NÃO é o produto (fora de escopo agora)

- Não é um app de apostas ou de gestão de ligas profissionais.
- O **Card Premium** hoje é **modo teste** (sem cobrança real); o PIX é um link/QR,
  não um gateway processando cartão.
- Não tem IA dentro do produto (a IA é usada para DESENVOLVER, não roda no app).

---

## 8. Sucesso do produto (como saber que funciona)

- O organizador sorteia os times em menos de 1 minuto, sem duplas repetidas.
- Os jogadores confirmam presença pelo celular sem depender do gestor.
- O caixa fecha por pelada sem divergência.
- O histórico de jogos e ranking está sempre disponível.

---

## 9. Decisões do organizador (respondidas)

| # | Decisão | Resposta | Impacto |
|---|---|---|---|
| 1 | Organizador e tesoureiro | Mesma pessoa hoje, mas podem ser diferentes | Papéis separados no sistema (permissões próprias) |
| 2 | App mobile offline | Seria interessante funcionar offline | Sincronização offline como P1 (depois do online) |
| 3 | Peladas em locais variados | Podem variar | Cadastro de quadras/locais por pelada |
| 4 | Card Premium com cobrança | Sim, terá cobrança real no futuro | Gateway de pagamento planejado; perfil visual a reativar |

---

*Fim do documento 01 — Visão do Produto (atualizado).*
