const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    showInLiveActivity: { type: Boolean, default: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
