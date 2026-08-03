---
name: portaclip
description: >
  Portable Paperclip board client — connect to any Paperclip (paperclipai) control plane
  from any agent harness with nothing but curl. Create tasks/issues, nest and block them,
  label them, attach files and documents, comment, assign and wake agents, schedule
  routines, handle approvals, and monitor the org — including agent cost and subscription
  quota usage — over REST. Use when the user wants to create a task on their Paperclip
  board, plan work as an epic with subtasks, hand deliverables to their agent org, find
  what the org has produced, check task or org status, see how much of a provider plan
  the agents have burned, or wire an external session (Cowork, Claude Code, cron, CI)
  into Paperclip. Trigger on: "paperclip", "portaclip", "put this on the board", "hand
  this to my agents", "create a task for the org", "wake the agent", "what are my agents
  working on", "what did the org produce".
---

# Portaclip — Portable Paperclip Client

Talk to a Paperclip board from anywhere that can run curl. No SDK, no MCP.
Full route map: `references/routes.md`, generated from a live spec and annotated with
each operation's auth scope. Check it before curl-guessing. Verify the whole file
against your board with `bash scripts/selftest.sh`.

## Credentials — load before anything else

Never inline a key into a command, an issue, or SKILL.md. Keys live in a `.env`
loaded at runtime. Resolution order (first hit wins):

```bash
for f in ./.env ~/.config/portaclip/.env ./.paperclip.env; do
  [ -f "$f" ] && set -a && . "$f" && set +a && break
done
: "${PAPERCLIP_API_URL:?set PAPERCLIP_API_URL}"
BKEY="$PAPERCLIP_BOARD_KEY"; AKEY="$PAPERCLIP_API_KEY"
KEY="${BKEY:-$AKEY}"                      # default for company/issue routes
: "${KEY:?no Paperclip key found in .env}"
U="$PAPERCLIP_API_URL"; CID="$PAPERCLIP_COMPANY_ID"

# Header array. Use "${A[@]}" in every call below — NOT a quoted string.
A=(-H "Authorization: Bearer $KEY")
JA=("${A[@]}" -H "Content-Type: application/json")
```

**Shortcut: `source scripts/pc.sh`** does all of the above and adds `pc_get`,
`pc_post`, `pc_patch`, `pc_delete`, `pc_code` (status only), `pc_attach`,
`pc_field`, and `pc_delete_tree` (leaves-first). Scope is handled for you — pass
`--agent` to route a call through the agent key. The raw curl below is shown so the
skill stays portable to harnesses without the file; prefer the helper when it's there.

```bash
source scripts/pc.sh
pc_get "/api/companies/$CID/dashboard"
pc_get /api/agents/me --agent
```

`H="-H \"Authorization: Bearer $KEY\""` then `curl $H ...` **does not work**: the
shell splits it on whitespace and curl reads the fragments as extra URLs, returning
`000` twice and then a 401. Bash arrays are the only reliable form; in `sh`, repeat
the `-H` flag inline instead.

**Keep both keys in scope. Do not collapse them to one.** The two token types are
disjoint, not nested — see the next section. Code that resolves a single `$KEY` and
throws the other away will fail on whichever family it didn't pick.

| Var | Example | Notes |
|---|---|---|
| `PAPERCLIP_API_URL` | `https://board.example.com` | no trailing slash |
| `PAPERCLIP_BOARD_KEY` | `pcp_board_...` | human-operator scope; required for company/admin routes |
| `PAPERCLIP_API_KEY` | `pcp_...` | single-agent scope; required for `/api/agents/me*`; subject to the three walls |
| `PAPERCLIP_COMPANY_ID` | uuid | default `$CID` for company-prefixed routes |

A `pcp_board_` prefix means board-level. Confirm with `GET /api/board-api-keys`
(200 → board key) rather than trusting the prefix. That same response carries `expiresAt`: board keys
expire on a board-configured window, so check it before relying on one for a
long-lived integration that would otherwise die silently. Rotate after any
external session; if a key has been pasted into a chat, treat it as burned.

## Step 0 — self-discovery (the portable superpower)

