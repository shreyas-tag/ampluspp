const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIo } = require('../config/socket');

const broadcastEvent = async ({ type, title, message, payload = {}, actorId = null, showInLiveActivity = true }) => {
  const users = await User.find({ isActive: true }).select('_id').lean();
  const recipientIds = users.map((user) => user._id);

  const notification = await Notification.create({
    type,
    title,
    message,
    payload,
    showInLiveActivity,
    actor: actorId,
    recipients: recipientIds
  });

  const io = getIo();
  const eventPayload = {
    id: notification._id,
    type,
    title,
    message,
    payload,
    showInLiveActivity,
    createdAt: notification.createdAt
  };

  recipientIds.forEach((recipientId) => {
    io.to(String(recipientId)).emit('app:event', eventPayload);
  });
};

module.exports = { broadcastEvent };
