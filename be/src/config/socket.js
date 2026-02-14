const jwt = require('jsonwebtoken');
const env = require('./env');
const User = require('../models/User');

let io;

const initSocket = (server, options = {}) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: options.origin,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token;
      const authHeader = socket.handshake.headers?.authorization;
      const rawToken = authToken || authHeader || '';
      const token = String(rawToken).startsWith('Bearer ') ? String(rawToken).slice(7) : String(rawToken);

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(decoded.sub).select('_id isActive').lean();
      if (!user || !user.isActive) {
        return next(new Error('Unauthorized'));
      }

      socket.data.userId = String(user._id);
      return next();
    } catch (_error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data?.userId) socket.join(String(socket.data.userId));
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.IO is not initialized');
  }
  return io;
};

module.exports = { initSocket, getIo };