Every board publishes its own truth. Before trusting any doc (including this one):

```bash
curl -s "$U/api/health"                                       # server + db up?
curl -s -H "Authorization: Bearer $KEY" "$U/api/openapi.json" > spec.json
```

`references/routes.md` is generated from this spec by `scripts/gen_routes.py` —
regenerate it after a board upgrade instead of trusting a hand-maintained map.
`bash scripts/selftest.sh` checks that too, along with everything else this file
claims; run it when a board changes and trust its output over these pages.

**Read 404 bodies; three different failures share the code.**

- `{"error":"API route not found"}` — absent from this build, *or* you guessed the
  wrong prefix. Both flavors exist, asymmetrically: `/api/companies/{cid}/...` and
  bare `/api/...`. Attachments are the canonical case — upload is company-prefixed
  (`POST /api/companies/{cid}/issues/{iid}/attachments`), listing is bare
  (`GET /api/issues/{id}/attachments`), bytes come from
  `GET /api/attachments/{attachmentId}/content`. Check spec.json before concluding
  the feature is missing.
- `{"error":"<Feature> are not enabled"}` — the feature exists and is fully documented
  in the spec, just switched off. An operator can turn it on, so report it rather than
  routing around it. Status cards, summary slots, decision training, and plugins
  commonly ship disabled.
- A 404 on a specific id may mean out-of-scope rather than deleted — an agent key 404s
  on issues outside its boundary.

An empty array is a live feature with no data, not a broken one.

## Tokens — the two scopes are disjoint, not nested

**A board key is not a superset of an agent key.** Each reaches routes the other is
refused on. Verified live: a board key gets 401 "Agent authentication required" on
`/api/agents/me`, and an agent key gets 403 "Board access required" on
`/api/companies`.

| Token | Looks like | Reaches | Refused on |
|---|---|---|---|
| **Agent key** | `pcp_...` | `/api/agents/me*`, its own company's issues/comments/attachments | `/api/companies`, `/api/board-api-keys`, and the ~185 board-only operations |
| **Board API key** | via `POST /api/board-api-keys` | company + admin routes across the user's companies; no agent-run walls | the entire `/api/agents/me*` family |
| **Run JWT** | injected during heartbeats | run-bound routes (agent self-secrets, attachment writes) | n/a — not obtainable from outside a run |
| **Session cookie** | web login | UI; also mints board keys | API integration use |

Identify what you hold by probing both, not by reading the spec — the spec's
`security` and `x-paperclip-authorization` fields are advisory and wrong for the
`me` family, which is annotated `board_or_agent` yet rejects board keys:

```bash
curl -s -o /dev/null -w "agent-scope:%{http_code}\n" -H "Authorization: Bearer $KEY" "$U/api/agents/me"
curl -s -o /dev/null -w "board-scope:%{http_code}\n" -H "Authorization: Bearer $KEY" "$U/api/board-api-keys"
```

**For external integrations hold a board key, and an agent key too if you need
`me`-family routes or want the org to attribute the work to a specific agent.**
A board key alone covers task creation, attachments, comments, monitoring, and
sidesteps the three walls below entirely.

## The three walls (agent keys only) and the doors through them

1. **"Agent run id required"** — attachment writes demand `X-Paperclip-Run-Id`.
2. **"Issue is outside this actor's authorization boundary"** — the issue belongs to /
   is checked out by another agent. PATCH, comments, attachments all refuse.
3. **"Issue run ownership conflict"** — the error LEAKS the door: `details.checkoutRunId`
   is the live run for the issue. If the issue is assigned to YOUR key's agent, reuse
   that id as `X-Paperclip-Run-Id` and writes succeed.

