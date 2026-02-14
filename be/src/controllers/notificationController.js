const Notification = require('../models/Notification');
const { StatusCodes } = require('http-status-codes');

const listNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipients: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ notifications });
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipients: req.user._id },
      { $addToSet: { readBy: req.user._id } },
      { new: true }
    );
    if (!notification) {
      const err = new Error('Notification not found');
      err.statusCode = StatusCodes.NOT_FOUND;
      throw err;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { listNotifications, markRead };
