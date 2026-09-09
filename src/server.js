'use strict';

const { createServer } = require('nemkit');
const { env } = require('./config/env');
const logger = require('./config/logger');
const { mongoClient } = require('./config/db');
const { seedAdminUser } = require('./seeds/admin-seed');
const app = require('./app');

createServer({
  app,
  mongo: mongoClient,
  logger,
  port: env.PORT,
  host: env.HOST,
}).then(async () => {
  await seedAdminUser();
}).catch((err) => {
  logger.error('Fatal error starting server', { error: err.message });
  process.exit(1);
});
