const mongoose = require('mongoose');

const clientTimelineSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    message: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const clientSchema = new mongoose.Schema(
  {
    clientCode: { type: String, unique: true, index: true },
    companyName: { type: String, required: true, trim: true },
    gstNo: { type: String, trim: true },
    factoryAddress: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    mobileNumber: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    agreementSigned: { type: Boolean, default: false },
    agreementDate: { type: Date },
    assignedConsultant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sourceLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    timeline: [clientTimelineSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', clientSchema);
