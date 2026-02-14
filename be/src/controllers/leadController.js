const { StatusCodes } = require('http-status-codes');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Category = require('../models/Category');
const Scheme = require('../models/Scheme');
const User = require('../models/User');
const { LEAD_STATUS } = require('../constants/lead');
const { PROJECT_STAGE } = require('../constants/project');
const { buildDefaultMilestones } = require('../constants/projectTemplates');
const { generateLeadId, generateClientCode, generateProjectId } = require('../utils/idGenerator');
const { getLeadTemperature } = require('../utils/leadTemperature');
const { broadcastEvent } = require('../utils/realtime');
const { recalcProjectStats } = require('../utils/projectStats');
const { logAudit } = require('../utils/auditLog');

const computeFirstResponse = (lead, actorId, now, nextStatus) => {
  const responseStatuses = [LEAD_STATUS.CONTACTED, LEAD_STATUS.FOLLOW_UP, LEAD_STATUS.CONVERTED];
  if (!lead.firstResponseAt && responseStatuses.includes(nextStatus)) {
    lead.firstResponseAt = now;
    const base = lead.enquiryReceivedAt || lead.createdAt || now;
    lead.firstResponseMinutes = Math.max(0, Math.round((now.getTime() - new Date(base).getTime()) / 60000));
    lead.timeline.push({
      type: 'FIRST_RESPONSE_CAPTURED',
      message: `First response captured in ${lead.firstResponseMinutes} minutes`,
      actor: actorId,
      at: now
    });
  }
};

const buildLeadFilter = (query) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.source) filter.source = query.source;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { companyName: regex },
      { contactPerson: regex },
      { mobileNumber: regex },
      { email: regex },
      { leadId: regex }
    ];
  }

  const now = Date.now();
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000);
  const bucket = String(query.bucket || '').toUpperCase();
  const temp = String(query.temperature || '').toUpperCase();

  if (bucket === 'CONVERTED') {
    filter.isConverted = true;
    filter.status = LEAD_STATUS.CONVERTED;
    return filter;
  }

  if (bucket === 'HOT' || temp === 'HOT') {
    filter.isConverted = { $ne: true };
    filter.lastInteractionAt = { $gte: twoDaysAgo };
  }
  if (bucket === 'WARM' || temp === 'WARM') {
    filter.isConverted = { $ne: true };
    filter.lastInteractionAt = { $lt: twoDaysAgo, $gte: fiveDaysAgo };
  }
  if (bucket === 'COLD' || temp === 'COLD') {
    filter.isConverted = { $ne: true };
    filter.lastInteractionAt = { $lt: fiveDaysAgo };
  }

  return filter;
};

const listLeads = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter = buildLeadFilter(req.query);

    const [total, leadsRaw] = await Promise.all([
      Lead.countDocuments(filter),
      Lead.find(filter)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    const leads = leadsRaw.map((lead) => ({
      ...lead,
      temperature: getLeadTemperature(lead.lastInteractionAt)
    }));

    res.json({
      page,
      limit,
      total,
      leads
    });
  } catch (err) {
    next(err);
  }
};

const getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name email role')
      .populate('timeline.actor', 'name email')
      .populate('statusHistory.changedBy', 'name email')
      .populate('notes.createdBy', 'name email')
      .populate('calls.createdBy', 'name email')
      .populate('convertedClient')
      .lean();

    if (!lead) {
      const err = new Error('Lead not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    lead.temperature = getLeadTemperature(lead.lastInteractionAt);
    res.json({ lead });
  } catch (err) {
    next(err);
  }
};

