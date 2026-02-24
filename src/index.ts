import { App, LogLevel } from '@slack/bolt';
import { config } from './config/index.js';
import { testConnection } from './database/connection.js';
import { runMigrations } from './database/migrate.js';
import { registerMessageListeners } from './slack/listeners/messages.js';
import { registerActionListeners } from './slack/listeners/actions.js';
import { registerEventListeners } from './slack/listeners/events.js';
import { createReminderWorker, createDeadlineWorker, startDeadlineChecker } from './scheduler/queue.js';
import { processReminder, setSlackApp as setReminderSlackApp } from './scheduler/workers/reminder-worker.js';
import { processDeadlineCheck, setSlackApp as setDeadlineSlackApp } from './scheduler/workers/deadline-checker.js';
import { setSlackApp as setExecutorSlackApp } from './agents/tools/executor.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info(`Starting ${config.BOT_NAME}...`);

  // 1. Test database connection and run migrations
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Make sure PostgreSQL is running (docker-compose up -d)');
    process.exit(1);
  }
  await runMigrations();

  // 2. Initialize Slack Bolt app with Socket Mode
  const app = new App({
    token: config.SLACK_BOT_TOKEN,
    appToken: config.SLACK_APP_TOKEN,
    socketMode: true,
    logLevel: config.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO,
  });

  // 3. Register all listeners
  registerMessageListeners(app);
  registerActionListeners(app);
  registerEventListeners(app);

  // 4. Set up Slack app references for all modules that need it
  setExecutorSlackApp(app);
  setReminderSlackApp(app);
  setDeadlineSlackApp(app);

  const reminderWorker = createReminderWorker(processReminder);
  const deadlineWorker = createDeadlineWorker(processDeadlineCheck);

  // Start the deadline checker repeatable job
  await startDeadlineChecker();

  // 5. Start the Slack app
  await app.start();

  logger.info('=================================');
  logger.info(`${config.BOT_NAME} is running!`);
  logger.info(`Founder: ${config.FOUNDER_SLACK_ID}`);
  logger.info(`Timezone: ${config.TIMEZONE}`);
  logger.info(`Claude model: ${config.CLAUDE_MODEL}`);
  logger.info('=================================');

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await reminderWorker.close();
    await deadlineWorker.close();
    await app.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
