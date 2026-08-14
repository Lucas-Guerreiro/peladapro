const express = require('express');
const router = express.Router();
const pixController = require('../controllers/pixController');
const authMiddleware = require('../middleware/auth');

// Rota de webhook do Mercado Pago (PÚBLICA - Mercado Pago não envia token Bearer local)
router.post('/webhook', pixController.receberWebhookMercadoPago);

// Rota para simulação de aprovação em ambiente local (PÚBLICA)
router.post('/simular-aprovacao', pixController.simularAprovacao);

router.use(authMiddleware);

router.post('/enviar-comprovante', pixController.enviarComprovante);
router.get('/comprovantes', pixController.listarComprovantes);
router.post('/estornar', pixController.estornarTransacao);
router.post('/criar-pagamento', pixController.criarPagamentoMercadoPago);
router.get('/status-pagamento/:peladaId', pixController.obterStatusPagamento);

module.exports = router;
