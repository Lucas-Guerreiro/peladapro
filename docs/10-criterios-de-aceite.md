# Pelada Pro — Critérios de Aceite

> Documento 10/12 · Data: 09/09/2026 · Status: ✅ FECHADO
> Objetivo: definir, em linguagem clara, o que significa "funcionou" para cada
> fluxo do sistema novo. É a checklist de aprovação que o organizador usa para
> validar o trabalho do Claude antes de aprovar cada fatia.
> Base: doc 03 (fluxos) + doc 06 (requisitos) + doc 07 (paridade) + raio-x.

---

## 1. Como usar este documento

- Cada critério é um **teste de aprovação**: se passar, o item está pronto.
- Os itens marcados **P0** são obrigatórios (corrigem os bugs do raio-x).
- O organizador valida cada critério antes de liberar a próxima fatia de código.
- Regra: **nenhum critério P0 pode falhar** para o sistema ser aprovado.

---

## 2. Critérios por módulo

### 2.1 Autenticação (AUT)
| # | Critério de aceite | Prioridade |
|---|---|---|
| AUT-01 | Login com e-mail e senha funciona com credenciais válidas | P0 |
| AUT-02 | Cadastro cria conta e permite login em seguida | P0 |
| AUT-03 | **Login com Google funciona** | P0 |
| AUT-04 | **Login com Apple funciona** | P0 |
| AUT-05 | Recuperação de senha **NÃO** mostra o código na resposta da API | P0 |
| AUT-06 | Logout limpa a sessão e volta ao login | P0 |
| AUT-07 | Existe UMA única fonte de identidade (sem auth duplicada) | P0 |

### 2.2 Grupos (GRP)
| # | Critério de aceite | Prioridade |
|---|---|---|
| GRP-01 | Criar grupo gera código de convite | P0 |
| GRP-02 | Entrar no grupo com código de convite funciona | P0 |
| GRP-03 | **Dados de um grupo NÃO aparecem em outro grupo** (isolamento) | P0 |
| GRP-04 | Só o organizador administra o grupo | P0 |
| GRP-05 | Tesoureiro opera apenas o financeiro (não edita jogadores) | P0 |
| GRP-06 | Transferir a gestão do grupo a outro membro funciona | P1 |

### 2.3 Quadras (QUA)
| # | Critério de aceite | Prioridade |
|---|---|---|
| QUA-01 | Cadastrar quadra e reutilizá-la em várias peladas | P1 |
| QUA-02 | Selecionar quadra cadastrada (não texto livre) | P1 |

### 2.4 Peladas (PEL)
| # | Critério de aceite | Prioridade |
|---|---|---|
| PEL-01 | Criar pelada com data, hora, local e valor | P0 |
| PEL-02 | Editar pelada reflete nos dados | P0 |
| PEL-03 | Cancelar pelada notifica os confirmados | P1 |
| PEL-04 | Pelada recorrente gera LEMBRETE, mas NÃO cria pelada automática | P0 |

### 2.5 Presença e Fila (PRE)
| # | Critério de aceite | Prioridade |
|---|---|---|
| PRE-01 | "Vou Jogar" registra a presença | P0 |
| PRE-02 | "Não Vou" registra a ausência | P0 |
| PRE-03 | Excedente vai para a fila de espera | P0 |
| PRE-04 | Desistência promove o 1º da fila **SÓ se ele tiver saldo** | P0 |
| PRE-05 | Cancelamento < 2h do início NÃO reembolsa | P0 |

### 2.6 Sorteio (SOR) — CRÍTICO
| # | Critério de aceite | Prioridade |
|---|---|---|
| SOR-01 | Sorteio automático gera times balanceados | P0 |
| SOR-02 | **Nenhuma dupla repete em 2 sorteios seguidos** (memória de duplas) | P0 |
| SOR-03 | Piso combinatório de repetições respeitado | P0 |
| SOR-04 | Diferença de força entre times ≤ 2 estrelas | P0 |
| SOR-05 | Cada time tem pelo menos 1 goleiro | P0 |
| SOR-06 | **"Limpar Times" apaga local + nuvem e NÃO volta sozinho** | P0 |
| SOR-07 | Sincronização não duplica placar/times (idempotente) | P0 |

### 2.7 Partidas (PAR)
| # | Critério de aceite | Prioridade |
|---|---|---|
| PAR-01 | Registrar placar funciona | P0 |
| PAR-02 | Registrar autor/assistência de gol funciona | P0 |
| PAR-03 | Rateio automático por jogador correto | P1 |
| PAR-04 | Correção de resultado registrada (auditável) | P1 |
| PAR-05 | MVP da partida é destacado | P1 |

### 2.8 Torneios (TOR)
| # | Critério de aceite | Prioridade |
|---|---|---|
| TOR-01 | Fase de grupos gera classificação | P1 |
| TOR-02 | Ida e volta (turno/returno) funcionam | P1 |
| TOR-03 | Mata-mata funciona | P1 |
| TOR-04 | Pontos corridos funcionam | P1 |
| TOR-05 | Tabela mista funciona | P1 |

