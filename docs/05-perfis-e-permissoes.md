# Pelada Pro — Perfis e Permissões

> Documento 05/12 · Data: 06/09/2026 · Status: aprovado
> Objetivo: definir QUEM pode ver, criar, editar e excluir cada coisa.
> Base para: matriz de permissões no frontend + políticas de segurança (RLS)
> no banco do novo sistema.
> Legenda: ✅ sim · ❌ não · 🔧 com restrição (ver nota)

---

## 1. Perfis de acesso

| Perfil | Quem é | Papel principal |
|---|---|---|
| **Organizador (gestor)** | Criador do grupo | Administra tudo: grupo, jogadores, peladas, times, financeiro |
| **Tesoureiro** | Pessoa delegada pelo organizador | Cuida APENAS do financeiro (entradas, despesas, cobranças) |
| **Jogador (atleta)** | Participante comum | Confirma presença, vê times/ranking, paga e gerencia o próprio Card Premium |

> **Decisão confirmada:** hoje organizador e tesoureiro são a mesma pessoa, mas o
> sistema deve suportar **papéis separados** desde o início — para que o organizador
> possa delegar o financeiro a outra pessoa sem dar acesso ao resto.
>
> **Decisão confirmada:** um grupo pode ter **mais de um tesoureiro** ao mesmo tempo.

### 1.1 Visitante / não logado

- Não existe acesso sem conta: para entrar em um grupo, o jogador precisa
  **criar conta** e entrar pelo **código/link de convite**.
- Apenas o fluxo de convite (aceitar código) pode ser acessado sem estar em um
  grupo — mas sempre com conta logada.

---

## 2. Papéis dentro do grupo

Cada vínculo jogador ↔ grupo carrega um **papel** (coluna `papel` na tabela de
vínculo):

| Papel | Pode fazer |
|---|---|
| `organizador` | Tudo no grupo (inclusive transferir/remover papel de tesoureiro) |
| `tesoureiro` | Ver e operar o módulo financeiro do grupo (e nada além disso) |
| `jogador` | Presença, times, partidas, ranking, pagar, card premium |

**Regras de papel:**
- Um usuário pode ser `organizador` em um grupo e `jogador` em outro (decisão
  confirmada: vários grupos por usuário).
- Só o `organizador` pode nomear/remover um `tesoureiro`.
- Um grupo pode ter **mais de um tesoureiro** (decisão confirmada: sim).
- O `tesoureiro` NÃO pode editar configurações do grupo, excluir jogadores nem
  sortear times — apenas operar o financeiro.
- **Transferência de grupo:** o organizador pode **transferir o grupo para outro
  usuário** (decisão confirmada: sim). Ao transferir, o novo usuário vira
  `organizador` e o antigo pode permanecer como `jogador` ou sair.

---

## 3. Matriz de permissões por módulo

### 3.1 Grupo e Jogadores

| Ação | Organizador | Tesoureiro | Jogador |
|---|---|---|---|
| Ver informações do grupo | ✅ | ✅ | ✅ |
| Editar nome/escudo do grupo | ✅ | ❌ | ❌ |
| Definir regras do grupo (configs) | ✅ | ❌ | ❌ |
| Cadastrar jogador manualmente | ✅ | ❌ | ❌ |
| Convidar jogador (link/código) | ✅ | ❌ | ❌ |
| Editar perfil/jogador (nível, posição) | ✅ | ❌ | 🔧 só o próprio perfil |
| Remover jogador do grupo | ✅ | ❌ | ❌ (pode sair sozinho) |
| Sair do grupo | ✅ (transferir antes) | ✅ | ✅ |
| Excluir o grupo | ✅ | ❌ | ❌ |
| Transferir o grupo para outro usuário | ✅ | ❌ | ❌ |

### 3.2 Peladas e Presença

