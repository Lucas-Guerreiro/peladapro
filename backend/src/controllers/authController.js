const db = require('../config/database');
const bcrypt = require('bcryptjs');
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

    // Notifica todos os gestores por push sobre o novo cadastro pendente
    try {
      const { sendNotificationInternal } = require('./pushController');
      sendNotificationInternal({
        title: '👤 Novo Atleta Pendente!',
        body: `${nome.trim()} se cadastrou e aguarda aprovação para acessar o app.`,
        url: '/#/gestor/atletas',
        onlyGestores: true
      }).catch(e => console.warn('[Push] Erro ao disparar push de novo cadastro para gestores:', e.message));
    } catch (e) { }

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
        verificado: true,
        time_coracao: usuario.time_coracao
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

    let tipoFinal = usuario.tipo;
    if (rows.length > 1) {
      const temGestor = rows.some(r => r.tipo === 'gestor');
      const temJogador = rows.some(r => r.tipo === 'jogador');
      if (temGestor && temJogador) tipoFinal = 'ambos';
    }

    const token = jwt.sign(
      { id: usuario.id, usuario_id: usuario.id, email: usuario.email, tipo: tipoFinal },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
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
        tipo: tipoFinal,
        goleiro: usuario.goleiro,
        apelido: usuario.apelido,
        foto: usuario.foto,
        saldo: parseFloat(usuario.saldo || 0),
        gols: usuario.gols,
        partidas: usuario.partidas,
        avaliacao_media: parseFloat(usuario.avaliacao_media || 0),
        verificado: true,
        time_coracao: usuario.time_coracao,
        vip: usuario.vip === true,
        premium: usuario.premium === true,
        card_ultimate: usuario.card_ultimate === true,
        plano: usuario.plano || 'gratis'
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

    // Se a conta está pendente de aprovação do gestor e o cadastro já foi completado
    const cadastroIncompleto = !usuario.nome || !usuario.cpf || !usuario.data_nascimento;

    if (!cadastroIncompleto && (!usuario.verificado || !usuario.ativo)) {
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
        verificado: true,
        time_coracao: usuario.time_coracao
      }
    });

  } catch (err) {
    console.error('❌ Erro no login do Google:', err);
    res.status(500).json({ error: 'Erro interno ao autenticar com Google', detail: err.message });
  }
};

// --- GET /api/auth/verify — Validar token de sessão (30d) e retornar dados do usuário ---
exports.verify = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ valid: false, error: 'Token de autenticação não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.usuario_id;

    if (!userId) {
      return res.status(401).json({ valid: false, error: 'Payload do token inválido.' });
    }

    const { rows } = await db.query('SELECT * FROM usuarios WHERE id = $1', [userId]);
    if (rows.length === 0) {
      return res.status(401).json({ valid: false, error: 'Usuário não encontrado.' });
    }

    const usuario = rows[0];

    if (!usuario.verificado) {
      return res.status(401).json({ valid: false, error: 'Usuário pendente de aprovação.' });
    }

    let tipoFinal = usuario.tipo;

    res.json({
      valid: true,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
        data_nascimento: usuario.data_nascimento,
        whatsapp: usuario.whatsapp,
        autoavaliacao: usuario.autoavaliacao,
        tipo: tipoFinal,
        goleiro: usuario.goleiro,
        apelido: usuario.apelido,
        foto: usuario.foto,
        saldo: parseFloat(usuario.saldo || 0),
        gols: usuario.gols,
        partidas: usuario.partidas,
        avaliacao_media: parseFloat(usuario.avaliacao_media || 0),
        verificado: true,
        time_coracao: usuario.time_coracao
      }
    });
  } catch (err) {
    return res.status(401).json({ valid: false, error: 'Sessão expirada ou token inválido.' });
  }
};

// --- POST /api/auth/recuperar-senha — Gerar código de 6 dígitos ---
exports.recuperarSenha = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Informe o e-mail cadastrado.' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [String(email).toLowerCase().trim()]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'E-mail não encontrado. Verifique e tente novamente.' });
    }

    const usuario = rows[0];
    const codigo = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
    const expiraEm = new Date(Date.now() + 15 * 60 * 1000); // válido por 15 minutos

    await db.query(
      'UPDATE usuarios SET recuperacao_codigo = $1, recuperacao_expira = $2 WHERE id = $3',
      [codigo, expiraEm, usuario.id]
    );

    // Retorna o código para o gestor repassar ao atleta
    res.json({
      success: true,
      message: 'Código gerado com sucesso. Repasse ao atleta.',
      codigo: codigo,
      expiraEm: expiraEm
    });
  } catch (err) {
    console.error('[RECUPERAR SENHA] Erro:', err);
    return res.status(500).json({ error: 'Erro ao gerar código de recuperação.' });
  }
};

// --- POST /api/auth/redefinir-senha — Validar código e definir nova senha ---
exports.redefinirSenha = async (req, res) => {
  const { email, codigo, novaSenha } = req.body;

  if (!email || !codigo || !novaSenha) {
    return res.status(400).json({ error: 'Informe e-mail, código e nova senha.' });
  }

  if (String(novaSenha).length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM usuarios WHERE email = $1', [String(email).toLowerCase().trim()]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'E-mail não encontrado.' });
    }

    const usuario = rows[0];

    if (!usuario.recuperacao_codigo || usuario.recuperacao_codigo !== String(codigo).trim()) {
      return res.status(400).json({ error: 'Código inválido. Verifique e tente novamente.' });
    }

    if (!usuario.recuperacao_expira || new Date(usuario.recuperacao_expira) < new Date()) {
      return res.status(400).json({ error: 'Código expirado. Solicite um novo código.' });
    }

    const senhaHash = await bcrypt.hash(String(novaSenha), 10);

    await db.query(
      'UPDATE usuarios SET senha_hash = $1, recuperacao_codigo = NULL, recuperacao_expira = NULL WHERE id = $2',
      [senhaHash, usuario.id]
    );

    res.json({ success: true, message: 'Senha redefinida com sucesso! Faça login.' });
  } catch (err) {
    console.error('[REDEFINIR SENHA] Erro:', err);
    return res.status(500).json({ error: 'Erro ao redefinir a senha.' });
  }
};