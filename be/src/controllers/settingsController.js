const AppSetting = require('../models/AppSetting');
const { logAudit } = require('../utils/auditLog');
const { broadcastEvent } = require('../utils/realtime');

const SETTINGS_KEY = 'SYSTEM_CONFIG';

const getOrCreateSettings = async () => {
  let settings = await AppSetting.findOne({ key: SETTINGS_KEY });
  if (!settings) {
    settings = await AppSetting.create({
      key: SETTINGS_KEY,
      ui: { usersLiveActivityEnabled: false }
    });
  }
  return settings;
};

const getMySettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const isAdmin = req.user?.role === 'ADMIN';
    const usersLiveActivityEnabled = Boolean(settings.ui?.usersLiveActivityEnabled);

    res.json({
      settings: {
        usersLiveActivityEnabled,
        canViewLiveActivity: isAdmin ? true : usersLiveActivityEnabled
      }
    });
  } catch (err) {
    next(err);
  }
};

const getAdminSettings = async (_req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
};

const updateAdminSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const before = { usersLiveActivityEnabled: Boolean(settings.ui?.usersLiveActivityEnabled) };

    if (req.body.usersLiveActivityEnabled !== undefined) {
      settings.ui.usersLiveActivityEnabled = Boolean(req.body.usersLiveActivityEnabled);
    }

    await settings.save();

    await logAudit({
      action: 'SETTINGS_UPDATED',
      entityType: 'APP_SETTING',
      entityId: settings._id,
      actor: req.user._id,
      before,
      after: { usersLiveActivityEnabled: Boolean(settings.ui?.usersLiveActivityEnabled) },
      req
    });

    await broadcastEvent({
      type: 'SETTINGS_UPDATED',
      title: 'System settings updated',
      message: `${req.user.name} changed global settings`,
      payload: { usersLiveActivityEnabled: Boolean(settings.ui?.usersLiveActivityEnabled) },
      showInLiveActivity: false,
      actorId: req.user._id
    });

    res.json({
      message: 'Settings saved successfully',
      settings
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMySettings, getAdminSettings, updateAdminSettings };
