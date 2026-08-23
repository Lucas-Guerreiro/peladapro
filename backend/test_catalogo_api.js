const https = require('https');

async function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'www.thorneios.com.br',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        console.log(`[${method} ${path}] Status: ${res.statusCode}`);
        console.log(`[${method} ${path}] Body: ${raw}`);
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // 1. Login (campo correto é 'cpf' que aceita e-mail ou CPF)
  const login = await request('POST', '/api/auth/login', { cpf: 'lucas.guerreiro.10@gmail.com', senha: '123456' });
  const token = login.body.token;
  if (!token) { console.error('❌ Falha no login:', login.body); return; }
  console.log('✅ Login OK. Token:', token.substring(0, 30) + '...');

  // 2. GET catálogo atual
  await request('GET', '/api/times-catalogo/grupo/7', null, token);

  // 3. POST novo time
  const novo = await request('POST', '/api/times-catalogo/grupo/7', { nome: 'Time Teste Debug Node', cor: '#FF5733' }, token);
  console.log('✅ Cadastro resultado:', novo.body);
}

run().catch(console.error);
