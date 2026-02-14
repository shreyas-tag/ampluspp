const mongoose = require('mongoose');

const schemeSchema = new mongoose.Schema(
  {
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

schemeSchema.index({ category: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Scheme', schemeSchema);
