const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');

// 1. Obter VAPID Public Key (Pública)
router.get('/vapid-public-key', pushController.getVapidPublicKey);

// 2. Registrar Push Subscription do cliente
router.post('/register', pushController.registerSubscription);

// 3. Enviar notificação push (Painel Gestor / Sistema)
router.post('/send', pushController.sendNotification);

module.exports = router;
