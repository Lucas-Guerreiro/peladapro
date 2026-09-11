# Pelada Pro — Matriz de Paridade

> Documento 07/12 · Data: 09/09/2026 · Status: para aprovação
> Objetivo: garantir que NENHUMA função do app atual fique de fora da
> reconstrução. Para cada função, registra: como o usuário acessa hoje,
> a decisão no novo sistema e o teste que comprova que funciona igual.
> Origem: doc 02 (inventário) + doc 06 (requisitos).
> Legenda de decisão: ✅ Manter · 🔧 Corrigir · 🔁 Substituir · 🗑️ Remover

---

## 1. Como usar esta matriz

1. Cada linha é uma **função do app atual**.
2. A coluna **Decisão** diz o que fazer no novo sistema.
3. A coluna **Requisito** liga ao ID do doc 06.
4. A coluna **Teste de aceite** diz como comprovar que funciona.
5. **Regra:** nenhuma linha pode ficar sem decisão e sem teste. Se faltar
   decisão, é pendência a resolver antes de considerar a paridade fechada.

---

## 2. Autenticação e Conta

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Login por e-mail/senha | ✅ Manter | AUT-001/002 | Usuário loga com e-mail e senha válidos |
| Login social (Google/Apple) | 🔧 Corrigir | AUT-003 | Logar com Google e com Apple funciona de ponta a ponta |
| Cadastro de conta | ✅ Manter | AUT-001 | Criar conta e entrar em seguida |
| Recuperar senha | ✅ Manter | AUT-004 | Receber e-mail e redefinir senha |
| Sessão persistente | 🔧 Corrigir | AUT-005 | Fechar e reabrir o app sem pedir login |
| Perfil do usuário | ✅ Manter | GRP-007 | Editar nome/foto/posição/nível |

---

## 3. Grupos e Jogadores

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Criar grupo | ✅ Manter | GRP-001 | Criar grupo com nome, escudo e regras |
| Editar grupo | ✅ Manter | GRP-001 | Alterar nome/escudo |
| Regras do grupo (configs) | ✅ Manter | GRP-013 | Editar jogadores/time, qtd times, valor convocação |
| Cadastrar jogador | ✅ Manter | GRP-004 | Adicionar jogador manualmente |
| Listar jogadores + filtros | ✅ Manter | GRP-006 | Filtrar por confirmados/devedores/goleiros |
| Perfil do jogador | ✅ Manter | GRP-007 | Ver jogos, gols, presença |
| Avaliação por estrelas | ✅ Manter | GRP-004 | Definir nível 1–5 usado no sorteio |
| Posição do jogador | ✅ Manter | GRP-004 | Definir goleiro/atacante/etc. |
| Remover jogador | ✅ Manter | GRP-008 | Remover com registro |
| Convidar jogador (código) | ✅ Manter | GRP-002 | Entrar no grupo pelo código |
| Vários grupos por usuário | ✅ Manter | GRP-003 | Participar de 2 grupos sem vazar dados |
| Papel tesoureiro separado | 🔁 Substituir | GRP-010/011 | Nomear tesoureiro; ele vê só o financeiro |
| Transferir grupo | 🔁 Substituir | GRP-012 | Transferir e o novo vira organizador |

---

## 4. Quadras / Locais

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Local/quadra por pelada | 🔧 Corrigir | QUA-001/002 | Criar pelada em quadra diferente; quadras reutilizáveis |

---

## 5. Peladas e Presença

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Criar pelada | ✅ Manter | PEL-001 | Criar com data, hora, local, valor, limite |
| Status agendada/finalizada | ✅ Manter | PEL-002 | Finalizar e ver status mudar |
| Formato do dia | ✅ Manter | PEL-003 | Escolher normal/torneio/mata-mata |
| Pelada recorrente (semanal) | 🔁 Substituir | PEL-005 | Sistema lembra de criar (não cria sozinho) |
| Convocar jogadores | ✅ Manter | PEL-006 | Enviar convocação (push) |
| Confirmar/recusar presença | ✅ Manter | PRE-001 | Jogador responde "Vou/Não Vou" |
| Lista de presença | ✅ Manter | PRE-002 | Ver confirmados/pendentes/recusados |
| Fila de espera | 🔧 Corrigir | PRE-004/005/006 | Excedente vai pra fila; promoção só com saldo |
| Confirmar todos / limpar todos | ✅ Manter | PRE-003 | Organizador confirma vários de uma vez |
| Adicionar presença manual | ✅ Manter | PRE-003 | Organizador confirma por outro |
| Copiar lista p/ WhatsApp | ✅ Manter | PRE-008 | Copiar texto da lista |
| Exportar presença em Excel | ✅ Manter | PRE-009 | Baixar .xlsx da presença |

