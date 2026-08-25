const express = require('express');
const router = express.Router();
const arrecadacaoController = require('../controllers/arrecadacaoController');
const authMiddleware = require('../middleware/auth');

// Rota para simulação de aprovação em desenvolvimento
router.post('/simular-aprovacao', arrecadacaoController.simularAprovacaoContribuicao);

router.use(authMiddleware);

router.post('/', arrecadacaoController.criarArrecadacao);
router.get('/grupo/:grupoId', arrecadacaoController.listarArrecadacoesDoGrupo);
router.put('/:id/status', arrecadacaoController.atualizarStatusArrecadacao);
router.post('/pix', arrecadacaoController.gerarPixContribuicao);
router.post('/usar-saldo', arrecadacaoController.contribuirComSaldo);
router.get('/status/:contribuicaoId', arrecadacaoController.consultarStatusContribuicao);

module.exports = router;
