const { StatusCodes } = require('http-status-codes');
const Client = require('../models/Client');
const Project = require('../models/Project');
const { Invoice, INVOICE_STATUS, PAYMENT_METHOD } = require('../models/Invoice');
const { generateInvoiceId } = require('../utils/idGenerator');
const { broadcastEvent } = require('../utils/realtime');
const { logAudit } = require('../utils/auditLog');
const { renderInvoicePdf } = require('../utils/invoicePdf');

const VALID_STATUSES = new Set(Object.values(INVOICE_STATUS));
const VALID_METHODS = new Set(Object.values(PAYMENT_METHOD));

const parseNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const cleanString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const normalizeLineItems = (lineItems = []) =>
  (Array.isArray(lineItems) ? lineItems : [])
    .map((item) => {
      const description = cleanString(item?.description);
      const quantity = Math.max(parseNumber(item?.quantity, 1), 0);
      const unitPrice = Math.max(parseNumber(item?.unitPrice, 0), 0);
      const amount = Number((quantity * unitPrice).toFixed(2));

      if (!description) return null;
      return { description, quantity, unitPrice, amount };
    })
    .filter(Boolean);

const sumPayments = (payments = []) =>
  Number(
    (Array.isArray(payments) ? payments : []).reduce((sum, payment) => sum + parseNumber(payment?.amount, 0), 0).toFixed(2)
  );

const calculateTotals = ({ lineItems = [], taxPercent = 0, discountAmount = 0, payments = [] }) => {
  const itemTotal = lineItems.reduce((sum, item) => sum + parseNumber(item.amount, 0), 0);
  const subTotal = Number(itemTotal.toFixed(2));
  const tax = Math.max(parseNumber(taxPercent, 0), 0);
  const taxAmount = Number(((subTotal * tax) / 100).toFixed(2));
  const discount = Math.max(parseNumber(discountAmount, 0), 0);
  const totalAmount = Number(Math.max(subTotal + taxAmount - discount, 0).toFixed(2));
  const paidAmount = sumPayments(payments);
  const balanceAmount = Number(Math.max(totalAmount - paidAmount, 0).toFixed(2));

  return { subTotal, taxAmount, totalAmount, paidAmount, balanceAmount };
};

const derivedStatus = (invoiceLike) => {
  if (invoiceLike.status === INVOICE_STATUS.CANCELLED) return INVOICE_STATUS.CANCELLED;
  if (invoiceLike.status === INVOICE_STATUS.DRAFT) return INVOICE_STATUS.DRAFT;

  if (invoiceLike.totalAmount > 0 && invoiceLike.paidAmount >= invoiceLike.totalAmount) return INVOICE_STATUS.PAID;
  if (invoiceLike.paidAmount > 0 && invoiceLike.balanceAmount > 0) return INVOICE_STATUS.PARTIALLY_PAID;

  if (
    invoiceLike.dueDate &&
    new Date(invoiceLike.dueDate).getTime() < Date.now() &&
    invoiceLike.balanceAmount > 0 &&
    invoiceLike.status !== INVOICE_STATUS.DRAFT
  ) {
    return INVOICE_STATUS.OVERDUE;
  }

  return INVOICE_STATUS.ISSUED;
};

const syncComputedFields = (invoice) => {
  const items = normalizeLineItems(invoice.lineItems || []);
  invoice.lineItems = items;
  invoice.taxPercent = Math.max(parseNumber(invoice.taxPercent, 0), 0);
  invoice.discountAmount = Math.max(parseNumber(invoice.discountAmount, 0), 0);

  const totals = calculateTotals({
    lineItems: items,
    taxPercent: invoice.taxPercent,
    discountAmount: invoice.discountAmount,
    payments: invoice.payments || []
  });

  invoice.subTotal = totals.subTotal;
  invoice.taxAmount = totals.taxAmount;
  invoice.totalAmount = totals.totalAmount;
  invoice.paidAmount = totals.paidAmount;
  invoice.balanceAmount = totals.balanceAmount;
  invoice.status = derivedStatus(invoice);
};

const buildSearchFilter = (search) => {
  const query = cleanString(search);
  if (!query) return null;
  const regex = new RegExp(query, 'i');
  return {
    $or: [{ invoiceNo: regex }, { subject: regex }, { billToName: regex }, { billToEmail: regex }]
  };
};

