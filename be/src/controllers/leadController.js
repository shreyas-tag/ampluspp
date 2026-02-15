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
const { getOrCreateSystemSettings, resolveWordpressWebhookConfig } = require('../utils/systemSettings');

const NUMERIC_LEAD_FIELDS = new Set([
  'investmentBuildingConstruction',
  'investmentLand',
  'investmentPlantMachinery',
  'totalInvestment',
  'expectedServiceValue',
  'financeBankLoanPercent',
  'financeOwnContributionPercent'
]);

const DATE_LEAD_FIELDS = new Set([
  'nextFollowUpAt'
]);

const EDITABLE_LEAD_FIELDS = [
  'companyName',
  'contactPerson',
  'promoterName',
  'mobileNumber',
  'email',
  'address',
  'taluka',
  'district',
  'city',
  'state',
  'businessConstitutionType',
  'industryType',
  'projectLandDetail',
  'partnersDirectorsGender',
  'promoterCasteCategory',
  'manufacturingDetails',
  'investmentBuildingConstruction',
  'investmentLand',
  'investmentPlantMachinery',
  'totalInvestment',
  'bankLoanIfAny',
  'financeBankLoanPercent',
  'financeOwnContributionPercent',
  'projectType',
  'requirementType',
  'inquiryFor',
  'expectedServiceValue',
  'associatePartnerName',
  'customerProgressStatus',
  'availedSubsidyPreviously',
  'projectSpecificAsk',
  'source',
  'status',
  'assignedTo',
  'nextFollowUpAt'
];

const normalizeKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const INQUIRY_FOR_MAP = {
  subsidy: 'SUBSIDY',
  licensescompliance: 'LICENSES_COMPLIANCE',
  licensesandcompliance: 'LICENSES_COMPLIANCE',
  industriallandinfrastructure: 'INDUSTRIAL_LAND_INFRASTRUCTURE',
  industriallandandinfrastructure: 'INDUSTRIAL_LAND_INFRASTRUCTURE',
  land: 'LAND',
  funding: 'FUNDING',
  compliance: 'COMPLIANCE'
};

const SOURCE_MAP = {
  manual: 'MANUAL',
  website: 'WEBSITE',
  onlinesocialmedia: 'ONLINE_SOCIAL_MEDIA',
  socialmedia: 'ONLINE_SOCIAL_MEDIA',
  referral: 'REFERRAL',
  coldcallingwhatsapp: 'COLD_CALLING_WHATSAPP',
  coldcallwhatsapp: 'COLD_CALLING_WHATSAPP',
  referencefromexistingclient: 'REFERENCE_EXISTING_CLIENT',
  associatesb2bpartners: 'ASSOCIATES_B2B_PARTNERS',
  exhibitionnetworkingevents: 'EXHIBITION_NETWORKING_EVENTS',
  exhibition: 'EXHIBITION',
  whatsapp: 'WHATSAPP',
  coldcall: 'COLD_CALL'
};

const CUSTOMER_PROGRESS_STATUS_MAP = {
  inprocess: 'IN_PROCESS',
  pendingfromcustomer: 'PENDING_FROM_CUSTOMER',
  won: 'WON',
  lost: 'LOST'
};

const normalizeString = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const str = String(value).trim();
  return str ? str : null;
};

const normalizeNumber = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeInquiryFor = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const key = normalizeKey(value);
  return INQUIRY_FOR_MAP[key] || 'SUBSIDY';
};

const normalizeSource = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return 'MANUAL';
  const key = normalizeKey(value);
  return SOURCE_MAP[key] || 'MANUAL';
};

const normalizeCustomerProgressStatus = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const key = normalizeKey(value);
  return CUSTOMER_PROGRESS_STATUS_MAP[key] || 'IN_PROCESS';
};

const normalizeLeadField = (field, value) => {
  if (NUMERIC_LEAD_FIELDS.has(field)) return normalizeNumber(value);
  if (DATE_LEAD_FIELDS.has(field)) return value || null;
  if (field === 'inquiryFor' || field === 'requirementType') return normalizeInquiryFor(value);
  if (field === 'source') return normalizeSource(value);
  if (field === 'customerProgressStatus') return normalizeCustomerProgressStatus(value);
  return normalizeString(value);
};

const extractLeadAttributes = (payload) => {
  const attrs = {};
  EDITABLE_LEAD_FIELDS.forEach((field) => {
    if (payload[field] !== undefined) {
      attrs[field] = normalizeLeadField(field, payload[field]);
    }
  });
  if (attrs.inquiryFor && attrs.requirementType === undefined) attrs.requirementType = attrs.inquiryFor;
  if (attrs.requirementType && attrs.inquiryFor === undefined) attrs.inquiryFor = attrs.requirementType;
  return attrs;
};

const createPayloadLookup = (payload) => {
  const lookup = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    lookup[normalizeKey(key)] = value;
  });
  return lookup;
};

