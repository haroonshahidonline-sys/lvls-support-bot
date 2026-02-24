import dotenv from 'dotenv';
dotenv.config();

import { upsertTeamMember } from '../src/services/team-service.js';
import { upsertChannelConfig } from '../src/services/channel-service.js';
import { testConnection } from '../src/database/connection.js';
import { runMigrations } from '../src/database/migrate.js';

/*
 * INSTRUCTIONS:
 * Update the team members below with your actual team info.
 * To find Slack User IDs: click a person's profile in Slack → three dots → Copy Member ID
 *
 * Update the channels below with your actual channel IDs.
 * To find Channel IDs: right-click a channel → Copy link → the ID is the last part of the URL
 */

const TEAM_MEMBERS = [
  {
    name: 'Moe',
    slack_user_id: 'U086Y2GKQP6',
    role: 'founder',
    is_founder: true,
    timezone: 'Asia/Karachi',
  },
  {
    name: 'Alex (Manager)',
    slack_user_id: 'U0A16AS136H',
    role: 'manager',
    is_founder: false,
    timezone: 'Asia/Karachi',
  },
  // Add remaining team members as you hire — get their Slack User IDs from:
  // Click profile → three dots → Copy Member ID
];

const CHANNELS = [
  // === CLIENT CHANNELS (require approval) ===
  { channel_id: 'C0A709RA5S4', channel_name: 'client_allureis-foundation', channel_type: 'client', client_name: 'Allureis Foundation', requires_approval: true },
  { channel_id: 'C0A4UPS1SSK', channel_name: 'client_hotshitclothing-domination', channel_type: 'client', client_name: 'Hot Shit Clothing', requires_approval: true },
  { channel_id: 'C0A8URZDKN1', channel_name: 'client_atmos-foundation', channel_type: 'client', client_name: 'Atmos Foundation', requires_approval: true },
  { channel_id: 'C0AF552DEAE', channel_name: 'client_roguereasons-foundation', channel_type: 'client', client_name: 'Rogue Reasons', requires_approval: true },
  { channel_id: 'C0AAYL93Z29', channel_name: 'client_timelessthreads-momentum', channel_type: 'client', client_name: 'Timeless Threads', requires_approval: true },
  { channel_id: 'C0A2BV9HWJX', channel_name: 'client_mayzcollective-foundation', channel_type: 'client', client_name: 'Mayz Collective', requires_approval: true },
  { channel_id: 'C09PTAQD3QA', channel_name: 'client_sukun-momentum', channel_type: 'client', client_name: 'Sukun', requires_approval: true },
  { channel_id: 'C0ACEA0AEKE', channel_name: 'client_japanesesorrows-momentum', channel_type: 'client', client_name: 'Japanese Sorrows', requires_approval: true },
  { channel_id: 'C0AD6T477ST', channel_name: 'client_stackssociety-momentum-trial', channel_type: 'client', client_name: 'Stacks Society', requires_approval: true },
  { channel_id: 'C0AFQRFJKGD', channel_name: 'client_verbsociety-momentum', channel_type: 'client', client_name: 'Verb Society', requires_approval: true },
  { channel_id: 'C0A7CGM3JD6', channel_name: 'client_lovereality-foundation', channel_type: 'client', client_name: 'Love Reality', requires_approval: true },
  { channel_id: 'C0AAU6MEZGW', channel_name: 'client_nemesisclo-momnetum', channel_type: 'client', client_name: 'Nemesis Clo', requires_approval: true },
  { channel_id: 'C0ADUMZCU4U', channel_name: 'client_aceworldapparel-domination', channel_type: 'client', client_name: 'Ace World Apparel', requires_approval: true },
  { channel_id: 'C09S89EAXNZ', channel_name: 'client_outis-ent-momentum', channel_type: 'client', client_name: 'Outis Ent', requires_approval: true },
  { channel_id: 'C0A66M5PWF9', channel_name: 'client_orlevstudios-foundation', channel_type: 'client', client_name: 'Orlev Studios', requires_approval: true },
  { channel_id: 'C0ABW5P2U6N', channel_name: 'client_mudbaby617-momentum', channel_type: 'client', client_name: 'Mudbaby617', requires_approval: true },
  { channel_id: 'C0A0GD67T4H', channel_name: 'client_coutur3culture-foundation', channel_type: 'client', client_name: 'Coutur3 Culture', requires_approval: true },
  { channel_id: 'C0A73V0T4FQ', channel_name: 'client_tamari-momentum', channel_type: 'client', client_name: 'Tamari', requires_approval: true },
  { channel_id: 'C0A86A4DDM3', channel_name: 'client_foreignfriend-foundation', channel_type: 'client', client_name: 'Foreign Friend', requires_approval: true },
  { channel_id: 'C0A54TWHB09', channel_name: 'client_outsiders-foundation', channel_type: 'client', client_name: 'Outsiders', requires_approval: true },
  { channel_id: 'C09SW31HLM6', channel_name: 'client_racksforever-foundation', channel_type: 'client', client_name: 'Racks Forever', requires_approval: true },
  { channel_id: 'C0AE7MM5LRG', channel_name: 'client_purpose-foundation', channel_type: 'client', client_name: 'Purpose', requires_approval: true },
  { channel_id: 'C0AFWSUKSUX', channel_name: 'client_toptier-momentum', channel_type: 'client', client_name: 'Top Tier', requires_approval: true },
  { channel_id: 'C096LE0R8J3', channel_name: 'client_sunseeker-domination', channel_type: 'client', client_name: 'Sunseeker', requires_approval: true },
  { channel_id: 'C09KSGJCZTM', channel_name: 'client_bimotionsclothes-momentum', channel_type: 'client', client_name: 'Bimotions Clothes', requires_approval: true },
  { channel_id: 'C0AEJBMEJ3E', channel_name: 'client_sevnsclub-foundation', channel_type: 'client', client_name: 'Sevns Club', requires_approval: true },
  { channel_id: 'C097REX5PBM', channel_name: 'client_phase-standard', channel_type: 'client', client_name: 'Phase', requires_approval: true },
  { channel_id: 'C0A8G2G7HJ5', channel_name: 'client_1ofnoneworldwide-foundation', channel_type: 'client', client_name: '1ofNone Worldwide', requires_approval: true },
  { channel_id: 'C0ACP1A1X61', channel_name: 'client_crossandthread-domination', channel_type: 'client', client_name: 'Cross and Thread', requires_approval: true },
  { channel_id: 'C0A8HBD90E8', channel_name: 'client_glareupon-foundation', channel_type: 'client', client_name: 'Glare Upon', requires_approval: true },
  { channel_id: 'C0AC6Q03YN6', channel_name: 'client_tmszmoezar-foundation', channel_type: 'client', client_name: 'TMSZ Moezar', requires_approval: true },
  { channel_id: 'C09V0JW781M', channel_name: 'client_four-foundation', channel_type: 'client', client_name: 'Four', requires_approval: true },
  { channel_id: 'C09S8N7NS2Z', channel_name: 'client_unlockclothing-foundation', channel_type: 'client', client_name: 'Unlock Clothing', requires_approval: true },
  { channel_id: 'C0A59675GTZ', channel_name: 'client_mucyo-foundation', channel_type: 'client', client_name: 'Mucyo', requires_approval: true },
  { channel_id: 'C09RHHTP4SJ', channel_name: 'client_divineglory-foundation', channel_type: 'client', client_name: 'Divine Glory', requires_approval: true },
  { channel_id: 'C09HRSS5CAC', channel_name: 'client_sonybruno-foundation', channel_type: 'client', client_name: 'Sony Bruno', requires_approval: true },
  { channel_id: 'C0A5L95E15Z', channel_name: 'client_curatedchrome-marketing', channel_type: 'client', client_name: 'Curated Chrome', requires_approval: true },
  { channel_id: 'C09MA0KHF5Y', channel_name: 'client_startseriesnyc--foundation', channel_type: 'client', client_name: 'Start Series NYC', requires_approval: true },

  // === TEAM / INTERNAL CHANNELS (no approval needed) ===
  { channel_id: 'C086ERXV7HV', channel_name: 'general', channel_type: 'general', requires_approval: false },
  { channel_id: 'C086NP9FPFG', channel_name: 'random', channel_type: 'general', requires_approval: false },
  { channel_id: 'C09GV81F0LV', channel_name: 'team_lvls-general', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C09MZKET571', channel_name: 'team_lvls-tracker', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C097ZUVAKKR', channel_name: 'team_lvls-setters', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C09B9FBKCRX', channel_name: 'team_client-success', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C0A7FD41PE0', channel_name: 'team_operations', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C0A7FD1BKBN', channel_name: 'team_graphics', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C0A79PT2X54', channel_name: 'team_marketing', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C0A864UMVHN', channel_name: 'team_video', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C0AFP6QT2N5', channel_name: 'team-tools', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C088L9BHS67', channel_name: 'administration-general', channel_type: 'internal', requires_approval: false },
  { channel_id: 'C099A555RAP', channel_name: 'client-onboarding-database', channel_type: 'internal', requires_approval: false },
];

async function main() {
  console.log('Seeding team members and channels...\n');

  const connected = await testConnection();
  if (!connected) {
    console.error('Could not connect to database. Run: docker-compose up -d');
    process.exit(1);
  }

  await runMigrations();

  // Seed team members
  for (const member of TEAM_MEMBERS) {
    const result = await upsertTeamMember(member);
    console.log(`  Team member: ${result.name} (${result.slack_user_id}) — ${result.role}`);
  }

  // Seed channels
  for (const channel of CHANNELS) {
    const result = await upsertChannelConfig(channel);
    console.log(`  Channel: #${result.channel_name} — ${result.channel_type}${result.requires_approval ? ' (approval required)' : ''}`);
  }

  console.log('\nSeeding complete!');
  console.log('\nNext steps:');
  console.log('  1. Update this file with your actual team member Slack IDs');
  console.log('  2. Update this file with your actual channel IDs');
  console.log('  3. Run this script again: npm run seed');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
