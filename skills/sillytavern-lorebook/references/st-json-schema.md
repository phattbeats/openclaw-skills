# SillyTavern World Info JSON Schema Reference

A World Info book is one JSON object with an `entries` key, itself an object keyed by stringified UID:

```json
{
  "entries": {
    "0": { ...entry fields... },
    "1": { ...entry fields... }
  }
}
```

## Full field list

| Field | Type | Purpose |
|---|---|---|
| `uid` | int | Stable numeric ID. Must match the dict key (as a string) it's stored under. |
| `key` | array[str] | Primary trigger keywords. Any one match (subject to `selective`/case/whole-word settings) activates the entry. |
| `keysecondary` | array[str] | Secondary keywords, only relevant when `selective: true`. |
| `comment` | str | Human-readable label shown in the ST UI. Not used for matching — purely organizational. |
| `content` | str | The actual text inserted into context when the entry fires. This is the entry's payload. |
| `constant` | bool | If true, always active regardless of any keyword match ("blue" entry in the ST UI). Use sparingly — this is the opposite of everything Pass 5 is trying to achieve. |
| `vectorized` | bool | Whether this entry participates in vector/embedding-based retrieval instead of keyword matching, if the book has that enabled. Usually leave `false` unless the user's setup specifically uses it. |
| `selective` | bool | If true, `keysecondary` logic (governed by `selectiveLogic`) is required in addition to a `key` match. |
| `selectiveLogic` | int | `0` = AND_ANY (at least one secondary key must also match), `1` = NOT_ALL, `2` = AND_ALL (all secondary keys must match), `3` = NOT_ANY. |
| `addMemo` | bool | Whether the `comment` is shown as a memo/note in the UI. Cosmetic only. |
| `order` | int | Insertion priority. Higher order wins when the token budget can't fit everything that matched. Not a relevance signal by itself — set this deliberately if you have entries you want prioritized over others when things get tight (e.g. main cast over one-scene walk-ons). |
| `position` | int | Where in the prompt this entry's content gets inserted relative to other context (before/after character description, etc., depending on the client). Usually leave at whatever the rest of the book uses unless the user asks. |
| `disable` | bool | If true, entry is inert regardless of anything else. Useful for staging draft entries without activating them yet. |
| `excludeRecursion` | bool | If true, this entry can **only** be activated by a direct match in the actual chat text — never by recursion from another entry's inserted content. Pair this with any entry that has `probability < 100`, or a recursive re-match can silently re-roll and bypass the throttle. |
| `preventRecursion` | bool | If true, this entry's own inserted content is excluded from the text that gets scanned during recursive passes — meaning it can't cause *other* entries to fire, even if its content happens to mention their keywords. This is the main lever for stopping cascade explosions in a heavily cross-referential cast. |
| `delayUntilRecursion` | bool or int | If set, this entry is only checked during recursive scanning passes, never on the initial direct-text pass. Rare; useful for entries that should genuinely only ever appear as a *consequence* of another entry firing, never on their own. |
| `probability` | int (0-100) | Chance the entry activates even after a keyword match. Use to throttle entries that would otherwise match on nearly every message (see Pass 5). |
| `useProbability` | bool | Whether the probability check applies at all. Must be `true` for `probability < 100` to do anything. |
| `depth` | int | How many prior messages back this entry's keywords get scanned for (entry-level override of the book's global scan depth). |
| `scanDepth`, `caseSensitive`, `matchWholeWords`, `useGroupScoring` | int/bool/null | Per-entry overrides of global matching settings. `null` = inherit the global default. Set `caseSensitive: true` on an entry whose name collides with a common lowercase word (e.g. a character literally named "Button"). |
| `group`, `groupOverride`, `groupWeight` | str/bool/int | For mutually-exclusive entry groups, where only one entry from the group should fire even if several match. Rarely needed for a straightforward character/event book. |
| `automationId` | str | Ties the entry to a ST automation/quick-reply, if the user's setup uses that. Usually empty. |
| `role` | str or null | Advanced — assigns the entry to a specific prompt role in some ST configurations. Leave `null` unless told otherwise. |
| `sticky` | int | Once activated, stays active for this many additional messages even without a fresh keyword match. `0` = no stickiness. |
| `cooldown` | int | After activating, entry cannot activate again for this many messages. `0` = no cooldown. |
| `delay` | int | Entry cannot activate until this many messages into the conversation. `0` = no delay. |
| `triggers` | array | Advanced trigger conditions beyond keyword matching. Usually empty for a character/event book. |
| `displayIndex` | int | UI ordering only, cosmetic. Generally keep in sync with `uid`. |
| `characterFilter` | object | `{"isExclude": bool, "names": [...], "tags": [...]}` — restricts the entry to firing only for/against specific character cards in multi-character setups. Usually `{"isExclude": false, "names": [], "tags": []}` (no restriction) for a single-story lorebook. |

