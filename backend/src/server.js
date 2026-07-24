const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes      = require('./routes/auth');
const usuarioRoutes   = require('./routes/usuarios');
const convocacaoRoutes = require('./routes/convocacoes');
const formacaoRoutes  = require('./routes/formacao');
const peladaRoutes    = require('./routes/peladas');
const seedRoutes      = require('./routes/seed');
const localRoutes     = require('./routes/locais');
const partidaRoutes   = require('./routes/partidas');
const vendasRoutes    = require('./routes/vendas');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// ============================================================
// 1. HELMET — Cabeçalhos HTTP de segurança
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ============================================================
// 2. CORS — Apenas origens autorizadas
// ============================================================
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim().toLowerCase().replace(/\/$/, ''))
  .filter(Boolean);

const defaultOrigins = [
  'http://localhost:8082',
  'http://localhost:3000',
  'https://www.thorneios.com.br',
  'https://thorneios.com.br'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const formattedOrigin = origin.trim().toLowerCase().replace(/\/$/, '');
    
    if (defaultOrigins.includes(formattedOrigin) || allowedOrigins.includes(formattedOrigin)) {
      return callback(null, true);
    }
    
    return callback(new Error(`CORS bloqueado para origem: ${origin}`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ============================================================
// 3. RATE LIMITING — Proteção contra força bruta e flood
// ============================================================

// Limite geral: 200 requisições por 15 minutos por IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' }
});

// Limite restrito para login/registro: 10 tentativas por 15 minutos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de autenticação. Aguarde 15 minutos.' }
});

app.use(globalLimiter);

// ============================================================
// 4. BODY PARSER — Limite de payload reduzido
// ============================================================
app.use(express.json({ limit: '2mb' }));

// ============================================================
// 5. ROTAS
// ============================================================
app.use('/api/auth',        authLimiter, authRoutes);   // Rate limit mais restrito no auth
app.use('/api/usuarios',    usuarioRoutes);
app.use('/api/convocacoes', convocacaoRoutes);
app.use('/api/formacao',    formacaoRoutes);
app.use('/api/peladas',     peladaRoutes);
app.use('/api/locais',      localRoutes);
app.use('/api/partidas',    partidaRoutes);
app.use('/api/vendas',      vendasRoutes);

// Rota de seed: apenas em desenvolvimento
if (!isProduction) {
  app.use('/api/seed', seedRoutes);
  console.log('⚠️  Rota /api/seed ATIVA (modo desenvolvimento)');
}

// ============================================================
// 6. HEALTH CHECK — Sem vazar informações sensíveis
// ============================================================
app.get('/', (req, res) => {
  res.json({
    message: 'PeladaPro API Online',
    status: 'ok'
  });
});

// ============================================================
// 7. HANDLER GLOBAL DE ERROS — Sem vazar stack traces
// ============================================================
app.use((err, req, res, next) => {
  console.error('❌ Erro inesperado:', err);

  // Em produção, nunca vazar detalhes internos
  if (isProduction) {
    return res.status(err.status || 500).json({ error: 'Erro interno no servidor.' });
  }

  // Em desenvolvimento, retornar detalhes para facilitar debug
  return res.status(err.status || 500).json({
    error: err.message || 'Erro interno no servidor',
    detail: err.stack
  });
});

// ============================================================
// 8. INICIALIZAÇÃO
// ============================================================
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

module.exports = app;
