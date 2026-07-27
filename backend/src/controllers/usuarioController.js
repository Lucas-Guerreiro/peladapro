const db = require('../config/database');

exports.me = async (req, res) => {
  const usuario_id = req.usuarioId;
  try {
    const { rows } = await db.query(
      'SELECT id, nome, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, apelido, foto, saldo, gols, partidas, avaliacao_media, ativo FROM usuarios WHERE id = $1',
      [usuario_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar perfil do usuário', detail: err.message });
  }
};

exports.atualizarPerfil = async (req, res) => {
  const usuario_id = req.usuarioId;
  const { nome, apelido, whatsapp, foto, goleiro, cpf, data_nascimento, autoavaliacao } = req.body;

  try {
    // Atualização flexível baseada nos campos fornecidos
    const query = `
      UPDATE usuarios 
      SET nome = COALESCE($1, nome),
          apelido = COALESCE($2, apelido),
          whatsapp = COALESCE($3, whatsapp),
          foto = COALESCE($4, foto),
          goleiro = COALESCE($5, goleiro),
          cpf = COALESCE($6, cpf),
          data_nascimento = COALESCE($7, data_nascimento),
          autoavaliacao = COALESCE($8, autoavaliacao)
      WHERE id = $9
      RETURNING id, nome, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, apelido, foto, saldo, gols, partidas, avaliacao_media`;
    
    const { rows } = await db.query(query, [
      nome || null, 
      apelido || null, 
      whatsapp || null, 
      foto || null, 
      goleiro !== undefined ? goleiro : null,
      cpf || null,
      data_nascimento || null,
      autoavaliacao !== undefined ? parseInt(autoavaliacao) : null,
      usuario_id
    ]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ message: 'Perfil atualizado com sucesso!', usuario: rows[0] });
  } catch (err) {
    res.status(400).json({ error: 'Erro ao atualizar perfil', detail: err.message });
  }
};

exports.listarTodos = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, nome, apelido, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, saldo, gols, partidas, avaliacao_media, ativo, verificado FROM usuarios ORDER BY nome ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar usuários', detail: err.message });
  }
};

exports.obterDetalhes = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT id, nome, apelido, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, saldo, gols, partidas, avaliacao_media, ativo, verificado FROM usuarios WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar detalhes do usuário', detail: err.message });
  }
};

exports.aprovarAtleta = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  const { id } = req.params;

  if (gestorTipo !== 'gestor') {
    return res.status(403).json({ error: 'Apenas gestores podem aprovar atletas.' });
  }

  try {
    const { rows } = await db.query(
      'UPDATE usuarios SET verificado = true, ativo = true WHERE id = $1 RETURNING id, nome, email',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Atleta não encontrado.' });
    }

    console.log(`✅ [Gestor] Atleta aprovado com sucesso: ${rows[0].email}`);
    res.json({ message: 'Atleta aprovado com sucesso!', atleta: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao aprovar atleta.', detail: err.message });
  }
};

exports.recusarAtleta = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  const { id } = req.params;

  if (gestorTipo !== 'gestor') {
    return res.status(403).json({ error: 'Apenas gestores podem recusar/deletar atletas.' });
  }

  try {
    // 1. Obter e-mail do atleta
    const { rows } = await db.query('SELECT id, email FROM usuarios WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Atleta não encontrado.' });
    }

    const email = rows[0].email;

    // 2. Deletar localmente no PostgreSQL
    await db.query('DELETE FROM usuarios WHERE id = $1', [id]);

    // 3. Deletar no Supabase Auth usando Admin API
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
        const supaUser = supaUsers.find(u => u.email === email);

        if (supaUser) {
          console.log(`🧹 [Gestor - Supabase Admin] Deletando atleta recusado no Supabase Auth: ${email}`);
          await fetch(`https://xgsdaavryzhqxkwsonkk.supabase.co/auth/v1/admin/users/${supaUser.id}`, {
            method: 'DELETE',
            headers: {
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            }
          });
        }
      }
    } catch (supaErr) {
      console.error('[Gestor - Supabase Recusa] Erro ao deletar no Supabase Auth:', supaErr);
    }

    console.log(`❌ [Gestor] Atleta recusado e removido do sistema: ${email}`);
    res.json({ message: 'Atleta recusado e removido do sistema com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao recusar atleta.', detail: err.message });
  }
};

exports.adicionarGol = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'UPDATE usuarios SET gols = COALESCE(gols, 0) + 1 WHERE id = $1 RETURNING id, nome, gols',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ message: 'Gol adicionado com sucesso!', jogador: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao adicionar gol.', detail: err.message });
  }
};

exports.criarPorGestor = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  if (gestorTipo !== 'gestor') {
    return res.status(403).json({ error: 'Apenas gestores podem cadastrar atletas.' });
  }

  const { nome, apelido, email, cpf, data_nascimento, whatsapp, goleiro, autoavaliacao, foto } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ error: 'Nome e e-mail são campos obrigatórios.' });
  }

  try {
    // 1. Verificar se e-mail já existe
    const { rows: emailCheck } = await db.query('SELECT id FROM usuarios WHERE email = $1', [email.trim().toLowerCase()]);
    if (emailCheck.length > 0) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
    }

    // 2. Verificar se CPF já existe (se fornecido)
    if (cpf && cpf.trim()) {
      const { rows: cpfCheck } = await db.query('SELECT id FROM usuarios WHERE cpf = $1', [cpf.trim()]);
      if (cpfCheck.length > 0) {
        return res.status(400).json({ error: 'Este CPF já está cadastrado no sistema.' });
      }
    }

    // 3. Tenta criar usuário no Supabase Auth para que ele possa logar
    let supaUserId = null;
    try {
      const supaRes = await fetch('https://xgsdaavryzhqxkwsonkk.supabase.co/auth/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: '123456', // Senha padrão para o atleta
          email_confirm: true,
          user_metadata: {
            full_name: nome.trim()
          }
        })
      });

      if (supaRes.ok) {
        const supaData = await supaRes.json();
        supaUserId = supaData.id;
      }
    } catch (supaErr) {
      console.warn('[criarPorGestor] Falha ao registrar atleta no Supabase Auth:', supaErr);
    }

    // 4. Inserir localmente na tabela de usuarios
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('123456', 10);

    const query = `
      INSERT INTO usuarios (nome, email, cpf, data_nascimento, whatsapp, senha_hash, autoavaliacao, tipo, goleiro, saldo, apelido, foto, verificado, ativo, gols, partidas, avaliacao_media)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'jogador', $8, 0.00, $9, $10, true, true, 0, 0, $11)
      RETURNING id, nome, apelido, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, saldo, gols, partidas, avaliacao_media, ativo, verificado`;

    const { rows } = await db.query(query, [
      nome.trim(),
      email.trim().toLowerCase(),
      cpf ? cpf.trim() : null,
      data_nascimento || null,
      whatsapp || null,
      hash,
      autoavaliacao !== undefined ? parseInt(autoavaliacao) : 3,
      !!goleiro,
      apelido ? apelido.trim() : nome.split(' ')[0],
      foto || null,
      autoavaliacao !== undefined ? parseFloat(autoavaliacao) : 3.0
    ]);

    res.status(201).json({ message: 'Atleta cadastrado com sucesso!', usuario: rows[0] });

  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar atleta.', detail: err.message });
  }
};
