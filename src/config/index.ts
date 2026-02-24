import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-'),
  SLACK_APP_TOKEN: z.string().startsWith('xapp-'),
  SLACK_SIGNING_SECRET: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-20250514'),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  FOUNDER_SLACK_ID: z.string().min(1),
  BOT_NAME: z.string().default("LVL'S Support"),
  TIMEZONE: z.string().default('Asia/Karachi'),
  LOG_LEVEL: z.string().default('info'),
  LATITUDE: z.coerce.number().default(24.8607),
  LONGITUDE: z.coerce.number().default(67.0011),
  CALCULATION_METHOD: z.string().default('Karachi'),
  PRAYER_BUFFER_MINUTES: z.coerce.number().default(20),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Missing or invalid environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nCopy .env.example to .env and fill in your values.');
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof envSchema>;
