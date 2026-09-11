# Pelada Pro — Requisitos do Sistema

> Documento 06/12 · Data: 07/09/2026 · Status: para aprovação
> Objetivo: listar TODOS os requisitos funcionais e não funcionais do novo
> sistema, cada um com identificador (ID) e prioridade. Cada requisito vira
> uma tarefa de implementação e um teste de aceitação no doc 10.
> Prioridades: P0 = essencial (sem isso o produto não funciona) ·
> P1 = importante (esperado) · P2 = desejável (agrega valor depois).
> Origem: docs 01 (visão), 02 (inventário), 03 (fluxos), 04 (mapa de dados),
> 05 (perfis e permissões) + decisões do organizador.

---

## 1. Autenticação e Conta (AUT)

| ID | Requisito | Prioridade |
|---|---|---|
| AUT-001 | Usuário cria conta com nome, e-mail, telefone e senha (mín. 8 caracteres). | P0 |
| AUT-002 | Usuário faz login com e-mail e senha (JWT + hash seguro). | P0 |
| AUT-003 | **Login social Google e Apple FUNCIONANDO** (hoje quebrado no app atual — corrigir de vez). | P0 |
| AUT-004 | Usuário recupera senha por e-mail (link de redefinição). | P0 |
| AUT-005 | Sessão persiste entre aberturas do app (sem pedir login toda hora). | P0 |
| AUT-006 | Login exige conexão com internet (não há login offline). | P1 |
| AUT-007 | **Unificar autenticação**: hoje existe JWT próprio (backend) + chamadas legadas ao Supabase Auth (mobile). O novo sistema deve ter UMA estratégia de auth única e documentada. | P0 |
| AUT-008 | E-mail deve ser único no cadastro (não permite duplicar). | P0 |

---

## 2. Grupos e Jogadores (GRP)

| ID | Requisito | Prioridade |
|---|---|---|
| GRP-001 | Organizador cria grupo: nome, escudo/foto, modalidade (society/campo) e regras. | P0 |
| GRP-002 | Grupo tem código/link de convite para jogadores entrarem. | P0 |
| GRP-003 | Um usuário pode participar/gerenciar **vários grupos** (dados 100% isolados entre grupos). | P0 |
| GRP-004 | Cadastrar jogador: nome, apelido, posição, nível (estrelas 1–5), goleiro (sim/não). | P0 |
| GRP-005 | Detectar duplicidade de jogador por e-mail/telefone ao cadastrar (avisar em vez de duplicar). | P1 |
| GRP-006 | Listar jogadores com busca e filtros: todos, confirmados, pendentes, devedores, goleiros. | P0 |
| GRP-007 | Editar jogador (nível, posição, goleiro) — organizador edita todos; jogador edita o próprio perfil. | P0 |
| GRP-008 | Remover jogador do grupo (registrar quem removeu). | P0 |
| GRP-009 | Jogador pode sair do grupo sozinho. | P1 |
| GRP-010 | **Papel por grupo**: organizador / tesoureiro / jogador (um usuário pode ter papéis diferentes em grupos diferentes). | P0 |
| GRP-011 | Organizador nomeia/remove **um ou mais tesoureiros**; tesoureiro vê/opera SÓ o financeiro. | P0 |
| GRP-012 | Organizador pode **transferir o grupo** para outro usuário (registro de auditoria). | P1 |
| GRP-013 | Regras do grupo ficam em tabela/configuração separada (`configs`): jogadores por time, qtd de times, critérios de rodízio, valor de convocação. | P0 |

---

## 3. Quadras / Locais (QUA)

| ID | Requisito | Prioridade |
|---|---|---|
| QUA-001 | Cadastro de quadras/locais (nome, endereço) reutilizável entre peladas. | P0 |
| QUA-002 | Cada pelada escolhe seu local (peladas podem variar de quadra). | P0 |
| QUA-003 | Apenas membros do grupo veem as quadras do grupo; só o organizador cadastra/edita. | P0 |

---

## 4. Peladas e Recorrência (PEL)

| ID | Requisito | Prioridade |
|---|---|---|
| PEL-001 | Criar pelada: data, hora, local/quadra, valor por jogador, jogadores por time, duração. | P0 |
| PEL-002 | Status da pelada: `agendada` / `finalizada`. | P0 |
| PEL-003 | Formato do dia: `normal`, `torneio`, `pontos_corridos`, `mata_mata_direto`, `torneio_livre` (e tabela mista). | P0 |
| PEL-004 | Editar e excluir pelada (excluir com confirmação e registro). | P0 |
| PEL-005 | **Recorrência semanal = SOMENTE LEMBRAR**: o sistema NÃO cria peladas automaticamente; apenas lembra/avisa o organizador de criar a próxima. | P1 |
| PEL-006 | Convocar jogadores do grupo para a pelada (push). | P0 |

