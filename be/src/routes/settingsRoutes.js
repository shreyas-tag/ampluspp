const express = require('express');
const { getMySettings, getAdminSettings, updateAdminSettings } = require('../controllers/settingsController');
const { requireAuth, adminOnly } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/me', getMySettings);
router.get('/admin', adminOnly, getAdminSettings);
router.patch('/admin', adminOnly, updateAdminSettings);

module.exports = router;
