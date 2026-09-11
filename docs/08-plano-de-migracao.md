# Pelada Pro — Plano de Migração de Dados

> Documento 08/12 · Data: 09/09/2026 · Status: ✅ ATUALIZADO
> Objetivo: migrar TODOS os dados do app atual para o novo sistema SEM perder
> nada, com backup, ensaio e rollback. É o documento mais crítico do projeto.
> Fonte: doc 04 (mapa de dados real confirmado) + doc 06 (requisitos MIG) +
> auditoria real do código (raio-x).
> Princípio nº 1: o app antigo permanece NO AR e INTACTO até o novo estar
> validado. Nenhum dado do legado é apagado durante a transição.

---

## 1. Objetivo e princípios

**Objetivo:** transferir usuários, grupos, configurações, jogadores, peladas,
presenças, times, partidas, financeiro e vaquinha do banco atual para o novo
sistema, preservando valores, relações e histórico.

**Princípios inegociáveis:**
1. **Backup primeiro** — nada é feito antes de um backup completo e testado.
2. **App antigo intacto** — continua funcionando até o corte final.
3. **Ensaio antes do corte** — migração testada em ambiente separado.
4. **Reversível** — plano de rollback simples; legado nunca é apagado.
5. **Auditável** — cada etapa gera relatório de conferência.

---

## 2. O que será migrado (inventário de dados)

Baseado no schema REAL confirmado (doc 04):

| Dado | Tabela(s) atual(is) | Migra? |
|---|---|---|
| Usuários/contas | `usuarios` (com senha hash bcrypt) | ✅ Sim |
| Grupos | `grupos` (codigo_convite, gestor_id, escudo_url) | ✅ Sim |
| Regras do grupo | `configs` (jogadores_por_time, qtd_times, etc.) | ✅ Sim |
| Vínculo jogador↔grupo | `usuario_grupo` (ÓRFÃ — 5 linhas) | ⚠️ Parcial — reconstruir vínculo real |
| Peladas | `peladas` (data, hora, valor, local, status, formato) | ✅ Sim |
| Presenças/convocacões | `convocacoes` (status, posicao_fila) | ✅ Sim |
| Times sorteados | `times` + `times_jogadores` | ✅ Sim |
| Partidas finalizadas | `partidas` (placares, autores_gols) | ✅ Sim |
| Financeiro | `transacoes` (tabela única crédito/débito) | ✅ Sim |
| Vaquinha | `arrecadacoes` + `arrecadacao_contribuicoes` | ✅ Sim |
| Emblemas | `emblemas_grupo` | ✅ Sim |
| Fotos/escudos | URL em `usuarios.foto`, `grupos.escudo_url` | ✅ Sim (referências) |
| Tokens de push | `push_subscriptions` | ✅ Sim |
| Comprovantes PIX | `comprovantes_pix` | ✅ Sim |
| Pagamentos MP | `pagamentos_mercado_pago` | ✅ Sim |
| Licenças | `licencas` | ✅ Sim |
| Nomes/cores de times | `nomes_times_grupo` | ✅ Sim |
| **Ranking** | NÃO existe tabela — calculado na hora | ⚠️ Não migra (só o histórico de partidas que o alimenta) |
| **Notificações** | `notificacoes` NÃO existe no banco | ❌ Não há dados — construir do zero |
| **MVP** | `mvp_partida` NÃO existe no banco | ❌ Não há dados — construir do zero |

---

## 3. Decisões de arquitetura que afetam a migração

### 3.1 Estratégia de autenticação — ✅ DECIDIDO: OPÇÃO B (Supabase Auth)

| Opção | O que é | Decisão |
|---|---|---|
| A. Manter JWT próprio | Continua com `usuarios` + bcrypt como hoje | ❌ Não escolhida |
| **B. Migrar para Supabase Auth** | Usa o sistema de login do Supabase | ✅ **ESCOLHIDA** |
| C. Híbrido | JWT para web + Supabase para mobile | ❌ Não escolhida |

**Motivo da escolha:** o login com **Google e Apple** está quebrado no app atual.
A opção B resolve esse login social de forma nativa e simples.

**Impacto na migração:** as contas dos usuários (e-mail + senha hash) precisam
ser migradas para o schema `auth` do Supabase, conforme a seção 6.2.

### 3.2 Armazenamento de fotos — ✅ DECIDIDO: STORAGE + URL

| Opção | O que é | Impacto |
|---|---|---|
| A. Manter URL/base64 em colunas | Como hoje | Migração simples (copia referências) |
| **B. Migrar para Storage do Supabase** | Upload real com RLS | ✅ **ESCOLHIDA** — mais robusto |

**Decisão:** as fotos vão para o **Supabase Storage** (pasta `avatars/`), e o
banco guarda apenas a **URL**. Backup do banco + backup do Storage juntos
garantem que nada se perde.

### 3.3 Gateway de pagamento — ✅ DECIDIDO: MERCADO PAGO

| Opção | O que é | Decisão |
|---|---|---|
| **Mercado Pago** | Gateway já usado no legado (PIX) | ✅ **ESCOLHIDO** |
| Supabase Payments | Alternativa nativa do Supabase | ❌ Não escolhida |

