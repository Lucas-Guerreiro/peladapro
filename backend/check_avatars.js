require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');
const db = require('./src/config/database');
const supaUsers = require('./supabase_users.json');

const supa = createClient(
  'https://xgsdaavryzhqxkwsonkk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function checkAvatars() {
  console.log("=== 1. AVATARES NO SUPABASE AUTH ===");
  let supaAvatarsCount = 0;
  supaUsers.forEach(u => {
    const meta = u.user_metadata || {};
    const pic = meta.avatar_url || meta.picture || meta.foto;
    if (pic) {
      supaAvatarsCount++;
      console.log(`📸 [Auth] ${u.email} => ${pic}`);
    }
  });
  console.log(`Total de avatares no Supabase Auth: ${supaAvatarsCount}`);

  console.log("\n=== 2. BUCKETS DE FOTOS NO SUPABASE STORAGE ===");
  try {
    const buckets = await supa.storage.listBuckets();
    console.log("Buckets encontrados:", buckets.data?.map(b => b.name));

    for (let b of (buckets.data || [])) {
      const files = await supa.storage.from(b.name).list('', { limit: 100 });
      console.log(`Arquivos no bucket '${b.name}':`, files.data?.map(f => f.name));
    }
  } catch (err) {
    console.error("Erro ao verificar Storage:", err.message);
  }

  console.log("\n=== 3. FOTOS ATUAIS NO POSTGRESQL ===");
  try {
    const res = await db.pool.query("SELECT id, nome, email, foto FROM usuarios WHERE foto IS NOT NULL AND foto != ''");
    console.log(`Total de usuários com foto no Postgres: ${res.rows.length}`);
    res.rows.forEach(r => console.log(`📸 [Postgres] ${r.nome} (${r.email}) => ${r.foto}`));
  } catch (err) {
    console.error("Erro Postgres:", err.message);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

checkAvatars();
