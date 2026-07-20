-- Script de Criação das Tabelas do PeladaPro no PostgreSQL / Supabase
-- Gerado em 18 de julho de 2026

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    data_nascimento DATE NOT NULL,
    whatsapp VARCHAR(15),
    senha_hash VARCHAR(100) NOT NULL,
    autoavaliacao INT NOT NULL CHECK(autoavaliacao BETWEEN 1 AND 5),
    tipo VARCHAR(20) DEFAULT 'jogador', -- 'jogador', 'gestor'
    goleiro BOOLEAN DEFAULT false,
    saldo NUMERIC(10,2) DEFAULT 0.00,
    apelido VARCHAR(50),
    foto TEXT,
    ativo BOOLEAN DEFAULT true,
    gols INT DEFAULT 0,
    partidas INT DEFAULT 0,
    avaliacao_media NUMERIC(3,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS grupos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    gestor_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
    ativo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS peladas (
    id SERIAL PRIMARY KEY,
    grupo_id INT REFERENCES grupos(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    horario VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'agendada', -- 'agendada', 'ativa', 'finalizada'
    local VARCHAR(100) NOT NULL,
    max_jogadores INT DEFAULT 20
);

CREATE TABLE IF NOT EXISTS convocacoes (
    pelada_id INT REFERENCES peladas(id) ON DELETE CASCADE,
    usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'confirmado', -- 'confirmado', 'pendente', 'cortado'
    forma_pagamento VARCHAR(20), -- 'saldo', 'pix'
    data_convocacao TIMESTAMPTZ DEFAULT NOW(),
    motivo_remocao VARCHAR(50),
    data_remocao TIMESTAMPTZ,
    PRIMARY KEY (pelada_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS transacoes (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    grupo_id INT REFERENCES grupos(id) ON DELETE CASCADE,
    valor NUMERIC(10,2) NOT NULL,
    tipo VARCHAR(20) NOT NULL, -- 'credito', 'debito'
    descricao VARCHAR(150),
    data TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS configs (
    grupo_id INT REFERENCES grupos(id) ON DELETE CASCADE PRIMARY KEY,
    valor_mensalidade NUMERIC(10,2) DEFAULT 30.00,
    limite_saldo_negativo NUMERIC(10,2) DEFAULT 60.00,
    qtd_times INT DEFAULT 2,
    jogadores_por_time INT DEFAULT 7,
    criterios_empate TEXT[] DEFAULT ARRAY['gols', 'estrelas', 'faltas', 'tempo', 'sorteio']
);

CREATE TABLE IF NOT EXISTS times (
    id SERIAL PRIMARY KEY,
    pelada_id INT REFERENCES peladas(id) ON DELETE CASCADE,
    nome VARCHAR(50) NOT NULL,
    cor VARCHAR(10),
    vitorias INT DEFAULT 0,
    empates INT DEFAULT 0,
    gols_pro INT DEFAULT 0,
    gols_contra INT DEFAULT 0,
    jogos INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS times_jogadores (
    time_id INT REFERENCES times(id) ON DELETE CASCADE,
    usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    PRIMARY KEY (time_id, usuario_id)
);
