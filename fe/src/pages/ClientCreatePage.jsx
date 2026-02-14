import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import PageHeader from '../components/PageHeader';

const initialClientForm = {
  companyName: '',
  gstNo: '',
  factoryAddress: '',
  contactPerson: '',
  mobileNumber: '',
  email: '',
  createProject: true,
  categoryId: '',
  schemeId: '',
  schemeName: '',
  departmentInvolved: '',
  targetCompletionDate: ''
};

function ClientCreatePage() {
  const [form, setForm] = useState(initialClientForm);
  const [catalog, setCatalog] = useState({ categories: [], schemes: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const { data } = await api.get('/meta/catalog');
        setCatalog(data);
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    };
    loadCatalog();
  }, []);

  const schemesForCategory = useMemo(() => {
    if (!form.categoryId) return catalog.schemes;
    return catalog.schemes.filter((item) => item.category?._id === form.categoryId);
  }, [form.categoryId, catalog.schemes]);

  const createClient = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        targetCompletionDate: form.targetCompletionDate || null
      };
      const { data } = await api.post('/clients', payload);
      if (data?.project?._id) {
        navigate(`/projects/${data.project._id}`);
      } else {
        navigate('/clients');
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page">
      <PageHeader
        title="Create Client"
        subtitle="Structured onboarding with optional instant project creation."
      />

      <article className="card form-card">
        <form className="grid-form" onSubmit={createClient}>
          <label>
            Company Name
            <input value={form.companyName} onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))} required />
          </label>
          <label>
            GST Number
            <input value={form.gstNo} onChange={(e) => setForm((prev) => ({ ...prev, gstNo: e.target.value }))} />
          </label>
          <label>
            Factory Address
            <input value={form.factoryAddress} onChange={(e) => setForm((prev) => ({ ...prev, factoryAddress: e.target.value }))} />
          </label>
          <label>
            Contact Person
            <input value={form.contactPerson} onChange={(e) => setForm((prev) => ({ ...prev, contactPerson: e.target.value }))} />
          </label>
          <label>
            Mobile Number
            <input value={form.mobileNumber} onChange={(e) => setForm((prev) => ({ ...prev, mobileNumber: e.target.value }))} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          </label>

          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={Boolean(form.createProject)}
              onChange={(e) => setForm((prev) => ({ ...prev, createProject: e.target.checked }))}
            />
            Create project immediately
          </label>

          {form.createProject ? (
            <>
              <label>
                Category
                <select value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value, schemeId: '' }))}>
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
                <select value={form.schemeId} onChange={(e) => setForm((prev) => ({ ...prev, schemeId: e.target.value }))}>
                  <option value="">Select scheme</option>
                  {schemesForCategory.map((scheme) => (
                    <option key={scheme._id} value={scheme._id}>
                      {scheme.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Custom Scheme
                <input value={form.schemeName} onChange={(e) => setForm((prev) => ({ ...prev, schemeName: e.target.value }))} />
              </label>
              <label>
                Department Involved
                <input value={form.departmentInvolved} onChange={(e) => setForm((prev) => ({ ...prev, departmentInvolved: e.target.value }))} />
              </label>
              <label>
                Target Completion Date
                <input
                  type="date"
                  value={form.targetCompletionDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, targetCompletionDate: e.target.value }))}
                />
              </label>
            </>
          ) : null}

          {error ? <p className="error-text form-error">{error}</p> : null}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/clients')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Create Client'}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}

export default ClientCreatePage;
