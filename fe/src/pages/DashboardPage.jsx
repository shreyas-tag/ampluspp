import { useEffect, useState } from 'react';
import { Clock3, Gauge, KanbanSquare, Target, Users, UserRoundCheck, Workflow } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import { useSocketEvents } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { formatSmartDateTime } from '../utils/dateFormat';

const kpiConfig = {
  leads: { label: 'Total Leads', icon: Users, tone: 'blue' },
  clients: { label: 'Total Clients', icon: UserRoundCheck, tone: 'teal' },
  projects: { label: 'Active Projects', icon: KanbanSquare, tone: 'amber' },
  delayedTasks: { label: 'Delayed Tasks', icon: Clock3, tone: 'red' },
  conversionRate: { label: 'Lead Conversion', icon: Target, suffix: '%', tone: 'violet' },
  avgFirstResponseMinutes: { label: 'Avg First Response', icon: Gauge, suffix: ' min', tone: 'slate' },
  taskCompletionRate: { label: 'Task Completion', icon: Workflow, suffix: '%', tone: 'green' }
};

function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    leads: 0,
    clients: 0,
    projects: 0,
    delayedTasks: 0,
    conversionRate: 0,
    avgFirstResponseMinutes: null,
    taskCompletionRate: 0
  });
  const [myQueue, setMyQueue] = useState([]);
  const [stageDistribution, setStageDistribution] = useState({});
  const [error, setError] = useState('');
  const { lastEvent } = useSocketEvents();

  useEffect(() => {
    const load = async () => {
      try {
        const [leadRes, clientRes, projectRes, reportRes] = await Promise.all([
          api.get('/leads?limit=1'),
          api.get('/clients'),
          api.get('/projects'),
          api.get('/meta/report-summary')
        ]);

        const projects = projectRes.data.projects || [];
        let delayedTasks = 0;
        const now = Date.now();

        const queue = [];
        projects.forEach((project) => {
          (project.milestones || []).forEach((milestone) => {
            (milestone.tasks || []).forEach((task) => {
              if (task.deadline && task.status !== 'COMPLETED' && new Date(task.deadline).getTime() < now) {
                delayedTasks += 1;
              }

              const assigneeId = task?.assignee?._id || task?.assignee || null;
              const isMine = assigneeId && String(assigneeId) === String(user?._id || '');
              const shouldInclude = isAdmin ? true : isMine;
              if (shouldInclude && !['COMPLETED', 'SKIPPED'].includes(task.status)) {
                queue.push({
                  projectId: project.projectId,
                  milestone: milestone.name,
                  taskName: task.name,
                  assignee: task?.assignee?.name || (assigneeId ? 'Assigned' : 'Unassigned'),
                  status: task.status,
                  deadline: task.deadline || null
                });
              }
            });
          });
        });

        queue.sort((a, b) => {
          const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        });

        const report = reportRes.data || {};
        setStats({
          leads: leadRes.data.total || 0,
          clients: (clientRes.data.clients || []).length,
          projects: projects.length,
          delayedTasks,
          conversionRate: report.conversionRate || 0,
          avgFirstResponseMinutes: report.avgFirstResponseMinutes,
          taskCompletionRate: report.taskCompletionRate || 0
        });
        setStageDistribution(report.stageDistribution || {});
        setMyQueue(queue.slice(0, 8));
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    };

    load();
  }, [lastEvent, isAdmin, user?._id]);

  return (
    <section className="page">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Executive snapshot of lead velocity, response discipline, and delivery execution."
      />

      {error ? <p className="error-text">{error}</p> : null}

      <div className="kpi-grid">
        {Object.entries(kpiConfig).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const value = stats[key];
          return (
            <article className={`kpi-card tone-${cfg.tone}`} key={key}>
              <div className="kpi-head">
                <span>{cfg.label}</span>
                <Icon size={16} />
              </div>
              <strong>
                {value === null || value === undefined ? '-' : `${value}${cfg.suffix || ''}`}
              </strong>
            </article>
          );
        })}
      </div>

      <article className="card">
        <div className="section-head">
          <h3>Project Stage Distribution</h3>
        </div>
        <div className="chip-grid">
          {Object.keys(stageDistribution).length === 0 ? (
            <p className="muted-text">No project stage data available yet.</p>
          ) : (
            Object.entries(stageDistribution).map(([stage, count]) => (
              <div className="stage-chip" key={stage}>
                <span>{stage}</span>
                <strong>{count}</strong>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="card">
        <div className="section-head">
          <h3>{isAdmin ? 'All Pending Work' : 'My Assigned Work'}</h3>
          <span className="table-count">{myQueue.length} pending</span>
        </div>
        {myQueue.length === 0 ? (
          <p className="muted-text">{isAdmin ? 'No pending tasks in system.' : 'No pending tasks assigned right now.'}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Milestone</th>
                  <th>Task</th>
                  {isAdmin ? <th>Assignee</th> : null}
                  <th>Status</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {myQueue.map((row, index) => (
                  <tr key={`${row.projectId}-${row.taskName}-${index}`} className="row-hover">
                    <td>{row.projectId}</td>
                    <td>{row.milestone}</td>
                    <td>{row.taskName}</td>
                    {isAdmin ? <td>{row.assignee}</td> : null}
                    <td>
                      <span className="tag neutral">{row.status}</span>
                    </td>
                    <td>{formatSmartDateTime(row.deadline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

export default DashboardPage;
