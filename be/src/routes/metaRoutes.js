const express = require('express');
const { getCatalog, getReportSummary } = require('../controllers/metaController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/catalog', requireAuth, getCatalog);
router.get('/report-summary', requireAuth, getReportSummary);

module.exports = router;
