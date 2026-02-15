const AppSetting = require('../models/AppSetting');

const SETTINGS_KEY = 'SYSTEM_CONFIG';
const WEBHOOK_ENDPOINT_PATH = '/api/leads/webform';
const WEBHOOK_HEADER_NAME = 'x-webhook-key';

const defaultSettingsPayload = () => ({
  key: SETTINGS_KEY,
  ui: { usersLiveActivityEnabled: false },
  integrations: {
    wordpress: {
      enabled: false,
      webhookKey: '',
      lastReceivedAt: null
    }
  }
});

const ensureSettingsShape = (settings) => {
  let changed = false;

  if (!settings.ui) {
    settings.ui = { usersLiveActivityEnabled: false };
    changed = true;
  }
  if (settings.ui.usersLiveActivityEnabled === undefined) {
    settings.ui.usersLiveActivityEnabled = false;
    changed = true;
  }

  if (!settings.integrations) {
    settings.integrations = {};
    changed = true;
  }
  if (!settings.integrations.wordpress) {
    settings.integrations.wordpress = {
      enabled: false,
      webhookKey: '',
      lastReceivedAt: null
    };
    changed = true;
  }

  const wp = settings.integrations.wordpress;
  if (wp.enabled === undefined) {
    wp.enabled = Boolean(wp.webhookKey);
    changed = true;
  }
  if (wp.webhookKey === undefined) {
    wp.webhookKey = '';
    changed = true;
  }
  if (wp.lastReceivedAt === undefined) {
    wp.lastReceivedAt = null;
    changed = true;
  }

  return changed;
};

const getOrCreateSystemSettings = async () => {
  let settings = await AppSetting.findOne({ key: SETTINGS_KEY });
  if (!settings) {
    settings = await AppSetting.create(defaultSettingsPayload());
  }

  if (ensureSettingsShape(settings)) {
    await settings.save();
  }
  return settings;
};

const maskSecret = (secret) => {
  const value = String(secret || '').trim();
  if (!value) return '';
  if (value.length <= 4) return '*'.repeat(value.length);
  const head = value.slice(0, 2);
  const tail = value.slice(-2);
  return `${head}${'*'.repeat(Math.max(4, value.length - 4))}${tail}`;
};

const resolveWordpressWebhookConfig = (settings) => {
  const dbKey = String(settings?.integrations?.wordpress?.webhookKey || '').trim();
  const envKey = String(process.env.WORDPRESS_WEBHOOK_KEY || '').trim();
  const source = dbKey ? 'DATABASE' : envKey ? 'ENV' : 'NONE';
  const effectiveKey = dbKey || envKey;
  const configured = Boolean(effectiveKey);
  const persistedEnabled = settings?.integrations?.wordpress?.enabled;
  const enabled =
    persistedEnabled === undefined || persistedEnabled === null ? configured : Boolean(persistedEnabled);
  const isActive = configured && enabled;

  return {
    source,
    key: effectiveKey,
    configured,
    enabled,
    isActive,
    endpointPath: WEBHOOK_ENDPOINT_PATH,
    headerName: WEBHOOK_HEADER_NAME,
    lastReceivedAt: settings?.integrations?.wordpress?.lastReceivedAt || null,
    keyPreview:
      source === 'DATABASE'
        ? maskSecret(dbKey)
        : source === 'ENV'
          ? 'Configured via server environment'
          : 'Not configured'
  };
};

module.exports = {
  SETTINGS_KEY,
  WEBHOOK_ENDPOINT_PATH,
  WEBHOOK_HEADER_NAME,
  getOrCreateSystemSettings,
  resolveWordpressWebhookConfig,
  maskSecret
};
