import dotenv from 'dotenv';
dotenv.config();

import { callClaude, callClaudeJSON } from '../src/services/claude.js';

async function main() {
  console.log('Testing Claude API connection...\n');

  // Test 1: Basic text response
  console.log('Test 1: Basic text response');
  try {
    const response = await callClaude({
      systemPrompt: 'You are a helpful assistant. Keep responses under 50 words.',
      messages: [{ role: 'user', content: 'Say hello and confirm you are working.' }],
    });
    console.log(`  Response: ${response}\n`);
  } catch (err) {
    console.error(`  FAILED: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // Test 2: JSON response (router simulation)
  console.log('Test 2: JSON classification (router simulation)');
  try {
    const result = await callClaudeJSON<{ intent: string; confidence: number; params: Record<string, unknown> }>({
      systemPrompt: 'Classify this message. Respond with JSON: { "intent": "TASK_ASSIGN" | "GENERAL_QUERY", "confidence": 0.0-1.0, "params": {} }',
      messages: [{ role: 'user', content: 'Assign Sarah to create 3 ad variations for Hot Shit Clothing by Friday' }],
    });
    console.log(`  Intent: ${result.intent}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Params: ${JSON.stringify(result.params)}\n`);
  } catch (err) {
    console.error(`  FAILED: ${(err as Error).message}\n`);
    process.exit(1);
  }

  console.log('All tests passed! Claude API is working.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
