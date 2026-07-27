const express = require('express');
const router = express.Router();
const convocacaoController = require('../controllers/convocacaoController');
const authMiddleware = require('../middleware/auth');

router.post('/confirmar', authMiddleware, convocacaoController.confirmar);
router.post('/remover', authMiddleware, convocacaoController.remover);
router.delete('/desconvocar', authMiddleware, convocacaoController.desconvocarPorGestor);
router.put('/presenca', authMiddleware, convocacaoController.atualizarPresenca);
router.get('/pelada/:peladaId', authMiddleware, convocacaoController.listarConvocados);

module.exports = router;