| Ação | Organizador | Tesoureiro | Jogador |
|---|---|---|---|
| Ver peladas do grupo | ✅ | ✅ | ✅ |
| Criar pelada | ✅ | ❌ | ❌ |
| Editar/excluir pelada | ✅ | ❌ | ❌ |
| Convocar jogadores | ✅ | ❌ | ❌ |
| Confirmar/recusar presença | ✅ | ✅ (própria) | ✅ (própria) |
| Confirmar presença de OUTRO jogador | ✅ | ❌ | ❌ |
| Ver lista de presença | ✅ | ✅ | 🔧 ver confirmados (não dados sensíveis) |
| Ver fila de espera | ✅ | ✅ | 🔧 só a própria posição |
| Promover da fila de espera | automático | automático | automático |

> **Regra da fila (decisão confirmada):** a promoção da fila para convocado é
> AUTOMÁTICA, mas **condicionada a saldo**: o atleta só é promovido se tiver saldo
> ≥ valor da pelada; caso contrário, recebe notificação para pagar antes de entrar.

### 3.3 Times e Sorteio

| Ação | Organizador | Tesoureiro | Jogador |
|---|---|---|---|
| Sortear times | ✅ | ❌ | ❌ |
| Montagem manual / drag & drop | ✅ | ❌ | ❌ |
| Re-sortear | ✅ | ❌ | ❌ |
| Limpar times | ✅ | ❌ | ❌ |
| Confirmar times | ✅ | ❌ | ❌ |
| Ver times sorteados | ✅ | ✅ | ✅ (do grupo) |
| Ver o próprio time | ✅ | ✅ | ✅ |

### 3.4 Partidas ao Vivo e Torneios

| Ação | Organizador | Tesoureiro | Jogador |
|---|---|---|---|
| Iniciar/finalizar partida | ✅ | ❌ | ❌ |
| Registrar gol/assistência/cartão | ✅ | ❌ | ❌ |
| Ver placar/eventos ao vivo | ✅ | ✅ | ✅ |
| Montar/gerenciar torneio | ✅ | ❌ | ❌ |
| Registrar resultado de partida | ✅ | ❌ | ❌ |

### 3.5 Financeiro (regras críticas)

| Ação | Organizador | Tesoureiro | Jogador |
|---|---|---|---|
| Ver caixa e saldo do grupo | ✅ | ✅ | ❌ |
| Ver quem está devendo (lista) | ✅ | ✅ | ❌ |
| Registrar pagamento de jogador | ✅ | ✅ | ❌ |
| Registrar despesa | ✅ | ✅ | ❌ |
| Injetar verba | ✅ | ✅ | ❌ |
| Cobrar devedor | ✅ | ✅ | ❌ |
| Ver histórico de transações do grupo | ✅ | ✅ | ❌ |
| Exportar financeiro (CSV/PDF) | ✅ | ✅ | ❌ |
| Corrigir lançamento (estorno) | ✅ | ✅ | ❌ |
| Ver a PRÓPRIA situação financeira | ✅ | ✅ | ✅ (só o seu saldo/débito) |
| Pagar a própria pendência (PIX) | ✅ | ✅ | ✅ |

> **Regra de confidencialidade:** o jogador NÃO vê os valores dos outros nem o
> caixa do grupo — apenas a própria situação ("Você deve R$ X").
> O tesoureiro vê o financeiro, mas nada de gestão de grupo/times.

### 3.6 Ranking e Estatísticas

| Ação | Organizador | Tesoureiro | Jogador |
|---|---|---|---|
| Ver ranking do grupo | ✅ | ✅ | ✅ |
| Ver estatísticas de outro jogador | ✅ | ✅ | ✅ |
| Filtrar por período | ✅ | ✅ | ✅ |

> **Decisão confirmada:** o ranking e as estatísticas dos jogadores são **públicos
> dentro do grupo** — qualquer membro (incluindo jogador) pode ver o desempenho de
> outros jogadores do mesmo grupo.

### 3.7 Card Premium (self-service)

| Ação | Organizador | Tesoureiro | Jogador |
|---|---|---|---|
| Ver o próprio card | ✅ | ✅ | ✅ |
| Adquirir/ativar o próprio card | ✅ | ✅ | ✅ |
| Ver cards de outros | ✅ | ✅ | ✅ (público no grupo) |

> O premium é **self-service**: cada jogador gerencia o SEU card. Ninguém ativa ou
> desativa o card de outro jogador. Os cards são visíveis aos membros do grupo.

