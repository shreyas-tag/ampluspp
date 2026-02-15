const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const env = require('../config/env');

const formatCurrency = (value, currency = 'INR') => {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(amount);
  } catch (_err) {
    return `INR ${amount.toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const resolveLogoPath = () => {
  const repoRoot = path.join(__dirname, '..', '..', '..');
  const explicit = env.invoiceLogoPath?.trim();

  const candidates = [];
  if (explicit) {
    candidates.push(path.isAbsolute(explicit) ? explicit : path.join(repoRoot, explicit));
  }

  candidates.push(path.join(repoRoot, 'assets', 'logo.png'));
  candidates.push(path.join(repoRoot, 'be', 'assets', 'logo.png'));
  candidates.push(path.join(repoRoot, 'fe', 'src', 'assets', 'logo.png'));

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const addKeyValue = (doc, key, value, x, y) => {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748B').text(key, x, y);
  doc.font('Helvetica').fontSize(10).fillColor('#0F172A').text(String(value || '-'), x, y + 12, {
    width: 220
  });
};

const renderInvoicePdf = (invoice, res, { download = false } = {}) => {
  const fileName = `${invoice.invoiceNo || 'invoice'}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${fileName}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 46 });
  doc.pipe(res);

  const startX = 46;
  const pageWidth = 595.28;
  const contentWidth = pageWidth - startX * 2;
  const logoPath = resolveLogoPath();

  doc.font('Helvetica-Bold').fontSize(26).fillColor('#0F172A').text('INVOICE', startX, 48);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#334155')
    .text(env.invoiceCompanyName, startX, 84)
    .text(env.invoiceCompanyAddress, startX, 98, { width: 280 })
    .text(`Phone: ${env.invoiceCompanyPhone}`, startX, 126)
    .text(`Email: ${env.invoiceCompanyEmail}`, startX, 140);

  if (logoPath) {
    doc.image(logoPath, pageWidth - 170, 42, { fit: [124, 72], align: 'right' });
  }

  doc.roundedRect(startX, 170, contentWidth, 80, 8).lineWidth(1).stroke('#CBD5E1');
  addKeyValue(doc, 'Invoice No', invoice.invoiceNo, startX + 12, 182);
  addKeyValue(doc, 'Invoice Date', formatDate(invoice.invoiceDate), startX + 190, 182);
  addKeyValue(doc, 'Due Date', formatDate(invoice.dueDate), startX + 370, 182);
  addKeyValue(doc, 'Status', invoice.status || '-', startX + 12, 216);

  doc.roundedRect(startX, 262, contentWidth, 94, 8).lineWidth(1).stroke('#CBD5E1');
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1E293B').text('Bill To', startX + 12, 274);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#334155')
    .text(invoice.billToName || invoice.client?.companyName || '-', startX + 12, 290)
    .text(invoice.billToAddress || '-', startX + 12, 304, { width: 280 })
    .text(invoice.billToEmail || invoice.client?.email || '-', startX + 12, 332)
    .text(invoice.billToPhone || invoice.client?.mobileNumber || '-', startX + 210, 332);

  addKeyValue(doc, 'Client Code', invoice.client?.clientCode || '-', startX + 330, 274);
  addKeyValue(doc, 'Project ID', invoice.project?.projectId || '-', startX + 330, 304);
  addKeyValue(doc, 'GST No', invoice.billToGstNo || invoice.client?.gstNo || '-', startX + 330, 332);

  let cursorY = 372;
  const tableHeaderHeight = 26;
  const tableInnerPadding = 10;
  const tableLeft = startX + tableInnerPadding;
  const tableInnerWidth = contentWidth - tableInnerPadding * 2;
  const colNoWidth = 24;
  const colDescWidth = 225;
  const colUnitPriceWidth = 90;
  const colQtyWidth = 56;
  const colAmountWidth = tableInnerWidth - (colNoWidth + colDescWidth + colUnitPriceWidth + colQtyWidth);
  const colNoX = tableLeft;
  const colDescX = colNoX + colNoWidth;
  const colUnitPriceX = colDescX + colDescWidth;
  const colQtyX = colUnitPriceX + colUnitPriceWidth;
  const colAmountX = colQtyX + colQtyWidth;

  const drawLineItemHeader = () => {
    doc.roundedRect(startX, cursorY, contentWidth, tableHeaderHeight, 6).fillAndStroke('#E2E8F0', '#E2E8F0');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#334155').text('#', colNoX, cursorY + 9, { width: colNoWidth - 2 });
    doc.text('Description', colDescX, cursorY + 9, { width: colDescWidth - 6 });
    doc.text('Unit Price', colUnitPriceX, cursorY + 9, { width: colUnitPriceWidth - 6, align: 'right' });
    doc.text('Qty', colQtyX, cursorY + 9, { width: colQtyWidth - 6, align: 'right' });
    doc.text('Amount', colAmountX, cursorY + 9, { width: colAmountWidth - 4, align: 'right' });
  };

  const ensureLineItemSpace = (requiredHeight) => {
    const pageBottomSafeY = 700;
    if (cursorY + requiredHeight <= pageBottomSafeY) return;

    doc.addPage({ size: 'A4', margin: 46 });
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0F172A')
      .text(`Invoice ${invoice.invoiceNo || ''} - Line Items`, startX, 52);
    cursorY = 76;
    drawLineItemHeader();
    cursorY += tableHeaderHeight + 6;
  };

  drawLineItemHeader();
  cursorY += tableHeaderHeight + 6;

  const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  items.forEach((item, index) => {
    const description = item.description || '-';
    const descHeight = doc.heightOfString(description, { width: colDescWidth - 8, align: 'left' });
    const rowHeight = Math.max(28, Math.ceil(descHeight) + 12);
    ensureLineItemSpace(rowHeight + 4);

    doc.roundedRect(startX, cursorY - 4, contentWidth, rowHeight, 4).stroke('#E2E8F0');
    const rowTextY = cursorY + 4;

    doc.font('Helvetica').fontSize(9).fillColor('#0F172A').text(String(index + 1), colNoX, rowTextY, {
      width: colNoWidth - 2
    });
    doc.text(description, colDescX, rowTextY, { width: colDescWidth - 8 });
    doc.text(formatCurrency(item.unitPrice || 0, invoice.currency), colUnitPriceX, rowTextY, {
      width: colUnitPriceWidth - 6,
      align: 'right'
    });
    doc.text(String(item.quantity || 0), colQtyX, rowTextY, {
      width: colQtyWidth - 6,
      align: 'right'
    });
    doc.text(formatCurrency(item.amount || 0, invoice.currency), colAmountX, rowTextY, {
      width: colAmountWidth - 4,
      align: 'right'
    });
    cursorY += rowHeight + 4;
  });

  if (items.length === 0) {
    ensureLineItemSpace(32);
    doc.roundedRect(startX, cursorY - 4, contentWidth, 28, 4).stroke('#E2E8F0');
    doc.font('Helvetica').fontSize(9).fillColor('#64748B').text('No line items', colDescX, cursorY + 6, {
      width: colDescWidth
    });
    cursorY += 32;
  }

  const summaryWidth = 210;
  const summaryOuterPadding = 8;
  // Anchor totals box to content-right boundary so it keeps same page margins as upper sections.
  const summaryX = startX + contentWidth - summaryWidth - summaryOuterPadding;
  const renderSummaryLine = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#334155').text(label, summaryX, cursorY, {
      width: 110
    });
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(10)
      .fillColor('#0F172A')
      .text(formatCurrency(value, invoice.currency), summaryX + 110, cursorY, {
        width: 100,
        align: 'right'
      });
    cursorY += 18;
  };

  cursorY += 8;
  if (cursorY + 150 > 760) {
    doc.addPage({ size: 'A4', margin: 46 });
    cursorY = 72;
  }
  doc.roundedRect(summaryX - summaryOuterPadding, cursorY - 8, summaryWidth + 16, 126, 8).stroke('#CBD5E1');
  renderSummaryLine('Sub Total', invoice.subTotal || 0);
  renderSummaryLine('Tax', invoice.taxAmount || 0);
  renderSummaryLine('Discount', invoice.discountAmount || 0);
  renderSummaryLine('Paid', invoice.paidAmount || 0);
  doc
    .moveTo(summaryX - summaryOuterPadding, cursorY)
    .lineTo(summaryX + summaryWidth + summaryOuterPadding, cursorY)
    .stroke('#CBD5E1');
  cursorY += 8;
  renderSummaryLine('Balance', invoice.balanceAmount || 0, true);
  renderSummaryLine('Total', invoice.totalAmount || 0, true);

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#64748B')
    .text('This is a system-generated invoice.', startX, 786, { align: 'center', width: contentWidth });

  doc.end();
};

module.exports = { renderInvoicePdf };
