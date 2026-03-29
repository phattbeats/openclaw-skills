#!/usr/bin/env node
/**
 * nextcloud-cli — Nextcloud operations via WebDAV + OCS + khal/vdirsyncer
 * Auth: NEXTCLOUD_USER / NEXTCLOUD_PASS env vars (defaults to phatt account)
 */

import { Command } from 'commander';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execAsync = promisify(exec);

const program = new Command();
program.name('nextcloud').description('Nextcloud operations via WebDAV + OCS + khal/vdirsyncer').version('1.1.0');

const isAgent = !process.stdout.isTTY;

// ── Config ────────────────────────────────────────────────────────────────────
// Credentials are hardcoded. The Docker container injects a stale NEXTCLOUD_PASS
// env var that is wrong; we intentionally ignore environment overrides here.
const BASE         = 'https://nextcloud.phatt.vip';
const USER         = 'phatt';
const PASS         = 'WzPyR-fLAH2-2fGgk-kQDo3-ToYtr';
const WEBDAV       = `${BASE}/remote.php/dav/files/${USER}`;
const OCS_BASE_URL = `${BASE}/ocs/v1.php/cloud`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a WebDAV URL from a path, preserving slashes. */
function webdavUrl(path: string): string {
  // Normalize: strip leading slash (WEBDAV base already ends without one)
  const clean = path.replace(/^\/+/, '');
  // Encode each path segment individually so slashes are preserved
  const encoded = clean.split('/').map(encodeURIComponent).join('/');
  return `${WEBDAV}/${encoded}`;
}

/** curl with Basic auth, returns stdout */
async function curl(args: string): Promise<string> {
  const { stdout } = await execAsync(
    `curl -s -u ${USER}:${shellEscape(PASS)} ${args}`,
    { maxBuffer: 10 * 1024 * 1024 }
  );
  return stdout;
}

