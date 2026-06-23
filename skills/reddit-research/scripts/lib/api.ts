/**
 * Reddit research API — browserless + PullPush + Arctic Shift.
 *
 * Reddit (default): browserless-backed HTML scrape of old.reddit.com.
 *   Real-time data, full thread content (post + nested comments).
 *   ~1.3s per call. Works because browserless bypasses Reddit's CF Enterprise
 *   protection with a real headless Chrome.
 *
 * PullPush: historical Reddit archive. Fast, free, global search, but stale
 *   (hours-to-days lag). Best for: deleted/old content, global comment search.
 *   Caveat: link_id lookups for recent posts return empty.
 *
 * Arctic Shift: historical archive with full selftext + indexed posts.
 *   Requires --sub or --author for search. API quirks:
 *     posts search:      ?query=&subreddit=
 *     comments search:   ?query=&subreddit=
 *     subreddit search:  ?subreddit= (no query param)
 *     single-post fetch: not supported (no endpoint)
 */

import { scrapeReddit, INLINE_HELPERS } from "./scraper.js";
import { fetchWithUA } from "./session.js";

// ─── Reddit provider (browserless) ───────────────────

const POST_EVAL = INLINE_HELPERS + `
function absUrl(href) {
  if (!href) return null;
  if (/^https?:\\/\\//.test(href)) return href;
  if (href.startsWith("/")) return "https://reddit.com" + href;
  return href;
}
function parseScoreText(str) {
  if (!str) return 0;
  const s = String(str).trim();
  let m;
  if ((m = s.match(/^([\\d.]+)\\s*([KkMm])$/))) {
    const n = parseFloat(m[1]);
    const mult = /m/i.test(m[2]) ? 1e6 : 1e3;
    return Math.round(n * mult);
  }
  if ((m = s.match(/(-?[\\d.]+)/))) return parseFloat(m[1]);
  return 0;
}
function extractId(permalink, fullname) {
  if (fullname) {
    const stripped = fullname.replace(/^t3_/, "");
    if (stripped) return stripped;
  }
  if (permalink) {
    const m = permalink.match(/\\/comments\\/(\\w+)/);
    if (m) return m[1];
  }
  return null;
}
// Two layouts: .thing (feeds, listings) and .search-result (search pages).
const things = $$(".thing").filter(t => t.dataset.type === "link" || t.dataset.fullname?.startsWith("t3_"));
const searchResults = $$(".search-result");
const fromThing = things.map(t => {
  const titleEl = $("a.title", t);
  const tagline = $(".tagline", t);
  const body = $(".usertext-body .md", t);
  const thumb = $(".thumbnail", t);
  const permalink = t.dataset.permalink;
  return {
    id: extractId(permalink, t.dataset.fullname),
    title: text(titleEl),
    author: t.dataset.author || null,
    subreddit: t.dataset.subreddit,
    score: parseInt(t.dataset.score || "0", 10),
    numComments: parseInt(t.dataset.commentsCount || "0", 10),
    created: attr($("time", tagline), "datetime"),
    url: absUrl(titleEl?.getAttribute("href")),
    permalink: absUrl(permalink),
    selftext: text(body).slice(0, 2000),
    isSelf: t.classList.contains("self") || (t.dataset.domain || "").startsWith("self."),
    isNsfw: t.dataset.nsfw === "true",
    flair: text($(".title .flair, .linkflairlabel", t)),
    domain: t.dataset.domain,
    thumbnail: thumb && !thumb.classList.contains("self") ? thumb.src : null,
    stickied: t.classList.contains("stickied") || t.classList.contains("stickied-link"),
  };
});
const fromSearch = searchResults.map(t => {
  const titleEl = $(".search-title", t);
  const scoreText = text($(".search-score", t));
  const commentsText = text($(".search-comments", t));
  const timeEl = $(".search-time time", t);
  const authorEl = $(".search-author .author", t);
  const subLink = $(".search-subreddit-link", t);
  const permalink = titleEl?.getAttribute("href");
  const subName = (text(subLink) || "").replace(/^r\\//, "") || null;
  return {
    id: extractId(permalink, t.dataset.fullname),
    title: text(titleEl),
    author: text(authorEl) || null,
    subreddit: subName,
    score: parseScoreText(scoreText),
    numComments: parseScoreText(commentsText),
    created: attr(timeEl, "datetime"),
    url: absUrl(permalink),
    permalink: absUrl(permalink),
    selftext: "",
    isSelf: t.classList.contains("self"),
    isNsfw: false,
    flair: text($(".linkflairlabel", t)),
    domain: null,
    thumbnail: null,
    stickied: false,
  };
});
return [...fromThing, ...fromSearch].filter(p => p.id);
`;

