import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import PageHeader from '../components/PageHeader';
import LeadProfileFields from '../components/LeadProfileFields';
import { buildLeadPayload, leadFormInitialValues } from '../constants/leadForm';

function LeadCreatePage() {
  const [form, setForm] = useState(leadFormInitialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submitLead = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = buildLeadPayload(form);
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
          <LeadProfileFields form={form} setForm={setForm} showOperationalFields />

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