/** Write XML to a temp file, run curl with --data @file, clean up */
async function curlXml(method: string, url: string, xml: string, extraArgs = ''): Promise<string> {
  const tmp = join(tmpdir(), `nc-${Date.now()}.xml`);
  await writeFile(tmp, xml, 'utf8');
  try {
    const { stdout } = await execAsync(
      `curl -s -u ${USER}:${shellEscape(PASS)} -X ${method} ` +
      `-H "Depth: 1" -H "Content-Type: text/xml" ` +
      `--data @${tmp} ${extraArgs} "${url}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout;
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

/** Minimal shell-escape for a single argument (wrap in single quotes, escape internal single quotes) */
function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/** Decode basic XML entities */
function decodeXmlEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}

/** Parse PROPFIND multistatus XML into a clean item list */
function parsePropfind(xml: string, basePath: string): Array<{ name: string; type: 'file' | 'dir'; size?: number; href: string }> {
  const items: Array<{ name: string; type: 'file' | 'dir'; size?: number; href: string }> = [];
  const responseRe = /<d:response>([\s\S]*?)<\/d:response>/g;
  let m: RegExpExecArray | null;
  while ((m = responseRe.exec(xml)) !== null) {
    const block = m[1];
    const hrefMatch = block.match(/<d:href>([^<]+)<\/d:href>/);
    if (!hrefMatch) continue;
    const href = decodeURIComponent(hrefMatch[1]);
    // Skip the base path itself
    const davBase = `/remote.php/dav/files/${USER}/`;
    const rel = href.replace(davBase, '').replace(/\/$/, '');
    if (!rel || rel === basePath.replace(/^\/+/, '').replace(/\/$/, '')) continue;
    const isDir = /<d:collection\/>/.test(block);
    const sizeMatch = block.match(/<d:getcontentlength>(\d+)<\/d:getcontentlength>/);
    const nameMatch = block.match(/<d:displayname>([^<]*)<\/d:displayname>/);
    const name = decodeXmlEntities(nameMatch ? nameMatch[1] : rel.split('/').pop() || rel);
    items.push({
      name,
      type: isDir ? 'dir' : 'file',
      size: sizeMatch ? parseInt(sizeMatch[1]) : undefined,
      href,
    });
  }
  return items;
}

/** Format bytes to human-readable */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

/** Output envelope */
function ok(command: string, result: any, next_actions: any[] = []) {
  console.log(JSON.stringify({ ok: true, command, result, next_actions }));
}

function fail(command: string, message: string, code: string, fix: string) {
  const out = { ok: false, command, error: { message, code }, fix };
  if (isAgent) console.log(JSON.stringify(out));
  else console.error(`Error [${code}]: ${message}\nFix: ${fix}`);
  process.exit(1);
}

// ── Files ─────────────────────────────────────────────────────────────────────
const files = program.command('files').description('File operations (WebDAV)');

files.command('list [path]')
  .description('List files/folders')
  .option('--depth <n>', 'WebDAV depth (0=folder only, 1=contents)', '1')
  .action(async (path = '', opts) => {
    const url = webdavUrl(path || '/');
    const xml = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:prop>
    <d:displayname/>
    <d:getcontentlength/>
    <d:resourcetype/>
    <d:getlastmodified/>
  </d:prop>
</d:propfind>`;
    try {
      const raw = await curlXml('PROPFIND', url, xml, `-H "Depth: ${opts.depth}"`);
      if (raw.includes('<s:exception>')) {
        const msg = raw.match(/<s:message>([^<]+)<\/s:message>/)?.[1] || 'WebDAV error';
        return fail('files list', msg, 'WEBDAV_ERROR', 'Check path and credentials');
      }
      const items = parsePropfind(raw, path || '/');
      if (isAgent) {
        ok('nextcloud files list', { path: path || '/', items }, [
          { command: 'nextcloud files get <path>', description: 'Download a file' },
          { command: 'nextcloud files put <local> <remote>', description: 'Upload a file' },
        ]);
      } else {
        console.log(`Contents of /${path || ''}:`);
        for (const item of items) {
          const prefix = item.type === 'dir' ? '📁' : '📄';
          const size = item.size !== undefined ? `  (${fmtBytes(item.size)})` : '';
          console.log(`  ${prefix} ${item.name}${size}`);
        }
        if (!items.length) console.log('  (empty)');
      }
    } catch (e: any) {
      fail('files list', e.message, 'WEBDAV_ERROR', 'Check path, credentials, and network');
    }
  });

files.command('get <path> [dest]')
  .description('Download a file')
  .action(async (path: string, dest?: string) => {
    const url = webdavUrl(path);
    const outPath = dest || path.split('/').pop() || 'downloaded_file';
    try {
      await execAsync(`curl -s -u ${USER}:${shellEscape(PASS)} -o ${shellEscape(outPath)} ${shellEscape(url)}`);
      if (isAgent) {
        ok('nextcloud files get', { path, saved_to: outPath }, [
          { command: `nextcloud files list ${path.split('/').slice(0, -1).join('/') || ''}`, description: 'List folder' },
        ]);
      } else {
        console.log(`Downloaded: ${path} → ${outPath}`);
      }
    } catch (e: any) {
      fail('files get', e.message, 'DOWNLOAD_FAILED', 'Check file exists and destination is writable');
    }
  });

files.command('put <local> <remote>')
  .description('Upload a file')
  .action(async (local: string, remote: string) => {
    const url = webdavUrl(remote);
    try {
      await execAsync(`curl -s -u ${USER}:${shellEscape(PASS)} -T ${shellEscape(local)} ${shellEscape(url)}`);
      if (isAgent) {
        ok('nextcloud files put', { local, remote }, [
          { command: `nextcloud files list ${remote.split('/').slice(0, -1).join('/') || ''}`, description: 'Verify upload' },
        ]);
      } else {
        console.log(`Uploaded: ${local} → ${remote}`);
      }
    } catch (e: any) {
      fail('files put', e.message, 'UPLOAD_FAILED', 'Check local file exists and remote path is valid');
    }
  });

files.command('mkdir <path>')
  .description('Create a folder')
  .action(async (path: string) => {
    const url = webdavUrl(path);
    try {
      const out = await execAsync(`curl -s -o /dev/null -w "%{http_code}" -u ${USER}:${shellEscape(PASS)} -X MKCOL ${shellEscape(url)}`);
      const code = out.stdout.trim();
      if (!['201', '405'].includes(code)) { // 405 = already exists
        return fail('files mkdir', `HTTP ${code}`, 'MKCOL_FAILED', 'Check parent path exists and permissions');
      }
      if (isAgent) {
        ok('nextcloud files mkdir', { path, http_code: code }, [
          { command: `nextcloud files list ${path}`, description: 'List new folder' },
        ]);
      } else {
        console.log(code === '405' ? `Folder already exists: ${path}` : `Created folder: ${path}`);
      }
    } catch (e: any) {
      fail('files mkdir', e.message, 'MKCOL_FAILED', 'Check parent path exists and permissions');
    }
  });

files.command('delete <path>')
  .description('Delete file or folder')
  .option('--force', 'Skip confirmation')
  .action(async (path: string, opts) => {
    if (!opts.force && !isAgent) {
      const rl = (await import('node:readline/promises')).createInterface(process.stdin, process.stdout);
      const answer = await rl.question(`Delete ${path}? (yes/no) `);
      rl.close();
      if (answer !== 'yes') { console.log('Cancelled.'); return; }
    }
    const url = webdavUrl(path);
    try {
      const out = await execAsync(`curl -s -o /dev/null -w "%{http_code}" -u ${USER}:${shellEscape(PASS)} -X DELETE ${shellEscape(url)}`);
      const code = out.stdout.trim();
      if (!['200', '204'].includes(code)) {
        return fail('files delete', `HTTP ${code}`, 'DELETE_FAILED', 'Check path exists and you have delete permission');
      }
      if (isAgent) {
        ok('nextcloud files delete', { path }, [
          { command: `nextcloud files list ${path.split('/').slice(0, -1).join('/') || ''}`, description: 'List parent' },
        ]);
      } else {
        console.log(`Deleted: ${path}`);
      }
    } catch (e: any) {
      fail('files delete', e.message, 'DELETE_FAILED', 'Check path exists and you have delete permission');
    }
  });

// ── OCS ───────────────────────────────────────────────────────────────────────
const ocs = program.command('ocs').description('OCS API: server/user info');

ocs.command('user')
  .description('Get own user info')
  .action(async () => {
    try {
      const raw = await curl(`-H "OCS-APIRequest: true" "${OCS_BASE_URL}/users/${USER}"`);
      // OCS XML uses whitespace/indentation; strip it before matching
      const flat = raw.replace(/>\s+</g, '><');
      const get = (tag: string) => flat.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))?.[1]?.trim();
      if (isAgent) {
        ok('nextcloud ocs user', {
          id: get('id'),
          displayname: get('displayname'),
          email: get('email'),
          quota_used: get('used') ? fmtBytes(parseInt(get('used')!)) : undefined,
          quota_total: get('total') ? fmtBytes(parseInt(get('total')!)) : undefined,
          quota_free: get('free') ? fmtBytes(parseInt(get('free')!)) : undefined,
          last_login: get('lastLogin'),
          backend: get('backend'),
          enabled: get('enabled') === '1',
        });
      } else {
        console.log([
          `User:       ${get('id')} (${get('displayname')})`,
          `Email:      ${get('email') || '—'}`,
          `Backend:    ${get('backend')}`,
          `Enabled:    ${get('enabled') === '1' ? 'yes' : 'no'}`,
          `Quota used: ${get('used') ? fmtBytes(parseInt(get('used')!)) : '—'} / ${get('total') ? fmtBytes(parseInt(get('total')!)) : '—'}`,
          `Last login: ${get('lastLogin') ? new Date(parseInt(get('lastLogin')!)).toLocaleString() : '—'}`,
        ].join('\n'));
      }
    } catch (e: any) {
      fail('ocs user', e.message, 'OCS_ERROR', 'Check credentials and OCS endpoint');
    }
  });

