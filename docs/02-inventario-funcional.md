# Pelada Pro — Inventário Funcional

> Documento 02/12 · Data: 06/09/2026 · Status: aprovado (com arquitetura confirmada)
> Objetivo: listar TODAS as telas, botões, filtros, regras e integrações atuais,
> com decisão de manter/corrigir/remover/substituir em cada item.
> Arquitetura de referência: confirmada no código-fonte (consulta ao Antigravity).
> Legenda de status: ✅ Manter · 🔧 Corrigir · 🗑️ Remover · 🔁 Substituir

---

## 1. Plataformas e arquitetura existentes

| Plataforma | Tecnologia | Público | Status |
|---|---|---|---|
| Web (SPA do gestor) | HTML/CSS/JS + roteador próprio | Organizador | ✅ Manter (reconstruir) |
| App Mobile | React Native + Expo Router | Jogador | ✅ Manter (reconstruir) |
| Backend | Node.js + PostgreSQL (auth própria via JWT) | — | ✅ Manter (reconstruir) |

**Confirmações de arquitetura (do código real):**
- **Autenticação:** o backend Node.js autentica via **JWT + bcrypt** consultando a
  tabela própria `usuarios` (`authController.js`). O app mobile contém **chamadas
  legadas ao Supabase Auth** (`supabase.auth.signUp/signInWithPassword`) que o PWA
  não utiliza. → **Decisão de migração necessária** (qual auth usar no novo sistema).
- **Fotos/arquivos:** NÃO estão em Storage em produção — são **URLs externas ou
  base64** em colunas (`usuarios.foto`, `grupos.escudo_url`). O mobile tem suporte
  configurado a bucket do Supabase para o futuro.
- **Ranking:** NÃO tem tabela própria — é **calculado em tempo real** a partir do
  histórico de partidas finalizadas (`ranking.js` + `Api.listarPartidas`).

---

## 2. Módulo: Autenticação e Conta

| Função | Onde | Status | Observação |
|---|---|---|---|
| Login por e-mail/senha | Web + App | ✅ Manter | JWT + bcrypt na tabela `usuarios` |
| Login social (Google/Apple) | Web + App | 🔧 Corrigir | **Desejado ativo**; hoje quebrado no app atual |
| Cadastro de conta | Web + App | ✅ Manter | |
| Recuperar senha | Web + App | ✅ Manter | |
| Sessão persistente | Web + App | 🔧 Corrigir | App mobile teve instabilidade de sessão |
| Perfil do usuário (nome, foto, posição, nível) | Web + App | ✅ Manter | Foto = URL/base64 na coluna `foto` |

---

## 3. Módulo: Grupos e Jogadores

| Função | Onde | Status | Observação |
|---|---|---|---|
| Criar grupo | App (onboarding) | ✅ Manter | Nome, escudo, código de convite, gestor |
| Editar grupo | App (configurações) | ✅ Manter | |
| Regras do grupo (configurações) | Web + App | ✅ Manter | **Tabela separada `configs`**: jogadores_por_time, qtd_times, vitorias_para_sair, regra_saida, criterio_empate, valor_convocacao |
| Cadastrar jogador | Web + App | ✅ Manter | |
| Listar jogadores com busca e filtros | Web + App | ✅ Manter | Filtros: todos, confirmados, pendentes, devedores, goleiros |
| Perfil do jogador | App | ✅ Manter | Jogos, gols, presença, estatísticas |
| Avaliação por estrelas (nível) | Web + App | ✅ Manter | Usada no sorteio equilibrado |
| Posição do jogador (goleiro, atacante...) | Web + App | ✅ Manter | |
| Remover jogador do grupo | Web + App | ✅ Manter | |
| Convidar jogador (link/código) | App | ✅ Manter | `grupos.codigo_convite` |
| Quadras/locais cadastrados | Web + App | 🔧 Corrigir | **Peladas podem variar de local** — cadastro de quadras a modelar |

---

## 4. Módulo: Peladas e Presença

| Função | Onde | Status | Observação |
|---|---|---|---|
| Criar pelada (data, hora, local, valor, jogadores/time, duração) | Web + App | ✅ Manter | |
| Pelada recorrente (semanal) | App | 🔁 Substituir | **Decisão: somente lembrar** (não criar automático) |
| Convocar jogadores | Web | ✅ Manter | |
| Confirmar/recusar presença | App | ✅ Manter | Botões "Vou Jogar" / "Não Vou" |
| Lista de presença (confirmados/pendentes/recusados) | Web + App | ✅ Manter | |
| Fila de espera (lista de espera) | Web | 🔧 Corrigir | **Decisão:** promover automaticamente **se tiver saldo**; senão, notificar para pagar |
| Confirmar todos / limpar todos | Web | ✅ Manter | |
| Adicionar presença manual | Web | ✅ Manter | |
| Copiar lista para WhatsApp | Web | ✅ Manter | |
| Exportar presença em Excel | Web | ✅ Manter | |
| Status da rodada (agendada/finalizada) | Web | ✅ Manter | |
| Formato do dia (normal, torneios, mata-mata) | Web | ✅ Manter | |