**Motivo da escolha:** o legado já usa Mercado Pago para PIX; a tabela
`pagamentos_mercado_pago` já existe; o organizador já conhece o painel da
plataforma. Usa-se o Mercado Pago para o **Card Premium (PREM-007)** e para os
**pagamentos PIX**.

---

## 4. Plano em 6 passagens (seguro e reversível)

### Passagem 1 — Congelamento lógico (data de corte: 09/09/2026)
- **Data de corte definida: 09/09/2026.**
- A partir dela, **não fazer mudanças estruturais** no banco antigo.
- Registrar: data, responsável e exceções.
- **Saída:** registro do congelamento.

### Passagem 2 — Inventário completo
- Exportar do banco atual:
  - Schema (todas as tabelas, colunas, chaves, enums, sequences);
  - Dados (todas as tabelas);
  - Auth (usuários e senhas hash);
  - Fotos/emblemas (referências URL/base64);
  - Functions, triggers, policies e configurações.
- **Saída:** relatório de origem com contagens por tabela.

### Passagem 3 — Backup (o passo mais importante)
- Fazer **dump/export completo e independente** do banco atual.
- Guardar **fora do ambiente de desenvolvimento** (nuvem + local).
- Registrar: arquivo, checksum (hash), data.
- **Testar a restauração** do backup em um ambiente separado (só é backup de
  verdade se conseguir restaurar).
- **Saída:** backup testado + checksum.

### Passagem 4 — Ensaio (migração de teste)
- Criar o **novo ambiente** (Supabase novo de homologação).
- Aplicar as **migrations versionadas** do schema novo.
- Importar uma **cópia** dos dados (não os originais).
- **Saída:** log reproduzível da migração (sem credenciais no Git).

### Passagem 5 — Reconciliação (conferência)
- Comparar entre origem e destino:
  - Quantidade de registros por tabela;
  - Quantidade de jogadores por pelada;
  - **Soma de receitas e despesas por período;**
  - **Saldos financeiros;**
  - Registros sem pai (chaves órfãs);
  - Duplicados por e-mail/telefone;
  - Amostras escolhidas pelo organizador.
- **Saída:** relatório de reconciliação aprovado OU lista de divergências.

### Passagem 6 — Corte (transição final)
1. Pausar alterações no app antigo (modo somente leitura ou aviso).
2. Repetir o export incremental (só o que mudou desde o ensaio).
3. Importar no novo ambiente de produção.
4. Testar o novo sistema com usuários reais.
5. Trocar o endereço do app para o novo.
6. **Plano de rollback:** se algo der errado, voltar o domínio ao app antigo
   (nenhum dado do legado foi apagado).
7. Só **arquivar/desativar** o app antigo depois de um período de operação
   aprovado + backup final.

---

## 5. Regras por tipo de dado

### 5.1 Usuários e contas (com Supabase Auth)
- Migrar as contas para o schema `auth` do Supabase, **incluindo as senhas com hash**
  (conforme procedimento da seção 6.2).
- Preservar os **IDs antigos** quando possível (evita quebrar relações).
- Se novos IDs forem gerados, criar um **mapa `legacy_id → new_id`** para
  usuários, grupos, peladas, times e lançamentos.
- Detectar e tratar **e-mails/telefones duplicados** antes de importar.
- **Teste obrigatório:** um usuário real consegue fazer login no novo sistema com
  a mesma senha de antes.

### 5.2 Financeiro (transações)
- **Nunca alterar valores** na migração.
- Definir explicitamente: moeda, escala decimal, arredondamento, sinal de
  entradas/saídas e regra para valores nulos.
- Conferir após a carga:
  - Soma de receitas por período;
  - Soma de despesas por período;
  - Saldo final;
  - Registros sem grupo/pelada (órfãos).

### 5.3 Vaquinha
- Migrar `arrecadacoes` + `arrecadacoes_contribuicoes`.
- Conferir que os pagamentos confirmados continuam consolidados em `transacoes`.

### 5.4 Ranking
- **Não há dados de ranking a migrar** (é calculado na hora).
- Migrar apenas o **histórico de partidas finalizadas** (placares + autores de
  gols) que alimenta o ranking.

### 5.5 Fotos e emblemas (Storage + URL)
- Migrar para Storage: baixar cada arquivo, subir no novo bucket, atualizar as
  referências e conferir que cada uma aponta para um arquivo existente.
- O banco guarda apenas a **URL**.

### 5.6 Tokens de push
- Migrar os tokens dos dispositivos para que as notificações continuem
  funcionando após o corte.

---

## 6. Ferramentas e comandos (referência para o Claude)

> ⚠️ IMPORTANTE PARA O ORGANIZADOR: esta seção é **instrução técnica para o Claude
> no Antigravity**. Você NÃO precisa executar nada daqui. O Claude segue esta
> seção ao fazer a migração. Nenhum comando deve rodar em produção sem a sua
> aprovação explícita.

### 6.1 Backup do banco atual (Node.js + PostgreSQL)
```bash
# Dump completo do banco atual (estrutura + dados)
pg_dump -h <HOST_ATUAL> -U <USUARIO> -d <BANCO> -F c -f backup_pelada_pro.dump

# Gerar checksum do backup
sha256sum backup_pelada_pro.dump

# Testar restauração em ambiente separado
pg_restore -h <HOST_TESTE> -U <USUARIO> -d <BANCO_TESTE> backup_pelada_pro.dump
