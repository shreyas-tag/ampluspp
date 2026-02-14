const { StatusCodes } = require('http-status-codes');
const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const { PROJECT_STAGE } = require('../constants/project');
const {
  getDefaultTaskDescription,
  getDefaultMilestoneDescription,
  taskNeedsAttachmentByDefault
} = require('../constants/projectTemplates');
const { broadcastEvent } = require('../utils/realtime');
const { recalcProjectStats } = require('../utils/projectStats');
const { logAudit } = require('../utils/auditLog');

const STAGE_SEQUENCE = [
  PROJECT_STAGE.DOCUMENTATION,
  PROJECT_STAGE.APPLICATION_FILED,
  PROJECT_STAGE.SCRUTINY,
  PROJECT_STAGE.CLARIFICATIONS,
  PROJECT_STAGE.APPROVED,
  PROJECT_STAGE.DISBURSED
];

const AUTO_LOCKED_STAGES = new Set([PROJECT_STAGE.ON_HOLD, PROJECT_STAGE.REJECTED, PROJECT_STAGE.COMPLETED]);

const applyGuidanceDefaults = (projectLike) => {
  (projectLike.milestones || []).forEach((milestone) => {
    if (!milestone.description) {
      milestone.description = getDefaultMilestoneDescription(milestone.name, milestone.stage);
    }

    (milestone.tasks || []).forEach((task) => {
      if (!task.description) {
        task.description = getDefaultTaskDescription(task.name, milestone.stage);
      }
      if (task.requiresAttachment === undefined || task.requiresAttachment === null) {
        task.requiresAttachment = taskNeedsAttachmentByDefault(task.name, milestone.stage);
      }
    });
  });

  return projectLike;
};

const isAdminUser = (req) => req.user?.role === 'ADMIN';

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

const isTaskAssignedToUser = (task, userId) => {
  const assigneeId = normalizeId(task?.assignee);
  if (!assigneeId || !userId) return false;
  return String(assigneeId) === String(userId);
};

const projectHasAssignedTaskForUser = (project, userId) =>
  (project?.milestones || []).some((milestone) =>
    (milestone?.tasks || []).some((task) => isTaskAssignedToUser(task, userId))
  );

const ensureProjectAccess = (project, req) => {
  if (isAdminUser(req)) return;
  if (projectHasAssignedTaskForUser(project, req.user?._id)) return;

  const err = new Error('You do not have access to this project');
  err.statusCode = StatusCodes.FORBIDDEN;
  throw err;
};

const ensureTaskExecutionAccess = (task, req) => {
  if (isAdminUser(req)) return;

  const assigneeId = normalizeId(task?.assignee);
  if (!assigneeId) {
    const err = new Error('Task is unassigned. Contact admin for assignment.');
    err.statusCode = StatusCodes.FORBIDDEN;
    throw err;
  }

  if (String(assigneeId) !== String(req.user?._id)) {
    const err = new Error('You can only update tasks assigned to you');
    err.statusCode = StatusCodes.FORBIDDEN;
    throw err;
  }
};

const syncMilestoneStatus = (milestone, now = new Date()) => {
  const tasks = milestone.tasks || [];
  const previousStatus = milestone.status;

  if (tasks.length === 0) {
    milestone.status = 'PENDING';
    milestone.completedAt = null;
    return previousStatus !== milestone.status;
  }

  const hasStarted = tasks.some((task) => ['IN_PROGRESS', 'COMPLETED', 'SKIPPED'].includes(task.status));
  const allDone = tasks.every((task) => ['COMPLETED', 'SKIPPED'].includes(task.status));

  if (allDone) {
    milestone.status = 'DONE';
    if (!milestone.completedAt) milestone.completedAt = now;
  } else if (hasStarted) {
    milestone.status = 'IN_PROGRESS';
    milestone.completedAt = null;
  } else {
    milestone.status = 'PENDING';
    milestone.completedAt = null;
  }

  return previousStatus !== milestone.status;
};

const getNextOpenStage = (project, currentStage) => {
  const currentIndex = STAGE_SEQUENCE.indexOf(currentStage);
  if (currentIndex < 0) return null;

  for (let index = currentIndex + 1; index < STAGE_SEQUENCE.length; index += 1) {
    const stage = STAGE_SEQUENCE[index];
    const milestones = (project.milestones || []).filter((m) => m.stage === stage);
    if (!milestones.length) continue;

    const allClosed = milestones.every((m) => ['DONE', 'SKIPPED'].includes(m.status));
    if (!allClosed) return stage;
  }

  return null;
};