---

## 6. Sorteio de Times (CRÍTICO)

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Sorteio automático c/ memória de duplas | ✅ Manter | SOR-001/002 | Sortear 2x e verificar: nenhuma dupla repete em 2 sorteios seguidos |
| Equilíbrio por habilidade | ✅ Manter | SOR-005 | Times com diferença de força ≤ 2★ |
| 1 goleiro por time | ✅ Manter | SOR-006 | Cada time tem exatamente 1 goleiro |
| Sorteio aleatório | ✅ Manter | SOR-007 | Sortear sem equilíbrio |
| Montagem manual (drag & drop) | ✅ Manter | SOR-008 | Arrastar jogador entre times |
| Re-sortear | ✅ Manter | SOR-009 | Gerar nova distribuição |
| Nomear times + emblema | ✅ Manter | SOR-010 | Nomear e escolher escudo |
| Confirmar times | ✅ Manter | SOR-011 | Todos os autorizados veem o mesmo resultado |
| **Limpar times** | 🔧 Corrigir | SOR-012 | Limpar, recarregar a página e os times NÃO voltam |
| Sincronização idempotente | 🔧 Corrigir | SOR-013 | Recarregar não duplica nem recria times |
| Exportar escalação p/ WhatsApp | ✅ Manter | SOR-014 | Copiar escalação em texto |

---

## 7. Partidas ao Vivo

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Placar ao vivo | ✅ Manter | PAR-001 | Iniciar e ver placar atualizar |
| Cronômetro | ✅ Manter | PAR-001 | Cronômetro roda corretamente |
| Registrar gol/assistência/cartão | ✅ Manter | PAR-002 | Registrar eventos e ver na timeline |
| Substituição | ✅ Manter | PAR-002 | Trocar jogador em campo |
| Fila de rodízio | ✅ Manter | PAR-003 | Ver próxima troca e fila |
| Finalizar partida | ✅ Manter | PAR-004 | Finalizar e gerar resumo |
| Rateio pós-jogo | ✅ Manter | PAR-005 | Rateio calculado automaticamente |
| Correção de placar | 🔧 Corrigir | PAR-006 | Corrigir com registro (não apaga) |

---

## 8. Torneios

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Fase de grupos | ✅ Manter | TOR-001 | Montar grupos e rodadas |
| Ida / ida e volta | ✅ Manter | TOR-002 | Gerar turno único e ida/volta |
| Mata-mata direto | ✅ Manter | TOR-003 | Gerar confrontos eliminatórios |
| Pontos corridos | ✅ Manter | TOR-004 | Tabela de classificação |
| Torneio livre | ✅ Manter | TOR-005 | Confrontos manuais |
| Tabela mista | ✅ Manter | TOR-006 | Tabela + mata-mata |
| Apuração do campeão | ✅ Manter | TOR-007 | Campeão apurado e ranking atualizado |

---

## 9. Financeiro

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Rateio por jogador | ✅ Manter | FIN-001/002 | Rateio calculado corretamente |
| Registrar pagamento | ✅ Manter | FIN-002 | Marcar jogador pago (credito) |
| Registrar despesa | ✅ Manter | FIN-003 | Registrar despesa (debito) |
| Injetar verba | ✅ Manter | FIN-004 | Adicionar verba ao caixa |
| Saldo do caixa | ✅ Manter | FIN-005 | Saldo atualiza em tempo real |
| Devedores | ✅ Manter | FIN-006 | Lista de quem deve |
| Cobrar devedor | ✅ Manter | FIN-007 | Enviar cobrança (push) |
| Pagamento via PIX | ✅ Manter | FIN-008 | Gerar link/QR do PIX |
| Vaquinha (campanhas) | 🔧 Corrigir | FIN-009 | Criar campanha, contribuir, consolidar em transações |
| Histórico de transações | ✅ Manter | FIN-001 | Ver todas as transações |
| Fechamento por pelada | ✅ Manter | FIN-005 | Fechar caixa da pelada |
| Exportar financeiro | 🔁 Substituir | FIN-011 | Exportar CSV **e** PDF, por pelada e período |
| Correção de lançamento | 🔧 Corrigir | FIN-010 | Corrigir por estorno com trilha |
| Jogador vê só a própria situação | ✅ Manter | FIN-012 | Jogador não vê valores de outros |

