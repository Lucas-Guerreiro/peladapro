require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function restoreAllAthletesAndPhotos() {
  let client;

  try {
    client = await db.pool.connect();
    console.log("🐘 Conectado ao PostgreSQL com sucesso!");

    // 1. Carrega os usuários do Supabase Auth
    const usersJsonPath = path.join(__dirname, 'supabase_users.json');
    if (!fs.existsSync(usersJsonPath)) {
      console.error("❌ Arquivo supabase_users.json não encontrado!");
      process.exit(1);
    }
    const supabaseUsers = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));

    const isTestEmail = (email) => {
      if (!email) return true;
      const em = email.toLowerCase();
      return em.endsWith('@teste.com') || em.includes('mailinator.com') || em === 'e@teste.com' || em === 'a@teste.com';
    };

    const realSupaUsers = supabaseUsers.filter(u => !isTestEmail(u.email));
    console.log(`📋 Usuários do Supabase Auth: ${realSupaUsers.length}`);

    // 2. Carrega atletas adicionais do grupo de players.json
    const playersJsonPath = path.join(__dirname, '../assets/data/players.json');
    let jsonPlayers = [];
    if (fs.existsSync(playersJsonPath)) {
      jsonPlayers = JSON.parse(fs.readFileSync(playersJsonPath, 'utf8'));
    }

    // 3. Remove atletas fictícios @teste.com
    await client.query("DELETE FROM usuarios WHERE email LIKE '%@teste.com'");

    const hashPadrao = await bcrypt.hash('123456', 10);
    let inseridos = 0;
    let atualizados = 0;

    const gestorEmails = [
      'lucas7s7@hotmail.com',
      'lucas7s@hotmail.com',
      'lucas.fguerreiro@eaportal.org',
      'guerreiro.lucas7s7@gmail.com'
    ];

    const supaNamesNorm = realSupaUsers.map(u => (u.user_metadata?.full_name || u.user_metadata?.name || u.email).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

    // Helper para gerar avatar estilizado caso não tenha foto customizada
    const getAvatarUrl = (nome, currentFoto) => {
      if (currentFoto && currentFoto.trim().length > 0) return currentFoto.trim();
      const encodedName = encodeURIComponent(nome.trim());
      return `https://ui-avatars.com/api/?name=${encodedName}&background=0F172A&color=38BDF8&size=256&bold=true`;
    };

    // --- A. Processar e-mails/logins do Supabase Auth ---
    for (let i = 0; i < realSupaUsers.length; i++) {
      const u = realSupaUsers[i];
      const email = u.email.trim().toLowerCase();
      const meta = u.user_metadata || {};

      let nome = meta.full_name || meta.name || meta.nome || email.split('@')[0];
      nome = nome.trim();

      const tipo = gestorEmails.includes(email) ? 'ambos' : (meta.tipo || 'jogador');
      const sufixoCpf = String(i + 1).padStart(3, '0');
      const cpf = meta.cpf || `000.000.${sufixoCpf}-00`;
      const dob = meta.data_nascimento || meta.dob || '1995-01-15';
      const whatsapp = meta.whatsapp || meta.phone || u.phone || null;
      const autoavaliacao = meta.autoavaliacao ? parseInt(meta.autoavaliacao) : 4;
      const goleiro = meta.goleiro !== undefined ? !!meta.goleiro : false;
      
      const fotoBruta = meta.avatar_url || meta.picture || meta.foto || null;
      const fotoFinal = getAvatarUrl(nome, fotoBruta);
      const apelido = meta.apelido || nome.split(' ')[0];

      const checkRes = await client.query('SELECT id, foto FROM usuarios WHERE email = $1', [email]);

      if (checkRes.rows.length > 0) {
        const fotoExistente = checkRes.rows[0].foto;
        const fotoDefinitiva = (fotoExistente && fotoExistente.length > 0 && !fotoExistente.includes('ui-avatars.com')) ? fotoExistente : fotoFinal;

        await client.query(
          `UPDATE usuarios 
           SET nome = $1, autoavaliacao = $2, tipo = $3, goleiro = $4, apelido = $5, foto = $6, verificado = true, ativo = true
           WHERE email = $7`,
          [nome, autoavaliacao, tipo, goleiro, apelido, fotoDefinitiva, email]
        );
        atualizados++;
      } else {
        const insertQuery = `
          INSERT INTO usuarios 
          (nome, email, cpf, data_nascimento, whatsapp, senha_hash, autoavaliacao, tipo, goleiro, saldo, apelido, foto, verificado, ativo)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0.00, $10, $11, true, true)`;

        await client.query(insertQuery, [
          nome, email, cpf, dob, whatsapp, hashPadrao, autoavaliacao, tipo, goleiro, apelido, fotoFinal
        ]);
        inseridos++;
      }
    }

    // --- B. Processar atletas adicionais do grupo ---
    for (let j = 0; j < jsonPlayers.length; j++) {
      const p = jsonPlayers[j];
      const pNorm = p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const jaInserido = supaNamesNorm.some(sn => sn.includes(pNorm) || pNorm.includes(sn.split(' ')[0]));
      if (jaInserido) continue;

      const slug = pNorm.replace(/[^a-z0-9]/g, '');
      const emailLocal = `${slug}@peladapro.local`;
      const sufixoCpf = String(100 + j).padStart(3, '0');
      const cpf = p.cpf || `000.000.${sufixoCpf}-00`;
      const dob = p.data_nascimento || '1995-01-15';
      const whatsapp = p.whatsapp || '(61) 99999-0000';
      const autoavaliacao = p.autoavaliacao ? parseInt(p.autoavaliacao) : 4;
      const goleiro = !!p.goleiro;
      const apelido = p.nome;
      const fotoFinal = getAvatarUrl(p.nome, p.foto);

      const checkRes = await client.query('SELECT id, foto FROM usuarios WHERE email = $1 OR nome = $2', [emailLocal, p.nome]);

      if (checkRes.rows.length === 0) {
        const insertQuery = `
          INSERT INTO usuarios 
          (nome, email, cpf, data_nascimento, whatsapp, senha_hash, autoavaliacao, tipo, goleiro, saldo, apelido, foto, verificado, ativo)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'jogador', $8, 0.00, $9, $10, true, true)`;

        await client.query(insertQuery, [
          p.nome, emailLocal, cpf, dob, whatsapp, hashPadrao, autoavaliacao, goleiro, apelido, fotoFinal
        ]);
        inseridos++;
      } else {
        const fotoExistente = checkRes.rows[0].foto;
        const fotoDefinitiva = (fotoExistente && fotoExistente.length > 0 && !fotoExistente.includes('ui-avatars.com')) ? fotoExistente : fotoFinal;

        await client.query(
          `UPDATE usuarios SET foto = $1, verificado = true, ativo = true WHERE id = $2`,
          [fotoDefinitiva, checkRes.rows[0].id]
        );
        atualizados++;
      }
    }

    console.log(`✅ RESTAURAÇÃO DE FOTOS E PERFIS CONCLUÍDA COM SUCESSO!`);
    console.log(`   - Atletas restaurados novos: ${inseridos}`);
    console.log(`   - Atletas com foto atualizada: ${atualizados}`);

  } catch (err) {
    console.error("❌ Erro durante a restauração de fotos:", err);
  } finally {
    if (client) client.release();
    await db.pool.end();
    process.exit(0);
  }
}

restoreAllAthletesAndPhotos();
