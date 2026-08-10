const express = require('express');
const router = express.Router();
const convocacaoController = require('../controllers/convocacaoController');
const authMiddleware = require('../middleware/auth');

router.post('/confirmar', authMiddleware, convocacaoController.confirmar);
router.post('/remover', authMiddleware, convocacaoController.remover);
router.delete('/desconvocar', authMiddleware, convocacaoController.desconvocarPorGestor);
router.post('/desconvocar', authMiddleware, convocacaoController.desconvocarPorGestor);
router.put('/presenca', authMiddleware, convocacaoController.atualizarPresenca);
router.post('/adicionar', authMiddleware, convocacaoController.adicionarPorGestor);
router.post('/estornar-saldo', authMiddleware, convocacaoController.estornarSaldo);
router.get('/pelada/:peladaId', authMiddleware, convocacaoController.listarConvocados);
router.put('/:peladaId/limite', authMiddleware, convocacaoController.alterarLimite);

module.exports = router;
