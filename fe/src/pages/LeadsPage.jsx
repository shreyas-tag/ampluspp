import { useEffect, useState } from 'react';
import { Flame, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useSocketEvents } from '../context/SocketContext';
import PageHeader from '../components/PageHeader';
import { formatSmartDateTime } from '../utils/dateFormat';

const LEAD_BUCKETS = ['HOT', 'WARM', 'COLD', 'CONVERTED'];

function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', bucket: 'HOT' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { lastEvent } = useSocketEvents();

  const fetchLeads = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextFilters.search) params.set('search', nextFilters.search);
      if (nextFilters.status) params.set('status', nextFilters.status);
      if (nextFilters.bucket) params.set('bucket', nextFilters.bucket);
      const { data } = await api.get(`/leads?${params.toString()}`);
      setLeads(data.leads || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [lastEvent]);

  return (
    <section className="page">
      <PageHeader
        title="Lead Pipeline"
        subtitle="Track enquiries, communication quality, and conversion readiness."
        rightSlot={(
          <div className="header-filter-inline">
            <div className="search-field compact-search">
              <Search size={14} />
              <input
                placeholder="Search lead..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <select
              className="compact-select"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="">All status</option>
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="FOLLOW_UP">FOLLOW_UP</option>
              <option value="CONVERTED">CONVERTED</option>
              <option value="LOST">LOST</option>
            </select>
            <button className="btn btn-secondary btn-compact" onClick={fetchLeads}>
              Apply
            </button>
          </div>
        )}
        actionLabel="Create New Lead"
        actionTo="/leads/new"
      />

      {error ? <p className="error-text">{error}</p> : null}

      <div className="stat-chip-row">
        <div className="stat-chip hot">
          <Flame size={14} /> Hot
        </div>
        <div className="stat-chip warm">
          <Flame size={14} /> Warm
        </div>
        <div className="stat-chip cold">
          <Flame size={14} /> Cold
        </div>
        <div className="stat-chip neutral-tag">Converted</div>
      </div>

      <div className="lead-bucket-tabs">
        {LEAD_BUCKETS.map((bucket) => (
          <button
            key={bucket}
            type="button"
            className={`lead-bucket-tab ${filters.bucket === bucket ? 'active' : ''}`}
            onClick={() => {
              const nextFilters = {
                ...filters,
                bucket,
                status: bucket === 'CONVERTED' ? 'CONVERTED' : filters.status === 'CONVERTED' ? '' : filters.status
              };
              setFilters(nextFilters);
              fetchLeads(nextFilters);
            }}
          >
            {bucket}
          </button>
        ))}
      </div>

      <article className="card">
        <div className="section-head">
          <h3>Lead Register</h3>
          <span className="table-count">{leads.length} records</span>
        </div>
        {loading ? <p className="muted-text">Loading leads...</p> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Company</th>
                <th>Contact Person</th>
                <th>Status</th>
                <th>Heat</th>
                <th>Source</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, index) => (
                <tr key={lead._id} className="row-hover">
                  <td>{index + 1}</td>
                  <td>
                    <strong>{lead.companyName}</strong>
                    <div className="sub-cell">{lead.leadId}</div>
                  </td>
                  <td>
                    <strong>{lead.contactPerson || '-'}</strong>
                    <div className="sub-cell">{lead.mobileNumber || '-'}</div>
                  </td>
                  <td>
                    <span className="tag neutral">{lead.status}</span>
                  </td>
                  <td>
                    <span className={`tag ${lead.temperature?.toLowerCase()}`}>{lead.temperature || '-'}</span>
                  </td>
                  <td>{lead.source}</td>
                  <td>{formatSmartDateTime(lead.lastInteractionAt)}</td>
                  <td>
                    <Link className="inline-link" to={`/leads/${lead._id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    No leads found for selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

export default LeadsPage;
