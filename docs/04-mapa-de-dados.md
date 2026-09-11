# Pelada Pro — Mapa de Dados

> Documento 04/12 · Data: 06/09/2026 · Status: aprovado
> Objetivo: descrever as tabelas, colunas, chaves, relações, enums e regras
> de dados. Base para criar o schema novo e o plano de migração.
> Fonte: análise do código-fonte real (arquitetura confirmada no Antigravity).

---

## 1. Visão geral do modelo

O banco gira em torno de **3 entidades centrais**:
- **Grupo** — a "comunidade" da pelada (jogadores + regras).
- **Pelada** — cada rodada/evento (data, local, valor, times, placar).
- **Jogador (usuário)** — o atleta, que participa de grupos e peladas.

**Confirmação importante (do código real):**
- O **financeiro** usa uma **tabela unificada `transacoes`** (créditos e débitos
  juntos), com tabelas auxiliares de vaquinha.
- O **ranking NÃO tem tabela própria** — é **calculado na hora** a partir do
  histórico de partidas finalizadas.
- **Fotos/arquivos NÃO estão em Storage** em produção — são URLs externas ou
  base64 em colunas das tabelas.
- A **autenticação** é via JWT + bcrypt na própria tabela `usuarios` (não é
  Supabase Auth em produção).
- As **regras do grupo** ficam em uma **tabela separada `configs`**.

---

## 2. Tabelas principais

### 2.1 `usuarios` — Atletas/contas

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | (PK) | Identificador único |
| `email` | text (unique) | Login |
| `senha` | text (hash bcrypt) | Senha criptografada |
| `nome` | text | Nome completo |
| `apelido` | text | Apelido |
| `posicao` | text | Posição (goleiro, atacante...) |
| `autoavaliacao` | int | Nível (estrelas 1–5) |
| `goleiro` | boolean | Se é goleiro |
| `premium_status` | boolean | Card Premium ativo |
| `foto` | text | URL externa OU base64 da foto |

> **Auth:** a validação de login consulta esta tabela (JWT + bcrypt), gerida pelo
> `authController.js` do backend Node.js. O app mobile tem chamadas legadas ao
> Supabase Auth — **decisão de migração necessária**.

### 2.2 `grupos` — Grupos de pelada

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | (PK) | Identificador |
| `nome` | text | Nome do grupo |
| `escudo_url` | text | Escudo/foto (URL ou base64) |
| `codigo_convite` | text | Código para jogadores entrarem |
| `gestor_id` | (FK → usuarios) | Organizador/criador |

> Decisão confirmada: um usuário pode ser organizador/participante de **vários**
> grupos.

### 2.3 Vínculo jogador ↔ grupo

**[A CONFIRMAR no código]** — tabela de relacionamento entre `usuarios` e `grupos`
(ex.: nome real, e se há coluna de papel `organizador`/`tesoureiro`/`jogador`).
O `gestor_id` na tabela `grupos` aponta o organizador; precisa mapear como os
demais jogadores são vinculados ao grupo.

### 2.4 `configs` — Regras do grupo (tabela separada)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | (PK) | Identificador |
| `grupo_id` | (FK → grupos) | Grupo dono |
| `jogadores_por_time` | int | Jogadores por time |
| `qtd_times` | int | Quantidade de times |
| `vitorias_para_sair` | int | Regra de rodízio (vitórias p/ sair) |
| `regra_saida` | text | Como funciona a saída no rodízio |
| `criterio_empate` | text | Critério de desempate |
| `valor_convocacao` | numeric | Valor da convocação |

### 2.5 `quadras` — Locais das peladas

**[A CONFIRMAR no código]** — como o local/quadra é armazenado hoje (coluna na
tabela de peladas ou tabela própria). A decisão do organizador é que peladas
podem variar de local → precisa de cadastro reutilizável de quadras.

### 2.6 `peladas` — Rodadas/eventos

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | (PK) | Identificador |
| `grupo_id` | (FK → grupos) | Grupo dono |
| `data` | date | Data |
| `hora` | time | Horário |
| `valor` | numeric | Valor por jogador |
| `local` | text | Local/quadra (confirmar) |
| `status` | text | `agendada` / `finalizada` |
| `formato` | text | `normal`, torneios, etc. |
| `live_state` | jsonb | Estado ao vivo (times, fila, placar) |

