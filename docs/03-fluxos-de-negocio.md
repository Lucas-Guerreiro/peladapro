# Pelada Pro — Fluxos de Negócio

> Documento 03/12 · Data: 06/09/2026 · Status: aprovado
> Objetivo: descrever o passo a passo de cada fluxo, com começo, decisões,
> erros e resultado esperado. Cada fluxo vira caso de teste no novo sistema.
> Legenda: [DECISÃO] = ponto que precisa da sua confirmação.

---

## 1. Fluxo: Criação de Conta e Login

**Objetivo:** o usuário cria uma conta e acessa o sistema.

### 1.1 Cadastro (e-mail/senha)
1. Usuário informa nome, e-mail, telefone e senha.
2. Sistema valida: e-mail único, senha ≥ 8 caracteres.
3. Sistema cria a conta e o perfil do usuário.
4. Usuário é levado ao onboarding (criar grupo).

### 1.2 Login social (Google/Apple)
1. Usuário clica em "Continuar com Google/Apple".
2. Sistema autentica via provedor e cria/vincula a conta.
3. **Requisito obrigatório (P0):** deve funcionar no novo sistema
   (hoje está quebrado no app atual).
4. **Decisão:** o login social **não precisa funcionar offline**
   (login exige conexão, como confirmado).

### 1.3 Recuperação de senha
1. Usuário informa o e-mail.
2. Sistema envia link de redefinição.
3. Usuário define nova senha e volta ao login.

### 1.4 Sessão
- A sessão deve persistir entre aberturas do app.
- A sessão exige conexão (não há login offline).

---

## 2. Fluxo: Criação de Grupo

**Objetivo:** o organizador cria o grupo da pelada com suas regras.

1. Usuário informa nome do grupo, foto, jogadores por time, modalidade
   (society/campo) e regras.
2. Sistema cria o grupo e define o criador como **organizador**.
3. Sistema disponibiliza link/código de convite para jogadores.
4. Jogadores entram no grupo pelo link/código.

**Decisões (confirmadas):**
- ✅ **Um usuário pode ser organizador de vários grupos:** SIM.
- ✅ **Um jogador pode participar de vários grupos:** SIM.

---

## 3. Fluxo: Cadastro e Gestão de Jogadores

**Objetivo:** manter a lista de atletas do grupo.

1. Organizador cadastra jogador manualmente OU jogador entra por convite.
2. Sistema registra: nome, apelido, posição, nível (estrelas), goleiro (sim/não).
3. Organizador pode editar, remover ou convidar jogadores.
4. Filtros disponíveis: todos, confirmados, pendentes, devedores, goleiros.

**Regra:** um jogador não deve virar duplicado por e-mail ou telefone
(sistema deve detectar e avisar).

---

## 4. Fluxo: Criação de Pelada

**Objetivo:** criar uma rodada (data, local, valor, limites).

1. Organizador informa: data, hora, **local/quadra**, valor por jogador,
   jogadores por time, duração.
2. **Decisão (confirmada):** recorrência semanal = **SOMENTE LEMBRAR**.
   O sistema **não cria** peladas automaticamente; ele apenas **lembra/avisa**
   o organizador de que é hora de criar a próxima rodada.
3. Sistema cria a pelada com status **agendada**.
4. Sistema convoca os jogadores do grupo (ou eles são convidados).

**Regra importante:** o **local/quadra** é um dado por pelada (pode variar).
Precisa de cadastro de quadras reutilizável.

---

## 5. Fluxo: Confirmação de Presença

**Objetivo:** saber quem vai jogar.

1. Jogador recebe convocação (push notification no celular).
2. Jogador responde "Vou Jogar" ou "Não Vou".
3. Sistema atualiza a lista de presença em tempo real.
4. Organizador vê: confirmados, pendentes, recusados.
5. Se confirmados excedem o limite → os excedentes vão para a **fila de espera**.

**Regras:**
- Canal oficial de comunicação: **push notification** (WhatsApp está fora de escopo).
- **Decisão (confirmada) — Fila de espera:**
  - Quando um confirmado desiste, o primeiro da fila de espera **é promovido
    automaticamente**, MAS **apenas se o atleta tiver saldo na conta** com o valor
    da pelada.
  - Se o atleta **não tiver saldo**, ele **recebe uma notificação para fazer o
    pagamento** antes de entrar na lista dos convocados.
  - Ou seja: a promoção para convocado **depende do pagamento/saldo**.

---

## 6. Fluxo: Sorteio de Times (CRÍTICO)

**Objetivo:** montar times equilibrados sem repetir duplas.

### 6.1 Sorteio automático (com memória de duplas)
1. Sistema reúne os jogadores confirmados.
2. Aplica a **memória de duplas**: nenhuma dupla cai junta em dois sorteios seguidos.
3. Equilibra por habilidade: diferença de força ≤ 2 estrelas (tolerância 3).
4. Garante 1 goleiro por time.
5. Gera os times e mostra o resultado.

