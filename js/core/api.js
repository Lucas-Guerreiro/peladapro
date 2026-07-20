// ==========================================================================
// js/core/api.js — Camada de Dados (localStorage wrapper)
// PeladaPro · Fundacional
// ==========================================================================

const Api = {

  // --- Chaves do localStorage -------------------------------------------
  KEYS: {
    players:      'players',
    groups:       'groups',
    peladas:      'peladas',
    configs:      'configs',
    transactions: 'transactions',
    teams:        'teams',
    convocations: 'convocations',
    dbVersion:    'pp_db_version'
  },

  DB_VERSION: 3,

  // --- Helpers privados ---------------------------------------------------
  _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error(`[Api] Erro ao ler ${key}:`, e);
      return null;
    }
  },

  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`[Api] Erro ao salvar ${key}:`, e);
    }
  },

  // --- Players ------------------------------------------------------------
  getPlayers()       { return this._get(this.KEYS.players) || []; },
  savePlayers(data)  { this._set(this.KEYS.players, data); },

  getPlayer(id) {
    return this.getPlayers().find(p => p.id === id) || null;
  },

  savePlayer(updated) {
    const players = this.getPlayers();
    const idx = players.findIndex(p => p.id === updated.id);
    if (idx >= 0) { players[idx] = updated; } else { players.push(updated); }
    this.savePlayers(players);
  },

  // --- Groups -------------------------------------------------------------
  getGroups()        { return this._get(this.KEYS.groups) || []; },
  saveGroups(data)   { this._set(this.KEYS.groups, data); },

  getGroup(id) {
    return this.getGroups().find(g => g.id === id) || null;
  },

  // --- Peladas ------------------------------------------------------------
  getPeladas()       { return this._get(this.KEYS.peladas) || []; },
  savePeladas(data)  { this._set(this.KEYS.peladas, data); },

  getPelada(id) {
    return this.getPeladas().find(p => p.id === id) || null;
  },

  savePelada(updated) {
    const peladas = this.getPeladas();
    const idx = peladas.findIndex(p => p.id === updated.id);
    if (idx >= 0) { peladas[idx] = updated; } else { peladas.push(updated); }
    this.savePeladas(peladas);
  },

  // --- Configs ------------------------------------------------------------
  getConfigs()       { return this._get(this.KEYS.configs) || []; },
  saveConfigs(data)  { this._set(this.KEYS.configs, data); },

  getConfig(groupId) {
    return this.getConfigs().find(c => c.grupo_id === groupId) || null;
  },

  saveConfig(updated) {
    const configs = this.getConfigs();
    const idx = configs.findIndex(c => c.grupo_id === updated.grupo_id);
    if (idx >= 0) { configs[idx] = updated; } else { configs.push(updated); }
    this.saveConfigs(configs);
  },

  // --- Transactions -------------------------------------------------------
  getTransactions()      { return this._get(this.KEYS.transactions) || []; },
  saveTransactions(data) { this._set(this.KEYS.transactions, data); },

  addTransaction(tx) {
    const list = this.getTransactions();
    list.unshift({ id: Utils.generateId(), data: new Date().toISOString(), ...tx });
    this.saveTransactions(list);
  },

  // --- Teams --------------------------------------------------------------
  getTeams()       { return this._get(this.KEYS.teams) || []; },
  saveTeams(data)  { this._set(this.KEYS.teams, data); },

  // --- Convocations -------------------------------------------------------
  getConvocations()      { return this._get(this.KEYS.convocations) || []; },
  saveConvocations(data) { this._set(this.KEYS.convocations, data); },

  addConvocation(conv) {
    const list = this.getConvocations();
    list.push({ id: Utils.generateId(), ...conv });
    this.saveConvocations(list);
  },

  // --- Init / Seed -------------------------------------------------------
  async checkAndInitDatabase() {
    const storedVersion = this._get(this.KEYS.dbVersion);
    if (storedVersion === this.DB_VERSION) return; // já inicializado

    console.log('[Api] Inicializando banco de dados local v' + this.DB_VERSION + '...');

    const seedFiles = [
      { key: this.KEYS.groups,       url: './assets/data/groups.json' },
      { key: this.KEYS.players,      url: './assets/data/players.json' },
      { key: this.KEYS.peladas,      url: './assets/data/peladas.json' },
      { key: this.KEYS.configs,      url: './assets/data/configs.json' },
      { key: this.KEYS.transactions, url: './assets/data/transactions.json' }
    ];

    for (const { key, url } of seedFiles) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          this._set(key, await res.json());
        }
      } catch (e) {
        console.warn(`[Api] Não foi possível carregar ${url}, usando fallback embutido.`);
        this._injectFallback(key);
      }
    }

    // Inicializa convocações e times como listas vazias se não existirem
    if (!this._get(this.KEYS.convocations)) this._set(this.KEYS.convocations, []);
    if (!this._get(this.KEYS.teams))        this._set(this.KEYS.teams, []);

    this._set(this.KEYS.dbVersion, this.DB_VERSION);
    console.log('[Api] Banco de dados local pronto.');
  },

  _injectFallback(key) {
    const fallbacks = {
      groups: [
        { id: 'g1', nome: 'Pelada dos Campeões', gestor_id: 'gest1', ativo: true }
      ],
      players: [
        { id: 'gest1', nome: 'Carlos Henrique', cpf: '111.222.333-44', data_nascimento: '1990-05-15', goleiro: false, autoavaliacao: 4, ativo: true, saldo: 50.00, gols: 12, partidas: 30, avaliacao_media: 4.0 },
        { id: 'p2',    nome: 'Rodrigo Silva',    cpf: '222.333.444-55', data_nascimento: '1988-03-22', goleiro: true,  autoavaliacao: 3, ativo: true, saldo: 0.00,  gols: 0,  partidas: 25, avaliacao_media: 3.0 },
        { id: 'p3',    nome: 'Marcelo Andrade',  cpf: '333.444.555-66', data_nascimento: '1992-08-10', goleiro: false, autoavaliacao: 5, ativo: true, saldo: 25.00, gols: 20, partidas: 28, avaliacao_media: 5.0 },
        { id: 'p4',    nome: 'Fernando Costa',   cpf: '444.555.666-77', data_nascimento: '1995-01-30', goleiro: false, autoavaliacao: 3, ativo: true, saldo: -15.00,gols: 5,  partidas: 18, avaliacao_media: 3.0 },
        { id: 'p5',    nome: 'Bruno Mendes',     cpf: '555.666.777-88', data_nascimento: '1993-11-05', goleiro: false, autoavaliacao: 4, ativo: true, saldo: 100.00,gols: 8,  partidas: 22, avaliacao_media: 4.0 }
      ],
      peladas: [
        { id: 'pel1', grupo_id: 'g1', data: new Date().toISOString().split('T')[0], horario: '20:00', status: 'agendada', local: 'Arena Indoor Norte', max_jogadores: 14 }
      ],
      configs: [
        { grupo_id: 'g1', valor_mensalidade: 30.00, limite_saldo_negativo: 60.00, qtd_times: 2, jogadores_por_time: 7, criterios_empate: ['gols','estrelas','faltas','tempo','sorteio'] }
      ],
      transactions: []
    };
    if (fallbacks[key]) {
      this._set(key, fallbacks[key]);
    }
  },

  // --- Integração com API do Backend para Peladas / Grupos --------------
  async criarGrupo(nome, configs = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
      return { error: 'Sessão expirada ou inválida. Por favor, faça Logout e entre novamente para ativar a conexão com o Supabase.' };
    }
    const res = await fetch('http://localhost:3000/api/peladas/grupos', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ nome, ...configs })
    });
    const data = await res.json();
    
    // Atualiza localmente os grupos no localStorage
    if (res.ok) {
      const gruposLocais = this.getGroups();
      gruposLocais.push(data.grupo);
      this.saveGroups(gruposLocais);
    }
    return data;
  },

  async agendarPelada(grupoId, data, horario, local, valorConvocacao = 20.00, maxJogadores = 20) {
    const token = localStorage.getItem('token');
    if (!token) {
      return { error: 'Sessão expirada ou inválida. Por favor, faça Logout e entre novamente para ativar a conexão com o Supabase.' };
    }
    const res = await fetch('http://localhost:3000/api/peladas/agendar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        grupo_id: parseInt(grupoId),
        data,
        horario,
        local,
        valor_convocacao: parseFloat(valorConvocacao),
        max_jogadores: parseInt(maxJogadores)
      })
    });
    const responseData = await res.json();

    // Sincroniza localmente as peladas e cria convocações no local
    if (res.ok) {
      const peladasLocais = this.getPeladas();
      const novaPelada = {
        id: responseData.pelada.id,
        grupo_id: responseData.pelada.grupo_id || parseInt(grupoId),
        data: responseData.pelada.data,
        horario: responseData.pelada.horario,
        local: responseData.pelada.local,
        status: 'agendada',
        max_jogadores: parseInt(maxJogadores)
      };
      peladasLocais.push(novaPelada);
      this.savePeladas(peladasLocais);

      // Criar convocações pendentes locais para os atletas ativos para refletir no front legado
      const players = this.getPlayers();
      const convocacoesLocais = this.getConvocations();
      players.forEach(p => {
        if (p.ativo && p.tipo !== 'gestor') {
          convocacoesLocais.push({
            id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
            pelada_id: novaPelada.id,
            player_id: p.id,
            status: 'pendente',
            forma_pagamento: null
          });
        }
      });
      this.saveConvocations(convocacoesLocais);
    }
    return responseData;
  },

  async getGruposDoGestor() {
    const token = localStorage.getItem('token');
    if (!token) return [];
    const res = await fetch('http://localhost:3000/api/peladas/grupos', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (res.ok) {
      this.saveGroups(data);
    }
    return data;
  },

  async listarDatasDoGrupo(grupoId) {
    const token = localStorage.getItem('token');
    if (!token) return [];
    const res = await fetch(`http://localhost:3000/api/peladas/grupo/${grupoId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return res.json();
  },

  async deletarData(id) {
    const token = localStorage.getItem('token');
    if (!token) {
      return { error: 'Sessão expirada. Por favor, faça login novamente.' };
    }
    const res = await fetch(`http://localhost:3000/api/peladas/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    
    // Remove localmente no localStorage também para consistência do front legado
    if (res.ok) {
      const peladasLocais = this.getPeladas().filter(p => String(p.id) !== String(id));
      this.savePeladas(peladasLocais);
      const convocacoesLocais = this.getConvocations().filter(c => String(c.pelada_id) !== String(id));
      this.saveConvocations(convocacoesLocais);
    }
    return data;
  },

  async listarConvocados(peladaId) {
    const token = localStorage.getItem('token');
    if (!token) return [];
    const res = await fetch(`http://localhost:3000/api/convocacoes/pelada/${peladaId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return res.json();
  },

  async atualizarPerfil(dados) {
    const token = localStorage.getItem('token');
    if (!token) {
      return { error: 'Sessão expirada.' };
    }
    const res = await fetch('http://localhost:3000/api/usuarios/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(dados)
    });
    return res.json();
  },

  async lancarGolAtleta(jogadorId) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    const res = await fetch(`http://localhost:3000/api/usuarios/${jogadorId}/gol`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return res.json();
  },

  async atualizarPresenca(peladaId, usuarioId, presenca) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    const res = await fetch('http://localhost:3000/api/convocacoes/presenca', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        pelada_id: parseInt(peladaId),
        usuario_id: parseInt(usuarioId),
        presenca: !!presenca
      })
    });
    return res.json();
  },

  async lancarPartida(peladaId, timeANome, timeBNome, golsTimeA, golsTimeB) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    const res = await fetch('http://localhost:3000/api/partidas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        pelada_id: parseInt(peladaId),
        time_a_nome: timeANome,
        time_b_nome: timeBNome,
        gols_time_a: parseInt(golsTimeA),
        gols_time_b: parseInt(golsTimeB)
      })
    });
    return res.json();
  },

  async listarPartidas(peladaId) {
    const token = localStorage.getItem('token');
    if (!token) return [];
    const res = await fetch(`http://localhost:3000/api/partidas/pelada/${peladaId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return res.json();
  },

  async atualizarStatusPelada(peladaId, status) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    const res = await fetch(`http://localhost:3000/api/peladas/${peladaId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    return res.json();
  },

  async editarPartida(partidaId, golsA, golsB) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    const res = await fetch(`http://localhost:3000/api/partidas/${partidaId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        gols_time_a: parseInt(golsA),
        gols_time_b: parseInt(golsB)
      })
    });
    return res.json();
  },

  async excluirPartida(partidaId) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    const res = await fetch(`http://localhost:3000/api/partidas/${partidaId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return res.json();
  },

  async verificarCodigo(email, codigo) {
    const res = await fetch('http://localhost:3000/api/auth/verificar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, codigo })
    });
    return res.json();
  },

  async listarLocais() {
    const token = localStorage.getItem('token');
    if (!token) return [];
    try {
      const res = await fetch('http://localhost:3000/api/locais', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    } catch (e) {
      console.error('[Api] Erro ao listar locais:', e);
      return [];
    }
  },

  async criarLocal(nome, endereco) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    try {
      const res = await fetch('http://localhost:3000/api/locais', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nome, endereco })
      });
      return await res.json();
    } catch (e) {
      console.error('[Api] Erro ao criar local:', e);
      return { error: 'Erro ao se conectar ao servidor.' };
    }
  },

  async atualizarLocal(id, nome, endereco) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    try {
      const res = await fetch(`http://localhost:3000/api/locais/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nome, endereco })
      });
      return await res.json();
    } catch (e) {
      console.error('[Api] Erro ao atualizar local:', e);
      return { error: 'Erro ao se conectar ao servidor.' };
    }
  },

  async deletarLocal(id) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    try {
      const res = await fetch(`http://localhost:3000/api/locais/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    } catch (e) {
      console.error('[Api] Erro ao deletar local:', e);
      return { error: 'Erro ao se conectar ao servidor.' };
    }
  },

  async atualizarConfigPartida(id, configs) {
    const token = localStorage.getItem('token');
    if (!token) return { error: 'Sessão expirada.' };
    try {
      const res = await fetch(`http://localhost:3000/api/peladas/${id}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(configs)
      });
      return await res.json();
    } catch (e) {
      console.error('[Api] Erro ao atualizar configurações da partida:', e);
      return { error: 'Erro ao se conectar ao servidor.' };
    }
  }
};

window.Api = Api;
