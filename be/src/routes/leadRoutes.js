const express = require('express');
const {
  listLeads,
  getLeadById,
  createLead,
  createLeadFromWebsite,
  updateLead,
  addLeadNote,
  addLeadCall,
  addLeadFollowUpReport,
  convertLeadToClient
} = require('../controllers/leadController');
const { requireAuth, requireModuleAccess } = require('../middlewares/auth');
const { APP_MODULES } = require('../constants/modules');

const router = express.Router();

router.post('/webform', createLeadFromWebsite);

router.use(requireAuth, requireModuleAccess(APP_MODULES.LEADS));
router.get('/', listLeads);
router.get('/:id', getLeadById);
router.post('/', createLead);
router.patch('/:id', updateLead);
router.post('/:id/notes', addLeadNote);
router.post('/:id/calls', addLeadCall);
router.post('/:id/follow-ups', addLeadFollowUpReport);
router.post('/:id/convert', convertLeadToClient);

module.exports = router;