const COMMENT_EVAL = INLINE_HELPERS + `
function walk(el, depth, parentAuthor) {
  const author = el.dataset.author;
  const score = text($(".tagline .score", el));
  const tagline = $(".tagline", el);
  const body = text($(".usertext-body .md", el));
  const permalink = "https://reddit.com" + el.dataset.permalink;
  const created = attr($("time", tagline), "datetime");
  const out = [{
    id: el.dataset.fullname?.replace(/^t1_/, ""),
    author,
    body: body ? body.slice(0, 2000) : "",
    score: parseScore(score),
    created,
    permalink,
    isOp: author === parentAuthor,
    awards: 0,
    controversiality: 0,
    depth,
    edited: false,
  }];
  const childContainer = $(".child .sitetable, .child > .thing", el);
  if (childContainer) {
    const kids = $$(".thing.comment, .thing.collapsed", childContainer);
    for (const k of kids) out.push(...walk(k, depth + 1, parentAuthor));
  }
  return out;
}
return walk($(".thing.comment").closest(".sitetable").querySelector(".thing.comment") || $(".thing.comment"), 0, $(".thing.link").dataset.author).filter(c => c.id);
`;

export interface SearchOptions {
  subreddit?: string;
  sort?: "relevance" | "hot" | "top" | "new" | "comments";
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
  limit?: number;
  after?: string;
  nsfw?: boolean;
}

export async function search(query: string, opts: SearchOptions = {}) {
  const { subreddit, sort = "relevance", time = "all", limit = 25, after, nsfw = false } = opts;
  const params = new URLSearchParams({ q: query, sort, t: time, restrict_sr: subreddit ? "on" : "off", limit: String(Math.min(limit, 100)) });
  if (after) params.set("after", after);
  if (!nsfw) params.set("include_over_18", "off");
  const base = subreddit ? `https://old.reddit.com/r/${subreddit}/search` : "https://old.reddit.com/search";
  const url = `${base}?${params}`;

  const posts = await scrapeReddit(url, POST_EVAL, { waitFor: ".thing" });
  return { posts, after: null, count: posts.length };
}

// ─── Subreddit feeds ──────────────────────────────────

export type FeedSort = "hot" | "new" | "rising" | "top" | "controversial";

export interface FeedOptions {
  sort?: FeedSort;
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
  limit?: number;
  after?: string;
}

export async function subredditFeed(subreddit: string, opts: FeedOptions = {}) {
  const { sort = "hot", time = "day", limit = 25, after } = opts;
  const params = new URLSearchParams({ limit: String(Math.min(limit, 100)), t: time });
  if (after) params.set("after", after);
  const url = `https://old.reddit.com/r/${subreddit}/${sort}/?${params}`;

  const posts = await scrapeReddit(url, POST_EVAL, { waitFor: ".thing" });
  return { posts, after: null };
}

export async function multiFeed(subreddits: string[], opts: FeedOptions = {}) {
  const { sort = "hot", time = "day", limit = 25 } = opts;
  const multi = subreddits.join("+");
  const params = new URLSearchParams({ limit: String(Math.min(limit, 100)), t: time });
  const url = `https://old.reddit.com/r/${multi}/${sort}/?${params}`;
  const posts = await scrapeReddit(url, POST_EVAL, { waitFor: ".thing" });
  return { posts, after: null };
}

// ─── Thread + comments ────────────────────────────────

export interface ThreadOptions {
  sort?: "top" | "best" | "new" | "controversial" | "old" | "qa";
  limit?: number;
  depth?: number;
}

