const express = require('express');
const { listNotifications, markRead } = require('../controllers/notificationController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', listNotifications);
router.patch('/:id/read', markRead);

module.exports = router;
