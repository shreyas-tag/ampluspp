const express = require('express');
const { listUsers, listAssignableUsers, createUser, updateUser } = require('../controllers/userController');
const { requireAuth, adminOnly } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/assignable', listAssignableUsers);
router.get('/', adminOnly, listUsers);
router.post('/', adminOnly, createUser);
router.patch('/:id', adminOnly, updateUser);

module.exports = router;
