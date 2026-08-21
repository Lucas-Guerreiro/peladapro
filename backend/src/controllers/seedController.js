const db = require('../config/database');
const bcrypt = require('bcrypt');

exports.seed = async (req, res) => {
  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Limpar todas as tabelas (na ordem inversa das chaves estrangeiras)
    await client.query('TRUNCATE TABLE times_jogadores, times, configs, transacoes, convocacoes, peladas, grupos, usuarios RESTART IDENTITY CASCADE');

    console.log('🌱 Populando banco de dados com dados de teste...');

    // 2. Criar Senha Hash
    const senhaHash = await bcrypt.hash('senha123', 10);

    // 3. Criar Usuários
    const usuarios = [
      { nome: 'Carlos Henrique', email: 'carlos@peladapro.com', cpf: '111.222.333-44', dob: '1990-05-15', whatsapp: '(11) 98888-7777', autoavaliacao: 4, tipo: 'gestor', goleiro: false, saldo: 50.00, apelido: 'Carlão' },
      { nome: 'Rodrigo Silva', email: 'rodrigo@peladapro.com', cpf: '222.333.444-55', dob: '1988-03-22', whatsapp: '(11) 97777-6666', autoavaliacao: 3, tipo: 'jogador', goleiro: true, saldo: 0.00, apelido: 'Rodrigão' },
      { nome: 'Marcelo Andrade', email: 'marcelo@peladapro.com', cpf: '333.444.555-66', dob: '1992-08-10', whatsapp: '(11) 96666-5555', autoavaliacao: 5, tipo: 'jogador', goleiro: false, saldo: 25.00, apelido: 'Marcelinho' },
      { nome: 'Fernando Costa', email: 'fernando@peladapro.com', cpf: '444.555.666-77', dob: '1995-01-30', whatsapp: '(11) 95555-4444', autoavaliacao: 3, tipo: 'jogador', goleiro: false, saldo: -15.00, apelido: 'Fer' },
      { nome: 'Bruno Mendes', email: 'bruno@peladapro.com', cpf: '555.666.777-88', dob: '1993-11-05', whatsapp: '(11) 94444-3333', autoavaliacao: 4, tipo: 'jogador', goleiro: false, saldo: 100.00, apelido: 'Brunão' },
      { nome: 'Marcos Oliveira', email: 'marcos@peladapro.com', cpf: '666.777.888-99', dob: '1991-04-12', whatsapp: '(11) 93333-2222', autoavaliacao: 4, tipo: 'jogador', goleiro: true, saldo: 10.00, apelido: 'Marcão' },
      { nome: 'Rafael Souza', email: 'rafael@peladapro.com', cpf: '777.888.999-00', dob: '1994-07-25', whatsapp: '(11) 92222-1111', autoavaliacao: 5, tipo: 'jogador', goleiro: false, saldo: 40.00, apelido: 'Rafa' }
    ];

    const insertedUsers = [];
    const queryUser = `
      INSERT INTO usuarios (nome, email, cpf, data_nascimento, whatsapp, senha_hash, autoavaliacao, tipo, goleiro, saldo, apelido, verificado, ativo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, true) RETURNING id, nome`;
    
    for (let u of usuarios) {
      const res = await client.query(queryUser, [
        u.nome, u.email, u.cpf, u.dob, u.whatsapp, senhaHash, u.autoavaliacao, u.tipo, u.goleiro, u.saldo, u.apelido
      ]);
      insertedUsers.push(res.rows[0]);
    }

    const gestorId = insertedUsers.find(x => x.nome === 'Carlos Henrique').id;

    // 4. Criar Grupo
    const queryGrupo = `
      INSERT INTO grupos (nome, gestor_id)
      VALUES ($1, $2) RETURNING id`;
    const grupoRes = await client.query(queryGrupo, ['Pelada dos Campeões', gestorId]);
    const grupoId = grupoRes.rows[0].id;

    // 5. Criar Configurações do Grupo
    const queryConfig = `
      INSERT INTO configs (grupo_id, valor_mensalidade, limite_saldo_negativo, qtd_times, jogadores_por_time)
      VALUES ($1, $2, $3, $4, $5)`;
    await client.query(queryConfig, [grupoId, 30.00, 60.00, 2, 7]);

    // 6. Criar Peladas (Uma ativa/agendada e uma finalizada)
    const queryPelada = `
      INSERT INTO peladas (grupo_id, data, horario, status, local, max_jogadores)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
    
    const hoje = new Date().toISOString().split('T')[0];
    
    // Pelada futura agendada
    const peladaRes = await client.query(queryPelada, [grupoId, hoje, '20:00', 'agendada', 'Arena Indoor Norte', 14]);
    const peladaId = peladaRes.rows[0].id;

    // 7. Criar Convocações (Todos confirmados exceto Fernando que está pendente)
    const queryConv = `
      INSERT INTO convocacoes (pelada_id, usuario_id, status, forma_pagamento)
      VALUES ($1, $2, $3, $4)`;
    
    for (let user of insertedUsers) {
      const isFernando = user.nome === 'Fernando Costa';
      await client.query(queryConv, [
        peladaId, 
        user.id, 
        isFernando ? 'pendente' : 'confirmado', 
        isFernando ? null : 'saldo'
      ]);
    }

    // 8. Criar Transações financeiras de exemplo
    const queryTx = `
      INSERT INTO transacoes (usuario_id, grupo_id, valor, tipo, descricao)
      VALUES ($1, $2, $3, $4, $5)`;
    
    for (let user of insertedUsers) {
      if (user.nome !== 'Fernando Costa') {
        await client.query(queryTx, [user.id, grupoId, 30.00, 'debito', `Mensalidade Pelada #${peladaId}`]);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Banco de dados populado com sucesso!');
    res.json({ message: 'Banco de dados populado com sucesso!', totalUsuarios: insertedUsers.length });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Erro no seed:', err);
    res.status(500).json({ error: 'Falha ao rodar seed de dados', detail: err.message });
  } finally {
    if (client) client.release();
  }
};
