const db = require('../config/database');

// Migration automática para garantir colunas VIP/Ultimate na tabela usuarios
(async () => {
  try {
    await db.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS vip BOOLEAN DEFAULT FALSE");
    await db.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE");
    await db.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS card_ultimate BOOLEAN DEFAULT FALSE");
    await db.query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS plano VARCHAR(50) DEFAULT 'gratis'");
  } catch (e) {
    console.warn('[DB Migration] Notice on usuarios columns:', e.message);
  }
})();

exports.me = async (req, res) => {
  const usuario_id = req.usuarioId;
  try {
    const { rows } = await db.query(
      'SELECT id, nome, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, apelido, foto, saldo, gols, partidas, avaliacao_media, ativo, time_coracao, vip, premium, card_ultimate, plano FROM usuarios WHERE id = $1',
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
  const { nome, apelido, email, senha, whatsapp, foto, goleiro, cpf, data_nascimento, autoavaliacao, time_coracao, vip, premium, card_ultimate, plano } = req.body;

  try {
    const bcrypt = require('bcryptjs');

    // 1. Obter usuário atual
    const { rows: userCheck } = await db.query('SELECT id, email, senha_hash FROM usuarios WHERE id = $1', [usuario_id]);
    if (userCheck.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // 2. Se e-mail foi alterado, verificar unicidade
    if (email && email.trim().toLowerCase() !== userCheck[0].email.toLowerCase()) {
      const { rows: emailCheck } = await db.query(
        'SELECT id FROM usuarios WHERE LOWER(email) = $1 AND id <> $2',
        [email.trim().toLowerCase(), usuario_id]
      );
      if (emailCheck.length > 0) {
        return res.status(400).json({ error: 'Este e-mail já está sendo utilizado por outro usuário.' });
      }
    }

    // 2.5. Se CPF foi informado, verificar unicidade
    if (cpf && cpf.trim()) {
      const { rows: cpfCheck } = await db.query(
        'SELECT id FROM usuarios WHERE cpf = $1 AND id <> $2',
        [cpf.trim(), usuario_id]
      );
      if (cpfCheck.length > 0) {
        return res.status(400).json({ error: 'Este CPF já está cadastrado para outro usuário.' });
      }
    }

    // 3. Tratar senha se informada
    let newHash = null;
    if (senha && senha.trim()) {
      if (senha.trim().length < 6) {
        return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
      }
      newHash = await bcrypt.hash(senha.trim(), 10);
    }

    // 4. Executar UPDATE flexível com persistência de colunas VIP/Ultimate
    const query = `
      UPDATE usuarios 
      SET nome = COALESCE($1, nome),
          apelido = COALESCE($2, apelido),
          email = COALESCE($3, email),
          senha_hash = COALESCE($4, senha_hash),
          whatsapp = COALESCE($5, whatsapp),
          foto = COALESCE($6, foto),
          goleiro = COALESCE($7, goleiro),
          cpf = COALESCE($8, cpf),
          data_nascimento = COALESCE($9, data_nascimento),
          autoavaliacao = COALESCE($10, autoavaliacao),
          time_coracao = COALESCE($11, time_coracao),
          vip = COALESCE($12, vip),
          premium = COALESCE($13, premium),
          card_ultimate = COALESCE($14, card_ultimate),
          plano = COALESCE($15, plano)
      WHERE id = $16
      RETURNING id, nome, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, apelido, foto, saldo, gols, partidas, avaliacao_media, time_coracao, vip, premium, card_ultimate, plano`;
    
    const { rows } = await db.query(query, [
      nome ? nome.trim() : null, 
      apelido ? apelido.trim() : null, 
      email ? email.trim().toLowerCase() : null,
      newHash,
      whatsapp ? whatsapp.trim() : null, 
      foto || null, 
      goleiro !== undefined ? !!goleiro : null,
      cpf ? cpf.trim() : null,
      data_nascimento || null,
      autoavaliacao !== undefined && parseInt(autoavaliacao) >= 1 && parseInt(autoavaliacao) <= 5 ? parseInt(autoavaliacao) : null,
      time_coracao !== undefined ? (time_coracao ? time_coracao.trim() : null) : null,
      vip !== undefined ? !!vip : null,
      premium !== undefined ? !!premium : null,
      card_ultimate !== undefined ? !!card_ultimate : null,
      plano !== undefined ? plano : null,
      usuario_id
    ]);

    res.json({ message: 'Perfil atualizado com sucesso!', usuario: rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    res.status(400).json({ error: 'Erro ao atualizar perfil', detail: err.message });
  }
};

exports.listarTodos = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, nome, apelido, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, foto, saldo, gols, partidas, avaliacao_media, ativo, verificado, time_coracao, vip, premium, card_ultimate, plano FROM usuarios ORDER BY nome ASC'
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
      'SELECT id, nome, apelido, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, foto, saldo, gols, partidas, avaliacao_media, ativo, verificado, time_coracao, vip, premium, card_ultimate, plano FROM usuarios WHERE id = $1',
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
  const { tipo } = req.body || {};
  const tipoFinal = (tipo === 'convidado') ? 'convidado' : 'jogador';

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem aprovar atletas.' });
  }

  try {
    const { rows } = await db.query(
      'UPDATE usuarios SET verificado = true, ativo = true, tipo = $2 WHERE id = $1 RETURNING id, nome, email, tipo',
      [id, tipoFinal]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Atleta não encontrado.' });
    }

    const tipoLabel = tipoFinal === 'convidado' ? 'Convidado' : 'Atleta da Pelada';
    console.log(`✅ [Gestor] Cadastro aprovado como ${tipoLabel}: ${rows[0].email}`);

    // Notifica o atleta que o cadastro dele foi aprovado
    try {
      const { sendNotificationInternal } = require('./pushController');
      sendNotificationInternal({
        title: '🎉 Cadastro Aprovado!',
        body: `Seu acesso ao PeladaPro foi aprovado pelo gestor como ${tipoLabel}. Entre no app para conferir!`,
        url: '/#/login',
        usuarioId: id
      }).catch(e => console.warn('[Push] Erro ao disparar push de aprovacao para o atleta:', e.message));
    } catch(e) {}

    res.json({ message: `Cadastro aprovado com sucesso como ${tipoLabel}!`, atleta: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao aprovar atleta.', detail: err.message });
  }
};

exports.recusarAtleta = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  const { id } = req.params;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
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
  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem cadastrar atletas.' });
  }

  const { nome, apelido, email, cpf, data_nascimento, whatsapp, goleiro, autoavaliacao, foto, time_coracao, tipo } = req.body;
  const tipoFinal = (tipo === 'convidado') ? 'convidado' : 'jogador';

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
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('123456', 10);

    const query = `
      INSERT INTO usuarios (nome, email, cpf, data_nascimento, whatsapp, senha_hash, autoavaliacao, tipo, goleiro, saldo, apelido, foto, verificado, ativo, gols, partidas, avaliacao_media, time_coracao)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0.00, $10, $11, true, true, 0, 0, $12, $13)
      RETURNING id, nome, apelido, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, saldo, gols, partidas, avaliacao_media, ativo, verificado, time_coracao`;

    const { rows } = await db.query(query, [
      nome.trim(),
      email.trim().toLowerCase(),
      cpf ? cpf.trim() : null,
      data_nascimento || null,
      whatsapp || null,
      hash,
      autoavaliacao !== undefined ? parseInt(autoavaliacao) : 3,
      tipoFinal,
      !!goleiro,
      apelido ? apelido.trim() : nome.split(' ')[0],
      foto || null,
      autoavaliacao !== undefined ? parseFloat(autoavaliacao) : 3.0,
      time_coracao ? time_coracao.trim() : null
    ]);

    res.status(201).json({ message: 'Atleta cadastrado com sucesso!', usuario: rows[0] });

  } catch (err) {
    res.status(500).json({ error: 'Erro ao cadastrar atleta.', detail: err.message });
  }
};

exports.atualizarPorGestor = async (req, res) => {
  const gestorTipo = req.usuarioTipo;
  const { id } = req.params;

  if (gestorTipo !== 'gestor' && gestorTipo !== 'ambos') {
    return res.status(403).json({ error: 'Apenas gestores podem atualizar outros atletas.' });
  }

  const { nome, apelido, email, senha, cpf, data_nascimento, whatsapp, goleiro, autoavaliacao, foto, time_coracao, vip, premium, card_ultimate, plano, tipo } = req.body;

  try {
    const bcrypt = require('bcryptjs');

    // 1. Verificar se o atleta existe
    const { rows: userCheck } = await db.query('SELECT id, email, nome FROM usuarios WHERE id = $1', [id]);
    if (userCheck.length === 0) {
      return res.status(404).json({ error: 'Atleta não encontrado.' });
    }

    const nomeFinal = nome ? nome.trim() : userCheck[0].nome;

    // 2. Verificar unicidade de e-mail se foi alterado
    if (email && email.trim().toLowerCase() !== userCheck[0].email.toLowerCase()) {
      const { rows: emailCheck } = await db.query(
        'SELECT id FROM usuarios WHERE LOWER(email) = $1 AND id <> $2',
        [email.trim().toLowerCase(), id]
      );
      if (emailCheck.length > 0) {
        return res.status(400).json({ error: 'Este e-mail já está sendo utilizado por outro usuário.' });
      }
    }

    // 3. Verificar se CPF já existe em outro usuário (se fornecido)
    if (cpf && cpf.trim()) {
      const { rows: cpfCheck } = await db.query('SELECT id FROM usuarios WHERE cpf = $1 AND id <> $2', [cpf.trim(), id]);
      if (cpfCheck.length > 0) {
        return res.status(400).json({ error: 'Este CPF já está cadastrado em outro atleta.' });
      }
    }

    // 4. Tratar atualização de senha (se informada)
    let newHash = null;
    if (senha && senha.trim()) {
      if (senha.trim().length < 6) {
        return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
      }
      newHash = await bcrypt.hash(senha.trim(), 10);
    }

    // 5. Atualizar no banco PostgreSQL
    const query = `
      UPDATE usuarios 
      SET nome = COALESCE($1, nome),
          apelido = COALESCE($2, apelido),
          cpf = COALESCE($3, cpf),
          data_nascimento = COALESCE($4, data_nascimento),
          whatsapp = COALESCE($5, whatsapp),
          goleiro = COALESCE($6, goleiro),
          autoavaliacao = COALESCE($7, autoavaliacao),
          foto = COALESCE($8, foto),
          avaliacao_media = COALESCE($9, avaliacao_media),
          email = COALESCE($10, email),
          senha_hash = COALESCE($11, senha_hash),
          time_coracao = COALESCE($12, time_coracao),
          vip = COALESCE($13, vip),
          premium = COALESCE($14, premium),
          card_ultimate = COALESCE($15, card_ultimate),
          plano = COALESCE($16, plano),
          tipo = COALESCE($17, tipo)
      WHERE id = $18
      RETURNING id, nome, apelido, email, cpf, data_nascimento, whatsapp, autoavaliacao, tipo, goleiro, saldo, gols, partidas, avaliacao_media, ativo, verificado, time_coracao, vip, premium, card_ultimate, plano`;

    const { rows } = await db.query(query, [
      nomeFinal,
      apelido ? apelido.trim() : null,
      cpf ? cpf.trim() : null,
      data_nascimento || null,
      whatsapp || null,
      goleiro !== undefined ? !!goleiro : null,
      autoavaliacao !== undefined && parseInt(autoavaliacao) >= 1 && parseInt(autoavaliacao) <= 5 ? parseInt(autoavaliacao) : null,
      foto || null,
      autoavaliacao !== undefined && parseFloat(autoavaliacao) >= 1 && parseFloat(autoavaliacao) <= 5 ? parseFloat(autoavaliacao) : null,
      email ? email.trim().toLowerCase() : null,
      newHash,
      time_coracao ? time_coracao.trim() : null,
      vip !== undefined ? !!vip : null,
      premium !== undefined ? !!premium : null,
      card_ultimate !== undefined ? !!card_ultimate : null,
      plano !== undefined ? plano : null,
      tipo !== undefined && (tipo === 'jogador' || tipo === 'convidado') ? tipo : null,
      id
    ]);

    res.json({ message: 'Atleta atualizado com sucesso!', usuario: rows[0] });

  } catch (err) {
    console.error('Erro ao atualizar atleta por gestor:', err);
    res.status(500).json({ error: 'Erro ao atualizar atleta.', detail: err.message });
  }
};

// Transferir estatísticas e histórico de um Convidado para um Atleta Cadastrado
exports.transferirConvidado = async (req, res) => {
  const { convidado_id, usuario_id } = req.body;

  if (!convidado_id || !usuario_id) {
    return res.status(400).json({ error: 'IDs do convidado e do atleta cadastrado são obrigatórios.' });
  }

  if (String(convidado_id) === String(usuario_id)) {
    return res.status(400).json({ error: 'O convidado e o atleta de destino não podem ser a mesma pessoa.' });
  }

  try {
    // 1. Busca dados do Convidado
    const { rows: convidadoRows } = await db.query(
      'SELECT id, nome, email, saldo, gols, partidas FROM usuarios WHERE id = $1',
      [convidado_id]
    );

    if (convidadoRows.length === 0) {
      return res.status(404).json({ error: 'Perfil do convidado não encontrado.' });
    }

    // 2. Busca dados do Atleta Cadastrado
    const { rows: atletaRows } = await db.query(
      'SELECT id, nome, email, saldo, gols, partidas FROM usuarios WHERE id = $1',
      [usuario_id]
    );

    if (atletaRows.length === 0) {
      return res.status(404).json({ error: 'Atleta cadastrado de destino não encontrado.' });
    }

    const convidado = convidadoRows[0];
    const atleta = atletaRows[0];

    const golsTransferidos = parseInt(convidado.gols || 0);
    const partidasTransferidas = parseInt(convidado.partidas || 0);
    const saldoTransferido = parseFloat(convidado.saldo || 0);

    // 3. Atualizar convocações (remove duplicadas primeiro e depois atualiza)
    try {
      await db.query(`
        DELETE FROM convocacoes 
        WHERE usuario_id = $1 AND pelada_id IN (SELECT pelada_id FROM convocacoes WHERE usuario_id = $2)
      `, [convidado_id, usuario_id]);
    } catch (e) {}

    try {
      await db.query(
        'UPDATE convocacoes SET usuario_id = $1 WHERE usuario_id = $2',
        [usuario_id, convidado_id]
      );
    } catch (e) {}

    // 4. Somar estatísticas (Gols, Partidas, Saldo) no perfil do Atleta Cadastrado
    await db.query(`
      UPDATE usuarios 
      SET gols = COALESCE(gols, 0) + $1,
          partidas = COALESCE(partidas, 0) + $2,
          saldo = COALESCE(saldo, 0) + $3
      WHERE id = $4
    `, [golsTransferidos, partidasTransferidas, saldoTransferido, usuario_id]);

    // 5. Transferir transações financeiras (se houver)
    try {
      await db.query('UPDATE transacoes SET usuario_id = $1 WHERE usuario_id = $2', [usuario_id, convidado_id]);
    } catch (e) {}

    // 6. Transferir MVP / Notificações (se houver)
    try {
      await db.query('UPDATE mvp_partida SET usuario_id = $1 WHERE usuario_id = $2', [usuario_id, convidado_id]);
    } catch (e) {}
    try {
      await db.query('UPDATE notificacoes SET usuario_id = $1 WHERE usuario_id = $2', [usuario_id, convidado_id]);
    } catch (e) {}

    // 7. Desativar conta temporária de convidado (preserva histórico de DB sem violações de FK)
    await db.query(`
      UPDATE usuarios 
      SET ativo = false, 
          verificado = false, 
          tipo = 'incorporado' 
      WHERE id = $1
    `, [convidado_id]);

    return res.json({
      message: `Sucesso! Histórico e estatísticas de ${convidado.nome} foram integrados ao perfil de ${atleta.nome}.`,
      convidadoNome: convidado.nome,
      atletaNome: atleta.nome,
      golsTransferidos,
      partidasTransferidas,
      saldoTransferido
    });
  } catch (err) {
    console.error('[transferirConvidado] Erro:', err);
    return res.status(500).json({ error: 'Erro ao transferir histórico do convidado.', detail: err.message });
  }
};