### 3.8 Notificações

| Ação | Organizador | Tesoureiro | Jogador |
|---|---|---|---|
| Receber push de convocação/sorteio/lembrete | ✅ | ✅ | ✅ |
| Gerenciar os próprios toggles de notificação | ✅ | ✅ | ✅ |
| Escolher canal (push; WhatsApp fora de escopo) | ✅ | ✅ | ✅ |

---

## 4. Isolamento entre grupos (multi-grupo)

Como um usuário pode participar de **vários grupos**:

1. **Nenhum dado vaza entre grupos.** Um jogador do Grupo A não vê nada do
   Grupo B, mesmo estando logado.
2. Toda consulta ao banco deve ser filtrada por `grupo_id` + papel do usuário
   naquele grupo (nunca apenas por usuário logado).
3. Um usuário pode ser `organizador` do Grupo A e `jogador` do Grupo B — as
   permissões são avaliadas **por grupo**, não globalmente.
4. O financeiro de cada grupo é 100% separado.

---

## 5. Segurança no banco (RLS — a implementar no novo sistema)

Como o novo sistema usará **Supabase + RLS (Row Level Security)**, cada tabela
precisa de políticas explícitas. Resumo do que o Claude deve implementar:

| Tabela | Regra de acesso (policy) |
|---|---|
| `usuarios` | Usuário vê/edita o PRÓPRIO registro. Admin/organizador vê jogadores dos grupos que gerencia. |
| `grupos` | Visto por quem tem vínculo ativo no grupo. Editado só por `organizador`. |
| vínculo grupo↔usuário | Usuário vê os próprios vínculos. Papel definido/criado pelo organizador. |
| `configs` | Leitura: membros do grupo. Escrita: só `organizador`. |
| `quadras` | Leitura: membros. Escrita: organizador. |
| `peladas` | Leitura: membros. Escrita: organizador. |
| convocações/presença | Jogador lê/edita a PRÓPRIA confirmação. Organizador lê tudo e edita tudo. |
| `times` / `times_jogadores` | Leitura: membros do grupo. Escrita: organizador. |
| `partidas` | Leitura: membros. Escrita: organizador. |
| `transacoes` | Leitura/escrita: `organizador` e `tesoureiro` do grupo. Jogador: só as próprias. |
| vaquinha (`arrecadacoes` etc.) | Leitura: membros. Escrita: organizador/tesoureiro. |
| tokens de push | Usuário só gerencia os próprios tokens. |

**Regra de ouro:** segurança NÃO fica só escondendo botões no frontend — o banco
deve negar acesso de verdade (RLS ativado em TODAS as tabelas, sem exceção).

---

## 6. Ações auditáveis (trilha)

| Ação | Exige registro |
|---|---|
| Correção/estorno de lançamento financeiro | ✅ quem fez, quando, valor original e novo |
| Remover jogador do grupo | ✅ quem removeu e motivo |
| Excluir pelada com histórico | ✅ confirmar e registrar |
| Transferir papel de organizador | ✅ registro (quem transferiu, para quem, quando) |
| Mudança de regras do grupo (configs) | ✅ recomendado |

> Financeiro nunca apaga silenciosamente: correção = estorno registrado.

---

## 7. Decisões confirmadas (todas respondidas)

| # | Ponto | Decisão |
|---|---|---|
| 1 | Tesoureiro pode ser pessoa separada do organizador | ✅ Decidido (papel separado) |
| 2 | Usuário pode ter vários grupos | ✅ Decidido (sim) |
| 3 | Fila de espera promove só com saldo | ✅ Decidido (regra automática) |
| 4 | Jogador não vê financeiro dos outros | ✅ Decidido (só a própria situação) |
| 5 | Um grupo pode ter mais de um tesoureiro | ✅ Decidido (sim) |
| 6 | Jogador pode ver estatísticas/ranking de outros | ✅ Decidido (sim, público no grupo) |
| 7 | Organizador pode transferir o grupo | ✅ Decidido (sim) |

---

*Fim do documento 05 — Perfis e Permissões (atualizado).*
