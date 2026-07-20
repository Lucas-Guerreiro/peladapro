const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const authMiddleware = require('../middleware/auth');

router.get('/me', authMiddleware, usuarioController.me);
router.put('/profile', authMiddleware, usuarioController.atualizarPerfil);
router.get('/', authMiddleware, usuarioController.listarTodos);
router.get('/:id', authMiddleware, usuarioController.obterDetalhes);
router.post('/:id/aprovar', authMiddleware, usuarioController.aprovarAtleta);
router.delete('/:id', authMiddleware, usuarioController.recusarAtleta);
router.post('/:id/gol', authMiddleware, usuarioController.adicionarGol);

module.exports = router;