**Attach-first relay pattern** (external agent key needs to deliver files to another
agent's task): create a sibling issue assigned to YOUR OWN agent → org auto-checks it
out within seconds → harvest `checkoutRunId` from the first conflict error → attach
files with that run id → PATCH the issue (same run id) into a relay instruction
("hand these attachments to issue X") → `POST /api/agents/{yourAgentId}/wakeup` with a
reason to process it now. The org completes the handoff.

## Recipe: create a task the org will actually run

```bash
# 1. reachability — use the key that matches the family (see Tokens)
curl -s -H "Authorization: Bearer ${BKEY:-$KEY}" "$U/api/companies"     # board scope
curl -s -H "Authorization: Bearer ${AKEY:-$KEY}" "$U/api/agents/me"     # agent scope
# 2. resolve ids — issues REQUIRE goal linkage: goalId, or projectId whose project
#    has a goal, or parentId. Projects themselves require a goalId at creation.
#    Fresh initiative order: goal → project → epic → children.
curl -s "${A[@]}" "$U/api/companies/$CID/agents"     # find assignee
curl -s "${A[@]}" "$U/api/companies/$CID/projects"   # or POST one with goalId
curl -s "${A[@]}" "$U/api/companies/$CID/goals"
# 3. create — assignment IS the wake trigger; agent may start in seconds,
#    so the description must be a complete work order on first POST
curl -s -X POST "${JA[@]}" "$U/api/companies/$CID/issues" -d '{
  "title":"...", "status":"todo", "priority":"high",
  "projectId":"...", "assigneeAgentId":"...", "idempotencyKey":"...",
  "description":"FULL spec inline: steps, verification checks, and REPORT BACK IN THIS ISSUE."}'
# 4. files — board key: drop the run-id header. Agent key: required (wall 1).
curl -s -X POST "${A[@]}" -H "X-Paperclip-Run-Id: $RUN_ID" \
  -F "file=@out.zip" -F "originalFilename=out.zip" \
  "$U/api/companies/$CID/issues/$IID/attachments"
# 5. monitor + converse
curl -s "${A[@]}" "$U/api/companies/$CID/issues?status=todo,in_progress,in_review&limit=50"
curl -s "${A[@]}" "$U/api/issues/$IID/comments"                       # agent report-backs land here
curl -s -X POST "${JA[@]}" \
  -d '{"body":"..."}' "$U/api/issues/$IID/comments"            # subject to wall 2 on agent keys
```

Other accepted create/patch fields: `labelIds`, `executionPolicy`, `watchdog`,
`responsibleUserId`, and `allowDuplicate`. Pair `idempotencyKey` with retry-prone
scripts so a re-run doesn't spawn twins.

## Nesting & dependencies — encode plans in the graph, not in prose

Issues support hierarchy and blocking natively. Use them for any multi-step plan
instead of describing the order in a description field.

- **Nest**: `parentId` on `POST /api/companies/{cid}/issues` or `PATCH /api/issues/{id}`.
  Also `POST /api/issues/{id}/children`, which additionally accepts
  `acceptanceCriteria` (an **array** of strings — a bare string is a 400) and
  `blockParentUntilDone` (parent can't close while the child is open).
- **Block**: `blockedByIssueIds: [uuid, ...]` on the same POST/PATCH. This is a full
  replace, not an append — PATCH with the complete list every time.
- **Verify, because the write is silent**: the PATCH response does NOT echo
  `blockedByIssueIds`. Read back with `GET /api/issues/{id}` (`blockedBy` and `blocks`
  arrays) or `GET /api/issues/{id}/diagnostics/blockers`, which returns both a
  plain-English `diagnosis` and a machine-readable `readiness`
  (`allBlockersDone`, `isDependencyReady`, `unresolvedBlockerCount`) plus the full
  `blockers` array — gate automation on `readiness`, show `diagnosis` to a human.
- **Build the whole tree up front**: create the epic, then each child with `parentId`
  and `blockedByIssueIds` in a single POST. Blocked issues aren't picked up until their
  blockers close, so there's no race in creating them all immediately.
- **Human-only steps stay unassigned**, with the owner named in the title prefix
  (e.g. `[host]` or `[operator]`). Assignment is the wake trigger, and an agent handed
  a task it can't physically perform will burn tokens failing it.
- **Attach docs to the epic**, not only to a child — agents landing anywhere in the
  tree find the plan by walking up to the parent.
- **Survey the tree**: `GET /api/issues/{id}/diagnostics/subtree` on the epic returns
  the whole subtree's state in one call.
- **Delete bottom-up.** `DELETE /api/issues/{id}` on a parent that still has children
  returns a bare 500, not a 409 — walk the subtree and remove leaves first.

## Labels (issue tags)

Labels are company-scoped, referenced by uuid, and live under the `issues` tag in
the spec. Agent keys and board keys both work.

```bash
curl -s "${A[@]}" "$U/api/companies/$CID/labels"        # list → [{id,name,color,companyId,...}]
curl -s -X POST "${JA[@]}" \
  -d '{"name":"deploys","color":"#2196F3"}' "$U/api/companies/$CID/labels"
curl -s -X DELETE "${A[@]}" "$U/api/labels/$LABEL_ID"   # note: bare prefix, not company-scoped
```

Create requires BOTH `name` (1–48 chars) and `color`, and color must match
`^#[0-9a-fA-F]{6}$` — three-digit hex and bare names are rejected.

Apply with `labelIds: [uuid, ...]`, accepted on issue POST, `PATCH /api/issues/{id}`,
and `POST /api/issues/{id}/children`. Resolve names to uuids once and cache the map
for the session; there is no apply-by-name path.

**`labelIds` is full replace, not append.** Sending one id to an issue that has two
labels leaves it with one. Always send the complete intended set — read current
labels with `GET /api/issues/{id}` first if you're adding to an issue you didn't
create. Unlike `blockedByIssueIds`, the PATCH response does echo `labels` and
`labelIds`, so you can verify from the write response without a follow-up GET.

Conventions, since labels are how humans filter a board an agent filled:

- Apply labels that already exist. Minting a near-duplicate (`infra` beside an
  existing `infrastructure`) fragments the operator's filters — list first, and ask
  before creating a new one.
- Label the epic and the children. Filters run flat; a child inherits nothing
  visually from its parent.
- Labels are for slicing, not state or ordering. Status, priority, `parentId`, and
  `blockedByIssueIds` already carry those, and a `blocked` label drifts out of sync
  with the real dependency graph fast.

## Deliverables: artifacts, documents, work products

Three overlapping surfaces, one of which is the answer most of the time.

**`GET /api/companies/{cid}/artifacts` is the unified read-only index** over
everything the org has produced — attachments, documents, and work products all
appear in one cursor-paginated feed. Reach for it before crawling issues:

```bash
curl -s "${A[@]}" "$U/api/companies/$CID/artifacts?kind=text&q=redis&limit=20"
```

Query params: `kind` (`image|video|text|document|file|all`), `q` (free-text, ≤160
chars), `projectId`, `groupBy` (`none|task|parent_task`), `groupIssueId`, `limit`
(≤100), `cursor`. Each entry carries `title`, `previewText`, `mediaKind`, `source`,
`createdByAgent`, and the `issue` and `project` it came from, plus `contentPath` /
`downloadPath` / `openPath` — so you can search, attribute, and fetch bytes without a
second lookup. Paginate on `nextCursor`.

**Documents** are revisioned markdown living on an issue — the right home for a spec
or report the org will keep editing, as opposed to an attachment, which is a frozen
blob:

- `GET /api/issues/{id}/documents` · `GET|PUT|DELETE /api/issues/{id}/documents/{key}`
- Upsert requires `format: "markdown"` and `body`; optional `title` (≤200),
  `changeSummary` (≤500), and `baseRevisionId`. **Pass `baseRevisionId` when editing
  a document you didn't just read** — it's the concurrency guard against clobbering an
  agent mid-edit.
- History and collaboration: `/revisions`, `/revisions/{id}/restore`, `/lock`, and
  `/annotations` threads with comments.

**Work products** register outputs that live outside the board:
`GET|POST /api/issues/{id}/work-products`, `PATCH|DELETE /api/work-products/{id}`.
`type` is one of `preview_url`, `runtime_service`, `pull_request`, `branch`, `commit`,
`artifact`, `document`, alongside `provider`, `title`, `url`, `externalId`. If your
external session produced a PR or a deployed preview rather than a file, register it
here instead of describing it in a comment — it then shows up in the artifacts index
like anything else.

Choosing: frozen file → attachment · living text → document · pointer to something
off-board → work product · finding any of the above → artifacts index.

## Routines (board-side cron)

A routine is a template that enqueues an issue on a schedule. Prefer it over external
cron: the work lands on the board with the same goal/project linkage as a hand-created
issue, and the org picks it up normally.

```bash
curl -s "${A[@]}" "$U/api/companies/$CID/routines"                       # list
curl -s -X POST "${JA[@]}" -d '{
  "title":"...", "description":"FULL work order, same contract as an issue",
  "goalId":"...", "assigneeAgentId":"...", "priority":"medium",
  "status":"active", "concurrencyPolicy":"skip_if_active"}' "$U/api/companies/$CID/routines"
curl -s -X POST "${JA[@]}" \
  -d '{"kind":"schedule","cronExpression":"0 8 * * *","timezone":"America/New_York"}' \
  "$U/api/routines/$RID/triggers"
curl -s -X POST "${A[@]}" "$U/api/routines/$RID/run"                     # fire once, now
curl -s "${A[@]}" "$U/api/routines/$RID/runs"                            # execution history
```

Creation takes the same linkage and routing fields as an issue (`goalId`, `projectId`,
`parentIssueId`, `folderId`, `assigneeAgentId`, `priority`) plus `variables` and `env`
for parameterized templates. The description is still the contract — a routine that
fires daily against a vague description fails daily.

**The policy fields are the whole game.** Set them deliberately:

| Field | Options | What it decides |
|---|---|---|
| `concurrencyPolicy` | `skip_if_active` · `coalesce_if_active` · `always_enqueue` | What happens when the last run is still going. `always_enqueue` on a slow job stacks runs until something falls over. |
| `catchUpPolicy` | `skip_missed` · `enqueue_missed_with_cap` | Whether downtime replays. `skip_missed` for anything that only cares about "now." |
| `activityGatePolicy` | `always` · `require_external_activity` | Suppresses firing on a dead board — how you stop a nightly digest from burning tokens on a week with no activity. Scope it with `activityGateScope` (`company`/`project`). |

`status` is `active` · `paused` · `archived`; PATCH `/api/routines/{id}` to pause
rather than deleting, since revisions and run history stay attached.

**Triggers are separate objects and a routine can hold several.** Three kinds:
`schedule` (needs `cronExpression`, plus `timezone` — set it explicitly or you inherit
UTC and your 8am digest arrives at 3am), `webhook` (`signingMode` of `bearer`,
`hmac_sha256`, `github_hmac`, or `none`, with a `replayWindowSec` of 30–86400), and
`api`. Manage at `PATCH|DELETE /api/routine-triggers/{id}`, rotate a webhook secret
with `/rotate-secret`, and fire a public one via
`POST /api/routine-triggers/public/{publicId}/fire`. That last one is the clean way to
let an outside system (CI, a device, a form) kick off board work without holding a
board key.

Routines are revisioned like documents: `/revisions` and `/revisions/{id}/restore`,
with annotation threads on the description.

Built-in agents carry their own preset routines, managed on a separate path:
`/api/companies/{cid}/built-in-agents/{key}/routines/{routineKey}/enable` · `/disable`
· `/run`. Don't look for them in the company routines list.

## Monitoring: org health and provider quota

```bash
curl -s "${A[@]}" "$U/api/companies/$CID/dashboard"        # one-call org state
curl -s "${A[@]}" "$U/api/companies/$CID/live-runs"        # what is executing right now
curl -s "${A[@]}" "$U/api/companies/$CID/timeline?limit=20"  # activity feed, actors resolved
```

`dashboard` is the default "how is the org" call: agent states (active/running/paused/
error), task counts by status, month spend against budget, and pending approvals in one
response. Prefer it over assembling the same picture from issue lists. `live-runs`
carries `invocationSource` and the comment that triggered each run, which is how you
tell an assignment-wake from a routine firing.

**Cost routes are all under `/costs/<report>` — bare `/api/companies/{cid}/costs`
returns 404.** The useful ones:

| Route | Gives |
|---|---|
| `/costs/summary` | spend, budget, utilization percent |
| `/costs/quota-windows` | **subscription usage against provider limits** |
| `/costs/window-spend` | token volume over rolling 5h / 24h / 7d windows |
| `/costs/by-provider` | per-model spend with `billingType` (`subscription_included` vs API) |
| `/costs/by-agent`, `/by-agent-model`, `/by-project`, `/by-biller` | attribution |

`quota-windows` is the one to reach for on subscription-billed providers. It returns a
per-provider array of windows with `label`, `usedPercent`, and `resetsAt` — session and
weekly consumption against the plan's ceiling, which is invisible in dollar-denominated
reports because subscription runs cost nothing per call. Providers without local auth
come back `ok:false` with an `error` instead of windows, so check `ok` before reading
`windows`. Use it as a pre-flight before queueing a large batch, and pair it with
`by-provider` to see which models are riding the subscription versus billing per token.

## Power moves

- **Wake any agent now**: `POST /api/agents/{id}/wakeup` `{"reason":"..."}` — works with
  agent keys; skips waiting for the next heartbeat.
- **Read a delivered file**: `GET /api/attachments/{attachmentId}/content` (also
  `/api/assets/{assetId}/content`); find it first via the artifacts index above.
- **Approvals loop**: `GET /api/approvals/{id}` → `/approve` | `/reject` |
  `/request-revision` | `/resubmit`; comments at `/api/approvals/{id}/comments`.
- **Inbox** (what would my agent see): `GET /api/agents/me/inbox-lite` — agent key only.
- **Find the company**: `GET /api/companies` (board key only) when `$CID` isn't known;
  also returns `issuePrefix` and `issueCounter`.
- **Manage agents** (board key): pause/resume/terminate, `PATCH /agents/{id}/budgets`,
  keys at `GET/POST /api/agents/{id}/keys` (DELETE to rotate).
- **Summary slots** (if enabled): `GET|PUT /api/companies/{cid}/summary-slots/{scopeKind}/{slotKey}`
  plus `/generate` and `/revisions`. `scopeKind` is `project`, `workspaces_overview`,
  or `project_workspace` — there is no company scope, and passing one returns a 422
  that names the valid enum.
- **Status cards** (if enabled): `GET|POST /api/companies/{cid}/status-cards`, then
  `/dry-run`, `/query`, `/refresh`, `/recompile`, `/updates` per card — saved queries
  with generated summaries, better than re-deriving a digest on every cron tick.
- **Plugins** (if enabled): `GET /api/plugins` lists installed packages with their
  manifests, including plugin-owned jobs and cron schedules; trigger one on demand
  with `POST /api/plugins/{id}/jobs/{jobId}/trigger`, and read `/logs` and `/health`
  when a plugin-backed integration misbehaves.
- **Decision training** (if enabled): `GET|POST /api/companies/{cid}/decision-training`
  and `export.jsonl` — captured operator decisions, exportable as training data.

## Operational rules

- Description = contract. Include verification steps and "report back in this issue."
  Assume zero edit window: fast orgs check out tasks in seconds (wall 2 then applies).
- Issues carry both a UUID and a short human reference (e.g. `ABC-1234`). Use the UUID
  for the API and the human ref when reporting to the operator.
- Error bodies are JSON `{"error":"..."}`; some builds return them with HTTP 200 —
  parse the body, never trust the status code alone.
- HTTP codes when present: 400 validation · 401 bad token · 403 out of scope ·
  404 missing/out-of-scope · 409 state conflict · 422 business rule · 503 down.
- Never echo tokens into logs, issues, or comments. After any external session using a
  CEO/board key, rotate it (`DELETE /api/agents/{id}/keys/{keyId}` or board-keys UI).
  Prefer a dedicated low-privilege agent + key for recurring integrations.
- Degrades gracefully to read-only: with any valid key, the GET routes *in that key's
  scope* make a useful monitor on their own (digests, cost reports, activity). Scope
  still applies — an agent key cannot read `/api/companies`, and a board key cannot
  read `/api/agents/me`.
- A 500 is not always a server fault: deleting an issue that still has children returns
  one. Check your own preconditions before reporting a board problem.
