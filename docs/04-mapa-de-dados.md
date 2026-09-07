# Pelada Pro — Mapa de Dados (schema REAL confirmado)

> Documento 04/12 · Data: 09/09/2026 · Status: ✅ FECHADO
> Schema confirmado por consulta direta ao Supabase (information_schema/pg_catalog).
> 23 tabelas reais confirmadas. Nenhuma pendência de nomes.
> Fonte: auditoria do código (raio-x) + consulta direta ao banco.

---

## 1. Objetivo

Este documento é a fonte da verdade sobre **quais dados existem de verdade** no
banco atual. Ele foi fechado após consulta direta ao Supabase, porque várias
tabelas em uso **não tinham script de criação no repositório** — só existiam no
banco. Agora temos o mapa completo e confiável para guiar a reconstrução e a
migração.

---

## 2. Tabelas confirmadas (23) — com script de criação no repositório

| Tabela | Colunas principais | Observação |
|---|---|---|
| `usuarios` | id, email, senha_hash, nome, apelido, cpf, whatsapp, foto, autoavaliacao, goleiro, saldo, ativo, verificado, tipo, premium/vip/plano, codigo_verificacao, recuperacao_codigo | Conta real (JWT+bcrypt) |
| `grupos` | id, nome, gestor_id, ativo, licenca_codigo, licenca_status, licenca_expira_em | Um gestor dono; SEM tabela de membros |
| `peladas` | id, grupo_id, data, horario, local(texto), status, max_jogadores, modo, turno_torneio, liberar_convidados, live_state(jsonb), chave_pix, valor_convocacao, jogadores_por_time, quantidade_times, vitorias_para_sair, criterio_empate, regra_saida | `live_state` guarda times/fila/placar |
| `convocacoes` | pelada_id+usuario_id (PK), status, forma_pagamento, posicao_fila, saldo_estornado, motivo_remocao | É TAMBÉM a fila de espera |
| `transacoes` | id, usuario_id, grupo_id, valor, tipo(credito/debito), descricao, data | Ledger append-only |
| `configs` | grupo_id (PK), valor_convocacao, regra_saida, vitorias_para_sair, criterio_empate, qtd_times, jogadores_por_time | Divergem do CREATE original |
| `times` / `times_jogadores` | id, pelada_id, nome, cor, emblema/emblema_url · time_id+usuario_id | Índice único (pelada, nome) |
| `partidas` | id, pelada_id, times, placar, autores_gols(texto) | Recriada por script avulso |
| `pagamentos_mercado_pago` | id, usuario_id, pelada_id, valor, status, qr_code, tipo | — |
| `licencas` | codigo, email_comprador, plano, status, grupo_id, ativada_em, expira_em | — |
| `nomes_times_grupo` | id, grupo_id, nome, cor | Catálogo de nomes/cores |
| `configuracao_pelada` | (fragmento UUID) | Órfã — sem uso no código |

---

## 3. Tabelas em uso SEM script de criação no repositório (6)

Estas tabelas existem no banco e são usadas, mas **não há script de criação
versionado** no repositório. Precisam ser recriadas (com melhorias) no novo
sistema.

| Tabela | Uso observado |
|---|---|
| `arrecadacoes` | Campanhas de vaquinha |
| `arrecadacoes_contribuicoes` | Contribuições da vaquinha |
| `comprovantes_pix` | Comprovantes de pagamento manual |
| `emblemas_grupo` | Galeria de brasões por grupo |
| `push_subscriptions` | Tokens de push por usuário |
| `locais` | Catálogo de quadras (desconectado de peladas.local) |

---

## 4. Tabelas que NÃO existem (achado novo — falham silenciosamente)

O relatório anterior listava estas como existentes, mas a consulta direta ao
banco confirmou que **não existem**. Os comandos do backend para elas **falham
silenciosamente em produção**.

| Tabela "imaginada" | Realidade |
|---|---|
| `notificacoes` | ❌ NÃO existe — INSERT/UPDATE do backend falham em silêncio |
| `mvp_partida` | ❌ NÃO existe — feature MVP praticamente não funciona |

> ⚠️ **Impacto:** notificações in-app e MVP **nunca funcionaram de verdade**.
> No novo sistema, ambos são construídos do zero (NOT-001 a 008, PAR-004).

