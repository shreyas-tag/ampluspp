const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const env = require('../config/env');
const User = require('../models/User');
const ROLES = require('../constants/roles');
const { normalizeModuleAccess } = require('../constants/modules');

const requireAuth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      const err = new Error('Authentication token is required');
      err.statusCode = StatusCodes.UNAUTHORIZED;
      return next(err);
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.sub).select('-password').lean();

    if (!user || !user.isActive) {
      const err = new Error('Invalid authentication token');
      err.statusCode = StatusCodes.UNAUTHORIZED;
      return next(err);
    }

    user.moduleAccess = normalizeModuleAccess(user.moduleAccess);
    req.user = user;
    return next();
  } catch (err) {
    err.statusCode = StatusCodes.UNAUTHORIZED;
    return next(err);
  }
};

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    const err = new Error('You do not have access to this resource');
    err.statusCode = StatusCodes.FORBIDDEN;
    return next(err);
  }

  return next();
};

const adminOnly = requireRole(ROLES.ADMIN);

const requireModuleAccess = (...allowedModules) => (req, _res, next) => {
  if (!req.user) {
    const err = new Error('Authentication token is required');
    err.statusCode = StatusCodes.UNAUTHORIZED;
    return next(err);
  }

  if (req.user.role === ROLES.ADMIN) return next();

  const userModules = normalizeModuleAccess(req.user.moduleAccess);
  const hasAccess = allowedModules.some((moduleKey) => userModules.includes(moduleKey));
  if (hasAccess) return next();

  const err = new Error('You do not have access to this module');
  err.statusCode = StatusCodes.FORBIDDEN;
  return next(err);
};

module.exports = { requireAuth, requireRole, adminOnly, requireModuleAccess };