> **Regra:** após "Limpar Times", o `live_state` zera e nada pode re-gravá-lo
> automaticamente (bug antigo a não repetir).

---

## 3. Presença, Times e Partidas

### 3.1 Convocação / presença

**[A CONFIRMAR no código]** — tabela(s) que ligam jogador ↔ pelada com status
(`confirmado`/`pendente`/`recusado`/`fila de espera`). Confirmar nome real e se a
fila de espera é um status ou campo separado.

### 3.2 `times` — Times sorteados

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | (PK) | Identificador |
| `pelada_id` | (FK → peladas) | Pelada |
| `nome` | text | Nome do time |
| `cor` | text | Cor |
| `emblema` / `emblema_url` | text | Emblema do sistema ou customizado |

### 3.3 `times_jogadores` — Jogadores de cada time

| Coluna | Tipo | Descrição |
|---|---|---|
| `time_id` | (FK → times) | Time |
| `usuario_id` | (FK → usuarios) | Jogador |

### 3.4 `partidas` — Jogos

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | (PK) | Identificador |
| `grupo_id` / `pelada_id` | FK | Vínculo |
| Times A/B | FK → times | Confronto |
| `gols_a` / `gols_b` | int | Placar |
| `autores_gols` | json | JSON com autores (usado no ranking) |
| `status` | text | Finalizada etc. |

---

## 4. Tabelas do Financeiro (CONFIRMADO)

### 4.1 `transacoes` — Tabela ÚNICA de lançamentos

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | (PK) | Identificador |
| `usuario_id` | (FK → usuarios) | Jogador (quando aplicável) |
| `grupo_id` | (FK → grupos) | Grupo |
| `valor` | numeric | Valor do lançamento |
| `tipo` | text | `credito` (entrada) / `debito` (saída) |
| `descricao` | text | Ex: "PIX João", "Aluguel quadra" |
| `data` | timestamp | Data |

> **Regra:** TODAS as entradas (créditos/PIX/verbas) e saídas (débitos/despesas/
> quadra) ficam aqui. O `tipo` + `descricao` diferenciam receita de despesa.

### 4.2 Vaquinha — campanhas de arrecadação (MÓDULO NOVO)

| Tabela | Descrição |
|---|---|
| `arrecadacoes` | Campanhas de vaquinha do grupo |
| `arrecadacao_contribuicoes` | Contribuições de cada jogador na campanha |

> Pagamentos confirmados das contribuições são **consolidados** na tabela
> `transacoes`.

---

## 5. Ranking e Estatísticas (CONFIRMADO)

**O ranking NÃO tem tabela própria.** É **calculado em tempo real**:
- `pages/jogador/ranking.js` consulta o histórico das partidas finalizadas do
  grupo (`Api.listarPartidas`).
- Percorre placares + JSON `autores_gols` e gera dinamicamente:
  - classificação por pontos/vitórias/empates/derrotas/saldo de gols;
  - lista de artilharia e assistências.

> **Implicação:** no novo sistema, manter ranking calculado na hora (simples) ou
> criar tabela de estatísticas agregadas (performance) — decisão de arquitetura.

---

## 6. Enums (valores fixos)

| Enum | Valores |
|---|---|
| `tipo_transacao` | `credito`, `debito` |
| `status_pelada` | `agendada`, `finalizada` |
| `formato_pelada` | `normal`, `torneio`, `pontos_corridos`, `mata_mata_direto`, `torneio_livre` |
| `status_presenca` | `confirmado`, `pendente`, `recusado`, `fila_espera` [A CONFIRMAR] |
| `papel` | `organizador`, `tesoureiro`, `jogador` [A CONFIRMAR] |

---

## 7. Pontos ainda a confirmar (para fechar 100%)

1. Nome real da tabela que **vincula jogador ao grupo** (e se há papel
   organizador/tesoureiro/jogador nela).
2. Como a **fila de espera** é representada (status na convocação ou campo
   separado).
3. Como o **local/quadra** é armazenado hoje (coluna em peladas ou tabela).
4. Se existem tabelas de **torneio** (fase de grupos, mata-mata) ou se o torneio
   roda dentro do `live_state`/partidas.
5. Tabela(s) de **notificações push** (tokens dos dispositivos) — onde ficam.

---

*Fim do documento 04 — Mapa de Dados (atualizado).*
