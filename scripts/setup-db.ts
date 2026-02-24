import dotenv from 'dotenv';
dotenv.config();

import { testConnection } from '../src/database/connection.js';
import { runMigrations } from '../src/database/migrate.js';

async function main() {
  console.log('Setting up database...\n');

  const connected = await testConnection();
  if (!connected) {
    console.error('Could not connect to database.');
    console.error('Make sure PostgreSQL is running: docker-compose up -d');
    process.exit(1);
  }

  await runMigrations();
  console.log('\nDatabase setup complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