export async function thread(subreddit: string, postId: string, _opts: ThreadOptions = {}) {
  const url = `https://old.reddit.com/r/${subreddit}/comments/${postId}/`;
  const data = await scrapeReddit(
    url,
    INLINE_HELPERS + `
function absUrl(href) { if (!href) return null; if (/^https?:\\/\\//.test(href)) return href; return "https://reddit.com" + (href.startsWith("/") ? href : "/" + href); }
function parseScoreText(str) { if (!str) return 0; const m = String(str).match(/(-?[\\d.]+)/); return m ? parseFloat(m[1]) : 0; }
const post = $(".thing.link");
const tagline = $(".tagline", post);
const body = text($(".usertext-body .md", post));
const titleEl = $(".title a", post);
const result = {
  post: post ? {
    id: post.dataset.fullname?.replace(/^t3_/, ""),
    title: text(titleEl),
    author: post.dataset.author || null,
    subreddit: post.dataset.subreddit,
    score: parseInt(post.dataset.score || "0", 10),
    upvoteRatio: 0,
    numComments: parseInt(post.dataset.commentsCount || "0", 10),
    created: attr($("time", tagline), "datetime"),
    url: absUrl(titleEl?.getAttribute("href")),
    permalink: absUrl(post.dataset.permalink),
    selftext: body ? body.slice(0, 2000) : "",
    isSelf: (post.dataset.domain || "").startsWith("self."),
    isNsfw: post.dataset.nsfw === "true",
    flair: text($(".linkflairlabel", post)),
    domain: post.dataset.domain,
    thumbnail: null,
    awards: 0,
    crosspostCount: 0,
    stickied: post.classList.contains("stickied"),
  } : null,
  comments: $$(".thing.comment").map(c => {
    const tagline = $(".tagline", c);
    return {
      id: c.dataset.fullname?.replace(/^t1_/, ""),
      author: c.dataset.author || null,
      body: text($(".usertext-body .md", c)).slice(0, 2000),
      score: parseScoreText(text($(".score", tagline))),
      created: attr($("time", tagline), "datetime"),
      permalink: absUrl(c.dataset.permalink),
      isOp: c.dataset.author === (post?.dataset?.author),
      awards: 0,
      controversiality: 0,
      depth: parseInt(c.dataset.depth || "0", 10),
      edited: false,
    };
  }),
};
return result;
`,
    { waitFor: ".thing" },
  );
  return {
    post: data.post,
    comments: data.comments || [],
    commentCount: data.comments?.length || 0,
  };
}

export async function threadFromUrl(url: string, opts: ThreadOptions = {}) {
  const match = url.match(/reddit\.com\/r\/(\w+)\/comments\/(\w+)/);
  if (!match) throw new Error(`Invalid Reddit URL: ${url}`);
  return thread(match[1], match[2], opts);
}

// ─── Subreddit info ───────────────────────────────────

export async function subredditInfo(subreddit: string) {
  const url = `https://old.reddit.com/r/${subreddit}/`;
  const data = await scrapeReddit(
    url,
    INLINE_HELPERS + `
// Reddit hides subscriber counts from logged-out users. Best-effort.
const box = $(".titlebox");
const sidebar = $(".side");
const subsEl = document.evaluate("//span[contains(@class,'subscribers')]//span[@class='number']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
const subsText = text(subsEl);
const subs = subsText ? parseInt(subsText.replace(/\\D/g, ""), 10) : 0;
const usersEl = document.evaluate("//span[contains(@class,'users-online')]//span[@class='number']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
const usersText = text(usersEl);
const users = usersText ? parseInt(usersText.replace(/\\D/g, ""), 10) : 0;
return {
  name: text($(".redditname a, h1.redditname", box)) || ${JSON.stringify(subreddit)},
  title: text($(".redditname, h1.redditname", box)),
  description: text($(".usertext-body .md", box)),
  subscribers: subs,
  activeUsers: users,
  created: attr($(".age time", box), "datetime"),
  nsfw: document.body.classList.contains("over-18"),
  type: "public",
  url: "https://reddit.com/r/" + ${JSON.stringify(subreddit)},
  subscribersNote: subs === 0 ? "hidden for anonymous browsing" : null,
};
`,
    { waitFor: ".titlebox" },
  );
  return data;
}

// ─── User profile ─────────────────────────────────────

