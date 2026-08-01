const express = require('express');
const router = express.Router();
const peladaController = require('../controllers/peladaController');
const authMiddleware = require('../middleware/auth');

router.post('/grupos', authMiddleware, peladaController.criarGrupo);
router.get('/grupos', authMiddleware, peladaController.listarGrupos);
router.post('/agendar', authMiddleware, peladaController.agendarData);
router.get('/grupo/:grupoId', authMiddleware, peladaController.listarDatasDoGrupo);
router.delete('/:id', authMiddleware, peladaController.deletarData);
router.put('/:id/config', authMiddleware, peladaController.atualizarConfigPartida);
router.put('/:id/status', authMiddleware, peladaController.atualizarStatus);
router.post('/:id/live', authMiddleware, peladaController.atualizarLiveState);
router.get('/:id/live', authMiddleware, peladaController.obterLiveState);
router.get('/grupo/:grupoId/transacoes', authMiddleware, peladaController.listarTransacoesDoGrupo);

module.exports = router;
