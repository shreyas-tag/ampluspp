const express = require('express');
const { listClients, getClientById, createClient } = require('../controllers/clientController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', listClients);
router.get('/:id', getClientById);
router.post('/', createClient);

module.exports = router;
