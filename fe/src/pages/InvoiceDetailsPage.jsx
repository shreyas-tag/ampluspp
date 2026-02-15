import { useEffect, useState } from 'react';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocketEvents } from '../context/SocketContext';
import PageHeader from '../components/PageHeader';
import { formatAbsoluteDate, formatAbsoluteDateTime, formatSmartDateTime } from '../utils/dateFormat';

const STATUS_OPTIONS = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
const PAYMENT_METHOD_OPTIONS = ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'OFFLINE', 'OTHER'];

const initialPaymentForm = {
  amount: '',
  paidOn: '',
  method: 'OFFLINE',
  referenceNo: '',
  note: ''
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const invoiceStatusClass = (status) => {
  if (status === 'PAID') return 'status-completed';
  if (status === 'PARTIALLY_PAID') return 'status-in-progress';
  if (status === 'OVERDUE') return 'due-overdue';
  if (status === 'CANCELLED') return 'status-skipped';
  if (status === 'ISSUED') return 'status-pending';
  return 'neutral';
};

function InvoiceDetailsPage() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const { lastEvent } = useSocketEvents();
  const navigate = useNavigate();
  const location = useLocation();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pdfActionId, setPdfActionId] = useState('');

  const [statusDraft, setStatusDraft] = useState('ISSUED');
  const [statusNote, setStatusNote] = useState('');
  const [statusAmount, setStatusAmount] = useState('');
  const [statusPaidOn, setStatusPaidOn] = useState('');
  const [statusMethod, setStatusMethod] = useState('OFFLINE');
  const [statusReferenceNo, setStatusReferenceNo] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const backTo = location.state?.from || '/invoices';

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/invoices/${id}`);
      const nextInvoice = data?.invoice || null;
      setInvoice(nextInvoice);
      setStatusDraft(nextInvoice?.status || 'ISSUED');
      setStatusNote('');
      setStatusAmount('');
      setStatusPaidOn('');
      setStatusMethod('OFFLINE');
      setStatusReferenceNo('');
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  useEffect(() => {
    if (!lastEvent?.type || !String(lastEvent.type).startsWith('INVOICE_')) return;
    loadInvoice();
  }, [lastEvent?.id]);

  const goBack = () => {
    navigate(backTo);
  };

  const viewPdf = () => {
    navigate(`/invoices/${id}/pdf`, {
      state: { from: `${location.pathname}${location.search}` }
    });
  };

  const downloadPdf = async () => {
    if (!invoice?._id) return;
    setPdfActionId(invoice._id);
    try {
      const { data } = await api.get(`/invoices/${invoice._id}/pdf`, {
        responseType: 'blob'
      });
      const pdfBlob = new Blob([data], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const anchor = document.createElement('a');
      anchor.href = pdfUrl;
      anchor.download = `${invoice.invoiceNo || 'invoice'}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPdfActionId('');
    }
  };

  const saveInvoiceStatus = async () => {
    if (!invoice?._id) return;
    if (statusDraft === 'PARTIALLY_PAID' && !toNumber(statusAmount)) {
      setError('Enter partial payment amount before saving PARTIALLY_PAID status.');
      return;
    }

    setStatusSaving(true);
    try {
      await api.patch(`/invoices/${invoice._id}/status`, {
        status: statusDraft,
        note: statusNote,
        amount: statusAmount ? toNumber(statusAmount) : undefined,
        paidOn: statusPaidOn || undefined,
        method: statusMethod || undefined,
        referenceNo: statusReferenceNo || undefined
      });
      await loadInvoice();
      setSuccessMessage('Invoice status updated');
      setTimeout(() => setSuccessMessage(''), 2200);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setStatusSaving(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    if (!invoice?._id) return;

    setPaymentSaving(true);
    try {
      await api.post(`/invoices/${invoice._id}/payments`, {
        amount: toNumber(paymentForm.amount),
        paidOn: paymentForm.paidOn || null,
        method: paymentForm.method,
        referenceNo: paymentForm.referenceNo,
        note: paymentForm.note
      });
      setPaymentForm(initialPaymentForm);
      await loadInvoice();
      setSuccessMessage('Payment recorded successfully');
      setTimeout(() => setSuccessMessage(''), 2200);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPaymentSaving(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        title={invoice?.invoiceNo || 'Invoice Details'}
        subtitle="Invoice details, payments, status trail, and PDF actions."
        rightSlot={(
          <div className="toolbar-row">
            <button className="btn btn-secondary btn-compact" onClick={goBack}>
              <ArrowLeft size={14} />
              Back
            </button>
            <button className="btn btn-secondary btn-compact" onClick={viewPdf} disabled={!invoice?._id}>
              <Eye size={14} />
              View PDF
            </button>
            <button className="btn btn-secondary btn-compact" onClick={downloadPdf} disabled={!invoice?._id || pdfActionId === invoice?._id}>
              <Download size={14} />
              Download
            </button>
          </div>
        )}
      />

      {error ? <p className="error-text">{error}</p> : null}
      {successMessage ? <p className="success-text">{successMessage}</p> : null}

      {loading ? (
        <article className="card">
          <p className="muted-text">Loading invoice details...</p>
        </article>
      ) : !invoice ? (
        <article className="card">
          <p className="muted-text">No details available.</p>
        </article>
      ) : (
        <>
          <div className="task-detail-grid">
            <div className="info-tile">
              <small>Client</small>
              <strong>{invoice.client?.companyName || '-'}</strong>
            </div>
            <div className="info-tile">
              <small>Project</small>
              <strong>{invoice.project?.projectId || '-'}</strong>
            </div>
            <div className="info-tile">
              <small>Status</small>
              <strong>
                <span className={`tag ${invoiceStatusClass(invoice.status)}`}>{invoice.status}</span>
              </strong>
            </div>
            <div className="info-tile">
              <small>Due Date</small>
              <strong>{formatAbsoluteDate(invoice.dueDate)}</strong>
            </div>
          </div>

          <article className="card compact">
            <div className="section-head">
              <h4>Amounts</h4>
            </div>
            <p>
              <strong>Sub Total:</strong> {formatMoney(invoice.subTotal)}
            </p>
            <p>
              <strong>Tax:</strong> {formatMoney(invoice.taxAmount)}
            </p>
            <p>
              <strong>Total:</strong> {formatMoney(invoice.totalAmount)}
            </p>
            <p>
              <strong>Paid:</strong> {formatMoney(invoice.paidAmount)}
            </p>
            <p>
              <strong>Balance:</strong> {formatMoney(invoice.balanceAmount)}
            </p>
          </article>

          <article className="card compact">
            <div className="section-head">
              <h4>Line Items</h4>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Description</th>
                    <th>Unit Price</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.lineItems || []).map((item, index) => (
                    <tr key={item._id || index}>
                      <td>{index + 1}</td>
                      <td>{item.description}</td>
                      <td>{formatMoney(item.unitPrice)}</td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(item.amount)}</td>
                    </tr>
                  ))}
                  {(invoice.lineItems || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-cell">
                        No line items
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card compact">
            <div className="section-head">
              <h4>Payments</h4>
              <span className="table-count">{(invoice.payments || []).length} entries</span>
            </div>
            {(invoice.payments || []).length === 0 ? (
              <p className="muted-text">No payment entries yet.</p>
            ) : (
              <ul className="event-list">
                {invoice.payments.map((payment) => (
                  <li key={payment._id}>
                    <p>
                      <strong>{formatMoney(payment.amount)}</strong> via {payment.method}
                    </p>
                    <div className="record-meta">
                      <span>{formatAbsoluteDateTime(payment.paidOn)}</span>
                      <span className="meta-sep">•</span>
                      <span>By {payment.recordedBy?.name || payment.recordedBy?.email || 'Unknown user'}</span>
                      {payment.referenceNo ? (
                        <>
                          <span className="meta-sep">•</span>
                          <span>{payment.referenceNo}</span>
                        </>
                      ) : null}
                    </div>
                    {payment.note ? <p className="sub-cell">{payment.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="card compact">
            <div className="section-head">
              <h4>Invoice Timeline</h4>
            </div>
            {(invoice.timeline || []).length === 0 ? (
              <p className="muted-text">No timeline entries.</p>
            ) : (
              <ul className="timeline-list">
                {invoice.timeline
                  .slice()
                  .reverse()
                  .map((entry, index) => (
                    <li key={`${entry.type}-${index}`} className="timeline-entry tone-info">
                      <p>{entry.message}</p>
                      <div className="record-meta">
                        <span>{entry.type}</span>
                        <span className="meta-sep">•</span>
                        <span>{entry.actor?.name || entry.actor?.email || 'System'}</span>
                        <span className="meta-sep">•</span>
                        <span>{formatSmartDateTime(entry.at)}</span>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </article>

          {isAdmin ? (
            <div className="split-grid">
              <article className="card compact">
                <div className="section-head">
                  <h4>Update Status</h4>
                </div>
                <label>
                  Status
                  <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                {statusDraft === 'PARTIALLY_PAID' || statusDraft === 'PAID' ? (
                  <>
                    {statusDraft === 'PARTIALLY_PAID' ? (
                      <label>
                        Payment Amount *
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={statusAmount}
                          onChange={(event) => setStatusAmount(event.target.value)}
                          required
                        />
                      </label>
                    ) : null}
                    <label>
                      Paid On
                      <input type="date" value={statusPaidOn} onChange={(event) => setStatusPaidOn(event.target.value)} />
                    </label>
                    <label>
                      Method
                      <select value={statusMethod} onChange={(event) => setStatusMethod(event.target.value)}>
                        {PAYMENT_METHOD_OPTIONS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Reference No
                      <input value={statusReferenceNo} onChange={(event) => setStatusReferenceNo(event.target.value)} />
                    </label>
                  </>
                ) : null}
                <label>
                  Note
                  <textarea rows={2} value={statusNote} onChange={(event) => setStatusNote(event.target.value)} />
                </label>
                <div className="form-actions">
                  <button className="btn btn-primary btn-compact" onClick={saveInvoiceStatus} disabled={statusSaving}>
                    {statusSaving ? 'Saving...' : 'Save Status'}
                  </button>
                </div>
              </article>

              <article className="card compact">
                <div className="section-head">
                  <h4>Add Payment</h4>
                </div>
                <form className="grid-form" onSubmit={submitPayment}>
                  <label>
                    Amount *
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.amount}
                      onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Paid On
                    <input
                      type="date"
                      value={paymentForm.paidOn}
                      onChange={(event) => setPaymentForm((prev) => ({ ...prev, paidOn: event.target.value }))}
                    />
                  </label>
                  <label>
                    Method
                    <select value={paymentForm.method} onChange={(event) => setPaymentForm((prev) => ({ ...prev, method: event.target.value }))}>
                      {PAYMENT_METHOD_OPTIONS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reference No
                    <input
                      value={paymentForm.referenceNo}
                      onChange={(event) => setPaymentForm((prev) => ({ ...prev, referenceNo: event.target.value }))}
                    />
                  </label>
                  <label className="full-row">
                    Note
                    <textarea
                      rows={2}
                      value={paymentForm.note}
                      onChange={(event) => setPaymentForm((prev) => ({ ...prev, note: event.target.value }))}
                    />
                  </label>
                  <div className="modal-actions">
                    <button className="btn btn-primary btn-compact" type="submit" disabled={paymentSaving}>
                      {paymentSaving ? 'Saving...' : 'Record Payment'}
                    </button>
                  </div>
                </form>
              </article>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default InvoiceDetailsPage;