---

## 5. Fragmento UUID órfão (achado novo — 5 tabelas desconectadas)

Encontrado um quinto grupo de 5 tabelas em UUID que **ninguém tinha mapeado
antes** — desconectadas do resto do banco, sem FK, sem nenhum controller usando-as.

| Tabela | Situação |
|---|---|
| `usuario_grupo` | ⚠️ É a tabela de vínculo jogador↔grupo pedida — mas ÓRFÃ: 5 linhas, ninguém escreve nela |
| `configuracao_pelada` | Órfã, sem FK, sem controller |
| `jogador_time` | Órfã, sem FK, sem controller |
| `desempenho_goleiro` | Órfã, sem FK, sem controller |
| `gols` | Órfã, sem FK, sem controller |

> ⚠️ **Impacto:** confirma que o **isolamento entre grupos nunca funcionou**
> (a convocação vaza para o sistema inteiro). No novo sistema, `usuario_grupo`
> vira peça central do multi-grupo (GRP-003, SEG-003/004).

---

## 6. Tabelas do mobile que NÃO existem no banco real

Nenhuma das tabelas consultadas pelo app mobile existe nas 23 reais:

| Tabela consultada pelo mobile | Existe no banco? |
|---|---|
| `profiles` | ❌ Não |
| `grupo_membros` | ❌ Não |
| `pelada_presencas` | ❌ Não |
| `quadras` | ❌ Não |
| `jogadores` | ❌ Não |
| `sorteios` | ❌ Não |
| `ranking_grupos` | ❌ Não |
| `conquistas` | ❌ Não |

> ⚠️ **Impacto:** o mobile consulta tabelas que não existem — mais um motivo
> para reconstruir o app seguindo o schema novo, não o legado.

---

## 7. Segurança (RLS) — achado crítico

- **ZERO políticas de RLS** em qualquer tabela.
- 5 tabelas (fragmento UUID) têm RLS ligado SEM política → trancadas.
- As outras 18 (incluindo `usuarios`, `transacoes`, `peladas`, `convocacoes`,
  `grupos`) estão com **RLS totalmente desligado**.
- A **chave anônima do Supabase está exposta no código do app mobile** → risco
  de segurança ATIVO.

> ✅ **Decisão:** no novo sistema, RLS ativado em TODAS as tabelas (SEG-001),
> com policies por papel (SEG-002) e isolamento por grupo (SEG-003/004).

---

## 8. Decisões fechadas que afetam o schema novo

| Ponto | Decisão |
|---|---|
| Autenticação | ✅ Supabase Auth (opção B) — login Google/Apple funcionando |
| Fotos | ✅ Supabase Storage + URL no banco (não BLOB) |
| Data de corte | ✅ 09/09/2026 |
| Vínculo jogador↔grupo | ✅ `usuario_grupo` vira peça central (conectada e com FK) |
| Isolamento multi-grupo | ✅ Dados 100% isolados por grupo |
| RLS | ✅ Ativo em todas as tabelas |

---

## 9. Pendências resolvidas (fechadas na auditoria)

| Pendência anterior | Resolução |
|---|---|
| Tabela de vínculo jogador↔grupo | ✅ Encontrada: `usuario_grupo` — mas ÓRFÃ (5 linhas, sem uso). Vira peça central no novo. |
| Fila de espera no banco | ✅ `convocacoes.status = 'espera'` (alias legado `fila_espera`). |
| Local/quadra | ✅ Tabela `locais` existe, mas SEM FK — `peladas.local` é texto livre. |
| Tabelas de torneio | ✅ Não existem — só rótulos em `peladas.modo/turno_torneio` + `partidas` genérica. |
| Tokens de push | ✅ `push_subscriptions` (sem script no repo). |
| Vaquinha | ✅ `arrecadacoes` + `arrecadacoes_contribuicoes` (sem campo de prazo). |
| `notificacoes` e `mvp_partida` | ✅ NÃO existem no banco — falham silenciosamente. Construir do zero. |
| Tabelas mobile | ✅ Nenhuma existe (`profiles`, `jogadores`, `sorteios` etc.). |
| RLS | ✅ Zero políticas — risco ativo. P0 no novo. |

---

*Fim do doc 04 — Mapa de Dados (fechado).*
