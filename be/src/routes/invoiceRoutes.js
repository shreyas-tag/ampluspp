const express = require('express');
const {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  addInvoicePayment,
  updateInvoiceStatus,
  streamInvoicePdf
} = require('../controllers/invoiceController');
const { requireAuth, adminOnly, requireModuleAccess } = require('../middlewares/auth');
const { APP_MODULES } = require('../constants/modules');

const router = express.Router();

router.use(requireAuth, requireModuleAccess(APP_MODULES.INVOICES));
router.get('/', listInvoices);
router.get('/:id', getInvoiceById);
router.get('/:id/pdf', streamInvoicePdf);
router.post('/', adminOnly, createInvoice);
router.patch('/:id', adminOnly, updateInvoice);
router.patch('/:id/status', adminOnly, updateInvoiceStatus);
router.post('/:id/payments', adminOnly, addInvoicePayment);

module.exports = router;