### 2.9 Financeiro (FIN)
| # | Critério de aceite | Prioridade |
|---|---|---|
| FIN-01 | Lançar crédito/débito funciona | P0 |
| FIN-02 | Saldo por jogador calculado corretamente | P0 |
| FIN-03 | Gerar PIX funciona | P0 |
| FIN-04 | Comprovante PIX é validado (não autodeclaração) | P0 |
| FIN-05 | Estorno é registrado (nunca apaga lançamento) | P0 |
| FIN-06 | Exportar CSV e PDF funcionam (por pelada e período) | P0 |
| FIN-07 | **Jogador vê SÓ a própria situação financeira** | P0 |

### 2.10 Ranking (RAN)
| # | Critério de aceite | Prioridade |
|---|---|---|
| RAN-01 | Artilheiros calculados corretamente | P0 |
| RAN-02 | % de presença correto | P0 |
| RAN-03 | Estatísticas de goleiros corretas | P1 |
| RAN-04 | Ranking visível apenas dentro do grupo | P0 |

### 2.11 Card Premium (PREM)
| # | Critério de aceite | Prioridade |
|---|---|---|
| PREM-01 | Ativar card NÃO crasha no iPhone | P0 |
| PREM-02 | **Card permanece ativo após fechar e reabrir o app** (3 camadas) | P0 |
| PREM-03 | Jogador ativa o card sozinho (self-service) | P0 |
| PREM-04 | Card aparece no perfil do jogador | P0 |
| PREM-05 | Cobrança via Mercado Pago (quando sair do modo teste) | P1 |

### 2.12 Notificações (NOT)
| # | Critério de aceite | Prioridade |
|---|---|---|
| NOT-01 | Push notification é recebido no celular | P0 |
| NOT-02 | Lembrete de pelada (24h antes) chega | P0 |
| NOT-03 | Notificação de cobrança chega | P1 |

---

## 3. Critérios de segurança (SEG) — P0 obrigatórios

| # | Critério de aceite | Prioridade |
|---|---|---|
| SEG-01 | RLS ativo em TODAS as tabelas | P0 |
| SEG-02 | Policies por papel (organizador/tesoureiro/jogador) | P0 |
| SEG-03 | Isolamento por grupo no banco | P0 |
| SEG-04 | Recuperação de senha não expõe código | P0 |
| SEG-05 | CORS restrito a origens permitidas | P0 |
| SEG-06 | Senha do banco em variável de ambiente (nunca no código) | P0 |
| SEG-07 | Chave anônima do Supabase não exposta no app | P0 |
| SEG-08 | Endpoints validam papel antes de expor dados pessoais | P0 |

---

## 4. Critérios de aceite da MIGRAÇÃO (doc 08)

A migração só é aprovada quando:
1. ✅ Backup completo feito e **testado** (restauração funcionou).
2. ✅ Contagem de registros **bate** entre origem e destino (todas as tabelas).
3. ✅ **Totais financeiros batem** (receitas, despesas, saldo por período).
4. ✅ **Login de usuário real funciona** no novo sistema (senha migrada).
5. ✅ **Login com Google e Apple funciona** (Supabase Auth).
6. ✅ **Nenhum dado órfão** crítico (chaves quebradas).
7. ✅ **Fotos/emblemas** carregam corretamente (Storage + URL).
8. ✅ **Notificações push** funcionam após o corte.
9. ✅ Organizador testa uma pelada real e **bate com o antigo**.
10. ✅ Plano de rollback documentado e pronto.
11. ✅ App antigo **preservado** (nada apagado).

---

## 5. Testes P0 que corrigem os bugs do raio-x

| Bug do raio-x | Teste de aceite |
|---|---|
| Times voltam após "Limpar Times" | Limpar → recarregar → segue vazio (SOR-06) |
| Card premium desativa no iPhone | Ativar → fechar app → reabrir → segue ativo (PREM-02) |
| Login social quebrado | Login Google e Apple funcionando (AUT-03/04) |
| Jogador vê financeiro do grupo | Jogador vê só a própria situação (FIN-07) |
| Sorteio sem memória de duplas | Dupla não repete em 2 sorteios (SOR-02) |
| Notificações/MVP inexistentes | Push recebido + MVP destacado (NOT-01, PAR-05) |
| Zero RLS / chave exposta | RLS ativo + segredos fora do código (SEG-01, SEG-07) |

---

## 6. Regra de aprovação

- **Um critério P0 falhando = fatia NÃO aprovada.** O Claude corrige e re-apresenta.
- **Critérios P1** podem ser aprovados com ressalvas, mas devem ser listados como pendências.
- O organizador é a **autoridade final** de aprovação de cada critério.

---

*Fim do doc 10 — Critérios de Aceite.*
