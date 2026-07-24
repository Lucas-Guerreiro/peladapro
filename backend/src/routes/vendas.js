const express = require('express');
const router = express.Router();
const vendasController = require('../controllers/vendasController');
const authMiddleware = require('../middleware/auth');

// Rotas públicas de checkout e confirmação de pagamento Pix (simulado/real)
router.post('/checkout', vendasController.criarCheckout);
router.post('/confirmar', vendasController.confirmarPagamento);

// Rota protegida para ativação manual de licença pelo painel do gestor
router.post('/ativar-manual', authMiddleware, vendasController.ativarLicencaManual);

module.exports = router;
