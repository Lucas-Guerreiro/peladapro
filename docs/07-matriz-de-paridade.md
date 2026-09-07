# Pelada Pro — Matriz de Paridade

> Documento 07/12 · Data: 09/09/2026 · Status: ✅ ATUALIZADO
> Objetivo: garantir que NENHUMA função do app atual fique de fora da
> reconstrução. Cada linha tem decisão + requisito + teste.
> Fonte: doc 02 (inventário) + doc 03 (fluxos) + auditoria real do código (raio-x).

---

## 1. Regra de ouro

**Nenhuma função do app atual fica de fora.** Para cada recurso existente, a
matriz registra: o que faz hoje, o que faremos no novo sistema, qual requisito
atende e qual teste garante que funcionou. Se algo não for migrar, precisa de
decisão explícita e justificada.

---

## 2. Problemas do legado que a paridade DEVE corrigir (testes obrigatórios)

| # | Problema encontrado | Correção no novo | Requisito | Teste |
|---|---|---|---|---|
| 1 | Times voltam após "Limpar Times" | Bloquear re-gravação automática; limpar local + nuvem | SOR-012 | Limpar → recarregar → segue vazio |
| 2 | Card Premium desativa sozinho no iPhone | Persistência em 3 camadas (memória → cache → Supabase) | PREM-003 | Ativar → fechar app → reabrir → segue ativo |
| 3 | Scripts duplicados na SPA (config.js 2x) | Carregar cada script 1x | NFR-006 | Auditar rede → sem duplicação |
| 4 | Fila de espera inconsistente | Promoção só com saldo suficiente | PRE-005/006 | Desistência → 1º da fila promovido só se tiver saldo |
| 5 | Visual do perfil inativo | Reativar edição do perfil | PREM-008 | Editar perfil → salvar → refletir |
| 6 | Login social quebrado | Implementar Google/Apple via Supabase Auth | AUT-003 | Login Google e Apple funcionando |
| 7 | Auth duplicada (JWT + Supabase) | Unificar em Supabase Auth | AUT-007 | Uma única fonte de identidade |

---

## 3. Matriz de paridade por módulo

### 3.1 Autenticação (AUT)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Login e-mail/senha | ✅ Manter (Supabase Auth) | AUT-001 | Login com credenciais válidas |
| Cadastro | ✅ Manter | AUT-002 | Criar conta → logar |
| Login Google | 🔧 Corrigir (estava quebrado) | AUT-003 | Login Google funciona |
| Login Apple | 🔧 Corrigir (estava quebrado) | AUT-003 | Login Apple funciona |
| Recuperação de senha | 🔧 Corrigir (OTP vazava na resposta) | AUT-004, SEG-008 | Código NÃO aparece na resposta |
| Sessão/logout | ✅ Manter | AUT-005 | Logout limpa sessão |
| Auth duplicada | 🔧 Unificar (JWT + Supabase) | AUT-007 | Uma única fonte de identidade |

### 3.2 Grupos (GRP)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Criar grupo | ✅ Manter | GRP-001 | Criar grupo com código de convite |
| Código de convite | ✅ Manter | GRP-002 | Entrar com código |
| Vários grupos por usuário | 🔧 Corrigir (isolamento nunca funcionou) | GRP-003 | Dados 100% isolados entre grupos |
| Gestor dono do grupo | ✅ Manter | GRP-004 | Só o gestor administra |
| Tesoureiro | 🔧 Adicionar (papel separado) | GRP-010/011 | Tesoureiro opera só o financeiro |
| Transferir grupo | 🔧 Adicionar | GRP-012 | Transferir gestão a outro membro |

### 3.3 Quadras (QUA)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Local como texto livre | 🔧 Corrigir (vira FK para `locais`) | QUA-001 | Selecionar quadra cadastrada |
| Cadastro de quadras | 🔧 Adicionar (tabela `locais` sem FK) | QUA-002 | Cadastrar e reutilizar quadra |

### 3.4 Peladas (PEL)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Criar pelada | ✅ Manter | PEL-001 | Criar pelada com dados |
| Editar pelada | ✅ Manter | PEL-002 | Editar data/hora/local |
| Cancelar pelada | ✅ Manter | PEL-003 | Cancelar → notificar |
| Pelada recorrente | 🔧 Corrigir (só lembrar, não cria automática) | PEL-005 | Lembrete sem criar nova |
| Modos de jogo | ✅ Manter (torneio, normal) | PEL-006 | Modo correto na pelada |

### 3.5 Presença e Fila (PRE)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Confirmar presença | ✅ Manter | PRE-001 | "Vou Jogar" registra |
| Recusar presença | ✅ Manter | PRE-002 | "Não Vou" registra |
| Fila de espera | 🔧 Corrigir (inconsistente) | PRE-004 | Excedente vai para a fila |
| Promoção da fila | 🔧 Corrigir (só com saldo) | PRE-005/006 | Promovido só se tiver saldo |
| Regra das 2 horas | 🔧 Adicionar (reembolso bloqueado <2h) | PRE-009 | Cancelamento <2h não reembolsa |

