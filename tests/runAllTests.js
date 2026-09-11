// tests/runAllTests.js
// Test runner central para a suíte de testes de integração do Pelada Pro

const testFiles = [
  './integration/liveMatchAndStandings.integration.test.js',
  './integration/tournamentEngine.integration.test.js'
];

console.log("=================================================================");
console.log(" 🚀 EXECUTANDO SUÍTE COMPLETA DE TESTES DE INTEGRAÇÃO");
console.log("=================================================================\n");

let totalAssertions = 0;
let failedCount = 0;

testFiles.forEach(file => {
  try {
    const runFn = require(file);
    const count = runFn();
    totalAssertions += count;
  } catch (err) {
    console.error(`❌ Erro executando ${file}:`, err.message);
    failedCount++;
  }
});

console.log("\n=================================================================");
if (failedCount === 0) {
  console.log(`✅ SUÍTE COMPLETA PASSOU COM SUCESSO! Total de ${totalAssertions} asserções validadas em ${testFiles.length} arquivos.`);
  process.exit(0);
} else {
  console.error(`❌ SUÍTE FALHOU: ${failedCount} arquivo(s) de teste falharam.`);
  process.exit(1);
}
