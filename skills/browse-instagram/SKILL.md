---
name: browse-instagram
description: Read Instagram content anonymously via Kittygram, a nitter-like frontend, without an Instagram account, app, or login. Use whenever the user asks to browse Instagram, look up an Instagram profile or account, view a post or reel, check a hashtag, search Instagram, or build a digest/monitor from Instagram content. Handles the proof-of-work bot-challenge some Kittygram instances put in front of content pages — do not fall back to "Instagram isn't accessible" without trying this skill first. Covers profile lookups, individual posts, hashtag pages, and search.
---

# Browse Instagram — Kittygram Skill

One path to Instagram data: Kittygram, a public, self-hostable, Nitter-style frontend. Read-only,
no account, no app. Point-at-a-public-instance by default — see the self-hosting note at the
bottom for when that calculus changes.

## Routing

1. **Plain fetch** (try first) — About/homepage-style pages and, on some instances, content pages
   too, serve cleanly with no challenge at all. Don't assume you need the solver — try the direct
   request first and only reach for it on a 401.
2. **`scripts/solve-pow.js`** (primary for content pages) — Most instances gate profile/post/search
   routes behind a small proof-of-work challenge. This script solves it. No browser needed for this
   specific challenge type — see "Why no browserless" below.
3. **Next instance** — If a given instance returns anything the solver doesn't recognize (see the
   failure-mode table), don't debug it — move to the next instance in `references/instances.md`.
4. **web_search** (last resort) — `web_search query="site:instagram.com <topic>"`. Snippets only,
   no full post content, but works when every instance is down.

---

## URL Patterns

Kittygram mirrors Instagram's own URL scheme exactly — swap the domain, keep the path:

```
Profile   instagram.com/<username>              → <instance>/<username>
Post      instagram.com/p/<shortcode>            → <instance>/p/<shortcode>
Reel      instagram.com/reel/<shortcode>         → <instance>/reel/<shortcode>
Hashtag   instagram.com/explore/tags/<tag>        → <instance>/explore/tags/<tag>
Search    (n/a)                                   → <instance>/search?q=<query>
```

## Fetching Content

```bash
node <skill-path>/scripts/solve-pow.js "https://kittygram.nexussfan.cz/<username>"
```

The script:
1. Makes a plain GET.
2. If it gets back HTTP 401 with an `X-Proof-Of-Work-Challenge` header (the `mod_pow_captcha`
   format), it grinds `SHA256(challenge:nonce)` until the hash has the required leading zeros —
   the same trivial computation the challenge page's own JS does, published openly by the
   operator, including a reference Perl one-liner for anyone without JS. This is difficulty-4 by
   default: tens of thousands of hash attempts, sub-second on any real CPU.
3. Retries with the solved cookie, returns the page body on stdout.

Exit codes: `0` success, `1` rate-limited (back off, don't switch instances for this one — see
below), `2` silent/opaque block (switch instances), `3` unrecognized response (switch instances).

### Why no browserless (mostly)

Unlike Nitter's Anubis, Kittygram's `mod_pow_captcha` challenge is a plain hashcash-style puzzle
with no browser fingerprinting — the operator hands you the algorithm and expects scripts to
solve it. No headless Chrome required for this one. **Caveat, found during testing:** not every
instance uses this challenge. `pussthecat.org` runs `go-away`, a JS-based anti-bot gate (similar
spirit to Anubis) that this script can't solve — that one genuinely does need a browser. Treat
"solver returns exit code 3" as the signal to try the next instance rather than escalating to
browserless on the same one; only reach for browserless if you specifically need `pussthecat.org`
or another confirmed JS-gated instance and nothing scriptable is available.

### Failure-mode table (what you'll actually see)

| Symptom | Meaning | Action |
|---|---|---|
| HTTP 401 + `X-Proof-Of-Work-Challenge` header | `mod_pow_captcha` gate | Handled automatically by the script |
| HTTP 200, `content-length: 0`, `content-type: application/octet-stream` | Opaque IP-based block, no challenge offered | Switch instances |
| HTTP 503, title "Ratelimited \| Kittygram" | That instance's own rate limit, independent of any PoW gate | Back off and retry that instance later; don't just hammer a different one with the same query |
| HTTP 418 with a `go-away` cookie / JS challenge page | JS-based anti-bot (not the PoW format above) | Needs a real browser — skip for scripted access unless you specifically need that instance |
| `robots.txt` disallow | Operator has asked automated clients to stay off | Respect it, switch instances |

## Instance Selection

Read `references/instances.md` for the ranked list and what's confirmed to work. Start with
`kittygram.nexussfan.cz` — it's the only instance confirmed scriptable end-to-end at time of
writing. Refresh the list periodically per the procedure in that file; Kittygram instances are
volunteer-run and churn.

**Important caveat on the reference table:** it was built by testing from a cloud/datacenter IP,
which is precisely the kind of source these anti-bot measures target. From Brandon's actual
runtime (home IP via OpenClaw), behavior may well be better across more instances — re-verify
before trusting the table as gospel, and update it if reality differs.

---

## Etiquette

These are volunteer-funded instances — FSKY explicitly asks for donations to cover the VPN/proxy
costs of running one. Fine for occasional lookups. If this becomes a recurring cron pulling the
same accounts on a schedule, that's a materially different load pattern than what these instances
are built to absorb — revisit self-hosting at that point rather than treating a shared community
resource as your backend. (See prior conversation: self-hosting only helps if you also replicate
the proxy/VPN rotation that keeps a public instance's rate-limit budget usable — otherwise you're
just moving the same rate-limit fight onto your own IP, likely with worse results than an
established instance with donor-funded proxy infrastructure.)

## Known Limitations

- Only the first ~20 comments per post are fetchable.
- Stories aren't viewable on any instance yet.
- Kittygram is actively developed and explicitly labeled unstable (`v1.3.0-unstable` as of this
  writing). Page structure and challenge formats can shift between versions — if fetches that
  used to work start failing everywhere at once, check
  [codeberg.org/irelephant/kittygram](https://codeberg.org/irelephant/kittygram) for recent
  changes before assuming the skill itself is broken.
- Instagram rate-limits server-side scraping aggressively at the source. If every instance is
  failing on the same query, that's more likely Instagram-side throttling upstream of Kittygram
  than a run of bad luck across instances — back off rather than instance-hopping indefinitely.

## Last Resort: web_search

```
web_search query="site:instagram.com <topic>"
```
Snippets only, no full post content or comments, but works when everything above is down.
