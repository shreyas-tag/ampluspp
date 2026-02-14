const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const ROLES = require('../constants/roles');
const { logAudit } = require('../utils/auditLog');

const listUsers = async (_req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    res.json({ users });
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

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: Object.values(ROLES).includes(role) ? role : ROLES.USER
    });

    res.status(StatusCodes.CREATED).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });

    await logAudit({
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user._id,
      actor: req.user?._id,
      after: { email: user.email, role: user.role, isActive: user.isActive },
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
      isActive: user.isActive
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

    await user.save();

    await logAudit({
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: user._id,
      actor: req.user?._id,
      before,
      after: {
        name: user.name,
        role: user.role,
        isActive: user.isActive
      },
      req
    });

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, listAssignableUsers, createUser, updateUser };