### 3.6 Sorteio (SOR) — CRÍTICO
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Sorteio automático | ✅ Manter | SOR-001 | Sortear times |
| Memória de duplas | 🔧 Corrigir (parâmetro nunca era passado) | SOR-002 | Dupla não repete em 2 sorteios |
| Piso combinatório | 🔧 Adicionar | SOR-003 | Repetições mínimas respeitadas |
| Equilíbrio de força | ✅ Manter | SOR-004 | Diferença ≤ 2 estrelas |
| Goleiro por time | ✅ Manter | SOR-005 | 1 goleiro em cada time |
| Limpar Times | 🔧 Corrigir (não re-gravar) | SOR-012 | Limpar → segue vazio |
| Sincronização | 🔧 Corrigir (idempotente) | SOR-013 | Sem duplicação de placar |

### 3.7 Partidas (PAR)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Registrar placar | ✅ Manter | PAR-001 | Registrar resultado |
| Autores de gols | ✅ Manter | PAR-002 | Registrar autor/assistência |
| Rateio automático | 🔧 Adicionar | PAR-003 | Rateio por jogador |
| Correção registrada | 🔧 Adicionar (estorno) | PAR-004 | Correção auditável |
| MVP | 🔧 Construir (não existia no banco) | PAR-004 | MVP destacado |

### 3.8 Torneios (TOR)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Fase de grupos | 🔧 Construir (só rótulos no legado) | TOR-001 | Classificação por grupo |
| Ida e volta | 🔧 Construir | TOR-002 | Turno e returno |
| Mata-mata | 🔧 Construir | TOR-003 | Eliminatórias |
| Pontos corridos | 🔧 Construir | TOR-004 | Tabela de pontos |
| Livre | 🔧 Construir | TOR-005 | Rodadas livres |
| Tabela mista | 🔧 Construir | TOR-006 | Combinação de formatos |

### 3.9 Financeiro (FIN)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Lançamento crédito/débito | ✅ Manter (ledger append-only) | FIN-001 | Lançar entrada/saída |
| Saldo por jogador | ✅ Manter | FIN-002 | Saldo correto |
| Pagamento PIX | ✅ Manter | FIN-003 | Gerar PIX |
| Comprovante PIX | 🔧 Corrigir (autodeclaração) | FIN-004, SEG-013 | Validar comprovante |
| Estorno | 🔧 Adicionar (não apagar) | FIN-010 | Estorno auditável |
| Exportar CSV/PDF | 🔧 Adicionar | FIN-011 | Exportar por pelada/período |
| Jogador vê só o próprio | 🔧 Corrigir (vazava tudo) | FIN-012 | Jogador vê só a própria situação |

### 3.10 Ranking (RAN)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Artilheiros | ✅ Manter (calculado) | RAN-001 | Gols corretos |
| Presença | ✅ Manter | RAN-002 | % de presença |
| Goleiros | ✅ Manter | RAN-003 | Defesas/sofridos |
| Público no grupo | 🔧 Corrigir (isolamento) | RAN-004 | Só o grupo vê |

### 3.11 Card Premium (PREM)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Ativar card | 🔧 Corrigir (crashava no iPhone) | PREM-001 | Ativar sem crash |
| Persistência 3 camadas | 🔧 Corrigir | PREM-003 | Sobrevive a limpeza do iOS |
| Self-service | ✅ Manter | PREM-004 | Jogador ativa sozinho |
| Cobrança futura | 🔧 Adicionar (gateway) | PREM-007 | Pagamento real (futuro) |
| Visual do perfil | 🔧 Corrigir (inativo) | PREM-008 | Card aparece no perfil |

### 3.12 Notificações (NOT)
| Função atual | Decisão no novo | Requisito | Teste |
|---|---|---|---|
| Push notifications | 🔧 Construir (tabela não existia) | NOT-001 a 008 | Push recebido no celular |
| WhatsApp | ❌ Fora de escopo (canal = push) | — | — |

---

## 4. Pendências de paridade (RESOLVIDAS na auditoria — 09/09/2026)

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

## 5. Funções que NÃO migram (decisões explícitas)

| Função | Motivo da não-migração |
|---|---|
| Tabelas do mobile inexistentes | Reconstruir seguindo o schema novo, não o legado |
| ~17 telas mortas do mobile | Refazer no padrão novo (reaproveitar só o visual como referência) |
| Ranking pré-calculado | Não existe tabela — é calculado em tempo real |
| WhatsApp | Fora de escopo; canal oficial é push |

---

*Fim do doc 07 — Matriz de Paridade (atualizado).*
