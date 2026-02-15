import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useSocketEvents } from '../context/SocketContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatSmartDateTime } from '../utils/dateFormat';
import LeadProfileFields from '../components/LeadProfileFields';
import { buildLeadPayload, leadFormInitialValues, mapLeadToForm } from '../constants/leadForm';

const actorName = (actor) => {
  if (!actor) return 'Unknown user';
  if (typeof actor === 'string') return 'User';
  return actor.name || actor.email || 'User';
};

function LeadDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lastEvent } = useSocketEvents();
  const [lead, setLead] = useState(null);
  const [catalog, setCatalog] = useState({ categories: [], schemes: [] });
  const [error, setError] = useState('');

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);

  const [updateForm, setUpdateForm] = useState({ status: '', nextFollowUpAt: '' });
  const [detailForm, setDetailForm] = useState(leadFormInitialValues);
  const [note, setNote] = useState('');
  const [callData, setCallData] = useState({ callAt: '', durationMinutes: 15, summary: '' });
  const [followUpForm, setFollowUpForm] = useState({ reportNo: '1', remark: '' });
  const [convertForm, setConvertForm] = useState({
    categoryId: '',
    schemeId: '',
    schemeName: '',
    departmentInvolved: '',
    targetCompletionDate: ''
  });

  const fetchLead = async () => {
    try {
      const [{ data }, catalogRes] = await Promise.all([api.get(`/leads/${id}`), api.get('/meta/catalog')]);
      setLead(data.lead);
      setUpdateForm({
        status: data.lead.status || '',
        nextFollowUpAt: data.lead.nextFollowUpAt ? new Date(data.lead.nextFollowUpAt).toISOString().slice(0, 16) : ''
      });
      setDetailForm(mapLeadToForm(data.lead));
      setCatalog(catalogRes.data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id, lastEvent]);

  const schemesForCategory = useMemo(() => {
    if (!convertForm.categoryId) return catalog.schemes;
    return catalog.schemes.filter((item) => item.category?._id === convertForm.categoryId);
  }, [convertForm.categoryId, catalog.schemes]);

  const updateLead = async (event) => {
    event.preventDefault();
    try {
      await api.patch(`/leads/${id}`, {
        status: updateForm.status,
        nextFollowUpAt: updateForm.nextFollowUpAt || null
      });
      setShowUpdateModal(false);
      await fetchLead();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const updateLeadDetails = async (event) => {
    event.preventDefault();
    try {
      const payload = buildLeadPayload(detailForm);
      await api.patch(`/leads/${id}`, payload);
      setShowEditDetailsModal(false);
      await fetchLead();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const addNote = async (event) => {
    event.preventDefault();
    if (!note.trim()) return;
    try {
      await api.post(`/leads/${id}/notes`, { note: note.trim() });
      setNote('');
      setShowNoteModal(false);
      await fetchLead();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const addCall = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/leads/${id}/calls`, {
        callAt: callData.callAt,
        durationMinutes: Number(callData.durationMinutes),
        summary: callData.summary
      });
      setCallData({ callAt: '', durationMinutes: 15, summary: '' });
      setShowCallModal(false);
      await fetchLead();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const addFollowUpReport = async (event) => {
    event.preventDefault();
    if (!followUpForm.remark.trim()) return;
    try {
      await api.post(`/leads/${id}/follow-ups`, {
        reportNo: Number(followUpForm.reportNo),
        remark: followUpForm.remark.trim()
      });
      setFollowUpForm({ reportNo: '1', remark: '' });
      setShowFollowUpModal(false);
      await fetchLead();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const confirmConvertLead = async () => {
    try {
      const { data } = await api.post(`/leads/${id}/convert`, convertForm);
      setShowConvertConfirm(false);
      setShowConvertModal(false);
      if (data?.project?._id) {
        navigate(`/projects/${data.project._id}`);
      } else {
        navigate('/clients');
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (!lead) return <section className="page">Loading lead...</section>;

  return (
    <section className="page">
      <PageHeader
        title={`${lead.companyName} (${lead.leadId})`}
        subtitle="Lead timeline, communication logs, and conversion workflow."
      />

      {error ? <p className="error-text">{error}</p> : null}

      <div className="action-strip">
        <button className="btn btn-secondary" onClick={() => setShowUpdateModal(true)}>
          Update Status
        </button>
        <button className="btn btn-secondary" onClick={() => setShowEditDetailsModal(true)}>
          Edit Lead Details
        </button>
        <button className="btn btn-secondary" onClick={() => setShowNoteModal(true)}>
          Add Note
        </button>
        <button className="btn btn-secondary" onClick={() => setShowCallModal(true)}>
          Log Call
        </button>
        <button className="btn btn-secondary" onClick={() => setShowFollowUpModal(true)}>
          Add Follow-up Report
        </button>
        {!lead.isConverted ? (
          <button className="btn btn-primary" onClick={() => setShowConvertModal(true)}>
            Convert to Client
          </button>
        ) : (
          <span className="tag cold">Converted</span>
        )}
      </div>

      <article className="card">
        <div className="section-head">
          <h3>Lead Intake Details</h3>
        </div>
        <div className="split-grid">
          <div className="info-tile">
            <small>Promoter / Authorized Person</small>
            <strong>{lead.promoterName || lead.contactPerson || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Enterprise / Business</small>
            <strong>{lead.companyName || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Business Constitution</small>
            <strong>{lead.businessConstitutionType || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Project Type</small>
            <strong>{lead.projectType || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Inquiry For</small>
            <strong>{lead.inquiryFor || lead.requirementType || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Expected Fees / Service Value</small>
            <strong>{lead.expectedServiceValue ?? '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Customer Progress Status</small>
            <strong>{lead.customerProgressStatus || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Associate / B2B Partner</small>
            <strong>{lead.associatePartnerName || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Location</small>
            <strong>{[lead.address, lead.taluka, lead.district, lead.state].filter(Boolean).join(', ') || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Project Land Detail</small>
            <strong>{lead.projectLandDetail || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Gender of Partners / Directors</small>
            <strong>{lead.partnersDirectorsGender || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Caste Category</small>
            <strong>{lead.promoterCasteCategory || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Investment - Building / Construction</small>
            <strong>{lead.investmentBuildingConstruction ?? '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Investment - Land</small>
            <strong>{lead.investmentLand ?? '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Investment - Plant & Machinery</small>
            <strong>{lead.investmentPlantMachinery ?? '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Total Investment</small>
            <strong>{lead.totalInvestment ?? '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Bank Loan (If Any)</small>
            <strong>{lead.bankLoanIfAny || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Bank Loan (%)</small>
            <strong>{lead.financeBankLoanPercent ?? '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Own Contribution / Margin (%)</small>
            <strong>{lead.financeOwnContributionPercent ?? '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Availed Subsidy Previously</small>
            <strong>{lead.availedSubsidyPreviously || '-'}</strong>
          </div>
        </div>
        <div className="split-grid">
          <div className="info-tile">
            <small>Manufacturing or Processing of</small>
            <strong>{lead.manufacturingDetails || '-'}</strong>
          </div>
          <div className="info-tile">
            <small>Specific Ask / Highlight</small>
            <strong>{lead.projectSpecificAsk || '-'}</strong>
          </div>
        </div>
      </article>

      <div className="three-col-grid">
        <article className="card compact">
          <h4>Contact</h4>
          <p>{lead.contactPerson}</p>
          <p>{lead.mobileNumber}</p>
          <p>{lead.email || '-'}</p>
        </article>
        <article className="card compact">
          <h4>Status</h4>
          <p>
            <span className="tag neutral">{lead.status}</span>
          </p>
          <p>
            <span className={`tag ${lead.temperature?.toLowerCase()}`}>{lead.temperature}</span>
          </p>
          <p className="muted-text">Source: {lead.source}</p>
        </article>
        <article className="card compact">
          <h4>Communication Metrics</h4>
          <p>Notes: {lead.communicationStats?.notesCount || 0}</p>
          <p>Calls: {lead.communicationStats?.callsCount || 0}</p>
          <p>First response: {lead.firstResponseMinutes ? `${lead.firstResponseMinutes} min` : '-'}</p>
        </article>
      </div>

      <div className="split-grid">
        <article className="card">
          <div className="section-head">
            <h3>Notes</h3>
            <span className="table-count">{lead.notes?.length || 0}</span>
          </div>
          <ul className="event-list">
            {lead.notes?.length
              ? lead.notes
                  .slice()
                  .reverse()
                  .map((item) => (
                    <li key={item._id}>
                      <p>{item.note}</p>
                      <div className="record-meta">
                        <span>By {actorName(item.createdBy)}</span>
                        <span className="meta-sep">•</span>
                        <span>{formatSmartDateTime(item.createdAt)}</span>
                      </div>
                    </li>
                  ))
              : [<li key="none" className="muted-text">No notes added yet.</li>]}
          </ul>
        </article>

        <article className="card">
          <div className="section-head">
            <h3>Call Logs</h3>
            <span className="table-count">{lead.calls?.length || 0}</span>
          </div>
          <ul className="event-list">
            {lead.calls?.length
              ? lead.calls
                  .slice()
                  .reverse()
                  .map((item) => (
                    <li key={item._id}>
                      <p>
                        {formatSmartDateTime(item.callAt)} - {item.durationMinutes} min
                      </p>
                      <p className="muted-text">{item.summary}</p>
                      <div className="record-meta">
                        <span>By {actorName(item.createdBy)}</span>
                        {item.createdAt ? (
                          <>
                            <span className="meta-sep">•</span>
                            <span>Logged {formatSmartDateTime(item.createdAt)}</span>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))
              : [<li key="none" className="muted-text">No calls logged yet.</li>]}
          </ul>
        </article>
      </div>

      <div className="split-grid">
        <article className="card">
          <div className="section-head">
            <h3>Follow-up Reports</h3>
            <span className="table-count">{lead.followUpReports?.length || 0}</span>
          </div>
          <ul className="event-list">
            {lead.followUpReports?.length
              ? lead.followUpReports
                  .slice()
                  .reverse()
                  .map((item) => (
                    <li key={item._id}>
                      <p>
                        <strong>Follow-up Report {item.reportNo}</strong>
                      </p>
                      <p>{item.remark}</p>
                      <div className="record-meta">
                        <span>By {actorName(item.createdBy)}</span>
                        <span className="meta-sep">•</span>
                        <span>{formatSmartDateTime(item.createdAt)}</span>
                      </div>
                    </li>
                  ))
              : [<li key="none" className="muted-text">No follow-up reports added yet.</li>]}
          </ul>
        </article>
      </div>

      <article className="card">
        <div className="section-head">
          <h3>Activity Timeline</h3>
        </div>
        <ul className="timeline-list">
          {lead.timeline?.slice().reverse().map((item, index) => (
            <li key={`${item.type}-${index}`}>
              <div>
                <strong>{item.type}</strong>
                <p>{item.message}</p>
                <div className="record-meta">
                  {item.actor ? <span>By {actorName(item.actor)}</span> : null}
                  {item.at ? (
                    <>
                      {item.actor ? <span className="meta-sep">•</span> : null}
                      <span>{formatSmartDateTime(item.at)}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </article>

      <Modal isOpen={showUpdateModal} title="Update Lead Status" onClose={() => setShowUpdateModal(false)}>
        <form className="grid-form" onSubmit={updateLead}>
          <label>
            Status
            <select value={updateForm.status} onChange={(e) => setUpdateForm((prev) => ({ ...prev, status: e.target.value }))}>
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="FOLLOW_UP">FOLLOW_UP</option>
              <option value="CONVERTED">CONVERTED</option>
              <option value="LOST">LOST</option>
            </select>
          </label>
          <label>
            Next Follow-up
            <input
              type="datetime-local"
              value={updateForm.nextFollowUpAt}
              onChange={(e) => setUpdateForm((prev) => ({ ...prev, nextFollowUpAt: e.target.value }))}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowUpdateModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Update
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditDetailsModal} title="Edit Lead Details" onClose={() => setShowEditDetailsModal(false)}>
        <form className="grid-form" onSubmit={updateLeadDetails}>
          <LeadProfileFields form={detailForm} setForm={setDetailForm} showOperationalFields />
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowEditDetailsModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Details
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showNoteModal} title="Add Lead Note" onClose={() => setShowNoteModal(false)}>
        <form onSubmit={addNote}>
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write note" required />
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowNoteModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Note
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showCallModal} title="Log Lead Call" onClose={() => setShowCallModal(false)}>
        <form className="grid-form" onSubmit={addCall}>
          <label>
            Call Date & Time
            <input
              type="datetime-local"
              value={callData.callAt}
              onChange={(e) => setCallData((prev) => ({ ...prev, callAt: e.target.value }))}
              required
            />
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              min={1}
              value={callData.durationMinutes}
              onChange={(e) => setCallData((prev) => ({ ...prev, durationMinutes: e.target.value }))}
              required
            />
          </label>
          <label className="full-row">
            Summary
            <textarea
              rows={4}
              value={callData.summary}
              onChange={(e) => setCallData((prev) => ({ ...prev, summary: e.target.value }))}
              required
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCallModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Call
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showFollowUpModal} title="Add Follow-up Report" onClose={() => setShowFollowUpModal(false)}>
        <form className="grid-form" onSubmit={addFollowUpReport}>
          <label>
            Follow-up Report Number
            <select value={followUpForm.reportNo} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, reportNo: e.target.value }))}>
              <option value="1">Follow-up Report 1</option>
              <option value="2">Follow-up Report 2</option>
              <option value="3">Follow-up Report 3</option>
            </select>
          </label>
          <label className="full-row">
            Remark
            <textarea
              rows={4}
              value={followUpForm.remark}
              onChange={(e) => setFollowUpForm((prev) => ({ ...prev, remark: e.target.value }))}
              required
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowFollowUpModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Report
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showConvertModal} title="Convert Lead to Client + Project" onClose={() => setShowConvertModal(false)}>
        <form className="grid-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Category
            <select
              value={convertForm.categoryId}
              onChange={(e) => setConvertForm((prev) => ({ ...prev, categoryId: e.target.value, schemeId: '' }))}
            >
              <option value="">Select category</option>
              {catalog.categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scheme
            <select value={convertForm.schemeId} onChange={(e) => setConvertForm((prev) => ({ ...prev, schemeId: e.target.value }))}>
              <option value="">Select scheme</option>
              {schemesForCategory.map((scheme) => (
                <option key={scheme._id} value={scheme._id}>
                  {scheme.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Custom Scheme Name
            <input
              value={convertForm.schemeName}
              onChange={(e) => setConvertForm((prev) => ({ ...prev, schemeName: e.target.value }))}
            />
          </label>
          <label>
            Department
            <input
              value={convertForm.departmentInvolved}
              onChange={(e) => setConvertForm((prev) => ({ ...prev, departmentInvolved: e.target.value }))}
            />
          </label>
          <label>
            Target Completion Date
            <input
              type="date"
              value={convertForm.targetCompletionDate}
              onChange={(e) => setConvertForm((prev) => ({ ...prev, targetCompletionDate: e.target.value }))}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowConvertModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setShowConvertConfirm(true)}>
              Continue
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showConvertConfirm}
        title="Confirm Conversion"
        message="This action creates a client and a project linked to this lead. Continue?"
        confirmLabel="Convert Lead"
        onConfirm={confirmConvertLead}
        onCancel={() => setShowConvertConfirm(false)}
      />
    </section>
  );
}

export default LeadDetailsPage;