export async function userProfile(username: string) {
  const url = `https://old.reddit.com/user/${username}/`;
  const data = await scrapeReddit(
    url,
    INLINE_HELPERS + `
const title = document.title;
const karmaText = text($(".karma"));
const isOver18 = title.includes("over 18");
const isSuspended = title.toLowerCase().includes("suspended") || title.toLowerCase().includes("banned");
const ageMatch = title.match(/overview for \\w+/);
return {
  name: ${JSON.stringify(username)},
  karma: parseInt((karmaText || "").replace(/\\D/g, ""), 10) || 0,
  linkKarma: 0,
  commentKarma: 0,
  created: null,
  verified: false,
  suspended: isSuspended,
  nsfwGate: isOver18,
  iconUrl: null,
  rawKarmaText: karmaText,
};
`,
    { waitFor: ".karma, .interstitial" },
  );
  return data;
}

// ─── User posts (overview / submitted / comments) ─────

export interface UserPostsOptions {
  sort?: "hot" | "new" | "top" | "controversial";
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
  limit?: number;
  type?: "links" | "comments" | "overview";
}

export async function userPosts(username: string, opts: UserPostsOptions = {}) {
  const { time = "all", limit = 25, type = "overview" } = opts;
  const path = type === "overview" ? `/user/${username}` : `/user/${username}/${type === "links" ? "submitted" : "comments"}`;
  const params = new URLSearchParams({ t: time, limit: String(Math.min(limit, 100)) });
  const url = `https://old.reddit.com${path}/?${params}`;
  const items = await scrapeReddit(url, POST_EVAL, { waitFor: ".thing" });
  return { items, after: null };
}

// ─── Duplicates / Cross-posts ─────────────────────────

export async function duplicates(postId: string) {
  const url = `https://old.reddit.com/duplicates/${postId}/`;
  const data = await scrapeReddit(
    url,
    INLINE_HELPERS + `
const original = $(".thing.link");
const crossPosts = $$(".thing.link").slice(1).map(t => ({
  id: t.dataset.fullname?.replace(/^t3_/, ""),
  title: text($("a.title", t)),
  author: t.dataset.author,
  subreddit: t.dataset.subreddit,
  score: parseInt(t.dataset.score || "0", 10),
  upvoteRatio: 0,
  numComments: parseInt(t.dataset.commentsCount || "0", 10),
  created: null,
  url: null,
  permalink: "https://reddit.com" + t.dataset.permalink,
  selftext: "",
  isSelf: false,
  isNsfw: false,
  flair: null,
  domain: t.dataset.domain,
  thumbnail: null,
  awards: 0,
  crosspostCount: 0,
  stickied: false,
}));
return {
  original: original ? {
    id: original.dataset.fullname?.replace(/^t3_/, ""),
    title: text($(".title a", original)),
    author: original.dataset.author,
    subreddit: original.dataset.subreddit,
    score: parseInt(original.dataset.score || "0", 10),
    upvoteRatio: 0,
    numComments: parseInt(original.dataset.commentsCount || "0", 10),
    created: null,
    url: null,
    permalink: "https://reddit.com" + original.dataset.permalink,
    selftext: "",
    isSelf: false,
    isNsfw: false,
    flair: null,
    domain: original.dataset.domain,
    thumbnail: null,
    awards: 0,
    crosspostCount: 0,
    stickied: false,
  } : null,
  crossPosts,
  count: crossPosts.length,
};
`,
    { waitFor: ".thing" },
  );
  return data;
}

// ─── Trending subreddits ──────────────────────────────

export async function popular(_opts: FeedOptions = {}) {
  const url = `https://old.reddit.com/subreddits/`;
  const subs = await scrapeReddit(
    url,
    `
function text(el) { return el ? el.textContent.replace(/\\s+/g, " ").trim() : ""; }
function $$(sel) { return [...document.querySelectorAll(sel)]; }
function $(sel, root) { return (root || document).querySelector(sel); }
return $$(".thing").filter(function(t) {
  return t.getAttribute("data-type") === "subreddit";
}).map(function(t) {
  var a = $("a.title", t);
  var raw = text(a);
  var colonIdx = raw.indexOf(":");
  var name = colonIdx > -1 ? raw.slice(0, colonIdx).replace(/^r\\//, "").trim() : raw.replace(/^r\\//, "").trim();
  var title = colonIdx > -1 ? raw.slice(colonIdx + 1).trim() : raw.trim();
  return {
    name: name,
    title: title,
    subscribers: 0,
    activeUsers: 0,
    nsfw: t.classList.contains("over18"),
    description: text($(".description .md", t)).slice(0, 150) || title,
    age: text($(".tagline", t)),
    url: a ? a.href.replace("old.reddit.com", "reddit.com") : ("https://reddit.com/r/" + name),
  };
}).filter(function(s) { return !!s.name; });
`,
    { waitFor: ".thing" },
  );
  return subs;
}

