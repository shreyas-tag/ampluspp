const mongoose = require('mongoose');
const { PROJECT_STAGE } = require('../constants/project');

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const taskTimelineSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    message: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deadline: { type: Date },
    priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
    requiresAttachment: { type: Boolean, default: false },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'], default: 'PENDING' },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    comments: [commentSchema],
    attachments: [attachmentSchema],
    timeline: [taskTimelineSchema]
  },
  { _id: true }
);

const milestoneTimelineSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    message: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const milestoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    stage: {
      type: String,
      enum: Object.values(PROJECT_STAGE),
      default: PROJECT_STAGE.DOCUMENTATION
    },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED'], default: 'PENDING' },
    startDate: { type: Date },
    dueDate: { type: Date },
    completedAt: { type: Date },
    tasks: [taskSchema],
    timeline: [milestoneTimelineSchema]
  },
  { _id: true }
);

const projectTimelineSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    message: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed }
  },
  { _id: false }
);

const stageHistorySchema = new mongoose.Schema(
  {
    from: { type: String, enum: Object.values(PROJECT_STAGE) },
    to: { type: String, enum: Object.values(PROJECT_STAGE), required: true },
    at: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: true }
);

const processTrackingSchema = new mongoose.Schema(
  {
    callToActionSharedAt: { type: Date },
    inquiryFormForwardedAt: { type: Date },
    milestone1InfoWithPaymentAt: { type: Date },
    milestone1InfoWithoutPaymentAt: { type: Date },
    milestone1ConsultationScheduledAt: { type: Date },
    milestone2ConsultationCompletedAt: { type: Date },
    milestone2SubsidySummaryForwardedAt: { type: Date },
    milestone2BusinessProposalSharedAt: { type: Date },
    milestone2DiscussionInProgressAt: { type: Date },
    milestone3MandateSignedAt: { type: Date },
    milestone3ProformaInvoiceRaisedAt: { type: Date },
    milestone3AdvanceReceivedAt: { type: Date },
    milestone3AdvanceReceivedAmount: { type: Number, min: 0, default: 0 },
    milestone3FinalInvoiceDoneAt: { type: Date },
    approxProjectValue: { type: Number, min: 0, default: 0 },
    approxServiceValue: { type: Number, min: 0, default: 0 },
    updatedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    projectId: { type: String, unique: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    scheme: { type: mongoose.Schema.Types.ObjectId, ref: 'Scheme' },
    schemeName: { type: String, trim: true },
    departmentInvolved: { type: String, trim: true },
    applicationNo: { type: String, trim: true },
    projectValue: { type: Number, default: 0 },
    expectedSubsidyAmount: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    targetCompletionDate: { type: Date },
    currentStage: {
      type: String,
      enum: Object.values(PROJECT_STAGE),
      default: PROJECT_STAGE.DOCUMENTATION
    },
    stageHistory: [stageHistorySchema],
    activityStats: {
      milestoneCount: { type: Number, default: 0 },
      taskCount: { type: Number, default: 0 },
      completedTaskCount: { type: Number, default: 0 },
      commentCount: { type: Number, default: 0 },
      attachmentCount: { type: Number, default: 0 }
    },
    processTracking: processTrackingSchema,
    milestones: [milestoneSchema],
    timeline: [projectTimelineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
