const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- Registrar Novo Usuário (Jogador) com Verificação OTP via Supabase Auth ------
exports.registrar = async (req, res) => {
  const { email, senha, nome } = req.body;
  
  if (!email || !senha || !nome) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
  }

  try {
    // 1. Verificar se e-mail já existe na nossa tabela local
    const { rows: emailCheck } = await db.query('SELECT id FROM usuarios WHERE email = $1', [email.trim().toLowerCase()]);
    if (emailCheck.length > 0) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
    }

    // 1.1 Pré-check Admin: Verificar se o usuário existe no Supabase Auth (mesmo se não no banco local)
    // Se existir na nuvem, nós limpamos/deletamos ele via Admin API para permitir um re-cadastro limpo e com novo e-mail
    try {
      const supaAdminRes = await fetch('https://xgsdaavryzhqxkwsonkk.supabase.co/auth/v1/admin/users', {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      if (supaAdminRes.ok) {
        const supaAdminData = await supaAdminRes.json();
        const supaUsers = supaAdminData.users || [];
        const supaUser = supaUsers.find(u => u.email === email.trim().toLowerCase());

        if (supaUser) {
          console.log(`🧹 [Supabase Admin] Deletando usuário órfão no Supabase Auth para permitir re-cadastro limpo: ${email}`);
          await fetch(`https://xgsdaavryzhqxkwsonkk.supabase.co/auth/v1/admin/users/${supaUser.id}`, {
            method: 'DELETE',
            headers: {
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            }
          });
        }
      }
    } catch (adminCheckErr) {
      console.warn('[Supabase Admin Precheck] Falha ao verificar/limpar usuário existente:', adminCheckErr);
    }

    // 2. Chamar o endpoint Admin /users do Supabase Auth para criar usuário já ativo/confirmado de fábrica
    const supaRes = await fetch('https://xgsdaavryzhqxkwsonkk.supabase.co/auth/v1/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: senha,
        email_confirm: true,
        user_metadata: {
          full_name: nome.trim()
        }
      })
    });

    const supaData = await supaRes.json();

    console.log(`👤 [Signup - Supabase Admin Create Response] Status: ${supaRes.status}`);
    console.log(`👤 [Signup - Supabase Admin Create Response] Body:`, JSON.stringify(supaData, null, 2));

    if (!supaRes.ok) {
      return res.status(400).json({ error: supaData.msg || supaData.message || 'Erro ao registrar no Supabase Auth' });
    }

    // 3. Cadastrar usuário localmente no PostgreSQL
    const hash = await bcrypt.hash(senha, 10);
    const query = `
      INSERT INTO usuarios (nome, email, senha_hash, tipo, saldo, gols, partidas, verificado, ativo)
      VALUES ($1, $2, $3, 'jogador', 0.00, 0, 0, false, false) 
      RETURNING id, email, tipo, verificado`;
    
    await db.query(query, [nome.trim(), email.trim().toLowerCase(), hash]);

    res.status(201).json({
      status: 'aprovacao_pendente',
      email: email.trim().toLowerCase(),
      nome: nome.trim(),
      message: 'Cadastro realizado com sucesso! Aguarde a aprovação do gestor para poder logar.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar usuário', detail: err.message });
  }
};

// --- Confirmar Código OTP via Supabase Auth --------------------------------
exports.verificarCodigo = async (req, res) => {
  const { email, codigo } = req.body;

  if (!email || !codigo) {
    return res.status(400).json({ error: 'E-mail e código de verificação são obrigatórios' });
  }

  try {
    // 1. Tentar verificar o código real (token OTP) no Supabase Auth
    const supaVerifyRes = await fetch('https://xgsdaavryzhqxkwsonkk.supabase.co/auth/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY || ''
      },
      body: JSON.stringify({
        type: 'signup',
        email: email.trim().toLowerCase(),
        token: codigo.trim()
      })
    });

    const supaVerifyData = await supaVerifyRes.json();

    if (!supaVerifyRes.ok) {
      return res.status(400).json({ error: supaVerifyData.msg || supaVerifyData.message || 'Código de verificação inválido ou expirado.' });
    }

    // 2. Se confirmado com sucesso no Supabase, ativar o usuário localmente
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email.trim().toLowerCase()]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado localmente' });
    }

    const usuario = rows[0];

    await db.query(
      'UPDATE usuarios SET verificado = true, ativo = true WHERE id = $1',
      [usuario.id]
    );

    // Gerar Token JWT
    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    res.json({
      message: 'E-mail confirmado com sucesso!',
      token,
      usuario: { 
        id: usuario.id, 
        nome: usuario.nome, 
        email: usuario.email,
        cpf: usuario.cpf,
        data_nascimento: usuario.data_nascimento,
        whatsapp: usuario.whatsapp,
        autoavaliacao: usuario.autoavaliacao,
        tipo: usuario.tipo, 
        goleiro: usuario.goleiro,
        apelido: usuario.apelido,
        foto: usuario.foto,
        saldo: parseFloat(usuario.saldo),
        gols: usuario.gols,
        partidas: usuario.partidas,
        avaliacao_media: parseFloat(usuario.avaliacao_media),
        verificado: true
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Erro no servidor ao verificar código', detail: err.message });
  }
};

// --- Login com suporte a contas não verificadas ---------------------------
exports.login = async (req, res) => {
  const { cpf, senha } = req.body; // 'cpf' pode conter e-mail ou CPF

  if (!cpf || !senha) {
    return res.status(400).json({ error: 'Credencial e senha são obrigatórios' });
  }

  try {
    // Busca por E-mail ou por CPF
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1 OR cpf = $1', [cpf.trim().toLowerCase()]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const usuario = rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Senha inválida' });
    }

    console.log(`🔑 [Login Attempt] E-mail/CPF: ${cpf}. Verificado no PostgreSQL local: ${usuario.verificado}`);

    // Se o cadastro está pendente de aprovação do gestor, bloquear o login
    if (!usuario.verificado) {
      console.log(`⚠️ [Login Attempt - Blocked] Usuário pendente de aprovação do gestor: ${usuario.email}`);
      return res.json({ 
        status: 'aprovacao_pendente', 
        email: usuario.email,
        nome: usuario.nome,
        message: 'Seu cadastro está pendente de aprovação pelo gestor. Por favor, aguarde a liberação do seu acesso!'
      });
    }

    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    res.json({ 
      token, 
      usuario: { 
        id: usuario.id, 
        nome: usuario.nome, 
        email: usuario.email,
        cpf: usuario.cpf,
        data_nascimento: usuario.data_nascimento,
        whatsapp: usuario.whatsapp,
        autoavaliacao: usuario.autoavaliacao,
        tipo: usuario.tipo, 
        goleiro: usuario.goleiro,
        apelido: usuario.apelido,
        foto: usuario.foto,
        saldo: parseFloat(usuario.saldo),
        gols: usuario.gols,
        partidas: usuario.partidas,
        avaliacao_media: parseFloat(usuario.avaliacao_media),
        verificado: true
      } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro no servidor', detail: err.message });
  }
};

