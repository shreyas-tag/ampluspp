import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useSocketEvents } from '../context/SocketContext';
import PageHeader from '../components/PageHeader';

function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { lastEvent } = useSocketEvents();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setClients(data.clients || []);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [lastEvent]);

  return (
    <section className="page">
      <PageHeader
        title="Client Master"
        subtitle="Single source of truth for converted and directly onboarded clients."
        rightSlot={(
          <div className="header-filter-inline">
            <div className="search-field compact-search">
              <Search size={14} />
              <input placeholder="Search by company, code, contact, email" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-secondary btn-compact" onClick={load}>
              Search
            </button>
          </div>
        )}
        actionLabel="Create New Client"
        actionTo="/clients/new"
      />

      {error ? <p className="error-text">{error}</p> : null}

      <article className="card">
        <div className="section-head">
          <h3>Clients</h3>
          <span className="table-count">{clients.length} records</span>
        </div>
        {loading ? <p className="muted-text">Loading clients...</p> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Company</th>
                <th>Client Code</th>
                <th>Contact Person</th>
                <th>Consultant</th>
                <th>Projects</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, index) => (
                <tr key={client._id} className="row-hover">
                  <td>{index + 1}</td>
                  <td>{client.companyName}</td>
                  <td>{client.clientCode}</td>
                  <td>
                    <strong>{client.contactPerson || '-'}</strong>
                    <div className="sub-cell">{client.mobileNumber || '-'}</div>
                  </td>
                  <td>{client.assignedConsultant?.name || '-'}</td>
                  <td>
                    {(client.projects || []).length === 0
                      ? '-'
                      : (client.projects || []).map((project) => (
                          <div key={project._id}>
                            <Link className="inline-link" to={`/projects/${project._id}`}>
                              {project.projectId}
                            </Link>
                          </div>
                        ))}
                  </td>
                </tr>
              ))}
              {!loading && clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No clients found.
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

export default ClientsPage;
