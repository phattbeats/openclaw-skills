/**
 * Reddit HTML scraper — browserless-backed.
 *
 * Why: Reddit blocks unauthenticated `.json` requests at the TLS/HTTP2 layer
 * (Cloudflare Enterprise). Direct `fetch()` returns 403 with a stub page.
 * However, a real headless Chrome (browserless) renders the full HTML page
 * because it presents legitimate TLS fingerprints + executes JavaScript.
 *
 * We use browserless's `/function` endpoint, which runs a small Node script
 * inside the browserless container that navigates to a Reddit URL, evaluates
 * a snippet, and returns structured JSON. ~1.3s per call.
 *
 * browserless is local (PHATT-RAID, 10.0.0.100:3000). No auth, no cost.
 */

const BROWSERLESS_URL = "http://10.0.0.100:3000";

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_PAGE_TIMEOUT_MS = 15000;

/**
 * Run a browserless function that navigates to `url`, evaluates `evaluateBody`
 * inside the page, and returns the result as JSON.
 *
 * The page-load selector waits for `.thing` (Reddit's class for any listing item —
 * post or comment). If we don't see it within `pageTimeoutMs`, we still try to
 * scrape whatever rendered.
 */
export async function scrapeReddit(
  url: string,
  evaluateBody: string,
  opts: { pageTimeoutMs?: number; fnTimeoutMs?: number; waitFor?: string } = {},
): Promise<any> {
  const pageTimeout = opts.pageTimeoutMs ?? DEFAULT_PAGE_TIMEOUT_MS;
  const fnTimeout = opts.fnTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const waitFor = opts.waitFor ?? ".thing";

  const code = `
module.exports = async ({ page }) => {
  await page.goto(${JSON.stringify(url)}, { waitUntil: "domcontentloaded", timeout: ${pageTimeout} });
  await page.waitForSelector(${JSON.stringify(waitFor)}, { timeout: 5000 }).catch(() => null);
  const data = await page.evaluate(() => {
    ${evaluateBody}
  });
  return { type: "json", data };
};
`;

  const res = await fetch(`${BROWSERLESS_URL}/function`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    signal: AbortSignal.timeout(fnTimeout),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`browserless HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const text = await res.text();
  if (!text) throw new Error("browserless returned empty response (function may have errored)");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`browserless returned non-JSON: ${text.slice(0, 200)}`);
  }
}

// ─── Selectors ───────────────────────────────────────
// All tested against old.reddit.com HTML as of 2026-06-23.
//
// `.thing`             — every listing item (post OR comment). Use data-* attrs.
// `data-fullname`      — "t3_xxx" for posts, "t1_xxx" for comments
// `data-author`        — author username
// `data-score`         — net score (as string)
// `data-permalink`     — relative URL "/r/.../comments/.../..."
// `data-subreddit`     — subreddit name
// `data-domain`        — link domain
// `data-num-crossposts`— crosspost count
// `data-comments-count`— comment count (on posts)
// `data-rank`          — rank in listing
// `data-is-gallery`    — gallery?
// `data-nsfw`          — "true"/"false"
// `.title a`           — post title
// `.title .flair`      — flair (class on span)
// `.usertext-body .md` — post or comment body (HTML, but textContent works)
// `.tagline .author`   — author link
// `.tagline .score`    — score text (e.g. "2 points")
// `.tagline time`      — `<time datetime="...">` — submission/post time
// `.tagline .live-timestamp` — relative time text ("4 hours ago")
// `.flat-list.buttons .bylink` — "4 comments" link text
// `.side .titlebox .redditname` — subreddit name on subreddit pages
// `.side .titlebox h1.redditname` — alt selector for subreddit name
// `.side .titlebox .age time`     — subreddit age
// `.side .titlebox .usertext-body` — subreddit description
// `.side .linkinfo .score .number` — sidebar score

// ─── Helpers used inside evaluate() ──────────────────

// Strip HTML, normalize whitespace. Used inside page.evaluate().
export const INLINE_HELPERS = `
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return [...(root || document).querySelectorAll(sel)]; }
function text(el) { return el ? el.textContent.replace(/\\s+/g, " ").trim() : ""; }
function attr(el, name) { return el ? el.getAttribute(name) : null; }
function parseScore(str) {
  if (!str) return 0;
  const m = String(str).match(/(-?\\d+)\\s*point/);
  return m ? parseInt(m[1], 10) : 0;
}
function parseAge(str) {
  if (!str) return null;
  const num = parseInt(str, 10);
  if (isNaN(num)) return null;
  if (/minute/i.test(str)) return num;
  if (/hour/i.test(str)) return num * 60;
  if (/day/i.test(str)) return num * 1440;
  if (/month/i.test(str)) return num * 43200;
  if (/year/i.test(str)) return num * 525600;
  return num;
}
`;