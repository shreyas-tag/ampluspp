const http = require('http');
const app = require('./app');
const connectDb = require('./config/db');
const env = require('./config/env');
const { initSocket } = require('./config/socket');

const start = async () => {
  await connectDb();
  const server = http.createServer(app);
  initSocket(server, { origin: env.clientOrigin });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.error(`Port ${env.port} is already in use. Update PORT in be/.env and restart.`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.error('Server failed', err);
    process.exit(1);
  });

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend running on port ${env.port}`);
  });
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  process.exit(1);
});
