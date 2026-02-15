import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Plus, Search } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useSocketEvents } from '../context/SocketContext';
import { formatAbsoluteDate, formatAbsoluteDateTime, formatSmartDateTime } from '../utils/dateFormat';

const STATUS_OPTIONS = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
const PAYMENT_METHOD_OPTIONS = ['BANK_TRANSFER', 'UPI', 'CHEQUE', 'CASH', 'OFFLINE', 'OTHER'];
const INVOICE_STEPS = [
  { step: 1, label: 'Project / Client Info' },
  { step: 2, label: 'Contact Info' },
  { step: 3, label: 'Line Items & Totals' }
];

const createLineItem = () => ({ description: '', quantity: 1, unitPrice: '' });

const initialInvoiceForm = {
  clientId: '',
  projectId: '',
  invoiceDate: '',
  dueDate: '',
  subject: '',
  billToName: '',
  billToEmail: '',
  billToPhone: '',
  billToAddress: '',
  billToGstNo: '',
  taxPercent: '0',
  discountAmount: '0',
  status: 'ISSUED',
  notes: '',
  lineItems: [createLineItem()]
};

const initialPaymentForm = {
  amount: '',
  paidOn: '',
  method: 'OFFLINE',
  referenceNo: '',
  note: ''
};

const formatMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const invoiceStatusClass = (status) => {
  if (status === 'PAID') return 'status-completed';
  if (status === 'PARTIALLY_PAID') return 'status-in-progress';
  if (status === 'OVERDUE') return 'due-overdue';
  if (status === 'CANCELLED') return 'status-skipped';
  if (status === 'ISSUED') return 'status-pending';
  return 'neutral';
};