**Limite matemático:** com 4 times de 6 (24 atletas), o piso é de 8 duplas
repetidas por janela — o algoritmo busca exatamente esse mínimo.

### 6.2 Sorteio aleatório
- Sem equilíbrio por habilidade, apenas distribuição aleatória.

### 6.3 Montagem manual
- Organizador arrasta jogadores para os times (drag & drop).

### 6.4 Ajustes e confirmação
1. Organizador pode trocar jogadores manualmente.
2. Pode re-sortear.
3. Pode nomear os times e escolher emblemas.
4. Confirma os times → sistema salva na nuvem.

### 6.5 Limpar times
1. Organizador clica "Limpar Times".
2. Sistema apaga os times **localmente e na nuvem**.
3. **Regra crítica:** após limpar, NADA pode re-gravar times automaticamente
   até o organizador sortear de novo manualmente. (Bug antigo: times voltavam
   após recarregar — deve ser corrigido de vez no novo sistema.)

---

## 7. Fluxo: Partida ao Vivo

**Objetivo:** registrar o jogo em tempo real.

1. Organizador inicia a partida.
2. Sistema mostra placar, cronômetro e fila de rodízio.
3. Organizador registra: gol, assistência, cartão, substituição.
4. Sistema atualiza placar e estatísticas em tempo real.
5. Organizador finaliza a partida.

### 7.1 Pós-jogo
1. Sistema mostra o resumo: resultado, gols, MVP, estatísticas.
2. Sistema calcula o **rateio** por jogador.
3. Organizador marca quem pagou.
4. Sistema atualiza o caixa e o ranking.

---

## 8. Fluxo: Financeiro

**Objetivo:** controlar entradas, despesas e saldo.

### 8.1 Rateio
1. Sistema calcula o valor por jogador (total de despesas ÷ confirmados).
2. Cada jogador tem um saldo (pago/pendente).

### 8.2 Registro de pagamento (entrada)
1. Organizador marca o jogador como pago (ou jogador paga via PIX).
2. Sistema registra a entrada e atualiza o saldo.

### 8.3 Registro de despesa
1. Organizador registra despesa (ex: aluguel da quadra).
2. Sistema desconta do caixa.

### 8.4 Injetar verba
1. Organizador adiciona verba extra ao caixa (ex: sobra de outra pelada).

### 8.5 Correção de lançamento
1. **Regra auditável:** nenhum lançamento é apagado silenciosamente.
2. Correções são feitas por **estorno/ajuste registrado** (com trilha).

### 8.6 Exportação
1. Sistema exporta o financeiro em **CSV e PDF** (ambos).
2. **Decisão (confirmada):** exportação **por pelada E por período** (ambos
   disponíveis).

---

## 9. Fluxo: Torneios

**Objetivo:** formatos de competição.

1. Organizador escolhe o formato do dia: normal, torneio, pontos corridos,
   mata-mata direto, torneio livre, tabela mista.
2. Sistema monta a tabela/confrontos conforme o formato.
3. Partidas são registradas e a tabela é atualizada.
4. Sistema apura o campeão e atualiza o ranking.

---

## 10. Fluxo: Card Premium (monetização futura)

**Objetivo:** destaque do atleta + cobrança futura.

1. Jogador acessa a tela do Card Premium.
2. Sistema mostra o card (estilo FUT) e os benefícios.
3. Jogador adquire o card (hoje: modo teste, sem cobrança).
4. **Futuro:** integração com gateway de pagamento real.
5. Sistema marca o jogador como premium e mostra o destaque.

**Regra de persistência (aprendida no bug do iPhone):**
- Memória → cache local (AsyncStorage) → Supabase (fonte da verdade).
- O status premium deve sobreviver a reinstalação/limpeza de cache.

---

## 11. Fluxo: Notificações

**Objetivo:** avisar os jogadores.

| Evento | Canal | Quando |
|---|---|---|
| Convocação | Push | Ao criar a pelada |
| Sorteio | Push | Ao sortear times |
| Lembrete | Push | 24h antes da pelada |
| Cobrança | Push | Ao registrar pendência |
| Promoção da fila | Push | Ao promover atleta (se precisar pagar) |

**Regra:** o canal oficial é **push notification no celular**. WhatsApp está
fora de escopo (não é prioridade).

---

## 12. Resumo das decisões do organizador (confirmadas)

| # | Ponto | Decisão |
|---|---|---|
| 1 | Recorrência semanal | **Somente lembrar** (não criar automático) |
| 2 | Fila de espera | Promover automaticamente **se tiver saldo**; senão, notificar para pagar antes de entrar |
| 3 | Vários grupos | **Sim** (usuário pode ter vários grupos) |
| 4 | Exportação financeiro | **Ambos** (por pelada e por período) |
| 5 | Login social offline | **Não** precisa funcionar offline |

---

*Fim do documento 03 — Fluxos de Negócio (atualizado).*
