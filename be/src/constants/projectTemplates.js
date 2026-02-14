const { PROJECT_STAGE } = require('./project');

const normalizeLabel = (value = '') => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');

const STAGE_GUIDANCE = {
  [PROJECT_STAGE.DOCUMENTATION]:
    'Collect and validate all mandatory client and financial documents before moving to filing.',
  [PROJECT_STAGE.APPLICATION_FILED]:
    'Prepare final application packet, submit to department, and capture acknowledgement proof.',
  [PROJECT_STAGE.SCRUTINY]:
    'Track department observations closely and prepare response items with clear ownership.',
  [PROJECT_STAGE.CLARIFICATIONS]:
    'Submit clarification responses with supporting documents within committed timelines.',
  [PROJECT_STAGE.APPROVED]:
    'Collect official approval artifacts and ensure all sanction conditions are met.',
  [PROJECT_STAGE.DISBURSED]:
    'Track disbursement release, validate credited amount, and close compliance items.',
  [PROJECT_STAGE.ON_HOLD]:
    'Pause execution with clear blocker note and owner; resume only after blocker is resolved.',
  [PROJECT_STAGE.COMPLETED]:
    'Project delivery cycle is complete and all required records are archived.',
  [PROJECT_STAGE.REJECTED]:
    'Capture rejection reason, supporting communication, and close-out recommendation.'
};

const TASK_LIBRARY = {
  'collect kyc documents':
    'Collect PAN, Aadhaar, incorporation and statutory KYC documents. Validate legibility and validity.',
  'collect financial statements':
    'Collect latest audited financials, GST returns and bank statements needed for scheme evaluation.',
  'prepare project report':
    'Prepare detailed project report including project scope, cost breakup, and expected subsidy mapping.',
  'fill application form':
    'Populate application form with verified business and project data. Cross-check mandatory fields.',
  'upload required documents':
    'Upload all mandatory annexures and proofs in the required format and naming convention.',
  'submit application':
    'Submit final application and capture submission acknowledgement/reference number.',
  'track scrutiny remarks':
    'Monitor scrutiny updates from department portal/email and log each observation with owner.',
  'submit clarifications':
    'Prepare clarification response package with supporting proofs and submit within timeline.',
  'collect approval letter':
    'Obtain sanctioned approval letter/order and verify sanction amount and conditions.',
  'track subsidy disbursement':
    'Track release milestones and validate subsidy credit with supporting payment references.',
  'prepare and submit application':
    'Compile, verify and submit complete application package with all required annexures.',
  'track status and submit clarifications':
    'Track status checkpoints and submit department clarification responses with documentary evidence.',
  'collect approval and track disbursement':
    'Capture approval documents and continuously track disbursement until receipt confirmation.'
};

const MILESTONE_LIBRARY = {
  [normalizeLabel('Documentation Collection')]:
    'Collect baseline legal, financial and project documents required to initiate scheme processing.',
  [normalizeLabel('Application Filing')]:
    'Complete filing readiness and submit application with full document set and acknowledgement.',
  [normalizeLabel('Department Scrutiny')]:
    'Manage scrutiny observations, clarifications and response submissions during assessment.',
  [normalizeLabel('Approval & Disbursement')]:
    'Track sanction approval and subsidy disbursement to financial closure.'
};

const defaultTaskTemplate = (name, stage) => ({
  name,
  description: TASK_LIBRARY[normalizeLabel(name)] || STAGE_GUIDANCE[stage] || 'Execute task and record key evidence.',
  requiresAttachment:
    stage === PROJECT_STAGE.DOCUMENTATION ||
    stage === PROJECT_STAGE.APPLICATION_FILED ||
    /(doc|document|kyc|statement|upload|application|report|approval|letter|clarification|proof|file)/i.test(name)
});

const buildDefaultMilestones = (now = new Date(), options = {}) => {
  const { withTimeline = false, setFirstStartDate = false } = options;

  const raw = [
    {
      name: 'Documentation Collection',
      stage: PROJECT_STAGE.DOCUMENTATION,
      tasks: ['Collect KYC documents', 'Collect financial statements', 'Prepare project report']
    },
    {
      name: 'Application Filing',
      stage: PROJECT_STAGE.APPLICATION_FILED,
      tasks: ['Fill application form', 'Upload required documents', 'Submit application']
    },
    {
      name: 'Department Scrutiny',
      stage: PROJECT_STAGE.SCRUTINY,
      tasks: ['Track scrutiny remarks', 'Submit clarifications']
    },
    {
      name: 'Approval & Disbursement',
      stage: PROJECT_STAGE.APPROVED,
      tasks: ['Collect approval letter', 'Track subsidy disbursement']
    }
  ];

  return raw.map((milestone, index) => {
    const item = {
      name: milestone.name,
      stage: milestone.stage,
      status: 'PENDING',
      description: getDefaultMilestoneDescription(milestone.name, milestone.stage),
      tasks: milestone.tasks.map((taskName) => defaultTaskTemplate(taskName, milestone.stage))
    };

    if (setFirstStartDate && index === 0) item.startDate = now;

    if (withTimeline) {
      item.timeline = [{ type: 'MILESTONE_CREATED', message: 'Milestone created', at: now }];
    }

    return item;
  });
};

const getDefaultTaskDescription = (taskName = '', stage = '') =>
  TASK_LIBRARY[normalizeLabel(taskName)] || STAGE_GUIDANCE[stage] || 'Execute task and record key evidence.';

const getDefaultMilestoneDescription = (milestoneName = '', stage = '') =>
  MILESTONE_LIBRARY[normalizeLabel(milestoneName)] || STAGE_GUIDANCE[stage] || 'Execute milestone plan and close all tasks.';

const taskNeedsAttachmentByDefault = (taskName = '', stage = '') =>
  stage === PROJECT_STAGE.DOCUMENTATION ||
  stage === PROJECT_STAGE.APPLICATION_FILED ||
  /(doc|document|kyc|statement|upload|application|report|approval|letter|clarification|proof|file)/i.test(String(taskName));

module.exports = {
  STAGE_GUIDANCE,
  buildDefaultMilestones,
  getDefaultTaskDescription,
  getDefaultMilestoneDescription,
  taskNeedsAttachmentByDefault
};