export async function searchSubreddits(query: string, limit = 10) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const url = `https://old.reddit.com/subreddits/search?${params}`;
  const subs = await scrapeReddit(
    url,
    INLINE_HELPERS + `
return $$(".search-result, .thing").slice(0, ${limit}).map(t => ({
  name: t.dataset.subreddit || text($(".title a, .redditname a", t)),
  title: text($(".result-name a, .title a", t)),
  subscribers: parseInt((text($(".subscribers", t)) || "0").replace(/\\D/g, ""), 10),
  activeUsers: 0,
  nsfw: false,
  description: text($(".search-result-body, .usertext-body .md", t)),
})).filter(s => s.name);
`,
    { waitFor: ".search-result, .thing" },
  );
  return subs;
}

// ─── Wiki page ────────────────────────────────────────

export async function wiki(subreddit: string, page = "index") {
  const url = `https://old.reddit.com/r/${subreddit}/wiki/${page}`;
  const res = await fetchWithUA(url);
  if (!res.ok) throw new Error(`wiki HTTP ${res.status}`);
  const html = await res.text();
  const mdMatch = html.match(/<div class="wiki-page-content">([\s\S]*?)<\/div>/);
  const content = mdMatch ? mdMatch[1].replace(/<[^>]+>/g, "").trim() : "";
  return { content: content.slice(0, 10000), source: "reddit-html" };
}

// ─── Alternative providers: PullPush ──────────────────

/**
 * PullPush — free historical Reddit archive.
 * Best for: global search across all subreddits, deleted/old content, comment search.
 * Caveat: link_id lookups for recent posts return empty (freshness lag).
 */
