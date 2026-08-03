#!/usr/bin/env node
// solve-pow.js — fetch a Kittygram URL, transparently solving the mod_pow_captcha
// proof-of-work challenge if one is presented. No browser needed; this is a pure
// SHA-256 grind, same algorithm the challenge page itself hands you in JS/Perl.
//
// Usage: node solve-pow.js <url>
// Stdout: response body on success
// Exit codes: 0 success | 1 ratelimited (try another instance) |
//             2 silent/unrecognized block (try another instance) | 3 other error

import { createHash } from 'node:crypto';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node solve-pow.js <url>');
  process.exit(3);
}

const UA = 'Mozilla/5.0 (compatible; browse-instagram-skill)';

function sha256hex(s) {
  return createHash('sha256').update(s).digest('hex');
}

function solvePow(challenge, difficulty) {
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;
  while (!sha256hex(`${challenge}:${nonce}`).startsWith(prefix)) nonce++;
  return nonce;
}

async function fetchOnce(cookie) {
  const headers = { 'User-Agent': UA };
  if (cookie) headers['Cookie'] = cookie;
  return fetch(url, { headers, redirect: 'follow' });
}

const res = await fetchOnce();

// Case 1: mod_pow_captcha challenge (401 + X-Proof-Of-Work-Challenge header)
if (res.status === 401 && res.headers.get('x-proof-of-work-challenge')) {
  const challenge = res.headers.get('x-proof-of-work-challenge');
  const difficulty = parseInt(res.headers.get('x-proof-of-work-difficulty') || '4', 10);
  const nonce = solvePow(challenge, difficulty);
  const cookie = `X-Proof-Of-Work-Challenge=${challenge}; X-Proof-Of-Work-Solution=${nonce}`;
  const res2 = await fetchOnce(cookie);

  if (res2.status === 503) {
    const text = await res2.text();
    if (text.includes('Ratelimited')) {
      console.error('RATELIMITED');
      process.exit(1);
    }
  }
  if (!res2.ok) {
    console.error(`Retry after solving PoW failed: HTTP ${res2.status}`);
    process.exit(3);
  }
  console.log(await res2.text());
  process.exit(0);
}

// Case 2: silent block — HTTP 200 but empty/octet-stream body (seen on kittygr.am)
const ct = res.headers.get('content-type') || '';
const len = res.headers.get('content-length');
if (res.ok && (len === '0' || (ct.includes('octet-stream') && (!len || len === '0')))) {
  console.error('SILENT_BLOCK — this instance returned an empty response, likely IP-based filtering. Try another instance.');
  process.exit(2);
}

// Case 3: clean success, no challenge presented
if (res.ok) {
  console.log(await res.text());
  process.exit(0);
}

// Case 4: something else (different PoW format, real error, etc.)
console.error(`Unhandled response: HTTP ${res.status}. This instance may use a different challenge format — try another instance.`);
process.exit(3);