---

## 10. Ranking e Estatísticas

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Ranking calculado na hora | ✅ Manter | RAN-001 | Ranking atualiza após partida finalizada |
| Artilheiros / presença / goleiros | ✅ Manter | RAN-002 | Cada ranking mostra o correto |
| Filtro por período | ✅ Manter | RAN-003 | Filtrar mês/ano/todos |
| Estatísticas por atleta | ✅ Manter | RAN-004 | Ver gols, assistências, defesas, cartões |
| Ranking público no grupo | ✅ Manter | RAN-005 | Jogador vê ranking de outros do grupo |
| Pódio (top 3) | ✅ Manter | RAN-006 | Pódio com medalhas |

---

## 11. Card Premium e Perfil Visual

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Card Premium do atleta | 🔧 Corrigir | PREM-001/003 | Ativar, fechar app, reabrir: continua ativo (iPhone) |
| Adquirir card (modo teste) | ✅ Manter | PREM-002/006 | Ativar sem cobrança (flag teste) |
| Benefícios premium | ✅ Manter | PREM-005 | MVP/medalha/destaque/estatísticas |
| Visual do perfil (FUT) | 🔧 Corrigir | PREM-008 | Reativar o card no perfil |
| Cobrança real futura | 🔁 Substituir | PREM-007 | Arquitetura pronta p/ gateway (não implementar) |

---

## 12. Notificações

| Função atual | Decisão | Requisito | Teste de aceite |
|---|---|---|---|
| Push de convocação | ✅ Manter | NOT-001 | Jogador recebe push ao criar pelada |
| Push de sorteio | ✅ Manter | NOT-002 | Jogador recebe push do time |
| Lembrete 24h antes | ✅ Manter | NOT-003 | Recebe push 24h antes |
| Push de cobrança | ✅ Manter | NOT-004 | Devedor recebe push |
| Push de promoção da fila | ✅ Manter | NOT-005 | Fila promovida recebe push (saldo/pagamento) |
| Toggles de notificação | ✅ Manter | NOT-006 | Usuário liga/desliga cada tipo |
| WhatsApp | 🗑️ Remover | NOT-007 | Fora de escopo (canal = push) |

---

## 13. Problemas conhecidos que a paridade deve corrigir

| # | Problema do app atual | Correção no novo sistema | Teste que comprova |
|---|---|---|---|
| 1 | Times voltam após "Limpar Times" | Bloquear re-gravação automática | SOR-012 |
| 2 | Card Premium desativa no iPhone | Persistência em 3 camadas | PREM-003 |
| 3 | Scripts duplicados na SPA | Carregar config.js 1 única vez | NFR-006 (carregar sem erro) |
| 4 | Fila de espera inconsistente | Regra de promoção com saldo | PRE-005/006 |
| 5 | Visual do perfil inativo | Reativar | PREM-008 |
| 6 | Login social quebrado | Implementar corretamente | AUT-003 |
| 7 | Auth duplicada (JWT + Supabase) | Unificar estratégia | AUT-007 |

---

## 14. Pendências de paridade (a resolver na auditoria do código)

1. **Vaquinha:** detalhar telas e fluxos completos (criar campanha, meta, prazo,
   contribuir, acompanhar) — hoje só sabemos das tabelas.
2. **Tabela de vínculo jogador ↔ grupo:** confirmar nome real e colunas de papel.
3. **Fila de espera:** confirmar representação no banco (status ou campo).
4. **Quadras:** confirmar como é armazenado hoje (coluna ou tabela).
5. **Torneios:** confirmar se há tabelas próprias ou rodam no `live_state`.
6. **Tokens de push:** localizar onde ficam armazenados.

> **Regra de fechamento:** a paridade só é considerada 100% quando TODAS as
> linhas têm decisão + teste, e as 6 pendências acima forem resolvidas na
> auditoria do código-fonte (fase 1 do plano de reconstrução).

---

*Fim do documento 07 — Matriz de Paridade.*