const createLead = async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload.companyName || !payload.contactPerson || !payload.mobileNumber) {
      const err = new Error('Company name, contact person and mobile number are required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const leadId = await generateLeadId();
    const now = new Date();

    const lead = await Lead.create({
      leadId,
      companyName: payload.companyName,
      contactPerson: payload.contactPerson,
      mobileNumber: payload.mobileNumber,
      email: payload.email,
      city: payload.city,
      state: payload.state,
      industryType: payload.industryType,
      requirementType: payload.requirementType,
      source: payload.source || 'MANUAL',
      assignedTo: payload.assignedTo || null,
      nextFollowUpAt: payload.nextFollowUpAt || null,
      createdBy: req.user._id,
      enquiryReceivedAt: now,
      lastStatusChangedAt: now,
      statusHistory: [{ to: LEAD_STATUS.NEW, at: now, changedBy: req.user._id }],
      communicationStats: {
        notesCount: 0,
        callsCount: 0,
        totalCallDurationMinutes: 0
      },
      timeline: [
        {
          type: 'LEAD_CREATED',
          message: 'Lead created',
          actor: req.user._id,
          at: now
        }
      ]
    });

    await broadcastEvent({
      type: 'LEAD_CREATED',
      title: 'New lead created',
      message: `${lead.companyName} (${lead.leadId}) added`,
      payload: { leadId: lead._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'LEAD_CREATED',
      entityType: 'LEAD',
      entityId: lead._id,
      actor: req.user._id,
      after: {
        leadId: lead.leadId,
        companyName: lead.companyName,
        status: lead.status,
        source: lead.source
      },
      req
    });

    res.status(StatusCodes.CREATED).json({ lead });
  } catch (err) {
    next(err);
  }
};

const createLeadFromWebsite = async (req, res, next) => {
  try {
    const key = req.headers['x-webhook-key'];
    const expected = process.env.WORDPRESS_WEBHOOK_KEY || '';
    if (!expected) {
      const err = new Error('WordPress webhook key is not configured on server');
      err.statusCode = StatusCodes.SERVICE_UNAVAILABLE;
      throw err;
    }
    if (key !== expected) {
      const err = new Error('Invalid webhook key');
      err.statusCode = StatusCodes.UNAUTHORIZED;
      throw err;
    }

    const { companyName, contactPerson, mobileNumber, email, city, state, message } = req.body;
    if (!companyName || !contactPerson || !mobileNumber) {
      const err = new Error('companyName, contactPerson and mobileNumber are required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const leadId = await generateLeadId();
    let actorId = req.user?._id || null;
    if (!actorId) {
      const fallbackUser = await User.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
      actorId = fallbackUser?._id || null;
    }
    if (!actorId) {
      const err = new Error('No active user found. Seed an admin user before using webform endpoint.');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const lead = await Lead.create({
      leadId,
      companyName,
      contactPerson,
      mobileNumber,
      email,
      city,
      state,
      source: 'WEBSITE',
      createdBy: actorId,
      enquiryReceivedAt: new Date(),
      lastStatusChangedAt: new Date(),
      statusHistory: [{ to: LEAD_STATUS.NEW, at: new Date(), changedBy: actorId }],
      communicationStats: {
        notesCount: message ? 1 : 0,
        callsCount: 0,
        totalCallDurationMinutes: 0
      },
      notes: message
        ? [
            {
              note: `Website message: ${message}`,
              createdBy: actorId
            }
          ]
        : [],
      timeline: [
        {
          type: 'LEAD_CREATED',
          message: 'Lead created from WordPress contact form',
          actor: actorId,
          at: new Date()
        }
      ]
    });

    await broadcastEvent({
      type: 'LEAD_CREATED',
      title: 'Website lead received',
      message: `${lead.companyName} (${lead.leadId}) from WordPress`,
      payload: { leadId: lead._id }
    });

    await logAudit({
      action: 'LEAD_CREATED_WEBSITE',
      entityType: 'LEAD',
      entityId: lead._id,
      actor: actorId,
      after: {
        leadId: lead.leadId,
        companyName: lead.companyName,
        source: lead.source
      },
      req
    });

    res.status(StatusCodes.CREATED).json({ lead });
  } catch (err) {
    next(err);
  }
};

const updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      const err = new Error('Lead not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }
    const before = {
      status: lead.status,
      assignedTo: lead.assignedTo,
      nextFollowUpAt: lead.nextFollowUpAt
    };
    const previousStatus = lead.status;
    if (!lead.statusHistory) lead.statusHistory = [];

    const updatableFields = [
      'companyName',
      'contactPerson',
      'mobileNumber',
      'email',
      'city',
      'state',
      'industryType',
      'requirementType',
      'source',
      'status',
      'assignedTo',
      'nextFollowUpAt'
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        lead[field] = req.body[field];
      }
    });
    const now = new Date();
    lead.lastInteractionAt = now;
    lead.updateCount = (lead.updateCount || 0) + 1;
    if (previousStatus !== lead.status) {
      lead.lastStatusChangedAt = now;
      lead.statusHistory.push({
        from: previousStatus,
        to: lead.status,
        at: now,
        changedBy: req.user._id
      });
    }
    computeFirstResponse(lead, req.user._id, now, lead.status);
    lead.timeline.push({
      type: 'LEAD_UPDATED',
      message: 'Lead details updated',
      actor: req.user._id,
      at: now
    });

    await lead.save();

    await broadcastEvent({
      type: 'LEAD_UPDATED',
      title: 'Lead updated',
      message: `${lead.companyName} updated`,
      payload: { leadId: lead._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'LEAD_UPDATED',
      entityType: 'LEAD',
      entityId: lead._id,
      actor: req.user._id,
      before,
      after: {
        status: lead.status,
        assignedTo: lead.assignedTo,
        nextFollowUpAt: lead.nextFollowUpAt
      },
      req
    });

    res.json({ lead });
  } catch (err) {
    next(err);
  }
};

const addLeadNote = async (req, res, next) => {
  try {
    const { note } = req.body;
    if (!note) {
      const err = new Error('Note is required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      const err = new Error('Lead not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }
    if (!lead.communicationStats) {
      lead.communicationStats = { notesCount: 0, callsCount: 0, totalCallDurationMinutes: 0 };
    }

    lead.notes.push({ note, createdBy: req.user._id, createdAt: new Date() });
    lead.lastInteractionAt = new Date();
    lead.updateCount = (lead.updateCount || 0) + 1;
    lead.communicationStats.notesCount = (lead.communicationStats?.notesCount || 0) + 1;
    lead.timeline.push({
      type: 'NOTE_ADDED',
      message: `Note added: ${note}`,
      actor: req.user._id,
      at: new Date()
    });

    await lead.save();

    await broadcastEvent({
      type: 'LEAD_NOTE',
      title: 'Lead note added',
      message: `${lead.companyName} note updated`,
      payload: { leadId: lead._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'LEAD_NOTE_ADDED',
      entityType: 'LEAD',
      entityId: lead._id,
      actor: req.user._id,
      metadata: { noteLength: note.length },
      req
    });

    res.status(StatusCodes.CREATED).json({ lead });
  } catch (err) {
    next(err);
  }
};

const addLeadCall = async (req, res, next) => {
  try {
    const { callAt, durationMinutes, summary } = req.body;
    if (!callAt || durationMinutes === undefined || !summary) {
      const err = new Error('callAt, durationMinutes and summary are required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      const err = new Error('Lead not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }
    if (!lead.communicationStats) {
      lead.communicationStats = { notesCount: 0, callsCount: 0, totalCallDurationMinutes: 0 };
    }

    lead.calls.push({
      callAt,
      durationMinutes,
      summary,
      createdBy: req.user._id,
      createdAt: new Date()
    });
    const now = new Date();
    lead.lastInteractionAt = now;
    lead.updateCount = (lead.updateCount || 0) + 1;
    lead.communicationStats.callsCount = (lead.communicationStats?.callsCount || 0) + 1;
    lead.communicationStats.totalCallDurationMinutes =
      (lead.communicationStats?.totalCallDurationMinutes || 0) + Number(durationMinutes);
    computeFirstResponse(lead, req.user._id, now, lead.status);
    lead.timeline.push({
      type: 'CALL_LOGGED',
      message: `Call logged (${durationMinutes} min)`,
      actor: req.user._id,
      at: now,
      meta: { callAt, durationMinutes }
    });

    await lead.save();

    await broadcastEvent({
      type: 'LEAD_CALL',
      title: 'Lead call logged',
      message: `${lead.companyName} call added`,
      payload: { leadId: lead._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'LEAD_CALL_LOGGED',
      entityType: 'LEAD',
      entityId: lead._id,
      actor: req.user._id,
      metadata: { durationMinutes: Number(durationMinutes), callAt },
      req
    });

    res.status(StatusCodes.CREATED).json({ lead });
  } catch (err) {
    next(err);
  }
};

const convertLeadToClient = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      const err = new Error('Lead not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    if (lead.isConverted && lead.convertedClient) {
      const existingClient = await Client.findById(lead.convertedClient).lean();
      return res.json({
        message: 'Lead already converted',
        client: existingClient
      });
    }

    const clientCode = await generateClientCode();
    const projectId = await generateProjectId();

    const client = await Client.create({
      clientCode,
      companyName: lead.companyName,
      contactPerson: lead.contactPerson,
      mobileNumber: lead.mobileNumber,
      email: lead.email,
      assignedConsultant: lead.assignedTo,
      sourceLead: lead._id,
      createdBy: req.user._id,
      timeline: [
        {
          type: 'CLIENT_CREATED_FROM_LEAD',
          message: `Created from lead ${lead.leadId}`,
          actor: req.user._id,
          at: new Date()
        }
      ]
    });

    let category = null;
    let scheme = null;
    if (req.body.categoryId) category = await Category.findById(req.body.categoryId);
    if (req.body.schemeId) scheme = await Scheme.findById(req.body.schemeId);

    const project = await Project.create({
      projectId,
      client: client._id,
      lead: lead._id,
      category: category?._id,
      scheme: scheme?._id,
      schemeName: req.body.schemeName || scheme?.name || 'To Be Defined',
      departmentInvolved: req.body.departmentInvolved,
      applicationNo: req.body.applicationNo,
      projectValue: req.body.projectValue || 0,
      expectedSubsidyAmount: req.body.expectedSubsidyAmount || 0,
      startDate: req.body.startDate || new Date(),
      targetCompletionDate: req.body.targetCompletionDate,
      currentStage: PROJECT_STAGE.DOCUMENTATION,
      stageHistory: [
        {
          to: PROJECT_STAGE.DOCUMENTATION,
          at: new Date(),
          changedBy: req.user._id
        }
      ],
      milestones: buildDefaultMilestones(new Date(), { withTimeline: true, setFirstStartDate: true }),
      timeline: [
        {
          type: 'PROJECT_CREATED',
          message: 'Project created during lead conversion',
          actor: req.user._id,
          at: new Date()
        }
      ],
      createdBy: req.user._id
    });
    recalcProjectStats(project);
    await project.save();

    client.projects.push(project._id);
    client.timeline.push({
      type: 'PROJECT_CREATED',
      message: `Project ${project.projectId} created`,
      actor: req.user._id,
      at: new Date()
    });
    await client.save();

    const now = new Date();
    const previousStatus = lead.status;
    if (!lead.statusHistory) lead.statusHistory = [];
    lead.isConverted = true;
    lead.convertedAt = now;
    lead.convertedClient = client._id;
    lead.status = LEAD_STATUS.CONVERTED;
    lead.lastInteractionAt = now;
    lead.lastStatusChangedAt = now;
    lead.updateCount = (lead.updateCount || 0) + 1;
    lead.statusHistory.push({
      from: previousStatus,
      to: LEAD_STATUS.CONVERTED,
      at: now,
      changedBy: req.user._id
    });
    computeFirstResponse(lead, req.user._id, now, LEAD_STATUS.CONVERTED);
    lead.timeline.push({
      type: 'LEAD_CONVERTED',
      message: `Lead converted to client ${client.clientCode}`,
      actor: req.user._id,
      at: now
    });
    await lead.save();

    await broadcastEvent({
      type: 'LEAD_CONVERTED',
      title: 'Lead converted',
      message: `${lead.companyName} converted to client ${client.clientCode}`,
      payload: { leadId: lead._id, clientId: client._id, projectId: project._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'LEAD_CONVERTED',
      entityType: 'LEAD',
      entityId: lead._id,
      actor: req.user._id,
      metadata: {
        clientId: client._id,
        projectId: project._id,
        clientCode: client.clientCode,
        projectCode: project.projectId
      },
      req
    });

    res.json({
      lead,
      client,
      project
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listLeads,
  getLeadById,
  createLead,
  createLeadFromWebsite,
  updateLead,
  addLeadNote,
  addLeadCall,
  convertLeadToClient
};
