const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const env = require('../config/env');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLog');

const signToken = (user) =>
  jwt.sign({ sub: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      const err = new Error('Email and password are required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !user.isActive) {
      const err = new Error('Invalid credentials');
      err.statusCode = StatusCodes.UNAUTHORIZED;
      throw err;
    }

    const matched = await user.comparePassword(password);
    if (!matched) {
      const err = new Error('Invalid credentials');
      err.statusCode = StatusCodes.UNAUTHORIZED;
      throw err;
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    return next(err);
  }
};

const me = async (req, res) => {
  res.json({ user: req.user });
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      const err = new Error('currentPassword, newPassword and confirmPassword are required');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }
    if (newPassword !== confirmPassword) {
      const err = new Error('Password confirmation does not match');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }
    if (String(newPassword).length < 8) {
      const err = new Error('Password must be at least 8 characters');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      const err = new Error('Current password is incorrect');
      err.statusCode = StatusCodes.BAD_REQUEST;
      throw err;
    }

    user.password = newPassword;
    await user.save();

    await logAudit({
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: user._id,
      actor: req.user._id,
      req
    });

    res.json({ message: 'Password updated successfully. Use new credentials on your next login.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, me, changePassword };
