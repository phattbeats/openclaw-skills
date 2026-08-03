# Kittygram Instances

Canonical source (used by kittygram-redirect itself, refresh from here):
```
curl -s https://codeberg.org/irelephant/kittygram/raw/branch/main/instances.json
```
Fallback mirror if Codeberg is down: `https://foundry.fsky.io/mirrors/kittygram/raw/branch/main/instances.json`

Human picker (paste any instagram.com URL, or swap the domain): https://redirect.kittygr.am/
Note: the redirect service itself returns an HTML picker page (HTTP 200), not an HTTP redirect —
it's built for a human clicking through a browser, not for a script to follow blindly. Useful for
manually checking which instances are currently up; not a drop-in fetch endpoint for the solver script.

## Known instances, anti-bot stack, and what a scripted client can expect

Tested from a datacenter/cloud IP (Anthropic sandbox) on 2026-08-02. **These results are
IP-dependent — re-verify from the actual runtime network (Brandon's home IP via OpenClaw)
before trusting this table long-term.** Datacenter IPs are exactly what these operators are
trying to filter; a home IP will very plausibly behave better.

| Instance | Country | Anti-bot on content routes | Scriptable? |
|---|---|---|---|
| kittygram.nexussfan.cz | CZ | `mod_pow_captcha` — 401 + `X-Proof-Of-Work-Challenge`/`-Difficulty` headers, plain SHA-256(challenge:nonce) grind | **Yes** — `scripts/solve-pow.js` handles this format |
| kittygram.pussthecat.org | DE | `go-away` (418, JWT-style cookie, JS-based) | No — needs a real browser/JS execution |
| kg.lus.lu | US | Custom `pow!` challenge (`tc-challenge`/`tc-difficulty` meta tags) — same hashcash idea, different field names, protocol not reverse-engineered | Unconfirmed — treat as browser-only until verified |
| kittygr.am | PL (FSKY) | HTTP 200 but empty body / `application/octet-stream` on content routes — no visible challenge page at all | No — opaque block, skip for scripted access |
| kittygram.nadeko.net | CL | Returned "Ratelimited \| Kittygram" (503) directly, same page/server family as kittygr.am | No — appears IP-flagged, same as above |
| kg.meowing.de | DE | HTTP 500 on content routes at test time | Unknown — retest, may be transient |
| kittygram.kareem.one | SG (Cloudflare) | `robots.txt` disallows automated access | Respect it — don't script against this one |
| kittygram.irelephant.net | DE (creator's own) | 0% uptime in kittygram-redirect's last health check | Skip until it's back |

## Practical ranking for the skill

1. **kittygram.nexussfan.cz** — primary target for scripted fetches. Only confirmed-scriptable instance.
2. Anything else from `instances.json` not listed above — untested, try with plain fetch first, fall
   back per the failure-mode table in SKILL.md.
3. If nexussfan.cz is rate-limited (it has its own limit independent of the PoW gate — confirmed by
   testing), back off and retry later rather than switching to a different instance's PoW format you
   haven't built a solver for.

## Refresh procedure

Instance operators come and go. Before assuming this table is current:
```bash
curl -s https://codeberg.org/irelephant/kittygram/raw/branch/main/instances.json | \
  node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{JSON.parse(d).forEach(i=>console.log(i.url,i.country))})"
```
Then re-run the anti-bot detection by hand against any new entries (fetch a profile URL, read the
response — see SKILL.md's failure-mode table for what each pattern means).
