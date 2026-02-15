const mongoose = require('mongoose');
const { LEAD_STATUS } = require('../constants/lead');

const timelineSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    message: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed }
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const callSchema = new mongoose.Schema(
  {
    callAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 0 },
    summary: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    from: { type: String, enum: Object.values(LEAD_STATUS) },
    to: { type: String, enum: Object.values(LEAD_STATUS), required: true },
    at: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { _id: true }
);

const leadSchema = new mongoose.Schema(
  {
    leadId: { type: String, unique: true, index: true },
    companyName: { type: String, required: true, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    promoterName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    businessConstitutionType: { type: String, trim: true },
    address: { type: String, trim: true },
    taluka: { type: String, trim: true },
    district: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    industryType: { type: String, trim: true },
    projectLandDetail: { type: String, trim: true },
    partnersDirectorsGender: { type: String, trim: true },
    promoterCasteCategory: { type: String, trim: true },
    manufacturingDetails: { type: String, trim: true },
    investmentBuildingConstruction: { type: Number, min: 0 },
    investmentLand: { type: Number, min: 0 },
    investmentPlantMachinery: { type: Number, min: 0 },
    totalInvestment: { type: Number, min: 0 },
    bankLoanIfAny: { type: String, trim: true },
    financeBankLoanPercent: { type: Number, min: 0, max: 100 },
    financeOwnContributionPercent: { type: Number, min: 0, max: 100 },
    projectType: { type: String, trim: true },
    availedSubsidyPreviously: { type: String, trim: true },
    projectSpecificAsk: { type: String, trim: true },
    requirementType: {
      type: String,
      enum: ['SUBSIDY', 'LAND', 'FUNDING', 'COMPLIANCE'],
      default: 'SUBSIDY'
    },
    source: {
      type: String,
      enum: ['WEBSITE', 'EXHIBITION', 'REFERRAL', 'WHATSAPP', 'COLD_CALL', 'MANUAL'],
      default: 'MANUAL'
    },
    status: {
      type: String,
      enum: Object.values(LEAD_STATUS),
      default: LEAD_STATUS.NEW
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    enquiryReceivedAt: { type: Date, default: Date.now, index: true },
    firstResponseAt: { type: Date },
    firstResponseMinutes: { type: Number },
    lastInteractionAt: { type: Date, default: Date.now, index: true },
    lastStatusChangedAt: { type: Date, default: Date.now },
    updateCount: { type: Number, default: 0 },
    communicationStats: {
      notesCount: { type: Number, default: 0 },
      callsCount: { type: Number, default: 0 },
      totalCallDurationMinutes: { type: Number, default: 0 }
    },
    nextFollowUpAt: { type: Date },
    isConverted: { type: Boolean, default: false },
    convertedAt: { type: Date },
    convertedClient: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    statusHistory: [statusHistorySchema],
    notes: [noteSchema],
    calls: [callSchema],
    timeline: [timelineSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', leadSchema);
