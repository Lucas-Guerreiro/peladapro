const express = require('express');
const router = express.Router();
const timesCatalogController = require('../controllers/timesCatalogController');
const authMiddleware = require('../middleware/auth');

router.get('/grupo/:groupId', authMiddleware, timesCatalogController.getCatalogo);
router.post('/grupo/:groupId', authMiddleware, timesCatalogController.cadastrar);
router.put('/:id', authMiddleware, timesCatalogController.atualizar);
router.delete('/:id', authMiddleware, timesCatalogController.excluir);

module.exports = router;
