import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, FileText, MessageSquareMore } from 'lucide-react';
import { useParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useSocketEvents } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatAbsoluteDate, formatSmartDateTime } from '../utils/dateFormat';

const STAGES = [
  'DOCUMENTATION',
  'APPLICATION_FILED',
  'SCRUTINY',
  'CLARIFICATIONS',
  'APPROVED',
  'DISBURSED',
  'ON_HOLD',
  'COMPLETED',
  'REJECTED'
];

const VISIBLE_TIMELINE_TYPES = new Set([
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'STAGE_AUTO_ADVANCED',
  'PROJECT_AUTO_COMPLETED',
  'MILESTONE_CREATED',
  'MILESTONE_UPDATED',
  'TASK_CREATED',
  'TASK_UPDATED',
  'TASK_STARTED',
  'TASK_COMPLETED',
  'TASK_COMMENT',
  'TASK_ATTACHMENT'
]);

const inferStage = (milestone, currentStage) => {
  if (milestone.stage) return milestone.stage;
  const name = (milestone.name || '').toLowerCase();
  if (name.includes('document')) return 'DOCUMENTATION';
  if (name.includes('application')) return 'APPLICATION_FILED';
  if (name.includes('scrutiny')) return 'SCRUTINY';
  if (name.includes('clarification')) return 'CLARIFICATIONS';
  if (name.includes('approval')) return 'APPROVED';
  if (name.includes('disbur')) return 'DISBURSED';
  return currentStage || 'DOCUMENTATION';
};

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const taskExecutionBlockReason = (task, currentUserId, isAdmin) => {
  if (isAdmin) return '';
  const assigneeId = task?.assignee?._id || task?.assignee || null;
  if (!assigneeId) return 'Task is unassigned. Contact admin for assignment.';
  if (String(assigneeId) !== String(currentUserId || '')) return 'This task is assigned to another user.';
  return '';
};

const completionBlockReason = (task, currentUserId, isAdmin) => {
  const accessBlockReason = taskExecutionBlockReason(task, currentUserId, isAdmin);
  if (accessBlockReason) return accessBlockReason;
  if (task.status === 'COMPLETED') return 'Already completed';
  if (task.status === 'SKIPPED') return 'Task is skipped';
  if (task.requiresAttachment && (task.attachments || []).length === 0) return 'Upload at least one PDF to complete';
  return '';
};

const actorName = (actor) => {
  if (!actor) return 'Unknown user';
  if (typeof actor === 'string') return 'User';
  return actor.name || actor.email || 'User';
};

const stageStateLabel = (status) => {
  if (status === 'DONE') return 'Done';
  if (status === 'IN_PROGRESS') return 'In Progress';
  if (status === 'PENDING') return 'Pending';
  return 'No Work';
};

const taskStatusTagClass = (status) => {
  if (status === 'COMPLETED') return 'status-completed';
  if (status === 'IN_PROGRESS') return 'status-in-progress';
  if (status === 'SKIPPED') return 'status-skipped';
  return 'status-pending';
};

const milestoneStatusTagClass = (status) => {
  if (status === 'DONE') return 'status-completed';
  if (status === 'IN_PROGRESS') return 'status-in-progress';
  if (status === 'SKIPPED') return 'status-skipped';
  return 'status-pending';
};

const taskPriorityTagClass = (priority) => {
  if (priority === 'HIGH') return 'priority-high';
  if (priority === 'LOW') return 'priority-low';
  return 'priority-medium';
};

const timelineToneClass = (type) => {
  if (String(type).includes('COMPLETED')) return 'tone-success';
  if (String(type).includes('STARTED') || String(type).includes('IN_PROGRESS')) return 'tone-warning';
  if (String(type).includes('ATTACHMENT') || String(type).includes('COMMENT')) return 'tone-info';
  if (String(type).includes('CREATED')) return 'tone-created';
  if (String(type).includes('UPDATED')) return 'tone-updated';
  return 'tone-neutral';
};

const TIMELINE_PAGE_SIZE = 10;