const listInvoices = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.clientId) filter.client = req.query.clientId;
    if (req.query.projectId) filter.project = req.query.projectId;
    if (req.query.status && VALID_STATUSES.has(req.query.status)) filter.status = req.query.status;

    const searchFilter = buildSearchFilter(req.query.search);
    if (searchFilter) Object.assign(filter, searchFilter);

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('client', 'clientCode companyName')
        .populate('project', 'projectId schemeName')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter)
    ]);

    res.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    next(err);
  }
};

const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'clientCode companyName contactPerson mobileNumber email factoryAddress gstNo')
      .populate('project', 'projectId schemeName applicationNo')
      .populate('payments.recordedBy', 'name email')
      .populate('timeline.actor', 'name email')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    if (!invoice) {
      const err = new Error('Invoice not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    res.json({ invoice });
  } catch (err) {
    next(err);
  }
};

const ensureClientAndProject = async ({ clientId, projectId }) => {
  let client = null;
  let project = null;

  if (projectId) {
    project = await Project.findById(projectId).select('_id projectId client schemeName').lean();
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }
  }

  const resolvedClientId = clientId || project?.client;
  if (!resolvedClientId) {
    const err = new Error('clientId is required');
    err.statusCode = StatusCodes.BAD_REQUEST;
    throw err;
  }

  client = await Client.findById(resolvedClientId).select('_id clientCode companyName email mobileNumber gstNo').lean();
  if (!client) {
    const err = new Error('Client not found');
    err.statusCode = StatusCodes.BAD_REQUEST;
    throw err;
  }

  if (project && String(project.client) !== String(client._id)) {
    const err = new Error('Selected project does not belong to selected client');
    err.statusCode = StatusCodes.BAD_REQUEST;
    throw err;
  }

  return { client, project };
};

