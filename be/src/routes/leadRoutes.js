const express = require('express');
const {
  listLeads,
  getLeadById,
  createLead,
  createLeadFromWebsite,
  updateLead,
  addLeadNote,
  addLeadCall,
  convertLeadToClient
} = require('../controllers/leadController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/webform', createLeadFromWebsite);

router.use(requireAuth);
router.get('/', listLeads);
router.get('/:id', getLeadById);
router.post('/', createLead);
router.patch('/:id', updateLead);
router.post('/:id/notes', addLeadNote);
router.post('/:id/calls', addLeadCall);
router.post('/:id/convert', convertLeadToClient);

module.exports = router;