---

## 5. Presença e Fila de Espera (PRE)

| ID | Requisito | Prioridade |
|---|---|---|
| PRE-001 | Jogador confirma "Vou Jogar" ou recusa "Não Vou" no app. | P0 |
| PRE-002 | Lista de presença em tempo real: confirmados / pendentes / recusados. | P0 |
| PRE-003 | Organizador pode confirmar presença de outro jogador manualmente. | P0 |
| PRE-004 | Quando confirmados excedem o limite, os excedentes vão para a **fila de espera**. | P0 |
| PRE-005 | **Promoção automática da fila**: quando um confirmado desiste, o 1º da fila é promovido **SE tiver saldo ≥ valor da pelada**. | P0 |
| PRE-006 | **Sem saldo**: o atleta da fila **não é promovido**; recebe notificação para pagar e só entra na lista de convocados após o pagamento. | P0 |
| PRE-007 | Jogador vê apenas a PRÓPRIA posição na fila (não a lista inteira). | P1 |
| PRE-008 | Copiar lista de presença para WhatsApp (texto). | P1 |
| PRE-009 | Exportar presença em Excel (.xlsx). | P1 |

---

## 6. Sorteio de Times (SOR) — CRÍTICO

| ID | Requisito | Prioridade |
|---|---|---|
| SOR-001 | **Sorteio automático com memória de duplas**: nenhuma dupla cai junta em 2 sorteios seguidos. | P0 |
| SOR-002 | Alcançar o **piso matemático de repetições** (com 4 times de 6 = 8 duplas repetidas por janela; padrão 2+2+1+1). | P0 |
| SOR-003 | Nenhum time novo recebe 3+ jogadores do mesmo time antigo (evita blocos). | P0 |
| SOR-004 | Nenhuma dupla "sacrificada" da janela anterior é reutilizada → nenhuma dupla se repete em 3 sorteios seguidos. | P0 |
| SOR-005 | Equilíbrio por habilidade: diferença de força entre times ≤ 2 estrelas (tolerância 3). | P0 |
| SOR-006 | Garantir **1 goleiro por time**. | P0 |
| SOR-007 | Sorteio aleatório (sem equilíbrio) disponível. | P1 |
| SOR-008 | Montagem manual com arrastar e soltar (drag & drop) no web. | P0 |
| SOR-009 | Re-sortear a qualquer momento antes de confirmar. | P0 |
| SOR-010 | Nomear times e escolher emblema (padrão ou customizado). | P1 |
| SOR-011 | Confirmar times → salvar na nuvem (todos os autorizados veem o mesmo resultado). | P0 |
| SOR-012 | **Limpar Times**: apaga local e na nuvem; **após limpar, NADA pode re-gravar times automaticamente** até novo sorteio manual (corrige bug histórico). | P0 |
| SOR-013 | Sincronização idempotente: re-carregar a página não duplica nem recria times. | P0 |
| SOR-014 | Exportar escalação para WhatsApp (texto). | P1 |

---

## 7. Partidas ao Vivo (PAR)

| ID | Requisito | Prioridade |
|---|---|---|
| PAR-001 | Iniciar partida com placar ao vivo e cronômetro. | P0 |
| PAR-002 | Registrar gol, assistência, cartão e substituição em tempo real. | P0 |
| PAR-003 | Fila de rodízio visível (quem entra/sai e quando). | P1 |
| PAR-004 | Finalizar partida com resumo: placar, autores dos gols (JSON `autores_gols`), MVP. | P0 |
| PAR-005 | Pós-jogo: rateio por jogador calculado automaticamente. | P0 |
| PAR-006 | Correção de placar registrada (não apaga silenciosamente). | P1 |

---

## 8. Torneios (TOR)

| ID | Requisito | Prioridade |
|---|---|---|
| TOR-001 | Formato fase de grupos. | P1 |
| TOR-002 | Turno único (ida) e ida e volta. | P1 |
| TOR-003 | Mata-mata direto. | P1 |
| TOR-004 | Pontos corridos. | P1 |
| TOR-005 | Torneio livre (confrontos manuais). | P1 |
| TOR-006 | Tabela mista (tabela + mata-mata). | P1 |
| TOR-007 | Apuração automática do campeão e atualização de ranking. | P1 |

---

## 9. Financeiro (FIN)

