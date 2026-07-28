const express = require('express');
const router = express.Router();
const formacaoController = require('../controllers/formacaoController');
const authMiddleware = require('../middleware/auth');

router.get('/sortear/:peladaId', authMiddleware, formacaoController.sortear);
router.get('/pelada/:peladaId', authMiddleware, formacaoController.obterTimesSorteados);
router.put('/times/:timeId/emblema', authMiddleware, formacaoController.atualizarEmblema);

// Biblioteca de emblemas do grupo
router.get('/emblemas/grupo/:grupoId', authMiddleware, formacaoController.listarEmblemasGrupo);
router.post('/emblemas/grupo/:grupoId', authMiddleware, formacaoController.adicionarEmblemaGrupo);
router.delete('/emblemas/:emblemaId', authMiddleware, formacaoController.deletarEmblemaGrupo);

module.exports = router;
