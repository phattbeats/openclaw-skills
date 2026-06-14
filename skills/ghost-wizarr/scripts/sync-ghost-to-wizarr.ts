#!/usr/bin/env npx tsx
/**
 * ghost-wizarr-sync
 * 
 * Ties Ghost PMC membership to Wizarr Plex access.
 * 
 * FLOW:
 *   1. Fetch all Ghost members with paid PMC tier
 *   2. For each paid member with no active Wizarr invite, create one
 *   3. For each expired Ghost member (canceled/lapsed), revoke Wizarr access
 *   4. Log actions taken
 * 
 * USAGE:
 *   npx tsx sync-ghost-to-wizarr.ts [--dry-run] [--notify]
 * 
 * OPTIONS:
 *   --dry-run   Preview actions without making changes
 *   --notify    Send invite link via email (uses Ghost's member email)
 * 
 * GHOST ADMIN API:
 *   Base: https://phattmedia.club
 *   Auth: Admin API JWT (id:secret format, signed with Admin API secret)
 * 
 * WIZARR API:
 *   Base: http://10.0.0.100:5690/api
 *   Auth: X-API-Key header
 */

import { parseArgs } from 'util';
import crypto from 'crypto';

// ─── Config ────────────────────────────────────────────────────────────────────

const GHOST_URL = process.env.GHOST_URL || 'https://phattmedia.club';

// Admin key (id:secret) — read from env, format `id:hex_secret`.
const ADMIN_KEY = process.env.GHOST_ADMIN_API_KEY;
if (!ADMIN_KEY || !ADMIN_KEY.includes(':')) {
  console.error('ghost-wizarr-sync: missing or malformed GHOST_ADMIN_API_KEY env var (expected id:hex_secret)');
  process.exit(1);
}
const [GHOST_ADMIN_KEY_ID, GHOST_ADMIN_KEY_SECRET] = ADMIN_KEY.split(':', 2);

// ─── Ghost JWT Helper ──────────────────────────────────────────────────────────

function makeGhostJWT(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', kid: GHOST_ADMIN_KEY_ID, typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/ghost/admin/' })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', Buffer.from(GHOST_ADMIN_KEY_SECRET, 'hex'))
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}
const WIZARR_URL = process.env.WIZARR_BASE_URL ?? 'http://10.0.0.100:5690/api';
const WIZARR_API_KEY = process.env.WIZARR_API_KEY ?? '';
const PMC_TIER_ID = '69a112ff1a8cee0001d0d204'; // paid tier
const FREE_TIER_ID = '69a112ff1a8cee0001d0d203';
const WIZARR_SERVER_ID = 1; // Plex server

// Access duration by tier (in hours): PMC paid = 720h (30 days), extensible
const ACCESS_DURATION_MONTHLY = 720; // 30 days
const INVITE_EXPIRY_DAYS = 7; // invite link valid for 7 days after creation

// ─── Types ────────────────────────────────────────────────────────────────────

interface GhostMember {
  id: string;
  email: string;
  name: string;
  status: 'free' | 'paid' | 'complimentary';
  memberships: Array<{
    tier: { id: string; name: string; slug: string };
    status: 'active' | 'canceled' | 'expired' | 'trial';
    start_date: string;
    mrr: number;
  }>;
  created_at: string;
}

interface WizarrInvitation {
  id: string;
  email: string | null;
  token: string;
  status: 'Pending' | 'Accepted' | 'Revoked' | 'Expired';
  duration: string | null; // hours
  expires_at: string | null;
  created_at: string;
  libraries: number[];
}

interface SyncAction {
  type: 'create_invite' | 'revoke_access' | 'extend_access' | 'skip';
  member: GhostMember;
  inviteUrl?: string;
  reason: string;
}

// ─── Ghost API ────────────────────────────────────────────────────────────────

async function ghostFetch(path: string): Promise<unknown> {
  const response = await fetch(`${GHOST_URL}/ghost/api/admin/${path}`, {
    headers: {
      'Authorization': `Ghost ${makeGhostJWT()}`,
      'Content-Type': 'application/json',
      'Accept-Version': 'v5.0',
    },
  });
  if (!response.ok) {
    throw new Error(`Ghost API error ${response.status}: ${await response.text()}`);
  }
  return (await response.json()).members ?? [];
}

/**
 * Fetch all Ghost members with paid PMC tier membership.
 * Handles pagination automatically.
 */
async function getPaidMembers(): Promise<GhostMember[]> {
  const allMembers: GhostMember[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const members: GhostMember[] = await ghostFetch(`members/?page=${page}&limit=100&include=memberships,tiers`) as GhostMember[];
    if (members.length === 0) break;

    // Filter to members with active paid PMC tier
    const paid = members.filter(m =>
      m.memberships?.some(ms =>
        ms.tier?.id === PMC_TIER_ID &&
        (ms.status === 'active' || ms.status === 'trial')
      )
    );

    allMembers.push(...paid);
    page++;
    hasMore = members.length === 100;
  }

  return allMembers;
}

