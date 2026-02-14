const Counter = require('../models/Counter');

const nextSequence = async (name) => {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return counter.seq;
};

const makeId = async (sequenceName, prefix) => {
  const seq = await nextSequence(sequenceName);
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

const generateLeadId = () => makeId('lead_id', 'LEAD-');
const generateClientCode = () => makeId('client_code', 'CL-');
const generateProjectId = () => makeId('project_id', 'PRJ-');

module.exports = { generateLeadId, generateClientCode, generateProjectId };
