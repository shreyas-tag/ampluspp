const express = require('express');
const { listClients, getClientById, createClient } = require('../controllers/clientController');
const { requireAuth, requireModuleAccess } = require('../middlewares/auth');
const { APP_MODULES } = require('../constants/modules');

const router = express.Router();

router.use(requireAuth, requireModuleAccess(APP_MODULES.CLIENTS));
router.get('/', listClients);
router.get('/:id', getClientById);
router.post('/', createClient);

module.exports = router;
