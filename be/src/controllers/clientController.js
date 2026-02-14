const { StatusCodes } = require('http-status-codes');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Category = require('../models/Category');
const Scheme = require('../models/Scheme');
const { PROJECT_STAGE } = require('../constants/project');
const { buildDefaultMilestones } = require('../constants/projectTemplates');
const { generateClientCode, generateProjectId } = require('../utils/idGenerator');
const { broadcastEvent } = require('../utils/realtime');
const { recalcProjectStats } = require('../utils/projectStats');
const { logAudit } = require('../utils/auditLog');

const listClients = async (req, res, next) => {
  try {
    const search = req.query.search?.trim();
    const filter = search
      ? {
          $or: [
            { companyName: new RegExp(search, 'i') },
            { clientCode: new RegExp(search, 'i') },
            { contactPerson: new RegExp(search, 'i') },
            { email: new RegExp(search, 'i') }
          ]
        }
      : {};

    const clients = await Client.find(filter)
      .populate('assignedConsultant', 'name email')
      .populate('projects')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ clients });
  } catch (err) {
    next(err);
  }
};

const getClientById = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate('assignedConsultant', 'name email role')
      .populate('projects')
      .populate('timeline.actor', 'name email')
      .lean();

    if (!client) {
      const err = new Error('Client not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    res.json({ client });
  } catch (err) {
    next(err);
  }
};

const createClient = async (req, res, next) => {
  try {
    const { companyName } = req.body;
    if (!companyName) {
      const err = new Error('companyName is required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const clientCode = await generateClientCode();

    const client = await Client.create({
      clientCode,
      companyName,
      gstNo: req.body.gstNo,
      factoryAddress: req.body.factoryAddress,
      contactPerson: req.body.contactPerson,
      mobileNumber: req.body.mobileNumber,
      email: req.body.email,
      agreementSigned: req.body.agreementSigned,
      agreementDate: req.body.agreementDate,
      assignedConsultant: req.body.assignedConsultant,
      createdBy: req.user._id,
      timeline: [
        {
          type: 'CLIENT_CREATED',
          message: 'Client created manually',
          actor: req.user._id,
          at: new Date()
        }
      ]
    });

    let project = null;
    const shouldCreateProject = req.body.createProject !== false;

    if (shouldCreateProject) {
      const projectId = await generateProjectId();
      let category = null;
      let scheme = null;
      if (req.body.categoryId) category = await Category.findById(req.body.categoryId);
      if (req.body.schemeId) scheme = await Scheme.findById(req.body.schemeId);

      project = await Project.create({
        projectId,
        client: client._id,
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
            message: 'Project created with client',
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
    }

    await broadcastEvent({
      type: 'CLIENT_CREATED',
      title: 'Client created',
      message: `${client.companyName} (${client.clientCode}) added`,
      payload: { clientId: client._id, projectId: project?._id },
      actorId: req.user._id
    });

    await logAudit({
      action: 'CLIENT_CREATED',
      entityType: 'CLIENT',
      entityId: client._id,
      actor: req.user._id,
      after: {
        clientCode: client.clientCode,
        companyName: client.companyName,
        withProject: Boolean(project)
      },
      metadata: { projectId: project?._id, projectCode: project?.projectId },
      req
    });

    res.status(StatusCodes.CREATED).json({ client, project });
  } catch (err) {
    next(err);
  }
};

module.exports = { listClients, getClientById, createClient };
