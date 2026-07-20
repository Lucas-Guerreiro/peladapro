// npm install @supabase/supabase-js

/**
 * testar-supabase.js
 * Script standalone para testar a conexão com o Supabase.
 * Executar com: node testar-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Credenciais do Supabase
// ---------------------------------------------------------------------------
const SUPABASE_URL = 'https://ktppxvhxtpuoikcephsy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Br3p7pqTGri1GQ-GS9KbkA_dMrSOUtg';

// ---------------------------------------------------------------------------
// Cabeçalho colorido
// ---------------------------------------------------------------------------
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function printTitle() {
  console.log(`${CYAN}${BOLD}`);
  console.log('============================================');
  console.log('       CONEXÃO SUPABASE - TESTE             ');
  console.log('============================================');
  console.log(`${RESET}`);
  console.log(`${YELLOW}URL:${RESET} ${SUPABASE_URL}`);
  console.log(`${YELLOW}ANON KEY:${RESET} ${SUPABASE_ANON_KEY}`);
  console.log('--------------------------------------------\n');
}

function printFooter() {
  console.log('\n--------------------------------------------');
  console.log(`${CYAN}${BOLD}Fim do teste.${RESET}`);
}

// ---------------------------------------------------------------------------
// Cria o cliente Supabase
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// ---------------------------------------------------------------------------
// Utilitários de impressão
// ---------------------------------------------------------------------------
function printSuccess(message) {
  console.log(`${GREEN}✅ ${message}${RESET}`);
}

function printFailure(message) {
  console.log(`${RED}❌ ${message}${RESET}`);
}

function printInfo(message) {
  console.log(`${YELLOW}ℹ️  ${message}${RESET}`);
}

function printData(data) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    console.log('   (nenhum dado retornado)');
    return;
  }
  console.log('   Dados retornados:');
  console.log('   ' + JSON.stringify(data, null, 2).replace(/\n/g, '\n   '));
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

/** Teste 1: Buscar linhas da tabela 'conquistas' (limite 3) */
async function testarConquistas() {
  console.log(`${BOLD}[Teste 1] Tabela 'conquistas' (limite 3)${RESET}`);
  try {
    const { data, error, count } = await supabase
      .from('conquistas')
      .select('*', { count: 'exact' })
      .limit(3);

    if (error) {
      printFailure(`Falha ao consultar 'conquistas': ${error.message}`);
      if (error.details) printInfo(`Detalhes: ${error.details}`);
      if (error.hint) printInfo(`Dica: ${error.hint}`);
      return;
    }

    const totalRegistros = count !== null ? count : data.length;
    printSuccess(`Consulta à tabela 'conquistas' realizada com sucesso!`);
    printInfo(`Total de registros encontrados: ${totalRegistros}`);
    printInfo(`Registros retornados nesta consulta: ${data.length}`);
    printData(data);
  } catch (err) {
    printFailure(`Erro inesperado em 'conquistas': ${err.message}`);
  }
  console.log('');
}

/** Teste 2: Buscar linhas da tabela 'grupos' (limite 3) */
async function testarGrupos() {
  console.log(`${BOLD}[Teste 2] Tabela 'grupos' (limite 3)${RESET}`);
  try {
    const { data, error, count } = await supabase
      .from('grupos')
      .select('*', { count: 'exact' })
      .limit(3);

    if (error) {
      printFailure(`Falha ao consultar 'grupos': ${error.message}`);
      if (error.details) printInfo(`Detalhes: ${error.details}`);
      if (error.hint) printInfo(`Dica: ${error.hint}`);
      return;
    }

    const totalRegistros = count !== null ? count : data.length;
    printSuccess(`Consulta à tabela 'grupos' realizada com sucesso!`);
    printInfo(`Total de registros encontrados: ${totalRegistros}`);
    printInfo(`Registros retornados nesta consulta: ${data.length}`);
    printData(data);
  } catch (err) {
    printFailure(`Erro inesperado em 'grupos': ${err.message}`);
  }
  console.log('');
}

/**
 * Teste 3: Verificar o endpoint de auth (signup).
 * Para NÃO criar um usuário de verdade, enviamos um e-mail inválido.
 * O Supabase responde com um erro de validação, o que prova que o
 * endpoint de auth está acessível e respondendo, sem persistir nada.
 */
async function testarAuthSignup() {
  console.log(`${BOLD}[Teste 3] Endpoint de Auth/Signup (verificação de resposta)${RESET}`);
  try {
    const { data, error } = await supabase.auth.signUp({
      email: 'invalido-teste-conexao@exemplo-invalido',
      password: 'senha-teste-nao-usada-123!',
    });

    // Se houve erro de validação (ex.: e-mail inválido), o endpoint respondeu.
    if (error) {
      // Erros esperados: validação de e-mail, rate limit, etc.
      // Qualquer resposta (mesmo de erro) indica que o endpoint está acessível.
      if (
        error.message &&
        (error.message.toLowerCase().includes('email') ||
          error.message.toLowerCase().includes('invalid') ||
          error.message.toLowerCase().includes('rate') ||
          error.message.toLowerCase().includes('password') ||
          error.message.toLowerCase().includes('validation'))
      ) {
        printSuccess('Endpoint de auth/signup respondeu corretamente (validação rejeitada).');
        printInfo(`Resposta do endpoint: ${error.message}`);
      } else {
        // Outro tipo de erro - ainda assim o endpoint respondeu.
        printSuccess('Endpoint de auth/signup respondeu (com aviso).');
        printInfo(`Mensagem: ${error.message}`);
      }
      return;
    }

    // Caso extremamente improvável em que o cadastro aconteceu.
    if (data && (data.user || data.session)) {
      printSuccess('Endpoint de auth/signup respondeu.');
      printInfo('Aviso: um usuário pode ter sido criado com dados inválidos.');
    } else {
      printSuccess('Endpoint de auth/signup respondeu sem erros.');
    }
  } catch (err) {
    printFailure(`Erro ao acessar o endpoint de auth/signup: ${err.message}`);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// Execução principal
// ---------------------------------------------------------------------------
async function main() {
  printTitle();

  await testarConquistas();
  await testarGrupos();
  await testarAuthSignup();

  printFooter();
}

main().catch((err) => {
  printFailure(`Erro fatal na execução do script: ${err.message}`);
  process.exit(1);
});