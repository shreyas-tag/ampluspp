const mongoose = require('mongoose');

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    ui: {
      usersLiveActivityEnabled: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSetting', appSettingSchema);