const pickFromPayload = (payload, lookup, aliases) => {
  for (const alias of aliases) {
    if (payload?.[alias] !== undefined && payload?.[alias] !== null && String(payload[alias]).trim() !== '') {
      return payload[alias];
    }
  }
  for (const alias of aliases) {
    const value = lookup[normalizeKey(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
};

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

const buildProjectProcessTrackingFromLead = (lead, actorId, now = new Date()) => {
  const processTracking = {
    callToActionSharedAt: lead.callToActionDetailsSharedAt || null,
    inquiryFormForwardedAt: lead.inquiryFormForwardedAt || null,
    milestone1InfoWithPaymentAt: lead.milestone1InfoWithPaymentAt || null,
    milestone1InfoWithoutPaymentAt: lead.milestone1InfoWithoutPaymentAt || null,
    milestone1ConsultationScheduledAt: lead.milestone1ConsultationScheduledAt || null,
    milestone2ConsultationCompletedAt: lead.milestone2ConsultationCompletedAt || null,
    milestone2SubsidySummaryForwardedAt: lead.milestone2SubsidySummaryForwardedAt || null,
    milestone2BusinessProposalSharedAt: lead.milestone2BusinessProposalSharedAt || null,
    milestone2DiscussionInProgressAt: lead.milestone2DiscussionInProgressAt || null,
    milestone3MandateSignedAt: lead.milestone3MandateSignedAt || null,
    milestone3ProformaInvoiceRaisedAt: lead.milestone3ProformaInvoiceRaisedAt || null,
    milestone3AdvanceReceivedAt: lead.milestone3AdvanceReceivedAt || null,
    milestone3AdvanceReceivedAmount: lead.milestone3AdvanceReceivedAmount || 0,
    milestone3FinalInvoiceDoneAt: lead.milestone3FinalInvoiceDoneAt || null,
    approxProjectValue: lead.approxProjectValue || 0,
    approxServiceValue: lead.approxServiceValue || 0,
    updatedAt: now,
    updatedBy: actorId
  };

  return processTracking;
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
      .populate('followUpReports.createdBy', 'name email')
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
    const contactPerson = payload.contactPerson || payload.promoterName;
    if (!payload.companyName || !contactPerson || !payload.mobileNumber) {
      const err = new Error('Company name, contact person and mobile number are required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const leadId = await generateLeadId();
    const now = new Date();

    const lead = await Lead.create({
      leadId,
      ...extractLeadAttributes({
        ...payload,
        contactPerson
      }),
      source: payload.source || 'MANUAL',
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
    const settings = await getOrCreateSystemSettings();
    const webhook = resolveWordpressWebhookConfig(settings);
    const key = req.headers['x-webhook-key'];
    if (!webhook.configured) {
      const err = new Error('WordPress webhook key is not configured');
      err.statusCode = StatusCodes.SERVICE_UNAVAILABLE;
      throw err;
    }
    if (!webhook.isActive) {
      const err = new Error('WordPress webhook is currently disabled');
      err.statusCode = StatusCodes.SERVICE_UNAVAILABLE;
      throw err;
    }
    if (key !== webhook.key) {
      const err = new Error('Invalid webhook key');
      err.statusCode = StatusCodes.UNAUTHORIZED;
      throw err;
    }

    const lookup = createPayloadLookup(req.body);
    const promoterName = pickFromPayload(req.body, lookup, [
      'promoterName',
      'nameOfPromoter',
      'nameOfPromoterAuthorizePerson',
      'nameOfPromoterAuthorizedPerson',
      'authorizedPersonName',
      'authorizePersonName',
      'name'
    ]);
    const companyName = pickFromPayload(req.body, lookup, [
      'companyName',
      'enterpriseName',
      'businessName',
      'nameOfEnterprise',
      'nameOfBusiness',
      'nameOfTheEnterpriseBusiness'
    ]);
    const contactPerson = pickFromPayload(req.body, lookup, ['contactPerson', 'contactName', 'personName']) || promoterName;
    const mobileNumber = pickFromPayload(req.body, lookup, ['mobileNumber', 'phoneNo', 'phone', 'phoneNumber', 'mobile', 'phoneNo1']);
    const email = pickFromPayload(req.body, lookup, ['email', 'emailId']);
    const city = pickFromPayload(req.body, lookup, ['city']);
    const district = pickFromPayload(req.body, lookup, ['district']);
    const state = pickFromPayload(req.body, lookup, ['state']);
    const inboundMessage = pickFromPayload(req.body, lookup, ['message', 'projectSpecificAsk', 'specificAsk', 'highlight']);
    const source = pickFromPayload(req.body, lookup, ['source', 'sourceOfLead']) || 'WEBSITE';

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
      ...extractLeadAttributes({
        companyName,
        contactPerson,
        promoterName,
        mobileNumber,
        email,
        city,
        district,
        state,
        businessConstitutionType: pickFromPayload(req.body, lookup, ['businessConstitutionType']),
        address: pickFromPayload(req.body, lookup, ['address', 'locationOfTheProjectAddress']),
        taluka: pickFromPayload(req.body, lookup, ['taluka', 'talukaTehsil']),
        projectLandDetail: pickFromPayload(req.body, lookup, ['projectLandDetail']),
        partnersDirectorsGender: pickFromPayload(req.body, lookup, ['partnersDirectorsGender', 'genderOfPartnersDirectors']),
        promoterCasteCategory: pickFromPayload(req.body, lookup, ['promoterCasteCategory', 'casteOfPromoterPartnersEntrepreneurs']),
        manufacturingDetails: pickFromPayload(req.body, lookup, ['manufacturingDetails', 'manufacturingOrProcessingOf']),
        investmentBuildingConstruction: pickFromPayload(req.body, lookup, ['investmentBuildingConstruction']),
        investmentLand: pickFromPayload(req.body, lookup, ['investmentLand']),
        investmentPlantMachinery: pickFromPayload(req.body, lookup, ['investmentPlantMachinery']),
        totalInvestment: pickFromPayload(req.body, lookup, ['totalInvestment']),
        bankLoanIfAny: pickFromPayload(req.body, lookup, ['bankLoanIfAny']),
        financeBankLoanPercent: pickFromPayload(req.body, lookup, [
          'financeBankLoanPercent',
          'bankLoanPercent',
          'bankLoan',
          'meansOfFinanceBankLoan'
        ]),
        financeOwnContributionPercent: pickFromPayload(req.body, lookup, [
          'financeOwnContributionPercent',
          'ownContributionMargin',
          'ownContribution'
        ]),
        inquiryFor: pickFromPayload(req.body, lookup, ['inquiryFor', 'inquiryForType']),
        expectedServiceValue: pickFromPayload(req.body, lookup, ['expectedServiceValue', 'expectedFeesServiceValue']),
        associatePartnerName: pickFromPayload(req.body, lookup, ['associatePartnerName']),
        customerProgressStatus: pickFromPayload(req.body, lookup, ['customerProgressStatus']),
        projectType: pickFromPayload(req.body, lookup, ['projectType', 'typeOfProject']),
        availedSubsidyPreviously: pickFromPayload(req.body, lookup, [
          'availedSubsidyPreviously',
          'whetherAvailedAnySubsidyBenefitUnderAnySchemePreviouslyUnderSameNameOrEntity'
        ]),
        projectSpecificAsk: pickFromPayload(req.body, lookup, ['projectSpecificAsk', 'specificAsk', 'highlight', 'message']) || inboundMessage
      }),
      source,
      createdBy: actorId,
      enquiryReceivedAt: new Date(),
      lastStatusChangedAt: new Date(),
      statusHistory: [{ to: LEAD_STATUS.NEW, at: new Date(), changedBy: actorId }],
      communicationStats: {
        notesCount: inboundMessage ? 1 : 0,
        callsCount: 0,
        totalCallDurationMinutes: 0
      },
      notes: inboundMessage
        ? [
            {
              note: `Website message: ${inboundMessage}`,
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

    try {
      settings.integrations.wordpress.lastReceivedAt = new Date();
      await settings.save();
    } catch (_err) {
      // Do not fail lead creation if heartbeat update fails.
    }

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

    EDITABLE_LEAD_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        lead[field] = normalizeLeadField(field, req.body[field]);
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

const addLeadFollowUpReport = async (req, res, next) => {
  try {
    const { reportNo, remark } = req.body;
    const parsedReportNo = Number(reportNo);
    if (![1, 2, 3].includes(parsedReportNo) || !String(remark || '').trim()) {
      const err = new Error('reportNo (1-3) and remark are required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      const err = new Error('Lead not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const now = new Date();
    lead.followUpReports.push({
      reportNo: parsedReportNo,
      remark: String(remark).trim(),
      createdBy: req.user._id,
      createdAt: now
    });
    lead.lastInteractionAt = now;
    lead.updateCount = (lead.updateCount || 0) + 1;
    computeFirstResponse(lead, req.user._id, now, lead.status);
    lead.timeline.push({
      type: 'FOLLOW_UP_REPORT_ADDED',
      message: `Follow-up report ${parsedReportNo} added`,
      actor: req.user._id,
      at: now
    });

    await lead.save();

    await broadcastEvent({
      type: 'LEAD_FOLLOW_UP',
      title: 'Follow-up report logged',
      message: `${lead.companyName} follow-up report ${parsedReportNo} added`,
      payload: { leadId: lead._id, reportNo: parsedReportNo },
      actorId: req.user._id
    });

    await logAudit({
      action: 'LEAD_FOLLOW_UP_ADDED',
      entityType: 'LEAD',
      entityId: lead._id,
      actor: req.user._id,
      metadata: { reportNo: parsedReportNo, remarkLength: String(remark).trim().length },
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
      processTracking: buildProjectProcessTrackingFromLead(lead, req.user._id, new Date()),
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
    lead.customerProgressStatus = 'WON';
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
  addLeadFollowUpReport,
  convertLeadToClient
};