export async function pullpushSearch(
  query: string,
  opts: { subreddit?: string; size?: number; sort?: "asc" | "desc"; sortType?: "score" | "created_utc"; after?: string; before?: string } = {},
) {
  const { subreddit, size = 25, sort = "desc", sortType = "score", after, before } = opts;
  const params = new URLSearchParams({ q: query, size: String(Math.min(size, 100)), sort, sort_type: sortType });
  if (subreddit) params.set("subreddit", subreddit);
  if (after) params.set("after", after);
  if (before) params.set("before", before);

  const res = await fetchWithUA(`https://api.pullpush.io/reddit/search/submission/?${params}`, { timeoutMs: 30000 });
  if (!res.ok) throw new Error(`PullPush HTTP ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as any;
  return { posts: (data.data || []).map(parsePullpush), provider: "pullpush" as const };
}

export async function pullpushComments(
  query: string,
  opts: { subreddit?: string; size?: number; sort?: "asc" | "desc"; sortType?: "score" | "created_utc" } = {},
) {
  const { subreddit, size = 25, sort = "desc", sortType = "score" } = opts;
  const params = new URLSearchParams({ q: query, size: String(Math.min(size, 100)), sort, sort_type: sortType });
  if (subreddit) params.set("subreddit", subreddit);

  const res = await fetchWithUA(`https://api.pullpush.io/reddit/search/comment/?${params}`, { timeoutMs: 30000 });
  if (!res.ok) throw new Error(`PullPush HTTP ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as any;
  return { comments: (data.data || []).map(parsePullpushComment), provider: "pullpush" as const };
}

/**
 * Arctic Shift — historical archive with full selftext.
 * Requires --sub or --author. API param names differ between endpoints.
 */
export async function arcticShiftSearch(
  query: string,
  opts: { subreddit?: string; author?: string; limit?: number; sort?: "asc" | "desc"; after?: string; before?: string } = {},
) {
  const { subreddit, author, limit = 25, sort = "desc", after, before } = opts;
  if (!subreddit && !author) throw new Error("Arctic Shift requires --sub <subreddit> or --author <username>");

  const params = new URLSearchParams({ query, limit: String(Math.min(limit, 100)), sort });
  if (subreddit) params.set("subreddit", subreddit);
  if (author) params.set("author", author);
  if (after) params.set("after", after);
  if (before) params.set("before", before);

  const res = await fetchWithUA(`https://arctic-shift.photon-reddit.com/api/posts/search?${params}`, { timeoutMs: 25000 });
  if (!res.ok) throw new Error(`Arctic Shift HTTP ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as any;
  if (data.error) throw new Error(`Arctic Shift: ${data.error}`);
  return { posts: (data.data || []).map(parseArcticShift), provider: "arctic-shift" as const };
}

export async function arcticShiftComments(
  query: string,
  opts: { subreddit?: string; author?: string; limit?: number; sort?: "asc" | "desc" } = {},
) {
  const { subreddit, author, limit = 25, sort = "desc" } = opts;
  if (!subreddit && !author) throw new Error("Arctic Shift requires --sub <subreddit> or --author <username>");

  // Arctic Shift's comments endpoint uses `body=` for the search term (not `query`).
  const params = new URLSearchParams({ body: query, limit: String(Math.min(limit, 100)), sort });
  if (subreddit) params.set("subreddit", subreddit);
  if (author) params.set("author", author);

  const res = await fetchWithUA(`https://arctic-shift.photon-reddit.com/api/comments/search?${params}`, { timeoutMs: 25000 });
  if (!res.ok) throw new Error(`Arctic Shift HTTP ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as any;
  if (data.error) throw new Error(`Arctic Shift: ${data.error}`);
  return { comments: (data.data || []).map(parseArcticShiftComment), provider: "arctic-shift" as const };
}

// ─── Provider parsers (PullPush / Arctic Shift) ───────

function parsePullpush(d: any) {
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    subreddit: d.subreddit,
    score: d.score || 0,
    upvoteRatio: d.upvote_ratio || 0,
    numComments: d.num_comments || 0,
    created: new Date((d.created_utc || 0) * 1000).toISOString(),
    url: d.url,
    permalink: d.permalink ? `https://reddit.com${d.permalink}` : `https://reddit.com/r/${d.subreddit}/comments/${d.id}`,
    selftext: d.selftext?.slice(0, 2000) || "",
    isSelf: d.is_self,
    isNsfw: d.over_18,
    flair: d.link_flair_text,
    domain: d.domain,
    thumbnail: null,
    awards: 0,
    crosspostCount: 0,
    stickied: false,
  };
}

function parsePullpushComment(d: any) {
  return {
    id: d.id,
    author: d.author,
    body: d.body?.slice(0, 2000) || "",
    score: d.score || 0,
    created: new Date((d.created_utc || 0) * 1000).toISOString(),
    permalink: d.permalink ? `https://reddit.com${d.permalink}` : null,
    isOp: false,
    awards: 0,
    controversiality: d.controversiality || 0,
    depth: 0,
    edited: d.edited ? true : false,
    subreddit: d.subreddit,
  };
}

function parseArcticShift(d: any) {
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    subreddit: d.subreddit,
    score: d.score || 0,
    upvoteRatio: d.upvote_ratio || 0,
    numComments: d.num_comments || 0,
    created: new Date((d.created_utc || 0) * 1000).toISOString(),
    url: d.url,
    permalink: d.permalink ? `https://reddit.com${d.permalink}` : `https://reddit.com/r/${d.subreddit}/comments/${d.id}`,
    selftext: d.selftext?.slice(0, 2000) || "",
    isSelf: d.is_self,
    isNsfw: d.over_18,
    flair: d.link_flair_text,
    domain: d.domain,
    thumbnail: null,
    awards: 0,
    crosspostCount: 0,
    stickied: false,
  };
}

function parseArcticShiftComment(d: any) {
  return {
    id: d.id,
    author: d.author,
    body: d.body?.slice(0, 2000) || "",
    score: d.score || 0,
    created: new Date((d.created_utc || 0) * 1000).toISOString(),
    permalink: d.permalink ? `https://reddit.com${d.permalink}` : null,
    isOp: false,
    awards: 0,
    controversiality: d.controversiality || 0,
    depth: 0,
    edited: d.edited ? true : false,
    subreddit: d.subreddit,
  };
}