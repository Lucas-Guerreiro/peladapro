-- Script de Migração para Licenciamento e Assinaturas no PeladaPro
-- Cria a tabela de licenças e adiciona referências na tabela grupos

CREATE TABLE IF NOT EXISTS licencas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    email_comprador VARCHAR(100) NOT NULL,
    plano VARCHAR(20) NOT NULL DEFAULT 'mensal', -- 'mensal', 'anual'
    status VARCHAR(20) DEFAULT 'disponivel', -- 'disponivel' (gerada, sem grupo associado), 'ativa', 'expirada'
    grupo_id INT, -- Referenciado manualmente para evitar conflito na criação do grupo
    criada_em TIMESTAMPTZ DEFAULT NOW(),
    ativada_em TIMESTAMPTZ,
    expira_em TIMESTAMPTZ
);

-- Adiciona a coluna de licença ativa diretamente na tabela de grupos para consulta rápida
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS licenca_codigo VARCHAR(50);
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS licenca_expira_em TIMESTAMPTZ;
ALTER TABLE grupos ADD COLUMN IF NOT EXISTS licenca_status VARCHAR(20) DEFAULT 'free';