const syncProjectAutomation = (project, actorId, now = new Date()) => {
  applyGuidanceDefaults(project);

  (project.milestones || []).forEach((milestone) => {
    syncMilestoneStatus(milestone, now);
  });

  if (!AUTO_LOCKED_STAGES.has(project.currentStage)) {
    const currentMilestones = (project.milestones || []).filter((m) => m.stage === project.currentStage);
    const currentClosed =
      currentMilestones.length > 0 && currentMilestones.every((m) => ['DONE', 'SKIPPED'].includes(m.status));

    if (currentClosed) {
      const previousStage = project.currentStage;
      const nextStage = getNextOpenStage(project, previousStage);

      if (nextStage && nextStage !== previousStage) {
        project.currentStage = nextStage;
        project.stageHistory.push({ from: previousStage, to: nextStage, at: now, changedBy: actorId });
        project.timeline.push({
          type: 'STAGE_AUTO_ADVANCED',
          message: `Project automatically moved from ${previousStage} to ${nextStage}`,
          actor: actorId,
          at: now
        });
      } else {
        const allMilestonesClosed =
          (project.milestones || []).length > 0 &&
          (project.milestones || []).every((m) => ['DONE', 'SKIPPED'].includes(m.status));

        if (allMilestonesClosed && project.currentStage !== PROJECT_STAGE.COMPLETED) {
          project.currentStage = PROJECT_STAGE.COMPLETED;
          project.stageHistory.push({
            from: previousStage,
            to: PROJECT_STAGE.COMPLETED,
            at: now,
            changedBy: actorId
          });
          project.timeline.push({
            type: 'PROJECT_AUTO_COMPLETED',
            message: 'All milestones closed. Project marked as completed automatically.',
            actor: actorId,
            at: now
          });
        }
      }
    }
  }

  recalcProjectStats(project);
};

const listProjects = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.clientId) filter.client = req.query.clientId;
    if (req.query.currentStage) filter.currentStage = req.query.currentStage;

    const search = req.query.search?.trim();
    if (search) {
      filter.$or = [
        { projectId: new RegExp(search, 'i') },
        { schemeName: new RegExp(search, 'i') },
        { applicationNo: new RegExp(search, 'i') }
      ];
    }

    if (!isAdminUser(req)) {
      filter['milestones.tasks.assignee'] = req.user._id;
    }

    const projects = await Project.find(filter)
      .populate('client', 'clientCode companyName')
      .populate('category', 'name')
      .populate('scheme', 'name code')
      .populate('milestones.tasks.assignee', 'name email')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ projects });
  } catch (err) {
    next(err);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client', 'clientCode companyName contactPerson mobileNumber email')
      .populate('lead', 'leadId companyName contactPerson mobileNumber email')
      .populate('category', 'name')
      .populate('scheme', 'name code')
      .populate('timeline.actor', 'name email')
      .populate('stageHistory.changedBy', 'name email')
      .populate('milestones.tasks.assignee', 'name email')
      .populate('milestones.tasks.comments.author', 'name email')
      .populate('milestones.tasks.attachments.uploadedBy', 'name email')
      .populate('milestones.tasks.timeline.actor', 'name email')
      .populate('milestones.timeline.actor', 'name email')
      .lean();

    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    ensureProjectAccess(project, req);
    applyGuidanceDefaults(project);
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

const createProject = async (req, res, next) => {
  try {
    const err = new Error('Create project using client creation or lead conversion for this version');
    err.statusCode = StatusCodes.BAD_REQUEST;
    throw err;
  } catch (err) {
    next(err);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const previousStage = project.currentStage;
    if (!project.stageHistory) project.stageHistory = [];

    const before = {
      currentStage: previousStage,
      targetCompletionDate: project.targetCompletionDate,
      expectedSubsidyAmount: project.expectedSubsidyAmount
    };

    const fields = [
      'schemeName',
      'departmentInvolved',
      'applicationNo',
      'projectValue',
      'expectedSubsidyAmount',
      'startDate',
      'targetCompletionDate',
      'currentStage',
      'category',
      'scheme'
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) project[field] = req.body[field];
    });

    const now = new Date();
    if (previousStage !== project.currentStage) {
      project.stageHistory.push({
        from: previousStage,
        to: project.currentStage,
        at: now,
        changedBy: req.user._id
      });
    }

    syncProjectAutomation(project, req.user._id, now);

    project.timeline.push({
      type: 'PROJECT_UPDATED',
      message: 'Project updated',
      actor: req.user._id,
      at: now
    });

    await project.save();

    await broadcastEvent({
      type: 'PROJECT_UPDATED',
      title: 'Project updated',
      message: `${project.projectId} was updated`,
      payload: { projectId: project._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'PROJECT_UPDATED',
      entityType: 'PROJECT',
      entityId: project._id,
      actor: req.user._id,
      before,
      after: {
        currentStage: project.currentStage,
        targetCompletionDate: project.targetCompletionDate,
        expectedSubsidyAmount: project.expectedSubsidyAmount
      },
      req
    });

    res.json({ project });
  } catch (err) {
    next(err);
  }
};

