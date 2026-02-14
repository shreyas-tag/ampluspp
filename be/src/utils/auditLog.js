const AuditLog = require('../models/AuditLog');

const logAudit = async ({ action, entityType, entityId, actor = null, before, after, metadata, req }) => {
  try {
    await AuditLog.create({
      action,
      entityType,
      entityId: String(entityId),
      actor,
      before,
      after,
      metadata,
      context: {
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent']
      }
    });
  } catch (_err) {
    // Avoid breaking business flows if audit write fails.
  }
};

module.exports = { logAudit };
