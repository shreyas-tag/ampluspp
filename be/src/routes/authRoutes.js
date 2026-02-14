const express = require('express');
const { login, me, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', login);
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, changePassword);

module.exports = router;