function ProjectDetailsPage() {
  const { id } = useParams();
  const { lastEvent } = useSocketEvents();
  const { user, isAdmin } = useAuth();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [taskAssigneeDraft, setTaskAssigneeDraft] = useState('');
  const [taskDeadlineDraft, setTaskDeadlineDraft] = useState('');
  const [milestoneDueDrafts, setMilestoneDueDrafts] = useState({});

  const [showStageModal, setShowStageModal] = useState(false);
  const [showStageConfirm, setShowStageConfirm] = useState(false);
  const [nextStage, setNextStage] = useState('DOCUMENTATION');
  const [selectedStage, setSelectedStage] = useState('DOCUMENTATION');

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ name: '', dueDate: '', stage: 'DOCUMENTATION' });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskMilestoneId, setTaskMilestoneId] = useState(null);
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    priority: 'MEDIUM',
    deadline: '',
    assignee: '',
    requiresAttachment: false
  });

  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeTarget, setCompleteTarget] = useState({ milestoneId: null, taskId: null, taskName: '' });
  const [taskDetailsTarget, setTaskDetailsTarget] = useState({ milestoneId: null, taskId: null });
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [timelinePage, setTimelinePage] = useState(1);

  const [commentForms, setCommentForms] = useState({});

  const load = async () => {
    try {
      const requests = [api.get(`/projects/${id}`)];
      if (isAdmin) requests.push(api.get('/users/assignable'));

      const [projectResponse, userResponse] = await Promise.all(requests);
      const projectData = projectResponse.data.project;

      setProject(projectData);
      setNextStage(projectData.currentStage);
      setSelectedStage((prev) => prev || projectData.currentStage || 'DOCUMENTATION');
      setNewMilestone((prev) => ({ ...prev, stage: projectData.currentStage || 'DOCUMENTATION' }));
      setAssignableUsers(isAdmin ? userResponse?.data?.users || [] : []);
      setMilestoneDueDrafts(
        Object.fromEntries((projectData.milestones || []).map((milestone) => [String(milestone._id), toDateInput(milestone.dueDate)]))
      );
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  useEffect(() => {
    load();
  }, [id, lastEvent, isAdmin]);

  const milestonesByStage = useMemo(() => {
    if (!project) return [];
    return (project.milestones || []).filter((milestone) => inferStage(milestone, project.currentStage) === selectedStage);
  }, [project, selectedStage]);

  const stageCountMap = useMemo(() => {
    const map = {};
    STAGES.forEach((stage) => {
      map[stage] = 0;
    });
    (project?.milestones || []).forEach((milestone) => {
      const stage = inferStage(milestone, project?.currentStage);
      map[stage] = (map[stage] || 0) + 1;
    });
    return map;
  }, [project]);

  const stageStatusMap = useMemo(() => {
    const map = {};

    STAGES.forEach((stage) => {
      const milestones = (project?.milestones || []).filter(
        (milestone) => inferStage(milestone, project?.currentStage) === stage
      );

      if (!milestones.length) {
        map[stage] = 'EMPTY';
        return;
      }

      const tasks = milestones.flatMap((milestone) => milestone.tasks || []);
      const totalTasks = tasks.length;
      const closedTasks = tasks.filter((task) => ['COMPLETED', 'SKIPPED'].includes(task.status)).length;
      const startedTasks = tasks.filter((task) => ['IN_PROGRESS', 'COMPLETED', 'SKIPPED'].includes(task.status)).length;

      if (totalTasks > 0) {
        if (closedTasks === totalTasks) map[stage] = 'DONE';
        else if (startedTasks > 0) map[stage] = 'IN_PROGRESS';
        else map[stage] = 'PENDING';
        return;
      }

      const allMilestonesClosed = milestones.every((milestone) => ['DONE', 'SKIPPED'].includes(milestone.status));
      const anyMilestoneStarted = milestones.some((milestone) => ['IN_PROGRESS', 'DONE', 'SKIPPED'].includes(milestone.status));
      if (allMilestonesClosed) map[stage] = 'DONE';
      else if (anyMilestoneStarted) map[stage] = 'IN_PROGRESS';
      else map[stage] = 'PENDING';
    });

    return map;
  }, [project]);

  const stageProgress = useMemo(() => {
    const tasks = milestonesByStage.flatMap((milestone) => milestone.tasks || []);
    const completed = tasks.filter((task) => task.status === 'COMPLETED').length;
    return { total: tasks.length, completed };
  }, [milestonesByStage]);

  const timelineEntries = useMemo(
    () =>
      (project?.timeline || [])
        .filter((entry) => VISIBLE_TIMELINE_TYPES.has(entry.type))
        .slice()
        .reverse(),
    [project]
  );

  const timelinePageCount = useMemo(
    () => Math.max(1, Math.ceil(timelineEntries.length / TIMELINE_PAGE_SIZE)),
    [timelineEntries.length]
  );

  const pagedTimelineEntries = useMemo(() => {
    const start = (timelinePage - 1) * TIMELINE_PAGE_SIZE;
    return timelineEntries.slice(start, start + TIMELINE_PAGE_SIZE);
  }, [timelineEntries, timelinePage]);

  const selectedTaskContext = useMemo(() => {
    if (!project || !showTaskDetailsModal || !taskDetailsTarget.milestoneId || !taskDetailsTarget.taskId) return null;
    const milestone = (project.milestones || []).find((item) => String(item._id) === String(taskDetailsTarget.milestoneId));
    const task = (milestone?.tasks || []).find((item) => String(item._id) === String(taskDetailsTarget.taskId));
    if (!milestone || !task) return null;
    return { milestone, task };
  }, [project, showTaskDetailsModal, taskDetailsTarget]);

  useEffect(() => {
    if (showTaskDetailsModal && !selectedTaskContext) {
      setShowTaskDetailsModal(false);
      setTaskDetailsTarget({ milestoneId: null, taskId: null });
    }
  }, [showTaskDetailsModal, selectedTaskContext]);

  useEffect(() => {
    if (!selectedTaskContext) {
      setTaskAssigneeDraft('');
      setTaskDeadlineDraft('');
      return;
    }

    const currentAssigneeId = selectedTaskContext.task?.assignee?._id || selectedTaskContext.task?.assignee || '';
    setTaskAssigneeDraft(currentAssigneeId ? String(currentAssigneeId) : '');
    setTaskDeadlineDraft(toDateInput(selectedTaskContext.task?.deadline));
  }, [selectedTaskContext]);

  useEffect(() => {
    setTimelinePage(1);
  }, [id]);

  useEffect(() => {
    setTimelinePage((prev) => Math.min(prev, timelinePageCount));
  }, [timelinePageCount]);

  const updateProjectStage = async () => {
    try {
      await api.patch(`/projects/${id}`, { currentStage: nextStage });
      setShowStageConfirm(false);
      setShowStageModal(false);
      setSelectedStage(nextStage);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const addMilestone = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/projects/${id}/milestones`, newMilestone);
      setNewMilestone({ name: '', dueDate: '', stage: selectedStage });
      setShowMilestoneModal(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const updateMilestone = async (milestoneId, payload) => {
    try {
      await api.patch(`/projects/${id}/milestones/${milestoneId}`, payload);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openTaskModal = (milestoneId) => {
    if (!isAdmin) return;
    setTaskMilestoneId(milestoneId);
    setNewTask({ name: '', description: '', priority: 'MEDIUM', deadline: '', assignee: '', requiresAttachment: false });
    setShowTaskModal(true);
  };

  const openTaskDetails = (milestoneId, taskId) => {
    setTaskDetailsTarget({ milestoneId, taskId });
    setShowTaskDetailsModal(true);
  };

  const addTask = async (event) => {
    event.preventDefault();
    if (!taskMilestoneId) return;

    try {
      await api.post(`/projects/${id}/milestones/${taskMilestoneId}/tasks`, {
        ...newTask,
        assignee: newTask.assignee || null,
        deadline: newTask.deadline || null
      });
      setShowTaskModal(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const saveTaskAssignee = async () => {
    if (!isAdmin || !selectedTaskContext) return;

    setSavingAssignee(true);
    try {
      await api.patch(`/projects/${id}/milestones/${selectedTaskContext.milestone._id}/tasks/${selectedTaskContext.task._id}`, {
        assignee: taskAssigneeDraft || null,
        deadline: taskDeadlineDraft || null
      });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingAssignee(false);
    }
  };

  const completeTask = async () => {
    if (!completeTarget.milestoneId || !completeTarget.taskId) return;

    try {
      await api.post(`/projects/${id}/milestones/${completeTarget.milestoneId}/tasks/${completeTarget.taskId}/complete`);
      setShowCompleteDialog(false);
      setCompleteTarget({ milestoneId: null, taskId: null, taskName: '' });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const addComment = async (event, milestoneId, taskId) => {
    event.preventDefault();
    const key = `${milestoneId}_${taskId}`;
    const text = commentForms[key]?.trim();
    if (!text) return;

    try {
      await api.post(`/projects/${id}/milestones/${milestoneId}/tasks/${taskId}/comments`, { text });
      setCommentForms((prev) => ({ ...prev, [key]: '' }));
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const uploadPdf = async (event, milestoneId, taskId) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/projects/${id}/milestones/${milestoneId}/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      event.target.value = '';
    }
  };

  const openAttachment = async (milestoneId, taskId, attachment) => {
    try {
      const response = await api.get(
        `/projects/${id}/milestones/${milestoneId}/tasks/${taskId}/attachments/${attachment._id}/download`,
        { responseType: 'blob' }
      );
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: attachment.mimeType || 'application/pdf' }));
      const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = attachment.fileName || 'document.pdf';
        anchor.click();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const selectedTaskExecutionReason = selectedTaskContext
    ? taskExecutionBlockReason(selectedTaskContext.task, user?._id, isAdmin)
    : '';
  const selectedTaskCompletionReason = selectedTaskContext
    ? completionBlockReason(selectedTaskContext.task, user?._id, isAdmin)
    : '';

  if (!project) return <section className="page">Loading project...</section>;

  return (
    <section className="page">
      <PageHeader
        title={`Project ${project.projectId}`}
        subtitle={`${project.client?.companyName || ''} - ${project.schemeName || project.scheme?.name || 'Scheme not set'}`}
      />

      {error ? <p className="error-text">{error}</p> : null}

      <div className="action-strip">
        <span className="tag neutral">Current: {project.currentStage}</span>
        {isAdmin ? (
          <>
            <button className="btn btn-secondary" onClick={() => setShowStageModal(true)}>
              Change Stage
            </button>
            <button className="btn btn-primary" onClick={() => setShowMilestoneModal(true)}>
              Add Milestone
            </button>
          </>
        ) : null}
      </div>

      <div className="three-col-grid">
        <article className="card compact">
          <h4>Application</h4>
          <p>{project.applicationNo || '-'}</p>
          <p className="muted-text">Department: {project.departmentInvolved || '-'}</p>
        </article>
        <article className="card compact">
          <h4>Financial Scope</h4>
          <p>Value: {project.projectValue || 0}</p>
          <p>Expected Subsidy: {project.expectedSubsidyAmount || 0}</p>
        </article>
        <article className="card compact">
          <h4>Execution Metrics</h4>
          <p>Milestones: {project.activityStats?.milestoneCount || project.milestones?.length || 0}</p>
          <p>Tasks: {project.activityStats?.taskCount || 0}</p>
          <p>Completed: {project.activityStats?.completedTaskCount || 0}</p>
        </article>
      </div>

      <article className="card">
        <div className="section-head">
          <h3>Project Stages</h3>
          <span className="table-count">
            Stage Progress: {stageProgress.completed}/{stageProgress.total}
          </span>
        </div>
        <div className="stage-tabs">
          {STAGES.map((stage) => {
            const stageStatus = stageStatusMap[stage] || 'EMPTY';
            const stageStatusClass = `status-${stageStatus.toLowerCase().replace(/_/g, '-')}`;
            return (
              <button
                key={stage}
                className={`stage-tab ${stageStatusClass} ${selectedStage === stage ? 'active' : ''}`}
                onClick={() => setSelectedStage(stage)}
              >
                <span>{stage} ({stageCountMap[stage] || 0})</span>
                <span className="stage-tab-state">{stageStateLabel(stageStatus)}</span>
              </button>
            );
          })}
        </div>
      </article>

      {milestonesByStage.length === 0 ? (
        <article className="card">
          <p className="muted-text">No milestones in {selectedStage} stage yet.</p>
        </article>
      ) : null}

      {milestonesByStage.map((milestone) => (
        <article className="card" key={milestone._id}>
          <div className="section-head">
            <h3>{milestone.name}</h3>
            <div className="toolbar-row">
              <span className={`tag ${milestoneStatusTagClass(milestone.status)}`}>{milestone.status}</span>
              {isAdmin ? (
                <>
                  <select value={milestone.stage || selectedStage} onChange={(e) => updateMilestone(milestone._id, { stage: e.target.value })}>
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-secondary" onClick={() => openTaskModal(milestone._id)}>
                    Add Task
                  </button>
                </>
              ) : (
                <span className="tag neutral">{milestone.stage || selectedStage}</span>
              )}
            </div>
          </div>

          <p className="muted-text">Due: {formatAbsoluteDate(milestone.dueDate)}</p>
          {isAdmin ? (
            <div className="toolbar-row">
              <input
                type="date"
                value={milestoneDueDrafts[String(milestone._id)] || ''}
                onChange={(e) =>
                  setMilestoneDueDrafts((prev) => ({
                    ...prev,
                    [String(milestone._id)]: e.target.value
                  }))
                }
              />
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => updateMilestone(milestone._id, { dueDate: milestoneDueDrafts[String(milestone._id)] || null })}
              >
                Save Due Date
              </button>
            </div>
          ) : null}
          {milestone.description ? <p className="muted-text">{milestone.description}</p> : null}

          <div className="task-list-shell">
            {(milestone.tasks || []).map((task) => {
              const isClosed = ['COMPLETED', 'SKIPPED'].includes(task.status);
              const isOverdue =
                Boolean(task.deadline) && !isClosed && new Date(task.deadline).getTime() < Date.now();

              return (
                <button
                  key={task._id}
                  type="button"
                  className={`task-row status-${String(task.status || 'PENDING').toLowerCase().replace(/_/g, '-')}`}
                  onClick={() => openTaskDetails(milestone._id, task._id)}
                >
                  <div className="task-row-main">
                    <div className="task-row-title">{task.name}</div>
                    <p className="task-row-desc">{task.description || 'No description provided yet.'}</p>
                    <div className="task-row-meta">
                      <span className={`tag ${taskPriorityTagClass(task.priority)}`}>{task.priority}</span>
                      <span className={`tag ${taskStatusTagClass(task.status)}`}>{task.status}</span>
                      <span className={`tag ${task?.assignee?.name ? 'assignee-assigned' : 'assignee-unassigned'}`}>
                        Assignee: {task?.assignee?.name || 'Unassigned'}
                      </span>
                      {task.requiresAttachment ? <span className="tag info-tag">Doc Required</span> : null}
                      <span className={`tag ${isOverdue ? 'due-overdue' : 'due-normal'}`}>Due: {formatAbsoluteDate(task.deadline)}</span>
                    </div>
                  </div>
                  <div className="task-row-end">
                    <span className="table-count">{(task.comments || []).length} comments</span>
                    <span className="table-count">{(task.attachments || []).length} docs</span>
                    <span className="inline-link">
                      Open <ChevronRight size={12} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </article>
      ))}

      <article className="card">
        <div className="section-head">
          <h3>Project Timeline</h3>
          <div className="toolbar-row">
            <span className="table-count">
              Page {timelinePage} / {timelinePageCount}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              disabled={timelinePage <= 1}
              onClick={() => setTimelinePage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              disabled={timelinePage >= timelinePageCount}
              onClick={() => setTimelinePage((prev) => Math.min(timelinePageCount, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
        <ul className="timeline-list">
          {pagedTimelineEntries.map((entry, idx) => (
            <li key={`${entry.type}-${entry.at || idx}-${idx}`} className={`timeline-entry ${timelineToneClass(entry.type)}`}>
              <div>
                <strong>{entry.type}</strong>
                <p>{entry.message}</p>
                <div className="record-meta">
                  {entry.actor ? <span>By {actorName(entry.actor)}</span> : null}
                  {entry.at ? (
                    <>
                      {entry.actor ? <span className="meta-sep">•</span> : null}
                      <span>{formatSmartDateTime(entry.at)}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </article>

      <Modal isOpen={showStageModal} title="Change Project Stage" onClose={() => setShowStageModal(false)}>
        <form className="grid-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Stage
            <select value={nextStage} onChange={(e) => setNextStage(e.target.value)}>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowStageModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setShowStageConfirm(true)}>
              Continue
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showStageConfirm}
        title="Confirm Stage Change"
        message={`Move project to ${nextStage}? This will be logged in audit history.`}
        confirmLabel="Change Stage"
        onConfirm={updateProjectStage}
        onCancel={() => setShowStageConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showCompleteDialog}
        title="Confirm Task Completion"
        message={`Mark task \"${completeTarget.taskName}\" as completed?`}
        confirmLabel="Complete Task"
        onConfirm={completeTask}
        onCancel={() => setShowCompleteDialog(false)}
      />

      <Modal isOpen={showMilestoneModal} title="Add Milestone" onClose={() => setShowMilestoneModal(false)}>
        <form className="grid-form" onSubmit={addMilestone}>
          <label>
            Milestone Name
            <input
              value={newMilestone.name}
              onChange={(e) => setNewMilestone((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>
          <label>
            Stage
            <select value={newMilestone.stage} onChange={(e) => setNewMilestone((prev) => ({ ...prev, stage: e.target.value }))}>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due Date
            <input
              type="date"
              value={newMilestone.dueDate}
              onChange={(e) => setNewMilestone((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowMilestoneModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Milestone
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showTaskModal} title="Add Task" onClose={() => setShowTaskModal(false)}>
        <form className="grid-form" onSubmit={addTask}>
          <label>
            Task Name
            <input value={newTask.name} onChange={(e) => setNewTask((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label>
            Priority
            <select value={newTask.priority} onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value }))}>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </label>
          <label>
            Deadline
            <input type="date" value={newTask.deadline} onChange={(e) => setNewTask((prev) => ({ ...prev, deadline: e.target.value }))} />
          </label>
          <label>
            Assignee
            <select value={newTask.assignee} onChange={(e) => setNewTask((prev) => ({ ...prev, assignee: e.target.value }))}>
              <option value="">Unassigned</option>
              {assignableUsers.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name} ({member.role})
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={newTask.requiresAttachment}
              onChange={(e) => setNewTask((prev) => ({ ...prev, requiresAttachment: e.target.checked }))}
            />
            Require document upload before completion
          </label>
          <label className="full-row">
            Description
            <textarea
              rows={4}
              value={newTask.description}
              onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Task
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showTaskDetailsModal}
        title={selectedTaskContext ? `Task Details - ${selectedTaskContext.task.name}` : 'Task Details'}
        onClose={() => setShowTaskDetailsModal(false)}
      >
        {selectedTaskContext ? (
          <>
            <div className="task-detail-grid">
              <div className="info-tile">
                <small>Status</small>
                <strong>{selectedTaskContext.task.status}</strong>
              </div>
              <div className="info-tile">
                <small>Priority</small>
                <strong>{selectedTaskContext.task.priority}</strong>
              </div>
              <div className="info-tile">
                <small>Milestone</small>
                <strong>{selectedTaskContext.milestone.name}</strong>
              </div>
              <div className="info-tile">
                <small>Deadline</small>
                <strong>{formatAbsoluteDate(selectedTaskContext.task.deadline)}</strong>
              </div>
              <div className="info-tile">
                <small>Assignee</small>
                <strong>{selectedTaskContext.task?.assignee?.name || 'Unassigned'}</strong>
              </div>
            </div>

            <article className="card compact">
              <div className="section-head">
                <h4>What Needs To Be Done</h4>
              </div>
              <p>{selectedTaskContext.task.description || 'Instruction pending configuration.'}</p>
              {selectedTaskContext.task.requiresAttachment ? (
                <p className="muted-text">This task requires document upload before completion.</p>
              ) : null}
            </article>

            <article className="card compact">
              <div className="section-head">
                <h4>Assignment</h4>
              </div>
              {isAdmin ? (
                <div className="grid-form">
                  <label className="full-row">
                    Assigned User
                    <select value={taskAssigneeDraft} onChange={(e) => setTaskAssigneeDraft(e.target.value)}>
                      <option value="">Unassigned</option>
                      {assignableUsers.map((member) => (
                        <option key={member._id} value={member._id}>
                          {member.name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="full-row">
                    Task Deadline
                    <input type="date" value={taskDeadlineDraft} onChange={(e) => setTaskDeadlineDraft(e.target.value)} />
                  </label>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" disabled={savingAssignee} onClick={saveTaskAssignee}>
                      {savingAssignee ? 'Saving...' : 'Save Assignment & Deadline'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="muted-text">
                  Assigned to {selectedTaskContext.task?.assignee?.name || 'nobody yet'}.
                </p>
              )}
            </article>

            <div className="split-grid">
              <article className="card compact">
                <div className="section-head">
                  <h4>
                    <MessageSquareMore size={14} /> Comments ({(selectedTaskContext.task.comments || []).length})
                  </h4>
                </div>
                <ul className="event-list">
                  {(selectedTaskContext.task.comments || []).map((comment) => (
                    <li key={comment._id}>
                      <p>{comment.text}</p>
                      <div className="record-meta">
                        <span>By {actorName(comment.author)}</span>
                        <span className="meta-sep">•</span>
                        <span>{formatSmartDateTime(comment.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <form
                  className="inline-form"
                  onSubmit={(event) => addComment(event, selectedTaskContext.milestone._id, selectedTaskContext.task._id)}
                >
                  <input
                    placeholder="Write comment"
                    disabled={Boolean(selectedTaskExecutionReason)}
                    value={commentForms[`${selectedTaskContext.milestone._id}_${selectedTaskContext.task._id}`] || ''}
                    onChange={(e) =>
                      setCommentForms((prev) => ({
                        ...prev,
                        [`${selectedTaskContext.milestone._id}_${selectedTaskContext.task._id}`]: e.target.value
                      }))
                    }
                  />
                  <button className="btn btn-secondary" type="submit" disabled={Boolean(selectedTaskExecutionReason)}>
                    Add
                  </button>
                </form>
              </article>

              <article className="card compact">
                <div className="section-head">
                  <h4>
                    <FileText size={14} /> Documents ({(selectedTaskContext.task.attachments || []).length})
                  </h4>
                </div>
                <ul className="event-list">
                  {(selectedTaskContext.task.attachments || []).map((file) => (
                    <li key={file._id}>
                      <button
                        type="button"
                        className="inline-link"
                        disabled={Boolean(selectedTaskExecutionReason)}
                        onClick={() => openAttachment(selectedTaskContext.milestone._id, selectedTaskContext.task._id, file)}
                      >
                        {file.fileName}
                      </button>
                    </li>
                  ))}
                </ul>
                <label className="upload-line">
                  Upload PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={Boolean(selectedTaskExecutionReason)}
                    onChange={(event) => uploadPdf(event, selectedTaskContext.milestone._id, selectedTaskContext.task._id)}
                  />
                </label>
              </article>
            </div>
            {selectedTaskExecutionReason ? <p className="muted-text">{selectedTaskExecutionReason}</p> : null}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowTaskDetailsModal(false)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={Boolean(selectedTaskCompletionReason)}
                onClick={() => {
                  setCompleteTarget({
                    milestoneId: selectedTaskContext.milestone._id,
                    taskId: selectedTaskContext.task._id,
                    taskName: selectedTaskContext.task.name
                  });
                  setShowCompleteDialog(true);
                }}
              >
                <CheckCircle2 size={14} />
                Complete Task
              </button>
            </div>
            {selectedTaskCompletionReason ? (
              <p className="muted-text">{selectedTaskCompletionReason}</p>
            ) : null}
          </>
        ) : (
          <p className="muted-text">Task details not available.</p>
        )}
      </Modal>
    </section>
  );
}

export default ProjectDetailsPage;
