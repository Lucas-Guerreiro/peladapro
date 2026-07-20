const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/registrar', authController.registrar);
router.post('/login', authController.login);
router.post('/verificar', authController.verificarCodigo);
router.post('/google-supabase', authController.googleSupabase);

module.exports = router;
