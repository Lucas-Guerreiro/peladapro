# PeladaPro Backend

API RESTful em Node.js com Express para gerenciamento de peladas amadoras, integrada ao PostgreSQL / Supabase.

## Recursos Implementados

1. **Snake Draft (Sorteador)**: Distribuição serpentina balanceando goleiros e jogadores de linha com limite técnico de variação de média de estrelas <= 0.5.
2. **Regra das 2 Horas**: Bloqueio automático de reembolso financeiro para cancelamento de presenças de última hora (dentro de 2 horas antes do início).
3. **Controle Financeiro**: Integração entre presenças, estornos e transações direto no banco relacional PostgreSQL com limites de saldo negativo configuráveis por grupo.
4. **Perfil do Jogador Avançado**: Cadastro e edição com suporte a Apelido e Foto de perfil customizada (armazenamento Base64).
5. **Autenticação Segura**: Senhas criptografadas via `bcrypt` e proteção de endpoints utilizando tokens `JWT` (Bearer Token).
6. **Mecanismo de Seed**: Endpoint dedicado `/api/seed` para preencher tabelas automaticamente com massa de dados de teste (7 atletas, grupo de exemplo, pelada agendada e transações).

## Instalação e Execução

### Requisitos
- Node.js (v16 ou superior)
- PostgreSQL ou conta no Supabase

### Passos
1. Entre na pasta `backend`:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` com sua URL de banco:
   ```env
   DATABASE_URL=postgres://usuario:senha@host:porta/banco
   JWT_SECRET=sua_chave_secreta
   ```
4. Se estiver iniciando um banco de dados novo, execute o script SQL contido no arquivo `database.sql` no console do seu banco (ou na aba SQL Editor do painel do Supabase).
5. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
6. Popule o banco executando um POST vazio na rota de seed:
   ```bash
   curl -X POST http://localhost:3000/api/seed
   ```

## Endpoints Principais

| Método | Rota | Descrição | Protegido? |
|---|---|---|---|
| **POST** | `/api/auth/registrar` | Cadastra um novo jogador no sistema | Não |
| **POST** | `/api/auth/login` | Realiza login e gera o Token JWT | Não |
| **GET** | `/api/usuarios/me` | Retorna o perfil do usuário logado | Sim |
| **PUT** | `/api/usuarios/profile` | Atualiza apelido, foto, whatsapp do usuário | Sim |
| **POST** | `/api/convocacoes/confirmar` | Confirma presença na pelada (débito ou PIX) | Sim |
| **POST** | `/api/convocacoes/remover` | Cancela presença aplicando a regra de 2h/estorno | Sim |
| **GET** | `/api/formacao/sortear/:peladaId` | Roda algoritmo de sorteio Snake Draft e persiste | Sim |
| **POST** | `/api/seed` | Popula o banco com massa de dados de teste | Não |

---
Documento elaborado em 18 de julho de 2026.
