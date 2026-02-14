import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import PageHeader from '../components/PageHeader';

const initialForm = {
  companyName: '',
  contactPerson: '',
  mobileNumber: '',
  email: '',
  city: '',
  state: '',
  industryType: '',
  source: 'MANUAL',
  requirementType: 'SUBSIDY',
  nextFollowUpAt: ''
};

function LeadCreatePage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submitLead = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        nextFollowUpAt: form.nextFollowUpAt || null
      };
      const { data } = await api.post('/leads', payload);
      navigate(`/leads/${data.lead._id}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        title="Create Lead"
        subtitle="Standardized intake form for accurate tracking and future analytics."
      />

      <article className="card form-card">
        <form className="grid-form" onSubmit={submitLead}>
          <label>
            Company Name
            <input
              value={form.companyName}
              onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
              required
            />
          </label>
          <label>
            Contact Person
            <input
              value={form.contactPerson}
              onChange={(e) => setForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
              required
            />
          </label>
          <label>
            Mobile Number
            <input
              value={form.mobileNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, mobileNumber: e.target.value }))}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </label>
          <label>
            City
            <input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
          </label>
          <label>
            State
            <input value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} />
          </label>
          <label>
            Industry Type
            <input
              value={form.industryType}
              onChange={(e) => setForm((prev) => ({ ...prev, industryType: e.target.value }))}
            />
          </label>
          <label>
            Source
            <select value={form.source} onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}>
              <option value="MANUAL">Manual</option>
              <option value="WEBSITE">Website</option>
              <option value="EXHIBITION">Exhibition</option>
              <option value="REFERRAL">Referral</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="COLD_CALL">Cold Call</option>
            </select>
          </label>
          <label>
            Requirement Type
            <select
              value={form.requirementType}
              onChange={(e) => setForm((prev) => ({ ...prev, requirementType: e.target.value }))}
            >
              <option value="SUBSIDY">Subsidy</option>
              <option value="LAND">Land</option>
              <option value="FUNDING">Funding</option>
              <option value="COMPLIANCE">Compliance</option>
            </select>
          </label>
          <label>
            Next Follow-up
            <input
              type="datetime-local"
              value={form.nextFollowUpAt}
              onChange={(e) => setForm((prev) => ({ ...prev, nextFollowUpAt: e.target.value }))}
            />
          </label>

          {error ? <p className="error-text form-error">{error}</p> : null}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/leads')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}

export default LeadCreatePage;