---

## 5. Módulo: Sorteio de Times (CRÍTICO)

| Função | Onde | Status | Observação |
|---|---|---|---|
| Sorteio automático com memória de duplas | Web + App | ✅ Manter | Regra validada: nenhuma dupla repete em 2 sorteios seguidos |
| Sorteio aleatório | App | ✅ Manter | |
| Montagem manual de times | Web + App | ✅ Manter | |
| Equilibrar por habilidade (estrelas) | Web + App | ✅ Manter | Diferença ≤ 2★ (tolerância 3★) |
| 1 goleiro por time | Web + App | ✅ Manter | |
| Troca manual de jogadores (drag & drop) | Web | ✅ Manter | |
| Re-sortear | Web + App | ✅ Manter | |
| Confirmar times | Web + App | ✅ Manter | |
| Nomes dos times | Web | ✅ Manter | |
| Emblemas/escudos dos times | Web | ✅ Manter | URL/base64 em coluna |
| Salvar na nuvem (sincronizar) | Web | 🔧 Corrigir | Bug conhecido de re-sincronização |
| Limpar times | Web | 🔧 Corrigir | Bug conhecido: times voltam após recarregar |
| Exportar escalação para WhatsApp | Web | ✅ Manter | |

---

## 6. Módulo: Partidas ao Vivo

| Função | Onde | Status | Observação |
|---|---|---|---|
| Placar ao vivo | Web + App | ✅ Manter | |
| Cronômetro / tempo de partida | Web + App | ✅ Manter | |
| Registrar gol | Web + App | ✅ Manter | Gols vão no JSON `autores_gols` da partida |
| Registrar assistência | Web + App | ✅ Manter | |
| Registrar cartão | Web + App | ✅ Manter | |
| Substituição | Web + App | ✅ Manter | |
| Fila de rodízio | Web + App | ✅ Manter | |
| Finalizar partida | Web + App | ✅ Manter | |
| Resumo pós-jogo (resultado, MVP, gols) | Web + App | ✅ Manter | |
| Rateio de pagamento pós-jogo | Web + App | ✅ Manter | Gera lançamentos na tabela `transacoes` |

---

## 7. Módulo: Torneios

| Função | Onde | Status | Observação |
|---|---|---|---|
| Fase de grupos | Web | ✅ Manter | |
| Turno único (ida) / ida e volta | Web | ✅ Manter | |
| Mata-mata direto | Web | ✅ Manter | |
| Pontos corridos | Web | ✅ Manter | |
| Torneio livre (confrontos manuais) | Web | ✅ Manter | |
| Tabela mista (tabela + mata-mata) | Web | ✅ Manter | |

---

## 8. Módulo: Financeiro

> **Arquitetura confirmada:** tabela **ÚNICA `transacoes`** com `tipo` =
> `credito` (entrada) ou `debito` (saída) + descrição. Vaquinha usa tabelas
> auxiliares consolidadas na `transacoes`.

| Função | Onde | Status | Observação |
|---|---|---|---|
| Rateio por jogador | Web + App | ✅ Manter | |
| Registrar pagamento (entrada) | Web + App | ✅ Manter | `transacoes.tipo = credito` |
| Registrar despesa | Web + App | ✅ Manter | `transacoes.tipo = debito` |
| Injetar verba | Web | ✅ Manter | `credito` (verba) |
| Saldo do caixa | Web + App | ✅ Manter | |
| Devedores / pendências | Web + App | ✅ Manter | |
| Cobrar devedor | Web + App | ✅ Manter | |
| Pagar via PIX (link/QR) | App | ✅ Manter | Sem gateway real por enquanto |
| Histórico de transações | Web + App | ✅ Manter | Tabela `transacoes` |
| Fechamento por pelada | Web + App | ✅ Manter | |
| Exportar financeiro | Web | 🔁 Substituir | **Decisão: CSV E PDF** (ambos), por pelada e por período |
| Correção de lançamento | Web | 🔧 Corrigir | Deve ser por estorno/ajuste auditável, não apagar |
| **Vaquinha (campanhas de arrecadação)** | Web + App | 🔧 Corrigir | **Módulo NOVO descoberto** — tabelas `arrecadacoes` + `arrecadacao_contribuicoes`; pagamentos confirmados viram `credito` na `transacoes` |

> **Vaquinha:** precisa ser inventariada no detalhe (criar campanha, meta, prazo,
> contribuir, acompanhar) — recomenda-se que o Claude audite o código e detalhe
> este fluxo no doc 03.

---

## 9. Módulo: Ranking e Estatísticas

