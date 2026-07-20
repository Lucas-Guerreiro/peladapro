const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const usuarioRoutes = require('./routes/usuarios');
const convocacaoRoutes = require('./routes/convocacoes');
const formacaoRoutes = require('./routes/formacao');
const peladaRoutes = require('./routes/peladas');
const seedRoutes = require('./routes/seed');
const localRoutes = require('./routes/locais');
const partidaRoutes = require('./routes/partidas');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Permitir upload de fotos em base64 grandes

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/convocacoes', convocacaoRoutes);
app.use('/api/formacao', formacaoRoutes);
app.use('/api/peladas', peladaRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/locais', localRoutes);
app.use('/api/partidas', partidaRoutes);

// Health Check
app.get('/', (req, res) => {
  res.json({ 
    message: 'PeladaPro API Online', 
    date: '18/07/2026', 
    status: 'ok',
    env: process.env.NODE_ENV 
  });
});

// Tratamento global de erros
app.use((err, req, res, next) => {
  console.error('❌ Erro inesperado:', err);
  res.status(500).json({ error: 'Erro interno no servidor', detail: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