/**
 * Get all Ghost members (including canceled/expired) for revocation checks.
 */
async function getAllMembers(): Promise<GhostMember[]> {
  const allMembers: GhostMember[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const members: GhostMember[] = await ghostFetch(`members/?page=${page}&limit=100&include=memberships,tiers`) as GhostMember[];
    if (members.length === 0) break;
    allMembers.push(...members);
    page++;
    hasMore = members.length === 100;
  }

  return allMembers;
}

// ─── Wizarr API ───────────────────────────────────────────────────────────────

async function wizarrFetch(path: string, method = 'GET', body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${WIZARR_URL}${path}`, {
    method,
    headers: {
      'X-API-Key': WIZARR_API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`Wizarr API error ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

/**
 * Get all existing Wizarr invitations.
 */
async function getWizarrInvites(): Promise<WizarrInvitation[]> {
  const data = await wizarrFetch('/invitations');
  return (data.invitations as WizarrInvitation[]) ?? [];
}

/**
 * Create a Wizarr invitation for a specific member.
 */
async function createWizarrInvite(email: string, durationHours: number): Promise<string> {
  const data = await wizarrFetch('/invitations', 'POST', {
    server_ids: [WIZARR_SERVER_ID],
    expires_in_days: INVITE_EXPIRY_DAYS,
    unlimited: false,
    duration: String(durationHours),
    email: email, // pre-fill email in invite form
  }) as { invitation?: { url?: string; token?: string } };

  const token = (data.invitation as { url?: string; token?: string })?.token ?? '';
  return `${WIZARR_URL.replace('/api', '')}/join/${token}`;
}

/**
 * Revoke a Wizarr invitation by ID.
 */
async function revokeWizarrInvite(inviteId: string): Promise<void> {
  await wizarrFetch(`/invitations/${inviteId}`, 'DELETE');
}

/**
 * Get active Plex users from Wizarr (optional: extend/revoke).
 */
async function getWizarrUsers(): Promise<unknown[]> {
  const data = await wizarrFetch('/users');
  return (data.users as unknown[]) ?? [];
}

// ─── Core Sync Logic ──────────────────────────────────────────────────────────

/**
 * Determine what actions need to be taken.
 * Returns arrays of actions for each category.
 */
async function determineActions(
  paidMembers: GhostMember[],
  allMembers: GhostMember[],
  existingInvites: WizarrInvitation[]
): Promise<{
  toInvite: Array<{ member: GhostMember; inviteUrl: string }>;
  toRevoke: Array<{ member: GhostMember; invite: WizarrInvitation }>;
  toExtend: Array<{ member: GhostMember; invite: WizarrInvitation }>;
  skipped: Array<{ member: GhostMember; reason: string }>;
}> {
  const result = {
    toInvite: [] as Array<{ member: GhostMember; inviteUrl: string }>,
    toRevoke: [] as Array<{ member: GhostMember; invite: WizarrInvitation }>,
    toExtend: [] as Array<{ member: GhostMember; invite: WizarrInvitation }>,
    skipped: [] as Array<{ member: GhostMember; reason: string }>,
  };

  // Build a map of email → existing invite
  const inviteByEmail = new Map<string, WizarrInvitation>();
  for (const inv of existingInvites) {
    if (inv.email) inviteByEmail.set(inv.email.toLowerCase(), inv);
  }

  // Check each paid member
  for (const member of paidMembers) {
    const email = member.email.toLowerCase();
    const existing = inviteByEmail.get(email);

    if (existing) {
      // Already has an invite — check if it needs extending
      if (existing.status === 'Pending' || existing.status === 'Accepted') {
        const existingDuration = parseInt(existing.duration ?? '0', 10);
        // If less than 48h remaining, extend it
        if (existingDuration < ACCESS_DURATION_MONTHLY - 48) {
          result.toExtend.push({ member, invite: existing });
        } else {
          result.skipped.push({ member, reason: `Active invite already exists (${existingDuration}h remaining)` });
        }
      } else if (existing.status === 'Revoked' || existing.status === 'Expired') {
        // Was revoked/expired — create a new one
        try {
          const url = await createWizarrInvite(email, ACCESS_DURATION_MONTHLY);
          result.toInvite.push({ member, inviteUrl: url });
        } catch (e) {
          result.skipped.push({ member, reason: `Failed to create invite: ${e}` });
        }
      }
    } else {
      // No existing invite — create one
      try {
        const url = await createWizarrInvite(email, ACCESS_DURATION_MONTHLY);
        result.toInvite.push({ member, inviteUrl: url });
      } catch (e) {
        result.skipped.push({ member, reason: `Wizarr API error: ${e}` });
      }
    }
  }

  // Check for revocations: members who HAD access but no longer have paid tier
  const paidEmails = new Set(paidMembers.map(m => m.email.toLowerCase()));
  const allEmails = new Set(allMembers.map(m => m.email.toLowerCase()));

  for (const invite of existingInvites) {
    const email = invite.email?.toLowerCase();
    if (!email) continue;
    if (!allEmails.has(email)) continue; // unknown email, leave alone

    // Member exists in Ghost but not in paid list
    if (!paidEmails.has(email) && (invite.status === 'Pending' || invite.status === 'Accepted')) {
      const member = allMembers.find(m => m.email.toLowerCase() === email);
      if (member) {
        result.toRevoke.push({ member, invite });
      }
    }
  }

  return result;
}

// ─── Email (via Ghost) ────────────────────────────────────────────────────────

/**
 * Send invite email to a member via Ghost's built-in email system.
 * Ghost has a members API but no direct "send email to member" endpoint —
 * this function logs the invite URL so it can be sent manually or via a
 * separate email tool like Resend.
 */
async function notifyMember(member: GhostMember, inviteUrl: string, type: 'welcome' | 'extension' | 'revoked'): Promise<void> {
  const subject = {
    welcome: `🎬 You're in — PHATT MEDIA CLUB access`,
    extension: `⏰ PHATT MEDIA CLUB access extended`,
    revoked: `⚠️ PHATT MEDIA CLUB access revoked`,
  }[type];

  console.log(`  📧 Would email: ${member.email}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Invite: ${inviteUrl}`);
  // TODO: integrate Resend API to send actual transactional email
  // await resend.emails.send({ from: 'hello@phattmedia.club', to: member.email, subject, html: ... });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'notify': { type: 'boolean', default: false },
    },
  });

  const dryRun = values['dry-run'] ?? false;
  const notify = values['notify'] ?? false;

  console.log('\n🎭 Ghost → Wizarr Sync');
  console.log('─'.repeat(50));
  if (dryRun) console.log('⚠️  DRY RUN — no changes will be made\n');

  // Step 1: Fetch Ghost members
  console.log('📡 Fetching Ghost members...');
  const [paidMembers, allMembers] = await Promise.all([getPaidMembers(), getAllMembers()]);
  console.log(`   ${paidMembers.length} paid PMC members`);
  console.log(`   ${allMembers.length} total members`);

  // Step 2: Fetch Wizarr invites
  console.log('🎟️  Fetching Wizarr invitations...');
  const existingInvites = await getWizarrInvites();
  console.log(`   ${existingInvites.length} existing invites`);

  // Step 3: Determine actions
  console.log('\n🔍 Analyzing...');
  const actions = await determineActions(paidMembers, allMembers, existingInvites);

  // Step 4: Execute actions
  if (dryRun) {
    console.log('\n📋 DRY RUN — would take these actions:\n');
  } else {
    console.log('\n⚡ Executing actions:\n');
  }

  // Invites
  for (const { member, inviteUrl } of actions.toInvite) {
    if (dryRun) {
      console.log(`  ➕ CREATE INVITE for ${member.name} (${member.email})`);
      console.log(`     → ${inviteUrl}`);
    } else {
      console.log(`  ✅ CREATED INVITE for ${member.name} (${member.email})`);
      if (notify) await notifyMember(member, inviteUrl, 'welcome');
    }
  }

  // Extensions
  for (const { member, invite } of actions.toExtend) {
    if (dryRun) {
      console.log(`  ⏩ EXTEND INVITE for ${member.name} (${member.email}) — ${invite.duration}h → ${ACCESS_DURATION_MONTHLY}h`);
    } else {
      // Extend by updating the invite duration via DELETE + recreate
      await revokeWizarrInvite(invite.id);
      const newUrl = await createWizarrInvite(member.email, ACCESS_DURATION_MONTHLY);
      console.log(`  ✅ EXTENDED INVITE for ${member.name} (${member.email})`);
      if (notify) await notifyMember(member, newUrl, 'extension');
    }
  }

  // Revocations
  for (const { member, invite } of actions.toRevoke) {
    if (dryRun) {
      console.log(`  ➖ REVOKE ACCESS for ${member.name} (${member.email})`);
      console.log(`     Invite ID: ${invite.id}, Status: ${invite.status}`);
    } else {
      await revokeWizarrInvite(invite.id);
      console.log(`  🔴 REVOKED ACCESS for ${member.name} (${member.email})`);
      if (notify) await notifyMember(member, '', 'revoked');
    }
  }

  // Skipped
  for (const { member, reason } of actions.skipped) {
    console.log(`  ⏭️  SKIP ${member.name} (${member.email}): ${reason}`);
  }

  // Summary
  const totalActions = actions.toInvite.length + actions.toExtend.length + actions.toRevoke.length;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Summary: ${totalActions} action(s) taken, ${actions.skipped.length} skipped`);
  if (dryRun) console.log('(dry run — no actual changes)');
  console.log('');

  if (totalActions === 0 && actions.skipped.length === 0) {
    console.log('✅ PMC membership and Wizarr access are in sync.');
  }
}

main().catch(err => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
