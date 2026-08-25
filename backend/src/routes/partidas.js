const express = require('express');
const router = express.Router();
const partidaController = require('../controllers/partidaController');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, partidaController.criarPartida);
router.get('/pelada/:peladaId', partidaController.listarPartidas);
router.put('/:id', authMiddleware, partidaController.editarPartida);
router.delete('/:id', authMiddleware, partidaController.deletarPartida);
router.delete('/pelada/:peladaId/all', authMiddleware, partidaController.deletarTodasPartidasDaPelada);
router.post('/delete-batch', authMiddleware, partidaController.deletarPartidasPorIds);

module.exports = router;
