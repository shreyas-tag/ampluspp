const express = require('express');
const { getCatalog, getReportSummary } = require('../controllers/metaController');
const { requireAuth, requireModuleAccess, requireRole } = require('../middlewares/auth');
const { APP_MODULES } = require('../constants/modules');
const ROLES = require('../constants/roles');

const router = express.Router();

router.get(
  '/catalog',
  requireAuth,
  requireModuleAccess(APP_MODULES.LEADS, APP_MODULES.CLIENTS, APP_MODULES.PROJECTS, APP_MODULES.INVOICES),
  getCatalog
);
router.get('/report-summary', requireAuth, requireModuleAccess(APP_MODULES.DASHBOARD), requireRole(ROLES.ADMIN), getReportSummary);

module.exports = router;
