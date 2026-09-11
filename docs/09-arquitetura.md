# Pelada Pro — Arquitetura Técnica

> Documento 09/12 · Data: 09/09/2026 · Status: ✅ FECHADO
> Base: doc 04 (schema real confirmado) + doc 06 (requisitos) + decisões do organizador.
> Objetivo: definir a arquitetura do NOVO sistema, corrigindo todos os problemas
> do legado (auth duplicada, zero RLS, tabelas órfãs, código morto, segurança).

---

## 1. Stack tecnológica (decidida)

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Banco de dados | **Supabase (PostgreSQL)** | Já é o banco atual; migração direta |
| Autenticação | **Supabase Auth** (opção B) | Login Google/Apple funcionando nativamente |
| Armazenamento de arquivos | **Supabase Storage** | Fotos/emblemas; banco guarda só a URL |
| Backend | **Node.js + Express** (API REST) | Reaproveita regras de negócio do legado, reescritas |
| Painel web (gestor) | **React (SPA)** | Painel gestor + área jogador |
| App mobile (jogador) | **React Native + Expo Router** | App do jogador |
| Notificações | **Push (FCM/APNs)** via Supabase | Canal oficial; WhatsApp fora de escopo |
| Pagamento | **Mercado Pago** (gateway) | Card Premium e PIX |

> **Decisões-chave:** auth única (Supabase), fotos no Storage (não BLOB),
> RLS ativo em TODAS as tabelas, segredos fora do código (env),
> **gateway = Mercado Pago** (Card Premium e PIX).

---

## 2. Princípios de arquitetura

1. **Auth única** — Supabase Auth é a única fonte de identidade (elimina o JWT
   duplicado do legado).
2. **Segurança no banco** — RLS ativo em todas as tabelas; o frontend NUNCA é a
   única barreira.
3. **Isolamento multi-grupo** — `usuario_grupo` é a peça central; nenhum dado
   vaza entre grupos.
4. **Ledger financeiro** — `transacoes` é append-only; correção por estorno.
5. **Sem código morto** — cada tela conectada ao roteador real; sem telas órfãs.
6. **Segredos fora do código** — chaves/credenciais via variáveis de ambiente.
7. **Sorteio com memória de duplas** — regra rígida no backend (P0).
8. **Pagamento via Mercado Pago** — gateway único para Card Premium e PIX.

---

## 3. Schema novo (tabelas) — com RLS

> Todas as tabelas têm RLS ATIVADO (SEG-001) com policies por papel (SEG-002)
> e isolamento por grupo (SEG-003/004). Nenhuma tabela fica sem política.

### 3.1 Autenticação e usuários
| Tabela | Colunas principais | RLS |
|---|---|---|
| `auth.users` (Supabase) | id, email, senha_hash | Gerenciado pelo Supabase |
| `usuarios` | id (uuid), nome, apelido, cpf, whatsapp, foto_url, autoavaliacao, goleiro, premium_status, premium_ativado_em, ativo, verificado, tipo | ✅ Ativo |

### 3.2 Grupos e vínculo (multi-grupo)
| Tabela | Colunas principais | RLS |
|---|---|---|
| `grupos` | id, nome, gestor_id, ativo, licenca_codigo, licenca_status, licenca_expira_em | ✅ Ativo |
| `usuario_grupo` | id, usuario_id, grupo_id, papel (organizador/tesoureiro/jogador), data_entrada | ✅ **Ativo + isolamento por grupo** |
| `nomes_times_grupo` | id, grupo_id, nome, cor | ✅ Ativo |

### 3.3 Quadras (corrige texto livre do legado)
| Tabela | Colunas principais | RLS |
|---|---|---|
| `locais` | id, grupo_id, nome, endereco, foto_url, ativo | ✅ Ativo |
> `peladas.local` deixa de ser texto livre e passa a ser FK para `locais` (QUA-001).

