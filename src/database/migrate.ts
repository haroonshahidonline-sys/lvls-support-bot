import fs from 'fs';
import path from 'path';
import { pool } from './connection.js';
import { logger } from '../utils/logger.js';

// Resolve migrations directory — works in both dev (src/) and prod (dist/)
const srcPath = path.resolve(process.cwd(), 'src', 'database', 'migrations');
const distPath = path.resolve(process.cwd(), 'migrations');
const migrationsPath = fs.existsSync(srcPath) ? srcPath : distPath;

export async function runMigrations(): Promise<void> {
  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const migrationsDir = migrationsPath;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    // Check if already executed
    const { rows } = await pool.query(
      'SELECT id FROM _migrations WHERE name = $1',
      [file]
    );

    if (rows.length > 0) {
      logger.debug(`Migration ${file} already applied, skipping`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    logger.info(`Running migration: ${file}`);

    await pool.query(sql);
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);

    logger.info(`Migration ${file} applied successfully`);
  }

  logger.info('All migrations complete');
}
