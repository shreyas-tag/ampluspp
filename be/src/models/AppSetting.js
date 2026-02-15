const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    ui: {
      usersLiveActivityEnabled: { type: Boolean, default: false }
    },
    integrations: {
      wordpress: {
        enabled: { type: Boolean, default: false },
        webhookKey: { type: String, default: '' },
        lastReceivedAt: { type: Date, default: null }
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSetting', appSettingSchema);
