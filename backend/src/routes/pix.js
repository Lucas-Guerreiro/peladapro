const express = require('express');
const router = express.Router();
const pixController = require('../controllers/pixController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.post('/enviar-comprovante', pixController.enviarComprovante);
router.get('/comprovantes', pixController.listarComprovantes);
router.post('/estornar', pixController.estornarTransacao);

module.exports = router;