function InvoicesPage() {
  const { isAdmin } = useAuth();
  const { lastEvent } = useSocketEvents();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [invoiceForm, setInvoiceForm] = useState(initialInvoiceForm);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editStep, setEditStep] = useState(1);
  const [editForm, setEditForm] = useState(initialInvoiceForm);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [statusDraft, setStatusDraft] = useState('ISSUED');
  const [statusNote, setStatusNote] = useState('');
  const [statusAmount, setStatusAmount] = useState('');
  const [statusPaidOn, setStatusPaidOn] = useState('');
  const [statusMethod, setStatusMethod] = useState('OFFLINE');
  const [statusReferenceNo, setStatusReferenceNo] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [pdfActionId, setPdfActionId] = useState('');

  const [filters, setFilters] = useState(() => ({
    search: searchParams.get('search') || '',
    clientId: searchParams.get('clientId') || '',
    projectId: searchParams.get('projectId') || '',
    status: searchParams.get('status') || '',
    page: Number(searchParams.get('page') || '1')
  }));

  const filteredProjects = useMemo(() => {
    if (!invoiceForm.clientId) return projects;
    return projects.filter((project) => String(project?.client?._id || '') === String(invoiceForm.clientId));
  }, [projects, invoiceForm.clientId]);

  const filteredEditProjects = useMemo(() => {
    if (!editForm.clientId) return projects;
    return projects.filter((project) => String(project?.client?._id || '') === String(editForm.clientId));
  }, [projects, editForm.clientId]);

  const createTotals = useMemo(() => {
    const lineTotal = (invoiceForm.lineItems || []).reduce((sum, item) => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unitPrice);
      return sum + quantity * unitPrice;
    }, 0);
    const subTotal = lineTotal;
    const tax = (subTotal * toNumber(invoiceForm.taxPercent)) / 100;
    const total = Math.max(subTotal + tax - toNumber(invoiceForm.discountAmount), 0);
    return { subTotal, tax, total };
  }, [invoiceForm]);

  const editTotals = useMemo(() => {
    const lineTotal = (editForm.lineItems || []).reduce((sum, item) => {
      const quantity = toNumber(item.quantity);
      const unitPrice = toNumber(item.unitPrice);
      return sum + quantity * unitPrice;
    }, 0);
    const subTotal = lineTotal;
    const tax = (subTotal * toNumber(editForm.taxPercent)) / 100;
    const total = Math.max(subTotal + tax - toNumber(editForm.discountAmount), 0);
    return { subTotal, tax, total };
  }, [editForm]);

  const syncUrlFilters = (nextFilters) => {
    const params = new URLSearchParams();
    if (nextFilters.search) params.set('search', nextFilters.search);
    if (nextFilters.clientId) params.set('clientId', nextFilters.clientId);
    if (nextFilters.projectId) params.set('projectId', nextFilters.projectId);
    if (nextFilters.status) params.set('status', nextFilters.status);
    if (nextFilters.page > 1) params.set('page', String(nextFilters.page));
    setSearchParams(params, { replace: true });
  };

  const loadLookups = async () => {
    try {
      const [clientsResponse, projectsResponse] = await Promise.all([api.get('/clients'), api.get('/projects')]);
      setClients(clientsResponse.data?.clients || []);
      setProjects(projectsResponse.data?.projects || []);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const loadInvoices = async (override = {}) => {
    const nextFilters = { ...filters, ...override };
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextFilters.search) params.set('search', nextFilters.search);
      if (nextFilters.clientId) params.set('clientId', nextFilters.clientId);
      if (nextFilters.projectId) params.set('projectId', nextFilters.projectId);
      if (nextFilters.status) params.set('status', nextFilters.status);
      params.set('page', String(nextFilters.page || 1));
      params.set('limit', String(pagination.limit || 20));

      const { data } = await api.get(`/invoices?${params.toString()}`);
      setInvoices(data?.invoices || []);
      setPagination((prev) => ({
        ...prev,
        ...(data?.pagination || {}),
        limit: data?.pagination?.limit || prev.limit || 20
      }));
      setFilters(nextFilters);
      syncUrlFilters(nextFilters);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceDetails = async (invoiceId) => {
    setDetailsLoading(true);
    try {
      const { data } = await api.get(`/invoices/${invoiceId}`);
      setInvoiceDetails(data.invoice);
      setStatusDraft(data?.invoice?.status || 'ISSUED');
      setStatusNote('');
      setStatusAmount('');
      setStatusPaidOn('');
      setStatusMethod('OFFLINE');
      setStatusReferenceNo('');
      setPaymentForm(initialPaymentForm);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
      setShowDetailsModal(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    if (!lastEvent?.type) return;
    if (!String(lastEvent.type).startsWith('INVOICE_')) return;
    loadInvoices();
    if (showDetailsModal && selectedInvoiceId) {
      loadInvoiceDetails(selectedInvoiceId);
    }
  }, [lastEvent?.id]);

  const openCreateModal = () => {
    setInvoiceForm({
      ...initialInvoiceForm,
      invoiceDate: new Date().toISOString().slice(0, 10)
    });
    setCreateError('');
    setCreateStep(1);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateError('');
    setCreateStep(1);
  };

  const goToNextCreateStep = () => {
    if (createStep === 1 && !invoiceForm.clientId) {
      setCreateError('Select client before moving to next step.');
      return;
    }
    setCreateError('');
    setCreateStep((prev) => Math.min(3, prev + 1));
  };

  const goToPreviousCreateStep = () => {
    setCreateStep((prev) => Math.max(1, prev - 1));
  };

  const handleInvoiceFormChange = (field, value) => {
    setInvoiceForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClientChange = (clientId) => {
    const selectedClient = clients.find((client) => String(client._id) === String(clientId));
    setInvoiceForm((prev) => ({
      ...prev,
      clientId,
      projectId: '',
      billToName: selectedClient?.companyName || '',
      billToEmail: selectedClient?.email || '',
      billToPhone: selectedClient?.mobileNumber || '',
      billToAddress: selectedClient?.factoryAddress || '',
      billToGstNo: selectedClient?.gstNo || ''
    }));
  };

  const addLineItem = () => {
    setInvoiceForm((prev) => ({ ...prev, lineItems: [...(prev.lineItems || []), createLineItem()] }));
  };

  const removeLineItem = (index) => {
    setInvoiceForm((prev) => {
      const nextItems = [...(prev.lineItems || [])];
      nextItems.splice(index, 1);
      return { ...prev, lineItems: nextItems.length ? nextItems : [createLineItem()] };
    });
  };

  const updateLineItem = (index, field, value) => {
    setInvoiceForm((prev) => {
      const nextItems = [...(prev.lineItems || [])];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, lineItems: nextItems };
    });
  };

  const addEditLineItem = () => {
    setEditForm((prev) => ({ ...prev, lineItems: [...(prev.lineItems || []), createLineItem()] }));
  };

  const removeEditLineItem = (index) => {
    setEditForm((prev) => {
      const nextItems = [...(prev.lineItems || [])];
      nextItems.splice(index, 1);
      return { ...prev, lineItems: nextItems.length ? nextItems : [createLineItem()] };
    });
  };

  const updateEditLineItem = (index, field, value) => {
    setEditForm((prev) => {
      const nextItems = [...(prev.lineItems || [])];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, lineItems: nextItems };
    });
  };

  const mapInvoiceToForm = (invoice) => ({
    clientId: invoice?.client?._id || '',
    projectId: invoice?.project?._id || '',
    invoiceDate: toDateInput(invoice?.invoiceDate),
    dueDate: toDateInput(invoice?.dueDate),
    subject: invoice?.subject || '',
    billToName: invoice?.billToName || '',
    billToEmail: invoice?.billToEmail || '',
    billToPhone: invoice?.billToPhone || '',
    billToAddress: invoice?.billToAddress || '',
    billToGstNo: invoice?.billToGstNo || '',
    taxPercent: invoice?.taxPercent ?? '0',
    discountAmount: invoice?.discountAmount ?? '0',
    status: invoice?.status || 'ISSUED',
    notes: invoice?.notes || '',
    lineItems:
      (invoice?.lineItems || []).length > 0
        ? invoice.lineItems.map((item) => ({
            description: item.description || '',
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0
          }))
        : [createLineItem()]
  });

  const buildInvoicePayload = (form) => ({
    clientId: form.clientId,
    projectId: form.projectId || null,
    invoiceDate: form.invoiceDate || null,
    dueDate: form.dueDate || null,
    subject: form.subject,
    billToName: form.billToName,
    billToEmail: form.billToEmail,
    billToPhone: form.billToPhone,
    billToAddress: form.billToAddress,
    billToGstNo: form.billToGstNo,
    taxPercent: toNumber(form.taxPercent),
    discountAmount: toNumber(form.discountAmount),
    status: form.status,
    notes: form.notes,
    lineItems: (form.lineItems || [])
      .map((item) => ({
        description: String(item.description || '').trim(),
        quantity: toNumber(item.quantity || 0),
        unitPrice: toNumber(item.unitPrice || 0)
      }))
      .filter((item) => item.description)
  });

  const submitCreateInvoice = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const payload = buildInvoicePayload(invoiceForm);
      if (!payload.clientId) {
        setCreateError('Client is required.');
        return;
      }
      if ((payload.lineItems || []).length === 0) {
        setCreateError('Add at least one line item.');
        return;
      }

      await api.post('/invoices', payload);
      setCreateError('');
      closeCreateModal();
      setSuccessMessage('Invoice created successfully');
      setTimeout(() => setSuccessMessage(''), 2200);
      await loadInvoices({ page: 1 });
    } catch (err) {
      setCreateError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const openInvoiceDetails = async (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    setShowDetailsModal(true);
    await loadInvoiceDetails(invoiceId);
  };

  const openInvoiceEditById = async (invoiceId) => {
    try {
      const { data } = await api.get(`/invoices/${invoiceId}`);
      setSelectedInvoiceId(invoiceId);
      setInvoiceDetails(data.invoice);
      setEditForm(mapInvoiceToForm(data.invoice));
      setEditStep(1);
      setShowEditModal(true);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openEditModal = () => {
    if (!invoiceDetails?._id) return;
    setEditForm(mapInvoiceToForm(invoiceDetails));
    setEditStep(1);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditStep(1);
  };

  const handleEditInvoiceFormChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditClientChange = (clientId) => {
    const selectedClient = clients.find((client) => String(client._id) === String(clientId));
    setEditForm((prev) => ({
      ...prev,
      clientId,
      projectId: '',
      billToName: selectedClient?.companyName || '',
      billToEmail: selectedClient?.email || '',
      billToPhone: selectedClient?.mobileNumber || '',
      billToAddress: selectedClient?.factoryAddress || '',
      billToGstNo: selectedClient?.gstNo || ''
    }));
  };

  const submitEditInvoice = async (event) => {
    event.preventDefault();
    if (!selectedInvoiceId) return;

    setEditing(true);
    try {
      const payload = buildInvoicePayload(editForm);
      if (!payload.clientId) {
        setError('Client is required.');
        return;
      }
      if ((payload.lineItems || []).length === 0) {
        setError('Add at least one line item.');
        return;
      }

      await api.patch(`/invoices/${selectedInvoiceId}`, payload);
      closeEditModal();
      await Promise.all([loadInvoiceDetails(selectedInvoiceId), loadInvoices()]);
      setSuccessMessage('Invoice updated successfully');
      setTimeout(() => setSuccessMessage(''), 2200);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setEditing(false);
    }
  };

  const runPdfAction = async (invoice, download) => {
    if (!download) {
      navigate(`/invoices/${invoice._id}/pdf`, {
        state: { from: `${location.pathname}${location.search}` }
      });
      return;
    }

    const fileName = `${invoice.invoiceNo || 'invoice'}.pdf`;
    setPdfActionId(invoice._id);
    try {
      const { data } = await api.get(`/invoices/${invoice._id}/pdf`, {
        responseType: 'blob'
      });

      const pdfBlob = new Blob([data], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(pdfBlob);

      if (download) {
        const anchor = document.createElement('a');
        anchor.href = pdfUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
      }
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPdfActionId('');
    }
  };

  const saveInvoiceStatus = async () => {
    if (!selectedInvoiceId) return;
    if (statusDraft === 'PARTIALLY_PAID' && !toNumber(statusAmount)) {
      setError('Enter partial payment amount before saving PARTIALLY_PAID status.');
      return;
    }
    setStatusSaving(true);
    try {
      await api.patch(`/invoices/${selectedInvoiceId}/status`, {
        status: statusDraft,
        note: statusNote,
        amount: statusAmount ? toNumber(statusAmount) : undefined,
        paidOn: statusPaidOn || undefined,
        method: statusMethod || undefined,
        referenceNo: statusReferenceNo || undefined
      });
      await Promise.all([loadInvoiceDetails(selectedInvoiceId), loadInvoices()]);
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
    if (!selectedInvoiceId) return;
    setPaymentSaving(true);
    try {
      await api.post(`/invoices/${selectedInvoiceId}/payments`, {
        amount: toNumber(paymentForm.amount),
        paidOn: paymentForm.paidOn || null,
        method: paymentForm.method,
        referenceNo: paymentForm.referenceNo,
        note: paymentForm.note
      });
      await Promise.all([loadInvoiceDetails(selectedInvoiceId), loadInvoices()]);
      setPaymentForm(initialPaymentForm);
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
        title="Invoice Management"
        subtitle="Create standard invoice records per client and project with payment tracking and PDF export."
        rightSlot={(
          <div className="header-filter-inline">
            <div className="search-field compact-search">
              <Search size={14} />
              <input
                placeholder="Search invoice number / subject / party"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
            <select
              className="compact-select"
              value={filters.clientId}
              onChange={(event) => setFilters((prev) => ({ ...prev, clientId: event.target.value, projectId: '' }))}
            >
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client._id} value={client._id}>
                  {client.companyName}
                </option>
              ))}
            </select>
            <select
              className="compact-select"
              value={filters.projectId}
              onChange={(event) => setFilters((prev) => ({ ...prev, projectId: event.target.value }))}
            >
              <option value="">All projects</option>
              {projects
                .filter((project) =>
                  filters.clientId ? String(project?.client?._id || '') === String(filters.clientId) : true
                )
                .map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectId}
                  </option>
                ))}
            </select>
            <select
              className="compact-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary btn-compact" onClick={() => loadInvoices({ page: 1 })}>
              Apply
            </button>
          </div>
        )}
        actionLabel={isAdmin ? 'Create Invoice' : undefined}
        onAction={isAdmin ? openCreateModal : undefined}
      />

      {error ? <p className="error-text">{error}</p> : null}
      {successMessage ? <p className="success-text">{successMessage}</p> : null}

      <article className="card">
        <div className="section-head">
          <h3>Invoices</h3>
          <span className="table-count">{pagination.total || invoices.length} records</span>
        </div>
        {loading ? <p className="muted-text">Loading invoices...</p> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Invoice</th>
                <th>Client</th>
                <th>Project</th>
                <th>Status</th>
                <th>Total</th>
                <th>Paid / Balance</th>
                <th>Due Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice, index) => (
                <tr key={invoice._id} className="row-hover">
                  <td>{(pagination.page - 1) * (pagination.limit || 20) + index + 1}</td>
                  <td>
                    <strong>{invoice.invoiceNo}</strong>
                    <div className="sub-cell">{formatAbsoluteDate(invoice.invoiceDate)}</div>
                  </td>
                  <td>{invoice.client?.companyName || '-'}</td>
                  <td>{invoice.project?.projectId || '-'}</td>
                  <td>
                    <span className={`tag ${invoiceStatusClass(invoice.status)}`}>{invoice.status}</span>
                  </td>
                  <td>{formatMoney(invoice.totalAmount)}</td>
                  <td>
                    <strong>{formatMoney(invoice.paidAmount)}</strong>
                    <div className="sub-cell">{formatMoney(invoice.balanceAmount)}</div>
                  </td>
                  <td>{formatAbsoluteDate(invoice.dueDate)}</td>
                  <td>
                    <div className="toolbar-row">
                      <button
                        className="btn btn-secondary btn-compact"
                        onClick={() =>
                          navigate(`/invoices/${invoice._id}`, {
                            state: { from: `${location.pathname}${location.search}` }
                          })
                        }
                      >
                        Open
                      </button>
                      {isAdmin ? (
                        <button className="btn btn-secondary btn-compact" onClick={() => openInvoiceEditById(invoice._id)}>
                          Edit
                        </button>
                      ) : null}
                      <button
                        className="icon-btn"
                        onClick={() => runPdfAction(invoice, false)}
                        title="View PDF"
                        disabled={pdfActionId === invoice._id}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => runPdfAction(invoice, true)}
                        title="Download PDF"
                        disabled={pdfActionId === invoice._id}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    No invoices found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="pagination-bar">
          <button
            className="btn btn-secondary btn-compact pagination-btn"
            onClick={() => loadInvoices({ page: Math.max(1, pagination.page - 1) })}
            disabled={pagination.page <= 1 || loading}
            aria-label="Previous page"
          >
            {'<<'}
          </button>
          <span className="pagination-status">
            Page {pagination.page} / {pagination.totalPages}
          </span>
          <button
            className="btn btn-secondary btn-compact pagination-btn"
            onClick={() => loadInvoices({ page: Math.min(pagination.totalPages, pagination.page + 1) })}
            disabled={pagination.page >= pagination.totalPages || loading}
            aria-label="Next page"
          >
            {'>>'}
          </button>
        </div>
      </article>

      <Modal isOpen={showCreateModal} title="Create Invoice" onClose={closeCreateModal} cardClassName="max-w-4xl">
        <form
          className="grid-form"
          onSubmit={(event) => {
            if (createStep !== 3) {
              event.preventDefault();
              return;
            }
            submitCreateInvoice(event);
          }}
        >
          <div className="full-row stepper-head">
            <div className="stepper-track">
              <span className="stepper-line" />
              {INVOICE_STEPS.map((item) => (
                <div key={item.step} className="stepper-step">
                  <span className={`stepper-dot ${createStep === item.step ? 'active' : ''} ${createStep > item.step ? 'done' : ''}`.trim()}>
                    {item.step}
                  </span>
                  <small className={`stepper-step-label ${createStep === item.step ? 'active' : ''}`}>{item.label}</small>
                </div>
              ))}
            </div>
          </div>

          {createError ? <p className="error-text full-row">{createError}</p> : null}

          {createStep === 1 ? (
            <>
              <label>
                Client *
                <select value={invoiceForm.clientId} onChange={(event) => handleClientChange(event.target.value)} required>
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.companyName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project (optional)
                <select value={invoiceForm.projectId} onChange={(event) => handleInvoiceFormChange('projectId', event.target.value)}>
                  <option value="">Select project</option>
                  {filteredProjects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectId} {project.schemeName ? `- ${project.schemeName}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Invoice Date
                <input
                  type="date"
                  value={invoiceForm.invoiceDate}
                  onChange={(event) => handleInvoiceFormChange('invoiceDate', event.target.value)}
                />
              </label>
              <label>
                Due Date
                <input type="date" value={invoiceForm.dueDate} onChange={(event) => handleInvoiceFormChange('dueDate', event.target.value)} />
              </label>
              <label>
                Subject
                <input value={invoiceForm.subject} onChange={(event) => handleInvoiceFormChange('subject', event.target.value)} />
              </label>
              <label>
                Initial Status
                <select value={invoiceForm.status} onChange={(event) => handleInvoiceFormChange('status', event.target.value)}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ISSUED">ISSUED</option>
                </select>
              </label>
            </>
          ) : null}

          {createStep === 2 ? (
            <>
              <label>
                Bill To Name
                <input value={invoiceForm.billToName} onChange={(event) => handleInvoiceFormChange('billToName', event.target.value)} />
              </label>
              <label>
                Bill To Email
                <input value={invoiceForm.billToEmail} onChange={(event) => handleInvoiceFormChange('billToEmail', event.target.value)} />
              </label>
              <label>
                Bill To Phone
                <input value={invoiceForm.billToPhone} onChange={(event) => handleInvoiceFormChange('billToPhone', event.target.value)} />
              </label>
              <label>
                Bill To GST
                <input value={invoiceForm.billToGstNo} onChange={(event) => handleInvoiceFormChange('billToGstNo', event.target.value)} />
              </label>
              <label className="full-row">
                Bill To Address
                <textarea
                  rows={3}
                  value={invoiceForm.billToAddress}
                  onChange={(event) => handleInvoiceFormChange('billToAddress', event.target.value)}
                />
              </label>
            </>
          ) : null}

          {createStep === 3 ? (
            <>
              <div className="full-row">
                <div className="section-head">
                  <h4>Line Items</h4>
                  <button type="button" className="btn btn-secondary btn-compact" onClick={addLineItem}>
                    <Plus size={14} />
                    Add Item
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(invoiceForm.lineItems || []).map((item, index) => (
                        <tr key={`item-${index}`}>
                          <td>
                            <input
                              value={item.description}
                              onChange={(event) => updateLineItem(index, 'description', event.target.value)}
                              placeholder="Service description"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity}
                              onChange={(event) => updateLineItem(index, 'quantity', event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(event) => updateLineItem(index, 'unitPrice', event.target.value)}
                            />
                          </td>
                          <td>
                            <button type="button" className="btn btn-secondary btn-compact" onClick={() => removeLineItem(index)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <label>
                Tax %
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceForm.taxPercent}
                  onChange={(event) => handleInvoiceFormChange('taxPercent', event.target.value)}
                />
              </label>
              <label>
                Discount Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceForm.discountAmount}
                  onChange={(event) => handleInvoiceFormChange('discountAmount', event.target.value)}
                />
              </label>
              <div className="info-tile">
                <small>Sub Total</small>
                <strong>{formatMoney(createTotals.subTotal)}</strong>
              </div>
              <div className="info-tile">
                <small>Estimated Total</small>
                <strong>{formatMoney(createTotals.total)}</strong>
              </div>
              <label className="full-row">
                Notes
                <textarea rows={3} value={invoiceForm.notes} onChange={(event) => handleInvoiceFormChange('notes', event.target.value)} />
              </label>
            </>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={closeCreateModal}>
              Cancel
            </button>
            {createStep > 1 ? (
              <button type="button" className="btn btn-secondary" onClick={goToPreviousCreateStep}>
                Previous
              </button>
            ) : null}
            {createStep < 3 ? (
              <button type="button" className="btn btn-primary" onClick={goToNextCreateStep}>
                Next
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Invoice'}
              </button>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showEditModal}
        title={`Edit Invoice ${invoiceDetails?.invoiceNo || ''}`}
        onClose={closeEditModal}
        cardClassName="max-w-4xl"
        zIndex={120}
      >
        <form className="grid-form" onSubmit={submitEditInvoice}>
          <div className="full-row stepper-head">
            <div className="stepper-track">
              <span className="stepper-line" />
              {INVOICE_STEPS.map((item) => (
                <button type="button" key={item.step} className="stepper-step" onClick={() => setEditStep(item.step)}>
                  <span className={`stepper-dot ${editStep === item.step ? 'active' : ''} ${editStep > item.step ? 'done' : ''}`.trim()}>
                    {item.step}
                  </span>
                  <small className={`stepper-step-label ${editStep === item.step ? 'active' : ''}`}>{item.label}</small>
                </button>
              ))}
            </div>
          </div>

          {editStep === 1 ? (
            <>
              <label>
                Client *
                <select value={editForm.clientId} onChange={(event) => handleEditClientChange(event.target.value)} required>
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.companyName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project (optional)
                <select value={editForm.projectId} onChange={(event) => handleEditInvoiceFormChange('projectId', event.target.value)}>
                  <option value="">Select project</option>
                  {filteredEditProjects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectId} {project.schemeName ? `- ${project.schemeName}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Invoice Date
                <input type="date" value={editForm.invoiceDate} onChange={(event) => handleEditInvoiceFormChange('invoiceDate', event.target.value)} />
              </label>
              <label>
                Due Date
                <input type="date" value={editForm.dueDate} onChange={(event) => handleEditInvoiceFormChange('dueDate', event.target.value)} />
              </label>
              <label>
                Subject
                <input value={editForm.subject} onChange={(event) => handleEditInvoiceFormChange('subject', event.target.value)} />
              </label>
              <label>
                Status
                <select value={editForm.status} onChange={(event) => handleEditInvoiceFormChange('status', event.target.value)}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="ISSUED">ISSUED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </label>
            </>
          ) : null}

          {editStep === 2 ? (
            <>
              <label>
                Bill To Name
                <input value={editForm.billToName} onChange={(event) => handleEditInvoiceFormChange('billToName', event.target.value)} />
              </label>
              <label>
                Bill To Email
                <input value={editForm.billToEmail} onChange={(event) => handleEditInvoiceFormChange('billToEmail', event.target.value)} />
              </label>
              <label>
                Bill To Phone
                <input value={editForm.billToPhone} onChange={(event) => handleEditInvoiceFormChange('billToPhone', event.target.value)} />
              </label>
              <label>
                Bill To GST
                <input value={editForm.billToGstNo} onChange={(event) => handleEditInvoiceFormChange('billToGstNo', event.target.value)} />
              </label>
              <label className="full-row">
                Bill To Address
                <textarea rows={3} value={editForm.billToAddress} onChange={(event) => handleEditInvoiceFormChange('billToAddress', event.target.value)} />
              </label>
            </>
          ) : null}

          {editStep === 3 ? (
            <>
              <div className="full-row">
                <div className="section-head">
                  <h4>Line Items</h4>
                  <button type="button" className="btn btn-secondary btn-compact" onClick={addEditLineItem}>
                    <Plus size={14} />
                    Add Item
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {(editForm.lineItems || []).map((item, index) => (
                        <tr key={`edit-item-${index}`}>
                          <td>
                            <input
                              value={item.description}
                              onChange={(event) => updateEditLineItem(index, 'description', event.target.value)}
                              placeholder="Service description"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity}
                              onChange={(event) => updateEditLineItem(index, 'quantity', event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(event) => updateEditLineItem(index, 'unitPrice', event.target.value)}
                            />
                          </td>
                          <td>
                            <button type="button" className="btn btn-secondary btn-compact" onClick={() => removeEditLineItem(index)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <label>
                Tax %
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.taxPercent}
                  onChange={(event) => handleEditInvoiceFormChange('taxPercent', event.target.value)}
                />
              </label>
              <label>
                Discount Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.discountAmount}
                  onChange={(event) => handleEditInvoiceFormChange('discountAmount', event.target.value)}
                />
              </label>
              <div className="info-tile">
                <small>Sub Total</small>
                <strong>{formatMoney(editTotals.subTotal)}</strong>
              </div>
              <div className="info-tile">
                <small>Estimated Total</small>
                <strong>{formatMoney(editTotals.total)}</strong>
              </div>
              <label className="full-row">
                Notes
                <textarea rows={3} value={editForm.notes} onChange={(event) => handleEditInvoiceFormChange('notes', event.target.value)} />
              </label>
            </>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={editing}>
              {editing ? 'Saving...' : 'Save Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDetailsModal} title={invoiceDetails?.invoiceNo || 'Invoice Details'} onClose={() => setShowDetailsModal(false)}>
        {detailsLoading ? (
          <p className="muted-text">Loading invoice details...</p>
        ) : !invoiceDetails ? (
          <p className="muted-text">No details available.</p>
        ) : (
          <div className="page">
            <div className="task-detail-grid">
              <div className="info-tile">
                <small>Client</small>
                <strong>{invoiceDetails.client?.companyName || '-'}</strong>
              </div>
              <div className="info-tile">
                <small>Project</small>
                <strong>{invoiceDetails.project?.projectId || '-'}</strong>
              </div>
              <div className="info-tile">
                <small>Status</small>
                <strong>
                  <span className={`tag ${invoiceStatusClass(invoiceDetails.status)}`}>{invoiceDetails.status}</span>
                </strong>
              </div>
              <div className="info-tile">
                <small>Due Date</small>
                <strong>{formatAbsoluteDate(invoiceDetails.dueDate)}</strong>
              </div>
            </div>

            <div className="toolbar-row">
              {isAdmin ? (
                <button className="btn btn-secondary btn-compact" onClick={openEditModal}>
                  Edit Invoice
                </button>
              ) : null}
              <button className="btn btn-secondary btn-compact" onClick={() => runPdfAction(invoiceDetails, false)}>
                <Eye size={14} />
                View PDF
              </button>
              <button className="btn btn-secondary btn-compact" onClick={() => runPdfAction(invoiceDetails, true)}>
                <Download size={14} />
                Download PDF
              </button>
            </div>

            <article className="card compact">
              <div className="section-head">
                <h4>Amounts</h4>
              </div>
              <p>
                <strong>Sub Total:</strong> {formatMoney(invoiceDetails.subTotal)}
              </p>
              <p>
                <strong>Tax:</strong> {formatMoney(invoiceDetails.taxAmount)}
              </p>
              <p>
                <strong>Total:</strong> {formatMoney(invoiceDetails.totalAmount)}
              </p>
              <p>
                <strong>Paid:</strong> {formatMoney(invoiceDetails.paidAmount)}
              </p>
              <p>
                <strong>Balance:</strong> {formatMoney(invoiceDetails.balanceAmount)}
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
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoiceDetails.lineItems || []).map((item, index) => (
                      <tr key={item._id || index}>
                        <td>{index + 1}</td>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{formatMoney(item.unitPrice)}</td>
                        <td>{formatMoney(item.amount)}</td>
                      </tr>
                    ))}
                    {(invoiceDetails.lineItems || []).length === 0 ? (
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
                <span className="table-count">{(invoiceDetails.payments || []).length} entries</span>
              </div>
              {(invoiceDetails.payments || []).length === 0 ? (
                <p className="muted-text">No payment entries yet.</p>
              ) : (
                <ul className="event-list">
                  {invoiceDetails.payments.map((payment) => (
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
              {(invoiceDetails.timeline || []).length === 0 ? (
                <p className="muted-text">No timeline entries.</p>
              ) : (
                <ul className="timeline-list">
                  {invoiceDetails.timeline
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
                      <select
                        value={paymentForm.method}
                        onChange={(event) => setPaymentForm((prev) => ({ ...prev, method: event.target.value }))}
                      >
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
          </div>
        )}
      </Modal>

    </section>
  );
}

export default InvoicesPage;
