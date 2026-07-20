const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seedController');

// Rota pública para popular o banco durante o desenvolvimento
router.post('/', seedController.seed);

module.exports = router;
