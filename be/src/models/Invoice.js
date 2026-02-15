const mongoose = require('mongoose');

const INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED'
};

const PAYMENT_METHOD = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  CASH: 'CASH',
  UPI: 'UPI',
  CHEQUE: 'CHEQUE',
  OFFLINE: 'OFFLINE',
  OTHER: 'OTHER'
};

const invoiceLineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 0, default: 1 },
    unitPrice: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 }
  },
  { _id: true }
);

const invoicePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paidOn: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      default: PAYMENT_METHOD.BANK_TRANSFER
    },
    referenceNo: { type: String, trim: true },
    note: { type: String, trim: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const invoiceTimelineSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    message: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, unique: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUS),
      default: INVOICE_STATUS.ISSUED,
      index: true
    },
    currency: { type: String, default: 'INR', trim: true },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    subject: { type: String, trim: true },
    billToName: { type: String, trim: true },
    billToEmail: { type: String, trim: true, lowercase: true },
    billToPhone: { type: String, trim: true },
    billToAddress: { type: String, trim: true },
    billToGstNo: { type: String, trim: true },
    notes: { type: String, trim: true },
    lineItems: [invoiceLineItemSchema],
    subTotal: { type: Number, min: 0, default: 0 },
    taxPercent: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, default: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    balanceAmount: { type: Number, min: 0, default: 0 },
    payments: [invoicePaymentSchema],
    timeline: [invoiceTimelineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ client: 1, project: 1, status: 1 });

module.exports = {
  Invoice: mongoose.model('Invoice', invoiceSchema),
  INVOICE_STATUS,
  PAYMENT_METHOD
};