const addMilestone = async (req, res, next) => {
  try {
    const { name, dueDate, stage } = req.body;
    if (!name) {
      const err = new Error('Milestone name is required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const now = new Date();
    const targetStage = stage || project.currentStage;

    project.milestones.push({
      name,
      stage: targetStage,
      dueDate,
      timeline: [
        {
          type: 'MILESTONE_CREATED',
          message: `Milestone ${name} created`,
          actor: req.user._id,
          at: now
        }
      ]
    });

    project.timeline.push({
      type: 'MILESTONE_CREATED',
      message: `Milestone ${name} created`,
      actor: req.user._id,
      at: now
    });

    syncProjectAutomation(project, req.user._id, now);

    await project.save();

    await broadcastEvent({
      type: 'MILESTONE_CREATED',
      title: 'Milestone added',
      message: `${project.projectId}: ${name}`,
      payload: { projectId: project._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'MILESTONE_CREATED',
      entityType: 'PROJECT',
      entityId: project._id,
      actor: req.user._id,
      metadata: { milestoneName: name, dueDate, stage: targetStage },
      req
    });

    res.status(StatusCodes.CREATED).json({ project });
  } catch (err) {
    next(err);
  }
};

const updateMilestone = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) {
      const err = new Error('Milestone not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    ['name', 'stage', 'startDate', 'dueDate'].forEach((field) => {
      if (req.body[field] !== undefined) milestone[field] = req.body[field];
    });

    const now = new Date();

    milestone.timeline.push({
      type: 'MILESTONE_UPDATED',
      message: 'Milestone updated',
      actor: req.user._id,
      at: now
    });

    project.timeline.push({
      type: 'MILESTONE_UPDATED',
      message: `Milestone ${milestone.name} updated`,
      actor: req.user._id,
      at: now
    });

    syncProjectAutomation(project, req.user._id, now);

    await project.save();

    await broadcastEvent({
      type: 'MILESTONE_UPDATED',
      title: 'Milestone updated',
      message: `${project.projectId}: ${milestone.name}`,
      payload: { projectId: project._id, milestoneId: milestone._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'MILESTONE_UPDATED',
      entityType: 'PROJECT',
      entityId: project._id,
      actor: req.user._id,
      metadata: { milestoneId: milestone._id, status: milestone.status, name: milestone.name, stage: milestone.stage },
      req
    });

    res.json({ project });
  } catch (err) {
    next(err);
  }
};

const addTaskToMilestone = async (req, res, next) => {
  try {
    const { name, description, assignee, deadline, priority, requiresAttachment } = req.body;
    if (!name) {
      const err = new Error('Task name is required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) {
      const err = new Error('Milestone not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const now = new Date();
    const finalRequiresAttachment =
      requiresAttachment !== undefined ? Boolean(requiresAttachment) : taskNeedsAttachmentByDefault(name, milestone.stage);
    const finalDescription = (description || '').trim() || getDefaultTaskDescription(name, milestone.stage);

    milestone.tasks.push({
      name,
      description: finalDescription,
      assignee,
      deadline,
      priority,
      requiresAttachment: finalRequiresAttachment,
      timeline: [
        {
          type: 'TASK_CREATED',
          message: `Task ${name} created`,
          actor: req.user._id,
          at: now
        }
      ]
    });

    milestone.timeline.push({
      type: 'TASK_CREATED',
      message: `Task ${name} added`,
      actor: req.user._id,
      at: now
    });

    project.timeline.push({
      type: 'TASK_CREATED',
      message: `Task ${name} added in milestone ${milestone.name}`,
      actor: req.user._id,
      at: now
    });

    syncProjectAutomation(project, req.user._id, now);

    await project.save();

    await broadcastEvent({
      type: 'TASK_CREATED',
      title: 'Task created',
      message: `${project.projectId}: ${name}`,
      payload: { projectId: project._id, milestoneId: milestone._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'TASK_CREATED',
      entityType: 'PROJECT',
      entityId: project._id,
      actor: req.user._id,
      metadata: {
        milestoneId: milestone._id,
        taskName: name,
        priority: priority || 'MEDIUM',
        descriptionLength: finalDescription.length,
        requiresAttachment: finalRequiresAttachment
      },
      req
    });

    res.status(StatusCodes.CREATED).json({ project });
  } catch (err) {
    next(err);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) {
      const err = new Error('Milestone not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const task = milestone.tasks.id(req.params.taskId);
    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    if (req.body.status !== undefined && req.body.status !== 'SKIPPED') {
      const err = new Error('Task status is automated. Use complete action to mark completed.');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    ['name', 'description', 'assignee', 'deadline', 'priority', 'requiresAttachment'].forEach((field) => {
      if (req.body[field] !== undefined) task[field] = req.body[field];
    });

    const now = new Date();

    if (req.body.status === 'SKIPPED') {
      if (req.user?.role !== 'ADMIN') {
        const err = new Error('Only admin can skip a task');
        err.statusCode = StatusCodes.FORBIDDEN;
        throw err;
      }
      task.status = 'SKIPPED';
      task.completedAt = now;
    }

    task.timeline.push({
      type: 'TASK_UPDATED',
      message: 'Task updated',
      actor: req.user._id,
      at: now
    });

    milestone.timeline.push({
      type: 'TASK_UPDATED',
      message: `Task ${task.name} updated`,
      actor: req.user._id,
      at: now
    });

    project.timeline.push({
      type: 'TASK_UPDATED',
      message: `${task.name} updated`,
      actor: req.user._id,
      at: now
    });

    syncProjectAutomation(project, req.user._id, now);

    await project.save();

    await broadcastEvent({
      type: 'TASK_UPDATED',
      title: 'Task updated',
      message: `${project.projectId}: ${task.name}`,
      payload: {
        projectId: project._id,
        milestoneId: milestone._id,
        taskId: task._id
      },
      actorId: req.user._id
    });

    await logAudit({
      action: 'TASK_UPDATED',
      entityType: 'PROJECT',
      entityId: project._id,
      actor: req.user._id,
      metadata: {
        milestoneId: milestone._id,
        taskId: task._id,
        status: task.status,
        priority: task.priority,
        requiresAttachment: Boolean(task.requiresAttachment)
      },
      req
    });

    res.json({ project });
  } catch (err) {
    next(err);
  }
};

const completeTask = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) {
      const err = new Error('Milestone not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const task = milestone.tasks.id(req.params.taskId);
    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    ensureTaskExecutionAccess(task, req);

    if (task.status === 'SKIPPED') {
      const err = new Error('Skipped task cannot be completed directly');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const needsAttachment =
      task.requiresAttachment || taskNeedsAttachmentByDefault(task.name, milestone.stage);
    task.requiresAttachment = needsAttachment;

    if (needsAttachment && (task.attachments || []).length === 0) {
      const err = new Error('Upload required documents before completing this task');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const now = new Date();
    task.status = 'COMPLETED';
    task.completedAt = now;

    task.timeline.push({
      type: 'TASK_COMPLETED',
      message: 'Task marked completed',
      actor: req.user._id,
      at: now
    });

    milestone.timeline.push({
      type: 'TASK_COMPLETED',
      message: `${task.name} completed`,
      actor: req.user._id,
      at: now
    });

    project.timeline.push({
      type: 'TASK_COMPLETED',
      message: `${task.name} completed`,
      actor: req.user._id,
      at: now
    });

    syncProjectAutomation(project, req.user._id, now);

    await project.save();

    await broadcastEvent({
      type: 'TASK_COMPLETED',
      title: 'Task completed',
      message: `${project.projectId}: ${task.name}`,
      payload: { projectId: project._id, milestoneId: milestone._id, taskId: task._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'TASK_COMPLETED',
      entityType: 'PROJECT',
      entityId: project._id,
      actor: req.user._id,
      metadata: {
        milestoneId: milestone._id,
        taskId: task._id,
        requiresAttachment: Boolean(task.requiresAttachment),
        attachmentCount: (task.attachments || []).length
      },
      req
    });

    res.json({ project });
  } catch (err) {
    next(err);
  }
};

const addTaskComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      const err = new Error('Comment text is required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) {
      const err = new Error('Milestone not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const task = milestone.tasks.id(req.params.taskId);
    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    ensureTaskExecutionAccess(task, req);

    const now = new Date();

    task.comments.push({ text, author: req.user._id });

    if (task.status === 'PENDING') {
      task.status = 'IN_PROGRESS';
      task.timeline.push({
        type: 'TASK_STARTED',
        message: 'Task moved to in-progress automatically',
        actor: req.user._id,
        at: now
      });
    }

    task.timeline.push({
      type: 'TASK_COMMENT',
      message: 'Comment added',
      actor: req.user._id,
      at: now
    });

    milestone.timeline.push({
      type: 'TASK_COMMENT',
      message: `Comment added on task ${task.name}`,
      actor: req.user._id,
      at: now
    });

    project.timeline.push({
      type: 'TASK_COMMENT',
      message: `Comment added on ${task.name}`,
      actor: req.user._id,
      at: now
    });

    syncProjectAutomation(project, req.user._id, now);

    await project.save();

    await broadcastEvent({
      type: 'TASK_COMMENT',
      title: 'Task comment',
      message: `${project.projectId}: comment on ${task.name}`,
      payload: { projectId: project._id, milestoneId: milestone._id, taskId: task._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'TASK_COMMENT_ADDED',
      entityType: 'PROJECT',
      entityId: project._id,
      actor: req.user._id,
      metadata: { milestoneId: milestone._id, taskId: task._id, commentLength: text.length },
      req
    });

    res.status(StatusCodes.CREATED).json({ project });
  } catch (err) {
    next(err);
  }
};

const uploadTaskAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      const err = new Error('PDF file is required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const uploadedBytes = fs.readFileSync(req.file.path);
    const fileSignature = uploadedBytes.subarray(0, 4).toString('utf8');
    if (fileSignature !== '%PDF') {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_cleanupError) {
        // Ignore cleanup errors for malformed uploads.
      }
      const err = new Error('Uploaded file content is not a valid PDF');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) {
      const err = new Error('Milestone not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const task = milestone.tasks.id(req.params.taskId);
    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    ensureTaskExecutionAccess(task, req);

    const now = new Date();

    task.attachments.push({
      fileName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      uploadedAt: now
    });

    if (task.status === 'PENDING') {
      task.status = 'IN_PROGRESS';
      task.timeline.push({
        type: 'TASK_STARTED',
        message: 'Task moved to in-progress automatically',
        actor: req.user._id,
        at: now
      });
    }

    task.timeline.push({
      type: 'TASK_ATTACHMENT',
      message: `PDF uploaded: ${req.file.originalname}`,
      actor: req.user._id,
      at: now
    });

    milestone.timeline.push({
      type: 'TASK_ATTACHMENT',
      message: `Attachment uploaded for ${task.name}`,
      actor: req.user._id,
      at: now
    });

    project.timeline.push({
      type: 'TASK_ATTACHMENT',
      message: `Attachment uploaded for task ${task.name}`,
      actor: req.user._id,
      at: now
    });

    syncProjectAutomation(project, req.user._id, now);

    await project.save();

    await broadcastEvent({
      type: 'TASK_ATTACHMENT',
      title: 'Task document uploaded',
      message: `${project.projectId}: ${task.name}`,
      payload: {
        projectId: project._id,
        milestoneId: milestone._id,
        taskId: task._id
      },
      actorId: req.user._id
    });

    await logAudit({
      action: 'TASK_ATTACHMENT_UPLOADED',
      entityType: 'PROJECT',
      entityId: project._id,
      actor: req.user._id,
      metadata: {
        milestoneId: milestone._id,
        taskId: task._id,
        fileName: req.file.originalname,
        size: req.file.size
      },
      req
    });

    res.status(StatusCodes.CREATED).json({ project });
  } catch (err) {
    next(err);
  }
};

const downloadTaskAttachment = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      const err = new Error('Project not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    ensureProjectAccess(project, req);

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) {
      const err = new Error('Milestone not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const task = milestone.tasks.id(req.params.taskId);
    if (!task) {
      const err = new Error('Task not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    ensureTaskExecutionAccess(task, req);

    const attachment = task.attachments.id(req.params.attachmentId);
    if (!attachment) {
      const err = new Error('Attachment not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const safeFileName = path.basename(attachment.filePath || '');
    const absolutePath = path.join(__dirname, '..', 'uploads', safeFileName);
    if (!safeFileName || !fs.existsSync(absolutePath)) {
      const err = new Error('Attachment file not found on server');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    res.setHeader('Content-Type', attachment.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${String(attachment.fileName || 'document.pdf').replace(/"/g, '')}"`);
    return res.sendFile(absolutePath);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  addMilestone,
  updateMilestone,
  addTaskToMilestone,
  updateTask,
  completeTask,
  addTaskComment,
  uploadTaskAttachment,
  downloadTaskAttachment
};