// --- Login / Cadastro Dinâmico Real via Google (Supabase JWT Validation) -----
exports.googleSupabase = async (req, res) => {
  const { access_token } = req.body;

  if (!access_token) {
    return res.status(400).json({ error: 'Token de acesso do Google ausente' });
  }

  try {
    // 1. Validar o access_token diretamente com a API do Supabase Auth na nuvem
    const supaRes = await fetch('https://xgsdaavryzhqxkwsonkk.supabase.co/auth/v1/user', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'apikey': process.env.SUPABASE_ANON_KEY || ''
      }
    });

    const supaData = await supaRes.json();
    if (!supaRes.ok) {
      return res.status(401).json({ error: 'Sessão do Google inválida ou expirada.', detail: supaData.msg });
    }

    const email = supaData.email;
    const nome = supaData.user_metadata?.full_name || email.split('@')[0];

    // 2. Buscar ou criar o usuário correspondente no nosso banco PostgreSQL
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [email.trim().toLowerCase()]);
    let usuario;

    if (rows.length === 0) {
      // Registrar novo atleta vindo do Google como pendente de aprovação do gestor (ativo/verificado = false)
      const queryInsert = `
        INSERT INTO usuarios (nome, email, tipo, saldo, gols, partidas, verificado, ativo, senha_hash)
        VALUES ($1, $2, 'jogador', 0.00, 0, 0, false, false, 'google_oauth_provider')
        RETURNING *`;
      const insertRes = await db.query(queryInsert, [nome, email.trim().toLowerCase()]);
      usuario = insertRes.rows[0];
      console.log(`🌱 [Google SignUp] Novo jogador pendente cadastrado via Google OAuth: ${email}`);
    } else {
      usuario = rows[0];
      console.log(`🔑 [Google SignIn] Jogador tentando autenticar via Google OAuth: ${email}`);
    }

    // Se a conta está pendente de aprovação do gestor
    if (!usuario.verificado || !usuario.ativo) {
      console.log(`⚠️ [Google Auth Blocked] Usuário pendente de aprovação do gestor: ${usuario.email}`);
      return res.json({
        status: 'aprovacao_pendente',
        email: usuario.email,
        nome: usuario.nome,
        message: 'Seu cadastro via Google foi realizado com sucesso! Aguarde a aprovação do gestor para poder acessar o sistema.'
      });
    }

    // 3. Gerar o JWT do Express para nossa sessão local
    const token = jwt.sign(
      { id: usuario.id, tipo: usuario.tipo }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Autenticado com sucesso pelo Google!',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
        data_nascimento: usuario.data_nascimento,
        whatsapp: usuario.whatsapp,
        autoavaliacao: usuario.autoavaliacao,
        tipo: usuario.tipo,
        goleiro: usuario.goleiro,
        apelido: usuario.apelido,
        foto: usuario.foto,
        saldo: parseFloat(usuario.saldo || 0),
        gols: usuario.gols || 0,
        partidas: usuario.partidas || 0,
        avaliacao_media: parseFloat(usuario.avaliacao_media || 0),
        verificado: true
      }
    });

  } catch (err) {
    console.error('❌ Erro no login do Google:', err);
    res.status(500).json({ error: 'Erro interno ao autenticar com Google', detail: err.message });
  }
};