const createInvoice = async (req, res, next) => {
  try {
    const { client, project } = await ensureClientAndProject({
      clientId: req.body.clientId,
      projectId: req.body.projectId
    });

    const lineItems = normalizeLineItems(req.body.lineItems || []);
    if (lineItems.length === 0) {
      const err = new Error('At least one line item is required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const invoiceNo = await generateInvoiceId();
    const now = new Date();
    const draftRequested = cleanString(req.body.status) === INVOICE_STATUS.DRAFT;

    const invoice = await Invoice.create({
      invoiceNo,
      client: client._id,
      project: project?._id,
      currency: cleanString(req.body.currency || 'INR') || 'INR',
      invoiceDate: parseDate(req.body.invoiceDate) || now,
      dueDate: parseDate(req.body.dueDate),
      subject: cleanString(req.body.subject),
      billToName: cleanString(req.body.billToName) || client.companyName,
      billToEmail: cleanString(req.body.billToEmail) || client.email,
      billToPhone: cleanString(req.body.billToPhone) || client.mobileNumber,
      billToAddress: cleanString(req.body.billToAddress),
      billToGstNo: cleanString(req.body.billToGstNo) || client.gstNo,
      notes: cleanString(req.body.notes),
      taxPercent: Math.max(parseNumber(req.body.taxPercent, 0), 0),
      discountAmount: Math.max(parseNumber(req.body.discountAmount, 0), 0),
      lineItems,
      payments: [],
      status: draftRequested ? INVOICE_STATUS.DRAFT : INVOICE_STATUS.ISSUED,
      createdBy: req.user._id,
      updatedBy: req.user._id,
      timeline: [
        {
          type: 'INVOICE_CREATED',
          message: `Invoice ${invoiceNo} created`,
          actor: req.user._id,
          at: now
        }
      ]
    });

    syncComputedFields(invoice);
    await invoice.save();

    await broadcastEvent({
      type: 'INVOICE_CREATED',
      title: 'Invoice created',
      message: `${invoice.invoiceNo} created for ${client.companyName}`,
      payload: { invoiceId: invoice._id, clientId: client._id, projectId: project?._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: invoice._id,
      actor: req.user._id,
      after: {
        invoiceNo: invoice.invoiceNo,
        client: client.companyName,
        projectId: project?.projectId,
        totalAmount: invoice.totalAmount,
        status: invoice.status
      },
      req
    });

    res.status(StatusCodes.CREATED).json({ invoice });
  } catch (err) {
    next(err);
  }
};

const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const before = invoice.toObject();

    const needsEntitySync = Object.prototype.hasOwnProperty.call(req.body, 'clientId') ||
      Object.prototype.hasOwnProperty.call(req.body, 'projectId');

    if (needsEntitySync) {
      const { client, project } = await ensureClientAndProject({
        clientId: req.body.clientId || invoice.client,
        projectId:
          Object.prototype.hasOwnProperty.call(req.body, 'projectId') && req.body.projectId !== ''
            ? req.body.projectId
            : invoice.project
      });
      invoice.client = client._id;
      invoice.project = project?._id || null;
    }

    const fieldMap = {
      invoiceDate: parseDate,
      dueDate: parseDate,
      subject: cleanString,
      billToName: cleanString,
      billToEmail: cleanString,
      billToPhone: cleanString,
      billToAddress: cleanString,
      billToGstNo: cleanString,
      notes: cleanString,
      currency: (value) => cleanString(value || 'INR') || 'INR',
      taxPercent: (value) => Math.max(parseNumber(value, 0), 0),
      discountAmount: (value) => Math.max(parseNumber(value, 0), 0)
    };

    Object.entries(fieldMap).forEach(([field, parser]) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        invoice[field] = parser(req.body[field]);
      }
    });

    if (Object.prototype.hasOwnProperty.call(req.body, 'lineItems')) {
      invoice.lineItems = normalizeLineItems(req.body.lineItems);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      const requestedStatus = cleanString(req.body.status);
      if (requestedStatus === INVOICE_STATUS.CANCELLED || requestedStatus === INVOICE_STATUS.DRAFT) {
        invoice.status = requestedStatus;
      }
      if (requestedStatus === INVOICE_STATUS.ISSUED && invoice.status === INVOICE_STATUS.DRAFT) {
        invoice.status = INVOICE_STATUS.ISSUED;
      }
    }

    syncComputedFields(invoice);
    invoice.updatedBy = req.user._id;
    invoice.timeline.push({
      type: 'INVOICE_UPDATED',
      message: `Invoice ${invoice.invoiceNo} details updated`,
      actor: req.user._id,
      at: new Date()
    });
    await invoice.save();

    await broadcastEvent({
      type: 'INVOICE_UPDATED',
      title: 'Invoice updated',
      message: `${invoice.invoiceNo} was updated`,
      payload: { invoiceId: invoice._id, status: invoice.status },
      actorId: req.user._id
    });

    await logAudit({
      action: 'INVOICE_UPDATED',
      entityType: 'INVOICE',
      entityId: invoice._id,
      actor: req.user._id,
      before: {
        status: before.status,
        totalAmount: before.totalAmount,
        paidAmount: before.paidAmount,
        balanceAmount: before.balanceAmount
      },
      after: {
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        balanceAmount: invoice.balanceAmount
      },
      req
    });

    res.json({ invoice });
  } catch (err) {
    next(err);
  }
};

