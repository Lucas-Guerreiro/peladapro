const express = require('express');
const router = express.Router();
const formacaoController = require('../controllers/formacaoController');
const authMiddleware = require('../middleware/auth');

router.get('/sortear/:peladaId', authMiddleware, formacaoController.sortear);
router.get('/pelada/:peladaId', authMiddleware, formacaoController.obterTimesSorteados);

module.exports = router;
