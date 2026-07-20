const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const seedController = require('../controllers/seedController');

// Rota de seed protegida: exige autenticação e só funciona fora de produção
router.post('/', authMiddleware, (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Operação não permitida em produção.' });
  }
  if (req.usuarioTipo !== 'gestor') {
    return res.status(403).json({ error: 'Apenas gestores podem popular o banco.' });
  }
  next();
}, seedController.seed);

module.exports = router;
