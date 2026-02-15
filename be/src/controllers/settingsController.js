const { logAudit } = require('../utils/auditLog');
const { broadcastEvent } = require('../utils/realtime');
const { getOrCreateSystemSettings, resolveWordpressWebhookConfig, maskSecret } = require('../utils/systemSettings');

const toAdminSettingsResponse = (settings) => {
  const webhook = resolveWordpressWebhookConfig(settings);
  return {
    key: settings.key,
    ui: {
      usersLiveActivityEnabled: Boolean(settings.ui?.usersLiveActivityEnabled)
    },
    integrations: {
      wordpress: {
        source: webhook.source,
        configured: webhook.configured,
        enabled: webhook.enabled,
        isActive: webhook.isActive,
        keyPreview: webhook.keyPreview,
        lastReceivedAt: webhook.lastReceivedAt,
        endpointPath: webhook.endpointPath,
        headerName: webhook.headerName
      }
    }
  };
};

const getMySettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSystemSettings();
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
    const settings = await getOrCreateSystemSettings();
    res.json({ settings: toAdminSettingsResponse(settings) });
  } catch (err) {
    next(err);
  }
};

const updateAdminSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSystemSettings();
    const beforeWebhook = resolveWordpressWebhookConfig(settings);
    const before = {
      usersLiveActivityEnabled: Boolean(settings.ui?.usersLiveActivityEnabled),
      wordpressWebhook: {
        source: beforeWebhook.source,
        configured: beforeWebhook.configured,
        enabled: beforeWebhook.enabled,
        keyPreview: beforeWebhook.keyPreview
      }
    };

    if (req.body.usersLiveActivityEnabled !== undefined) {
      settings.ui.usersLiveActivityEnabled = Boolean(req.body.usersLiveActivityEnabled);
    }

    if (req.body.wordpressWebhookEnabled !== undefined) {
      settings.integrations.wordpress.enabled = Boolean(req.body.wordpressWebhookEnabled);
    }

    if (req.body.clearWordpressWebhookKey === true) {
      settings.integrations.wordpress.webhookKey = '';
      settings.integrations.wordpress.enabled = false;
    }

    if (req.body.wordpressWebhookKey !== undefined) {
      const incomingKey = String(req.body.wordpressWebhookKey || '').trim();
      if (!incomingKey) {
        const err = new Error('Webhook key cannot be blank. Use clear action to remove it.');
        err.statusCode = 400;
        throw err;
      }
      if (incomingKey.length < 8) {
        const err = new Error('Webhook key must be at least 8 characters.');
        err.statusCode = 400;
        throw err;
      }
      settings.integrations.wordpress.webhookKey = incomingKey;
      if (req.body.wordpressWebhookEnabled === undefined) {
        settings.integrations.wordpress.enabled = true;
      }
    }

    await settings.save();
    const afterWebhook = resolveWordpressWebhookConfig(settings);
    const after = {
      usersLiveActivityEnabled: Boolean(settings.ui?.usersLiveActivityEnabled),
      wordpressWebhook: {
        source: afterWebhook.source,
        configured: afterWebhook.configured,
        enabled: afterWebhook.enabled,
        keyPreview: maskSecret(settings.integrations?.wordpress?.webhookKey)
      }
    };

    await logAudit({
      action: 'SETTINGS_UPDATED',
      entityType: 'APP_SETTING',
      entityId: settings._id,
      actor: req.user._id,
      before,
      after,
      req
    });

    await broadcastEvent({
      type: 'SETTINGS_UPDATED',
      title: 'System settings updated',
      message: `${req.user.name} changed global settings`,
      payload: {
        usersLiveActivityEnabled: Boolean(settings.ui?.usersLiveActivityEnabled),
        wordpressWebhookActive: afterWebhook.isActive
      },
      showInLiveActivity: false,
      actorId: req.user._id
    });

    res.json({
      message: 'Settings saved successfully',
      settings: toAdminSettingsResponse(settings)
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMySettings, getAdminSettings, updateAdminSettings };
