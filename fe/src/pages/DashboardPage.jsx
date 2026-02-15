import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Gauge, KanbanSquare, Target, Users, UserRoundCheck, Workflow } from 'lucide-react';
import api, { apiErrorMessage } from '../api/client';
import { useSocketEvents } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import { formatSmartDateTime } from '../utils/dateFormat';
import { APP_MODULES } from '../constants/modules';

const adminKpiConfig = {
  leads: { label: 'Total Leads', icon: Users, tone: 'blue' },
  clients: { label: 'Total Clients', icon: UserRoundCheck, tone: 'teal' },
  projects: { label: 'Active Projects', icon: KanbanSquare, tone: 'amber' },
  delayedTasks: { label: 'Delayed Tasks', icon: Clock3, tone: 'red' },
  conversionRate: { label: 'Lead Conversion', icon: Target, suffix: '%', tone: 'violet' },
  avgFirstResponseMinutes: { label: 'Avg First Response', icon: Gauge, suffix: ' min', tone: 'slate' },
  taskCompletionRate: { label: 'Task Completion', icon: Workflow, suffix: '%', tone: 'green' }
};

const userKpiConfig = {
  assignedOpen: { label: 'My Open Tasks', icon: Workflow, tone: 'blue' },
  inProgress: { label: 'In Progress', icon: KanbanSquare, tone: 'amber' },
  dueToday: { label: 'Due Today', icon: Clock3, tone: 'slate' },
  overdue: { label: 'Overdue', icon: Target, tone: 'red' }
};

const taskStatusTagClass = (status) => {
  if (status === 'COMPLETED') return 'status-completed';
  if (status === 'IN_PROGRESS') return 'status-in-progress';
  if (status === 'PENDING') return 'status-pending';
  if (status === 'SKIPPED') return 'status-skipped';
  return 'neutral';
};

function DashboardPage() {
  const { user, isAdmin, hasModuleAccess } = useAuth();
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
  const canViewProjects = isAdmin || hasModuleAccess(APP_MODULES.PROJECTS);

  const myWorkStats = useMemo(() => {
    const summary = { assignedOpen: myQueue.length, inProgress: 0, dueToday: 0, overdue: 0 };
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;

    myQueue.forEach((task) => {
      if (task.status === 'IN_PROGRESS') summary.inProgress += 1;

      if (!task.deadline) return;
      const deadlineTime = new Date(task.deadline).getTime();
      if (Number.isNaN(deadlineTime)) return;
      if (deadlineTime < todayStart) summary.overdue += 1;
      else if (deadlineTime < tomorrowStart) summary.dueToday += 1;
    });

    return summary;
  }, [myQueue]);

  useEffect(() => {
    const load = async () => {
      try {
        if (isAdmin) {
          const canViewLeads = hasModuleAccess(APP_MODULES.LEADS);
          const canViewClients = hasModuleAccess(APP_MODULES.CLIENTS);
          const [leadRes, clientRes, projectRes, reportRes] = await Promise.all([
            canViewLeads ? api.get('/leads?limit=1') : Promise.resolve({ data: { total: 0 } }),
            canViewClients ? api.get('/clients') : Promise.resolve({ data: { clients: [] } }),
            canViewProjects ? api.get('/projects') : Promise.resolve({ data: { projects: [] } }),
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
                const shouldInclude = true;
                if (shouldInclude && !['COMPLETED', 'SKIPPED'].includes(task.status)) {
                  queue.push({
                    projectId: project.projectId,
                    projectRef: project._id,
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
          return;
        }

        if (!canViewProjects) {
          setMyQueue([]);
          setStageDistribution({});
          setStats({
            leads: 0,
            clients: 0,
            projects: 0,
            delayedTasks: 0,
            conversionRate: 0,
            avgFirstResponseMinutes: null,
            taskCompletionRate: 0
          });
          setError('');
          return;
        }

        const { data } = await api.get('/projects');
        const projects = data?.projects || [];
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
              const shouldInclude = isMine;
              if (shouldInclude && !['COMPLETED', 'SKIPPED'].includes(task.status)) {
                queue.push({
                  projectId: project.projectId,
                  projectRef: project._id,
                  milestone: milestone.name,
                  taskName: task.name,
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

        setStats({
          leads: 0,
          clients: 0,
          projects: projects.length,
          delayedTasks,
          conversionRate: 0,
          avgFirstResponseMinutes: null,
          taskCompletionRate: 0
        });
        setStageDistribution({});
        setMyQueue(queue.slice(0, 12));
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    };

    load();
  }, [lastEvent, isAdmin, canViewProjects, user?._id, hasModuleAccess]);

  return (
    <section className="page">
      <PageHeader
        title={isAdmin ? 'Operations Dashboard' : 'My Work Dashboard'}
        subtitle={
          isAdmin
            ? 'Executive snapshot of lead velocity, response discipline, and delivery execution.'
            : 'Assigned task workspace focused on what you need to execute next.'
        }
      />

      {error ? <p className="error-text">{error}</p> : null}

      {isAdmin ? (
        <>
          <div className="kpi-grid">
            {Object.entries(adminKpiConfig).map(([key, cfg]) => {
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
        </>
      ) : (
        <div className="kpi-grid">
          {Object.entries(userKpiConfig).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const value = myWorkStats[key];
            return (
              <article className={`kpi-card tone-${cfg.tone}`} key={key}>
                <div className="kpi-head">
                  <span>{cfg.label}</span>
                  <Icon size={16} />
                </div>
                <strong>{value}</strong>
              </article>
            );
          })}
        </div>
      )}

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
                  {!isAdmin ? <th>Action</th> : null}
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
                      <span className={`tag ${taskStatusTagClass(row.status)}`}>{row.status}</span>
                    </td>
                    <td>{formatSmartDateTime(row.deadline)}</td>
                    {!isAdmin ? (
                      <td>
                        <Link className="btn btn-secondary btn-compact" to={`/projects/${row.projectRef}`}>
                          Open
                        </Link>
                      </td>
                    ) : null}
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