| ID | Requisito | Prioridade |
|---|---|---|
| FIN-001 | **Tabela única de transações** (`transacoes`): tipo `credito` (entrada) / `debito` (saída) + descrição + data. | P0 |
| FIN-002 | Registrar pagamento do jogador (entrada/`credito`). | P0 |
| FIN-003 | Registrar despesa (saída/`debito`). | P0 |
| FIN-004 | Injetar verba no caixa (`credito`). | P0 |
| FIN-005 | Saldo do caixa por grupo, atualizado em tempo real. | P0 |
| FIN-006 | Lista de devedores com valores. | P0 |
| FIN-007 | Cobrar devedor (push). | P1 |
| FIN-008 | Pagamento via PIX por link/QR (sem gateway real nesta fase). | P0 |
| FIN-009 | Vaquinha (campanhas de arrecadação): criar campanha, meta, contribuições; pagamentos confirmados consolidados em `transacoes`. | P1 |
| FIN-010 | **Correção auditável**: nenhum lançamento é apagado silenciosamente; correção por estorno/ajuste com trilha (quem, quando, valores). | P0 |
| FIN-011 | **Exportar financeiro em CSV E PDF**, por pelada e por período (ambos). | P0 |
| FIN-012 | Jogador vê APENAS a própria situação financeira; não vê caixa nem valores de outros. | P0 |
| FIN-013 | Tesoureiro(s) e organizador operam o financeiro; jogador comum não. | P0 |

---

## 10. Ranking e Estatísticas (RAN)

| ID | Requisito | Prioridade |
|---|---|---|
| RAN-001 | Ranking **calculado em tempo real** a partir das partidas finalizadas (sem tabela de ranking). | P0 |
| RAN-002 | Rankings: artilheiros, presença e goleiros. | P0 |
| RAN-003 | Filtro por período: mês / ano / todos. | P0 |
| RAN-004 | Estatísticas por atleta: gols, assistências, defesas, cartões. | P0 |
| RAN-005 | **Ranking e estatísticas são públicos dentro do grupo** (qualquer membro vê o desempenho de outros do mesmo grupo). | P0 |
| RAN-006 | Pódio (top 3) com medalhas no app. | P1 |

---

## 11. Card Premium (PREM)

| ID | Requisito | Prioridade |
|---|---|---|
| PREM-001 | Tela do Card Premium com visual estilo card de atleta (FUT). | P0 |
| PREM-002 | Adquirir/ativar o próprio card — **self-service** (ninguém ativa por outro). | P0 |
| PREM-003 | **Persistência em 3 camadas**: memória → cache protegido (AsyncStorage com try/catch) → Supabase como fonte da verdade. Deve sobreviver a reinstalação/limpeza de cache (corrige bug do iPhone). | P0 |
| PREM-004 | Re-hidratação ao voltar para a tela e ao app voltar do background. | P0 |
| PREM-005 | Benefícios: MVP destacado, medalha no ranking, destaque no perfil, estatísticas avançadas. | P0 |
| PREM-006 | Modo teste sem cobrança nesta fase (flag explícita). | P0 |
| PREM-007 | **Cobrança real FUTURA**: arquitetura pronta para integrar gateway de pagamento (sem implementar agora). | P1 |
| PREM-008 | **Reativar visual do perfil** (estilo card de atleta no perfil) — hoje inativo. | P1 |

---

## 12. Notificações (NOT)

| ID | Requisito | Prioridade |
|---|---|---|
| NOT-001 | Push de convocação ao criar pelada. | P0 |
| NOT-002 | Push de sorteio (avisa time sorteado). | P0 |
| NOT-003 | Push de lembrete 24h antes da pelada. | P0 |
| NOT-004 | Push de cobrança quando houver pendência. | P0 |
| NOT-005 | Push de promoção da fila / solicitação de pagamento (regra PRE-005/PRE-006). | P0 |
| NOT-006 | Toggles por tipo de notificação (usuário gerencia os próprios). | P1 |
| NOT-007 | **WhatsApp FORA de escopo** (canal oficial = push no celular). | — |
| NOT-008 | Tokens de push: usuário gerencia apenas os próprios dispositivos. | P0 |

---

## 13. Segurança e Permissões (SEG)