ocs.command('capabilities')
  .description('Get server capabilities and version')
  .action(async () => {
    try {
      const raw = await curl(`-H "OCS-APIRequest: true" "${BASE}/ocs/v1.php/cloud/capabilities"`);
      const flat = raw.replace(/>\s+</g, '><');
      const version = flat.match(/<string>([^<]+)<\/string>/)?.[1];
      const edition = flat.match(/<edition>([^<]+)<\/edition>/)?.[1];
      if (isAgent) {
        ok('nextcloud ocs capabilities', { version, edition, raw_xml: raw });
      } else {
        console.log(`Nextcloud ${version || '?'} (${edition || 'Community'})`);
      }
    } catch (e: any) {
      fail('ocs capabilities', e.message, 'OCS_ERROR', 'Check server supports OCS');
    }
  });

// ── Calendar ──────────────────────────────────────────────────────────────────
const KHAL = '/root/.openclaw/utilities/bin/khal';
const VDIR = '/root/.openclaw/utilities/bin/vdirsyncer';

const calendar = program.command('calendar').description('Calendar operations (khal + vdirsyncer)');

calendar.command('list [range...]')
  .description('List upcoming events (default: today 7d)')
  .action(async (range: string[]) => {
    const rangeStr = range.length ? range.join(' ') : 'today 7d';
    try {
      const { stdout } = await execAsync(`${KHAL} list ${rangeStr}`);
      if (isAgent) {
        ok('nextcloud calendar list', { range: rangeStr, events_text: stdout.trim() }, [
          { command: 'nextcloud calendar new <date> <start> <end> <title>', description: 'Create an event' },
          { command: 'nextcloud calendar sync', description: 'Sync with Nextcloud' },
        ]);
      } else {
        console.log(stdout || '(no events)');
      }
    } catch (e: any) {
      fail('calendar list', e.stderr || e.message, 'KHAL_ERROR', 'Run: nextcloud calendar setup');
    }
  });