> **Arquitetura confirmada:** ranking **calculado em tempo real** a partir do
> histórico de partidas finalizadas (`Api.listarPartidas` + JSON `autores_gols`).
> Não há tabela de ranking — portanto **não há dados de ranking a migrar**,
> apenas o histórico de partidas.

| Função | Onde | Status | Observação |
|---|---|---|---|
| Ranking de artilheiros | Web + App | ✅ Manter | Calculado na hora |
| Ranking de presença | Web + App | ✅ Manter | |
| Ranking de goleiros | Web + App | ✅ Manter | |
| Pódio (top 3) | App | ✅ Manter | |
| Filtro por período (mês/ano/todos) | App | ✅ Manter | |
| Estatísticas por atleta | App | ✅ Manter | Gols, assistências, defesas, cartões |

---

## 10. Módulo: Card Premium e Perfil Visual

| Função | Onde | Status | Observação |
|---|---|---|---|
| Card Premium do atleta | App | 🔧 Corrigir | Bug no iPhone corrigido (3 camadas); validar |
| Adquirir card (modo teste) | App | ✅ Manter | Sem cobrança real por enquanto |
| Benefícios premium (MVP, medalha, destaque, estatísticas) | App | ✅ Manter | |
| Visual do perfil (estilo FUT/cartão) | App | 🔧 Corrigir | **Está INATIVO** — reativar no novo sistema |
| Cobrança real do card | App | 🔁 Substituir | **Futuro confirmado**: integrar gateway de pagamento |

---

## 11. Integrações e Notificações

| Função | Onde | Status | Observação |
|---|---|---|---|
| Push notification de sorteio | Backend | ✅ Manter | Avisa atleta do time sorteado |
| Push notification de convocação | Backend | ✅ Manter | |
| Lembrete de pelada (24h antes) | Backend | ✅ Manter | |
| Lembrete via WhatsApp | Backend | 🗑️ Remover/adiar | **Inativo** — o canal oficial é push no celular |
| Exportar WhatsApp (lista, escalação) | Web | ✅ Manter | |
| Notificação de cobrança/promoção da fila | Backend | ✅ Manter | Regra da fila de espera (saldo/pagamento) |

---

## 12. Problemas conhecidos a corrigir (resumo)

| # | Problema | Módulo | Causa provável |
|---|---|---|---|
| 1 | Times voltam após "Limpar Times" | Sorteio | Re-sincronização automática re-grava no servidor |
| 2 | Card Premium desativa sozinho no iPhone | Premium | AsyncStorage instável no iOS (corrigido com 3 camadas) |
| 3 | Scripts duplicados na SPA (SyntaxError) | Web | Roteador carregava config.js 2x (corrigido) |
| 4 | Fila de espera inconsistente | Presença | Sincronização entre telas |
| 5 | Visual do perfil inativo | Premium/Perfil | Funcionalidade não implementada/desativada |
| 6 | Login social quebrado | Autenticação | A diagnosticar no novo sistema |
| 7 | Auth duplicada (JWT própria vs Supabase legado) | Autenticação | App mobile usa chamadas legadas ao Supabase Auth — unificar no novo sistema |

---

## 13. Decisões do organizador (respondidas)

| # | Decisão | Resposta | Impacto |
|---|---|---|---|
| 1 | Login social (Google/Apple) | **Desejado ativo**; quebrado hoje | Requisito obrigatório (P0) no novo sistema |
| 2 | Pelada recorrente (semanal) | **Somente lembrar** (não criar automático) | Fluxo 4 do doc 03 |
| 3 | Lembrete via WhatsApp | **Inativo**; usa push no celular | WhatsApp fora de escopo; push é o canal oficial |
| 4 | Fila de espera | Promover **se tiver saldo**; senão, notificar para pagar | Regra de promoção com saldo/pagamento |
| 5 | Exportar financeiro | **CSV e PDF**, por pelada e por período | Novo sistema deve gerar os dois formatos |
| 6 | Tela/função não listada | **Não sabe** no momento | Validar quando o Claude auditar o código real |

---

## 14. Pendências de inventário (a validar na auditoria do código)

1. **Vaquinha:** detalhar telas e fluxos do módulo de arrecadações (falta no
   inventário funcional detalhado).
2. **Tabela de vínculo jogador ↔ grupo:** confirmar nome real e colunas (o
   `gestor_id` está em `grupos`; falta mapear os demais jogadores).
3. **Fila de espera:** confirmar representação (status na convocação ou campo
   separado).
4. **Quadras/locais:** confirmar como é armazenado hoje (coluna em peladas ou
   tabela própria).
5. **Torneios:** confirmar se existem tabelas de torneio/partidas ou se rodam
   dentro do `live_state`.
6. **Tokens de push:** localizar onde ficam armazenados os tokens dos dispositivos.

---

*Fim do documento 02 — Inventário Funcional (atualizado).*