| ID | Requisito | Prioridade |
|---|---|---|
| SEG-001 | **RLS ativado em TODAS as tabelas** do banco (nenhuma exceção). | P0 |
| SEG-002 | Policies por papel conforme doc 05: jogador vê/edita o próprio; tesoureiro opera financeiro; organizador administra. | P0 |
| SEG-003 | Isolamento total entre grupos (nenhum dado vaza entre grupos do mesmo usuário). | P0 |
| SEG-004 | Toda consulta filtrada por `grupo_id` + papel do usuário naquele grupo. | P0 |
| SEG-005 | Segurança não fica só no frontend: o banco nega acesso de verdade. | P0 |
| SEG-006 | Segredos/chaves fora do código e do Git (`.env.example` sem valores; verificação de segredos). | P0 |
| SEG-007 | Auditoria de ações sensíveis: estorno financeiro, remover jogador, excluir pelada, transferir grupo. | P1 |

---

## 14. Migração de Dados (MIG) — legado → novo

| ID | Requisito | Prioridade |
|---|---|---|
| MIG-001 | Fazer **backup completo e testado** do banco atual antes de qualquer migração. | P0 |
| MIG-002 | Migrar usuários e contas (definir estratégia de auth: manter JWT próprio, ir p/ Supabase Auth ou híbrido — decisão AUT-007). | P0 |
| MIG-003 | Migrar grupos, configurações (`configs`), jogadores e vínculos jogador↔grupo. | P0 |
| MIG-004 | Migrar peladas, presenças, times sorteados e partidas finalizadas (histórico). | P0 |
| MIG-005 | Migrar financeiro: todas as `transacoes` + vaquinha (arrecadações e contribuições), sem alterar valores. | P0 |
| MIG-006 | Migrar fotos/emblemas: hoje são URL/base64 em colunas (não há Storage em produção) — preservar referências. | P0 |
| MIG-007 | Ranking NÃO é migrado (é calculado na hora) — migrar apenas o histórico de partidas que o alimenta. | P0 |
| MIG-008 | Ensaio de migração em ambiente separado + reconciliação (contagens, totais financeiros, chaves órfãs, duplicados). | P0 |
| MIG-009 | Mapear IDs antigos → novos quando necessário (sem quebrar relações). | P0 |
| MIG-010 | App antigo permanece no ar e intacto até o novo estar validado; rollback simples e nenhum dado do legado apagado durante a transição. | P0 |

---

## 15. Requisitos Não Funcionais (NFR)

| ID | Requisito | Prioridade |
|---|---|---|
| NFR-001 | Performance: telas principais carregam em menos de 2s em conexão comum. | P0 |
| NFR-002 | Sincronização de times/presença sem "piscar" a tela (cache local + servidor). | P0 |
| NFR-003 | **Offline no futuro (P1, fase de expansão)**: jogador confirma presença sem internet e sincroniza ao reconectar. Começar online. | P1 |
| NFR-004 | Acessibilidade básica: contraste, alvos de toque ≥ 44px, labels acessíveis. | P1 |
| NFR-005 | Responsivo: web funciona em desktop e celular; app em iOS e Android. | P0 |
| NFR-006 | Código versionado no Git; mudanças de banco sempre via migration revisável. | P0 |
| NFR-007 | Testes: cada requisito P0 tem pelo menos 1 teste de aceitação (doc 10). | P0 |

---

## 16. Requisitos que herdam decisões do organizador (resumo)

| Decisão | Requisitos afetados |
|---|---|
| Login social ativo (quebrado hoje) | AUT-003 |
| Pelada recorrente = somente lembrar | PEL-005 |
| Fila promove só com saldo; senão notifica p/ pagar | PRE-005, PRE-006, NOT-005 |
| Tesoureiro pode ser pessoa separada; mais de 1 | GRP-010, GRP-011 |
| Vários grupos por usuário | GRP-003, SEG-003, SEG-004 |
| Exportar CSV + PDF, por pelada e período | FIN-011 |
| Ranking público no grupo | RAN-005 |
| Transferir grupo | GRP-012 |
| Card Premium com cobrança futura + perfil a reativar | PREM-007, PREM-008 |
| WhatsApp fora de escopo (push é o canal) | NOT-007 |

---

## 17. Pendências de decisão (para fechar este documento)

1. **Estratégia de auth no novo sistema** (AUT-007): manter JWT próprio + bcrypt na tabela `usuarios` (como hoje), migrar tudo para Supabase Auth, ou híbrido? — *Recomendação: avaliar Supabase Auth (login social mais simples), mas decidir antes do schema.*
2. **Gateway de pagamento** do Card Premium (PREM-007): qual usar no futuro (ex.: Stripe/Mercado Pago)? — *Decisão pode ficar para depois; só a arquitetura precisa prever.*
3. **Fotos no novo sistema**: manter URL/base64 em colunas (como hoje) ou migrar para Storage do Supabase? — *Recomendação: Storage com RLS (mais robusto), mas muda MIG-006.*

---

*Fim do documento 06 — Requisitos do Sistema.*
