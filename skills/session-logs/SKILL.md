
---
name: session-logs  
description: Search, summarize, and analyze your own session logs (older/parent conversations) using `jq`, `rg`, and safe streaming techniques. Handles very large `.jsonl` files efficiently.  
metadata: { "openclaw": { "emoji": "📜", "requires": { "bins": \["jq", "rg", "du", "ls", "head", "tail", "awk", "sort", "grep"] } } }
---

# session-logs

Search your complete conversation history stored in session JSONL files. Use this when a user references older/parent conversations or asks what was said before.

## Trigger

Use this skill when the user asks about prior chats, parent conversations, or historical context that isn't in memory files.

## Location

Session logs are stored at:

```
/root/.openclaw/agents/<agentId>/sessions/
```

* Replace `<agentId>` with the value from your system prompt "Runtime" line.
* Index file: `sessions.json` (maps external chat IDs to session IDs)
* Session files: `<session-id>.jsonl` (JSON Lines — one object per line)
* Deleted sessions: `<session-id>.deleted.<timestamp>.jsonl` (automatically excluded below)

## Core Structure Reminder

Each line in a `.jsonl` is a JSON object with:

* `type`: "session" (first line only) or "message" or "toolResult" etc.
* `timestamp`
* `message.role`: "user" / "assistant" / "toolResult" / "system"
* `message.content\[]`: array of `{type: "text", text: "..."}` or thinking/toolCall
* `message.usage.cost.total`: present on many assistant responses

## Essential Commands

### 1\. List all active sessions (date, size, ID) — newest first

```bash
AGENT\_DIR="/root/.openclaw/agents/<agentId>/sessions"
for f in "$AGENT\_DIR"/\*.jsonl; do
  \[\[ -f "$f" \&\& "$f" != \*.deleted.\* ]] || continue
  start\_date=$(jq -r '.\[0].timestamp // empty' "$f" | cut -dT -f1)
  size=$(du -h "$f" | cut -f1)
  id=$(basename "$f" .jsonl)
  printf "%s  %8s  %s\\n" "$start\_date" "$size" "$id"
done | sort -r
```

### 2\. List 10 most recent sessions

```bash
AGENT\_DIR="/root/.openclaw/agents/<agentId>/sessions"
ls -lt "$AGENT\_DIR"/\*.jsonl "$AGENT\_DIR"/\*.deleted.\* 2>/dev/null | head -11
```

### 3\. List 10 largest sessions (danger zone for memory)

```bash
AGENT\_DIR="/root/.openclaw/agents/<agentId>/sessions"
du -h "$AGENT\_DIR"/\*.jsonl "$AGENT\_DIR"/\*.deleted.\* 2>/dev/null | sort -hr | head -10
```

### 4\. Clean, readable transcript of a session (user + assistant text only)

```bash
SESSION\_FILE="/root/.openclaw/agents/<agentId>/sessions/<session-id>.jsonl"
jq -r '
  select(.type == "message") |
  . as $msg |
  .message.content // \[] |
  .\[] |
  select(.type == "text") |
  "\\($msg.message.role | ascii\_upcase): \\(.text)"
' "$SESSION\_FILE" |
grep -E '^(USER|ASSISTANT):'
```

> This skips thinking, tool calls, tool results, and system messages for maximum readability.

### 5\. Search for a keyword/phrase across ALL sessions (fast first-pass with rg)

```bash
AGENT\_DIR="/root/.openclaw/agents/<agentId>/sessions"
rg -l "your keyword or phrase" "$AGENT\_DIR"/\*.jsonl | grep -v '\\.deleted\\.'
```

Follow up with precise extraction on matching files:

```bash
jq -r '
  select(.type == "message") |
  select(any(.message.content\[]; .type == "text" and (.text | test("keyword"; "i")))) |
  "\[\\(.timestamp)] \\(.message.role): " + (.message.content\[] | select(.type=="text").text)
' matching-session.jsonl
```

### 6\. Session summary (dates, counts, cost, top tools)

```bash
SESSION\_FILE="/root/.openclaw/agents/<agentId>/sessions/<session-id>.jsonl"
jq -r '
  {
    start: .\[0].timestamp,
    end: .\[-1].timestamp,
    messages: length,
    user: \[.\[] | select(.type=="message" and .message.role=="user")] | length,
    assistant: \[.\[] | select(.type=="message" and .message.role=="assistant")] | length,
    total\_cost: \[.\[ ] | .message.usage.cost.total // 0] | add,
    top\_tools: \[.\[ ] | select(.type=="message") | .message.content\[]? | select(.type=="toolCall") | .name] | unique | .\[0:5]
  }
' "$SESSION\_FILE"
```

### 7\. Daily cost summary across all sessions

```bash
AGENT\_DIR="/root/.openclaw/agents/<agentId>/sessions"
for f in "$AGENT\_DIR"/\*.jsonl; do
  \[\[ -f "$f" \&\& "$f" != \*.deleted.\* ]] || continue
  date=$(jq -r '.\[0].timestamp | split("T")\[0]' "$f")
  cost=$(jq '\[.\[ ] | .message.usage.cost.total // 0] | add' "$f")
  echo "$date $cost"
done | awk '{a\[$1]+=$2} END {for(d in a) printf "%s $%.4f\\n", d, a\[d]}' | sort -r
```

### 8\. Tool usage breakdown for a session

```bash
SESSION\_FILE="/root/.openclaw/agents/<agentId>/sessions/<session-id>.jsonl"
jq -r '
  select(.type=="message") |
  .message.content\[]? |
  select(.type=="toolCall") |
  .name
' "$SESSION\_FILE" | sort | uniq -c | sort -nr
```

### 9\. Sample first 500 lines of a huge session (safe preview)

```bash
head -500 "/root/.openclaw/agents/<agentId>/sessions/<session-id>.jsonl" | jq -r '
  select(.type == "message") |
  . as $msg |
  .message.content // \[] |
  .\[] |
  select(.type == "text") |
  "\\($msg.message.role | ascii\_upcase): \\(.text)"
' | grep -E '^(USER|ASSISTANT):'
```

## Tips for Huge Sessions

* Never use `jq --slurp` on files >50 MB — it loads everything into memory.
* Use `rg` first for existence checks, then `jq` on specific files.
* For multi-GB sessions (rare but possible), consider splitting or archiving old ones manually.
* The provided example session (converted to JSON array for upload) would be ~10–20 MB as `.jsonl` — typical for very long threads.