## Safe default template for a new entry

When adding an entry from scratch, start from an already-working entry in the same book (copy its full field dict, don't hand-write from memory) and only change `uid`, `key`, `keysecondary`, `comment`, `content`, and `displayIndex`. This guarantees every field ST expects is present with a sane value, and avoids re-deriving the whole schema by hand each time.

If there's no existing entry to copy from, this is a reasonable minimal default:

```json
{
  "uid": 0,
  "key": [],
  "keysecondary": [],
  "comment": "",
  "content": "",
  "constant": false,
  "vectorized": false,
  "selective": true,
  "selectiveLogic": 0,
  "addMemo": true,
  "order": 100,
  "position": 0,
  "disable": false,
  "excludeRecursion": false,
  "preventRecursion": true,
  "delayUntilRecursion": false,
  "probability": 100,
  "useProbability": true,
  "depth": 4,
  "group": "",
  "groupOverride": false,
  "groupWeight": 100,
  "scanDepth": null,
  "caseSensitive": null,
  "matchWholeWords": null,
  "useGroupScoring": null,
  "automationId": "",
  "role": null,
  "sticky": 0,
  "cooldown": 0,
  "delay": 0,
  "triggers": [],
  "displayIndex": 0,
  "characterFilter": {"isExclude": false, "names": [], "tags": []}
}
```

Note `preventRecursion` defaults to `true` in this template, not ST's own factory default of `false` — that's a deliberate choice for this skill's use case (large, cross-referential character casts), not a claim about what ST ships with. Flip it to `false` explicitly for the small cluster of entries you want cascading together.

## Recursion, worked through

Recursion in SillyTavern happens in passes. Pass one scans the actual chat history for keyword matches across all entries. If recursive scanning is enabled, a second pass then scans the *content of whatever just got activated* in pass one, looking for further keyword matches — so entry A's text mentioning "Grondulf" can activate Grondulf's entry even though the user never typed the name. This can chain for a few passes before ST stops it.

This is powerful and, left unmanaged, chaotic. In a book where most character entries reference several other characters by name (normal for anything with an ensemble cast), leaving every entry's recursion settings at their permissive defaults means a single keyword match can cascade into activating a large fraction of the book on one turn. Two knobs control this:

- Set `preventRecursion: true` on an entry to stop *its own* content from being a source of further cascade. This is the right default for almost everything.
- Set `preventRecursion: false` deliberately on a small, chosen set of entries that are meant to pull each other in — typically an interlinked mystery, a tightly bound group of allies, or similar. This is the "helpful recursion" case: you *want* asking about one piece of it to surface the rest.
- Set `excludeRecursion: true` on an entry if it should never be triggered by recursion at all, only by a direct match in the actual chat text. The main use case is protecting a probability throttle (see Pass 5, point 3): without this, an entry that failed its probability roll on the direct pass can still sneak back in via a recursive re-match and get an unintended second roll.

A useful pattern for a book with a genuinely interconnected subplot: add one small "hub" entry with generic trigger phrases (things like "what's really going on," "is this connected") and `preventRecursion: false`, whose *content* explicitly contains the exact keyword phrases of the entries you want it to pull in. Firing the hub then cascades into the relevant cluster automatically, without needing to stuff those same generic phrases into every individual entry's keyword list.