### 3.4 Peladas, presença e fila
| Tabela | Colunas principais | RLS |
|---|---|---|
| `peladas` | id, grupo_id, local_id (FK), data, horario, status, max_jogadores, modo, turno_torneio, liberar_convidados, live_state (jsonb), chave_pix, valor_convocacao, jogadores_por_time, quantidade_times, vitorias_para_sair, criterio_empate, regra_saida | ✅ Ativo |
| `convocacoes` | pelada_id+usuario_id (PK), status (confirmado/recusado/espera), forma_pagamento, posicao_fila, saldo_estornado, motivo_remocao | ✅ Ativo |
| `push_subscriptions` | id, usuario_id, token, dispositivo | ✅ Ativo |

### 3.5 Times, partidas e estatísticas
| Tabela | Colunas principais | RLS |
|---|---|---|
| `times` | id, pelada_id, nome, cor, emblema_url | ✅ Ativo |
| `times_jogadores` | time_id, usuario_id | ✅ Ativo |
| `partidas` | id, pelada_id, times, placar, autores_gols | ✅ Ativo |
| `gols` | id, partida_id, usuario_id, time_id, minuto, assistencia_id | ✅ Ativo (recriada) |
| `desempenho_goleiro` | id, partida_id, usuario_id, defesas, gols_sofridos | ✅ Ativo (recriada) |

### 3.6 Financeiro (ledger)
| Tabela | Colunas principais | RLS |
|---|---|---|
| `transacoes` | id, usuario_id, grupo_id, pelada_id, valor, tipo (credito/debito), descricao, data, estorno_de (nullable) | ✅ Ativo |
| `pagamentos_mercado_pago` | id, usuario_id, pelada_id, valor, status, qr_code, tipo | ✅ Ativo |
| `comprovantes_pix` | id, usuario_id, pelada_id, arquivo_url, validado | ✅ Ativo |

### 3.7 Vaquinha
| Tabela | Colunas principais | RLS |
|---|---|---|
| `arrecadacoes` | id, grupo_id, titulo, meta, prazo, status | ✅ Ativo |
| `arrecadacoes_contribuicoes` | id, arrecadacao_id, usuario_id, valor, confirmado | ✅ Ativo |

### 3.8 Licenças e emblemas
| Tabela | Colunas principais | RLS |
|---|---|---|
| `licencas` | codigo, email_comprador, plano, status, grupo_id, ativada_em, expira_em | ✅ Ativo |
| `emblemas_grupo` | id, grupo_id, nome, imagem_url | ✅ Ativo |

### 3.9 Notificações (NOVA — não existia no legado)
| Tabela | Colunas principais | RLS |
|---|---|---|
| `notificacoes` | id, usuario_id, tipo, titulo, corpo, lida, criada_em | ✅ Ativo |
> No legado, `notificacoes` NÃO existia (falhava silenciosamente). Agora é criada
> de verdade (NOT-001 a 008).

---

## 4. Políticas de RLS (padrão por papel)

> Regra geral: o usuário só acessa dados de grupos em que é membro
> (`usuario_grupo`), e cada papel vê apenas o que lhe cabe.

| Papel | Pode ver | Pode alterar |
|---|---|---|
| **Organizador** | Tudo do grupo | Tudo do grupo |
| **Tesoureiro** | Financeiro do grupo | Financeiro do grupo |
| **Jogador** | Presença, times, ranking, PRÓPRIA situação financeira | A própria presença, o próprio perfil, o próprio card premium |

**Exemplo de policy (isolamento por grupo):**
```sql
-- Jogador só vê a própria situação financeira (FIN-012)
CREATE POLICY "jogador_ve_proprio_financeiro" ON transacoes
FOR SELECT
USING (
  usuario_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM usuario_grupo ug
    WHERE ug.usuario_id = auth.uid()
      AND ug.grupo_id = transacoes.grupo_id
  )
);