calendar.command('new <date> <start> <end> <title>')
  .description('Create timed event. Example: 2026-03-07 14:00 15:30 "Team sync"')
  .action(async (date: string, start: string, end: string, title: string) => {
    try {
      await execAsync(`${KHAL} new ${date} ${start} ${end} ${shellEscape(title)}`);
      if (isAgent) {
        ok('nextcloud calendar new', { date, start, end, title }, [
          { command: 'nextcloud calendar list', description: 'Verify creation' },
          { command: 'nextcloud calendar sync', description: 'Push to Nextcloud' },
        ]);
      } else {
        console.log(`Event created: ${date} ${start}–${end} "${title}"`);
      }
    } catch (e: any) {
      fail('calendar new', e.stderr || e.message, 'KHAL_ERROR', 'Ensure khal is configured via: nextcloud calendar setup');
    }
  });

calendar.command('sync')
  .description('Bidirectional sync via vdirsyncer')
  .action(async () => {
    try {
      const { stdout, stderr } = await execAsync(`${VDIR} sync 2>&1`);
      const output = (stdout + stderr).trim();
      if (isAgent) {
        ok('nextcloud calendar sync', { output });
      } else {
        console.log(output || 'Sync complete.');
      }
    } catch (e: any) {
      fail('calendar sync', e.message, 'VDIRSYNCER_ERROR', 'Run: nextcloud calendar setup');
    }
  });

calendar.command('setup')
  .description('Re-link khal/vdirsyncer configs and run initial sync (run after container restart)')
  .action(async () => {
    try {
      const { stdout } = await execAsync('/root/.openclaw/utilities/caldav-setup.sh');
      if (isAgent) {
        ok('nextcloud calendar setup', { output: stdout.trim() });
      } else {
        console.log(stdout);
      }
    } catch (e: any) {
      fail('calendar setup', e.message, 'SETUP_FAILED', 'Check /root/.openclaw/utilities/caldav-setup.sh exists and is executable');
    }
  });

// Note: Commander.js can't parse two-word subcommands like "reminders list"
// Use a single command "reminders" instead
calendar.command('reminders')
  .description('List reminders/tasks for the next 30 days')
  .action(async () => {
    try {
      const { stdout } = await execAsync(`${KHAL} list today 30d --format "{start-time} {title}"`);
      if (isAgent) {
        ok('nextcloud calendar reminders', { raw: stdout.trim() });
      } else {
        console.log(stdout || '(no reminders)');
      }
    } catch (e: any) {
      fail('calendar reminders', e.stderr || e.message, 'KHAL_ERROR', 'Run: nextcloud calendar setup');
    }
  });

program.parse();
