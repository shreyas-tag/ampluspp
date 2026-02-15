const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const ROLES = require('../constants/roles');
const { logAudit } = require('../utils/auditLog');
const { broadcastEvent } = require('../utils/realtime');
const { normalizeModuleAccess, DEFAULT_USER_MODULE_ACCESS } = require('../constants/modules');

const presentUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  moduleAccess: normalizeModuleAccess(user.moduleAccess),
  isActive: user.isActive
});

const listUsers = async (_req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    res.json({ users: users.map((item) => presentUser(item)) });
  } catch (err) {
    next(err);
  }
};

const listAssignableUsers = async (_req, res, next) => {
  try {
    const users = await User.find({ isActive: true })
      .select('_id name email role')
      .sort({ name: 1 })
      .lean();
    res.json({ users });
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      const err = new Error('Name, email and password are required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      const err = new Error('User with this email already exists');
      err.statusCode = StatusCodes.CONFLICT;
      throw err;
    }

    const nextRole = Object.values(ROLES).includes(role) ? role : ROLES.USER;
    const moduleAccess =
      nextRole === ROLES.ADMIN
        ? normalizeModuleAccess(DEFAULT_USER_MODULE_ACCESS)
        : normalizeModuleAccess(req.body.moduleAccess);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: nextRole,
      moduleAccess
    });

    res.status(StatusCodes.CREATED).json({ user: presentUser(user) });

    await broadcastEvent({
      type: 'USER_CREATED',
      title: 'User created',
      message: `${user.name} added`,
      payload: { userId: user._id },
      actorId: req.user?._id,
      showInLiveActivity: false
    });

    await logAudit({
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user._id,
      actor: req.user?._id,
      after: { email: user.email, role: user.role, isActive: user.isActive, moduleAccess: user.moduleAccess },
      req
    });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }
    const before = {
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      moduleAccess: normalizeModuleAccess(user.moduleAccess)
    };

    const nextRole =
      role !== undefined && Object.values(ROLES).includes(role)
        ? role
        : user.role;
    const nextIsActive = isActive !== undefined ? Boolean(isActive) : user.isActive;

    if (String(user._id) === String(req.user?._id) && !nextIsActive) {
      const err = new Error('You cannot disable your own account');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const adminDemotionOrDisable =
      user.role === ROLES.ADMIN &&
      (!nextIsActive || nextRole !== ROLES.ADMIN);

    if (adminDemotionOrDisable) {
      const otherActiveAdminCount = await User.countDocuments({
        _id: { $ne: user._id },
        role: ROLES.ADMIN,
        isActive: true
      });

      if (otherActiveAdminCount === 0) {
        const err = new Error('At least one active admin user must remain in the system');
        err.statusCode = StatusCodes.BAD_REQUEST;
        throw err;
      }
    }

    if (name !== undefined) user.name = name;
    if (role !== undefined && Object.values(ROLES).includes(role)) user.role = role;
    if (isActive !== undefined) user.isActive = Boolean(isActive);
    if (req.body.moduleAccess !== undefined) {
      user.moduleAccess = normalizeModuleAccess(req.body.moduleAccess);
    } else if (!Array.isArray(user.moduleAccess) || user.moduleAccess.length === 0) {
      user.moduleAccess = normalizeModuleAccess(user.moduleAccess);
    }

    await user.save();

    await broadcastEvent({
      type: 'USER_UPDATED',
      title: 'User access updated',
      message: `${user.name} permissions updated`,
      payload: { userId: user._id },
      actorId: req.user?._id,
      showInLiveActivity: false
    });

    await logAudit({
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: user._id,
      actor: req.user?._id,
      before,
      after: {
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        moduleAccess: normalizeModuleAccess(user.moduleAccess)
      },
      req
    });

    res.json({ user: presentUser(user) });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, listAssignableUsers, createUser, updateUser };