const addInvoicePayment = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    if (invoice.status === INVOICE_STATUS.CANCELLED) {
      const err = new Error('Cannot add payments to a cancelled invoice');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const amount = Math.max(parseNumber(req.body.amount, 0), 0);
    if (!amount) {
      const err = new Error('Payment amount must be greater than 0');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const method = cleanString(req.body.method) || PAYMENT_METHOD.OFFLINE;
    if (!VALID_METHODS.has(method)) {
      const err = new Error('Invalid payment method');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    invoice.payments.push({
      amount,
      paidOn: parseDate(req.body.paidOn) || new Date(),
      method,
      referenceNo: cleanString(req.body.referenceNo),
      note: cleanString(req.body.note),
      recordedBy: req.user._id,
      createdAt: new Date()
    });

    syncComputedFields(invoice);
    invoice.updatedBy = req.user._id;
    invoice.timeline.push({
      type: 'INVOICE_PAYMENT_ADDED',
      message: `Payment of ${amount} added`,
      actor: req.user._id,
      at: new Date()
    });
    await invoice.save();

    await broadcastEvent({
      type: 'INVOICE_PAYMENT_ADDED',
      title: 'Invoice payment recorded',
      message: `${invoice.invoiceNo} payment updated`,
      payload: { invoiceId: invoice._id, status: invoice.status, paidAmount: invoice.paidAmount },
      actorId: req.user._id
    });

    await logAudit({
      action: 'INVOICE_PAYMENT_ADDED',
      entityType: 'INVOICE',
      entityId: invoice._id,
      actor: req.user._id,
      after: {
        paymentAmount: amount,
        paymentMethod: method,
        status: invoice.status,
        paidAmount: invoice.paidAmount,
        balanceAmount: invoice.balanceAmount
      },
      req
    });

    res.status(StatusCodes.CREATED).json({ invoice });
  } catch (err) {
    next(err);
  }
};

const updateInvoiceStatus = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const targetStatus = cleanString(req.body.status);
    if (!VALID_STATUSES.has(targetStatus)) {
      const err = new Error('Invalid status');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const beforeStatus = invoice.status;
    const now = new Date();
    const statusNote = cleanString(req.body.note);

    if (targetStatus === INVOICE_STATUS.PARTIALLY_PAID) {
      const partialAmount = Math.max(parseNumber(req.body.amount, 0), 0);
      if (!partialAmount) {
        const err = new Error('Provide payment amount to mark as PARTIALLY_PAID');
        err.statusCode = StatusCodes.BAD_REQUEST;
        throw err;
      }

      const partialMethod = cleanString(req.body.method) || PAYMENT_METHOD.OFFLINE;
      if (!VALID_METHODS.has(partialMethod)) {
        const err = new Error('Invalid payment method');
        err.statusCode = StatusCodes.BAD_REQUEST;
        throw err;
      }

      invoice.payments.push({
        amount: Math.min(partialAmount, invoice.balanceAmount),
        paidOn: parseDate(req.body.paidOn) || now,
        method: partialMethod,
        referenceNo: cleanString(req.body.referenceNo),
        note: statusNote || 'Partial payment recorded via status update',
        recordedBy: req.user._id,
        createdAt: now
      });
    }

    if (targetStatus === INVOICE_STATUS.PAID && invoice.balanceAmount > 0) {
      const autoMethod = cleanString(req.body.method) || PAYMENT_METHOD.OFFLINE;
      if (!VALID_METHODS.has(autoMethod)) {
        const err = new Error('Invalid payment method');
        err.statusCode = StatusCodes.BAD_REQUEST;
        throw err;
      }

      invoice.payments.push({
        amount: invoice.balanceAmount,
        paidOn: parseDate(req.body.paidOn) || now,
        method: autoMethod,
        referenceNo: cleanString(req.body.referenceNo),
        note: statusNote || 'Settled offline via status update',
        recordedBy: req.user._id,
        createdAt: now
      });
    }

    invoice.status = targetStatus;
    syncComputedFields(invoice);

    if (targetStatus === INVOICE_STATUS.CANCELLED || targetStatus === INVOICE_STATUS.DRAFT) {
      invoice.status = targetStatus;
    }

    if (targetStatus === INVOICE_STATUS.ISSUED && invoice.status === INVOICE_STATUS.DRAFT) {
      invoice.status = INVOICE_STATUS.ISSUED;
    }

    if (targetStatus === INVOICE_STATUS.OVERDUE) {
      invoice.status = INVOICE_STATUS.OVERDUE;
    }

    invoice.updatedBy = req.user._id;
    invoice.timeline.push({
      type: 'INVOICE_STATUS_UPDATED',
      message: `Status changed from ${beforeStatus} to ${invoice.status}${statusNote ? ` (${statusNote})` : ''}`,
      actor: req.user._id,
      at: now
    });
    await invoice.save();

    await broadcastEvent({
      type: 'INVOICE_STATUS_UPDATED',
      title: 'Invoice status updated',
      message: `${invoice.invoiceNo}: ${beforeStatus} -> ${invoice.status}`,
      payload: { invoiceId: invoice._id, status: invoice.status },
      actorId: req.user._id
    });

    await logAudit({
      action: 'INVOICE_STATUS_UPDATED',
      entityType: 'INVOICE',
      entityId: invoice._id,
      actor: req.user._id,
      before: { status: beforeStatus },
      after: { status: invoice.status },
      metadata: { note: statusNote || undefined },
      req
    });

    res.json({ invoice });
  } catch (err) {
    next(err);
  }
};

const streamInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client', 'clientCode companyName email mobileNumber gstNo factoryAddress')
      .populate('project', 'projectId schemeName')
      .lean();

    if (!invoice) {
      const err = new Error('Invoice not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    renderInvoicePdf(invoice, res, {
      download: req.query.download === '1'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  addInvoicePayment,
  updateInvoiceStatus,
  streamInvoicePdf
};
