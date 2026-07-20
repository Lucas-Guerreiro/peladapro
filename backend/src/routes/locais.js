const express = require('express');
const router = express.Router();
const localController = require('../controllers/localController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, localController.listarTodos);
router.post('/', authMiddleware, localController.criar);
router.put('/:id', authMiddleware, localController.atualizar);
router.delete('/:id', authMiddleware, localController.deletar);

module.exports = router;
