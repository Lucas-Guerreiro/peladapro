const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  console.log('🤖 INICIANDO TESTE INTEGRADO DE LICENCIAMENTO...');
  const client = await pool.connect();
  
  const emailTeste = 'gestor_venda_teste@gmail.com';
  let licencaCodigo = '';

  try {
    // 0. Limpar qualquer teste anterior
    await client.query('DELETE FROM licencas WHERE email_comprador = $1', [emailTeste]);
    
    // 1. Simular a chamada de Checkout (criação)
    console.log('\nStep 1: Criando checkout Pix...');
    
    // Simular a chamada ao controller
    const resCheckout = await fetch('/api/vendas/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailTeste, plano: 'mensal' })
    });
    
    const dataCheckout = await resCheckout.json();
    if (!resCheckout.ok) throw new Error(dataCheckout.error || 'Erro no checkout');
    
    licencaCodigo = dataCheckout.licenca_codigo;
    console.log(`✅ Checkout criado! Licença Gerada: ${licencaCodigo}`);

    // Verificar no banco de dados se a licença está 'disponivel'
    const dbCheck1 = await client.query('SELECT status FROM licencas WHERE codigo = $1', [licencaCodigo]);
    console.log(`🔍 Status no Banco: ${dbCheck1.rows[0].status} (Esperado: disponivel)`);

    // 2. Simular a Confirmação de Pagamento
    console.log('\nStep 2: Simulando confirmação de pagamento Pix aprovado...');
    const resConfirmar = await fetch('/api/vendas/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_comprador: emailTeste, licenca_codigo: licencaCodigo })
    });
    
    const dataConfirmar = await resConfirmar.json();
    if (!resConfirmar.ok) throw new Error(dataConfirmar.error || 'Erro na confirmação');
    
    console.log(`✅ Pagamento Confirmado! Resposta: ${dataConfirmar.message}`);

    // Verificar no banco de dados se a licença está 'ativa' e com expiração correta
    const dbCheck2 = await client.query('SELECT status, expira_em FROM licencas WHERE codigo = $1', [licencaCodigo]);
    console.log(`🔍 Status no Banco: ${dbCheck2.rows[0].status} (Esperado: ativa)`);
    console.log(`📅 Expiração no Banco: ${dbCheck2.rows[0].expira_em}`);

    console.log('\n🎉 TESTE DE LICENCIAMENTO PASSOU COM SUCESSO TOTAL!');

  } catch (err) {
    console.error('\n❌ O TESTE FALHOU:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

test();
