import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useSocketEvents } from '../context/SocketContext';
import PageHeader from '../components/PageHeader';
import { formatAbsoluteDate } from '../utils/dateFormat';

function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { lastEvent } = useSocketEvents();

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (stage) params.set('currentStage', stage);
      const { data } = await api.get(`/projects?${params.toString()}`);
      setProjects(data.projects || []);
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
        title="Project Execution"
        subtitle="Milestone-driven view across all client projects."
        rightSlot={(
          <div className="header-filter-inline">
            <div className="search-field compact-search">
              <Search size={14} />
              <input placeholder="Search project/scheme/application" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="compact-select" value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">All stages</option>
              <option value="DOCUMENTATION">DOCUMENTATION</option>
              <option value="APPLICATION_FILED">APPLICATION_FILED</option>
              <option value="SCRUTINY">SCRUTINY</option>
              <option value="CLARIFICATIONS">CLARIFICATIONS</option>
              <option value="APPROVED">APPROVED</option>
              <option value="DISBURSED">DISBURSED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="ON_HOLD">ON_HOLD</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
            <button className="btn btn-secondary btn-compact" onClick={load}>
              Apply
            </button>
          </div>
        )}
      />

      {error ? <p className="error-text">{error}</p> : null}

      <article className="card">
        <div className="section-head">
          <h3>Projects</h3>
          <span className="table-count">{projects.length} records</span>
        </div>
        {loading ? <p className="muted-text">Loading projects...</p> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Project ID</th>
                <th>Client</th>
                <th>Scheme</th>
                <th>Stage</th>
                <th>Target Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((project, index) => (
                <tr key={project._id} className="row-hover">
                  <td>{index + 1}</td>
                  <td>{project.projectId}</td>
                  <td>{project.client?.companyName || '-'}</td>
                  <td>{project.schemeName || project.scheme?.name || '-'}</td>
                  <td>
                    <span className="tag neutral">{project.currentStage}</span>
                  </td>
                  <td>{formatAbsoluteDate(project.targetCompletionDate)}</td>
                  <td>
                    <Link className="inline-link" to={`/projects/${project._id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No projects found.
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

export default ProjectsPage;
