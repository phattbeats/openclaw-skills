#!/usr/bin/env bash
# portaclip helper — source this, don't execute it:
#   source scripts/pc.sh
#
# Loads .env, exposes $U / $CID / $BKEY / $AKEY, and wraps curl so the auth
# header shape is defined once. Requires bash (arrays); in sh, repeat -H inline.

pc_load() {
  local f
  for f in ./.env ~/.config/portaclip/.env ./.paperclip.env "$(dirname "${BASH_SOURCE[0]}")/../.env"; do
    if [ -f "$f" ]; then set -a; . "$f"; set +a; return 0; fi
  done
  echo "pc: no .env found" >&2; return 1
}
pc_load || return 1 2>/dev/null || exit 1

U="${PAPERCLIP_API_URL%/}"
CID="$PAPERCLIP_COMPANY_ID"
BKEY="$PAPERCLIP_BOARD_KEY"
AKEY="$PAPERCLIP_API_KEY"
: "${U:?PAPERCLIP_API_URL not set}"

# Scope selection. Board and agent keys are disjoint: /api/agents/me* needs the
# agent key, /api/companies and /api/board-api-keys need the board key.
pc_key() { case "${1:-board}" in agent) printf %s "${AKEY:-$BKEY}";; *) printf %s "${BKEY:-$AKEY}";; esac; }

# pc <method> <path> [json] [--agent] [extra curl args...]
pc() {
  local method="$1" path="$2"; shift 2
  local body="" scope=board
  if [ $# -gt 0 ] && [ "${1:0:1}" = "{" ]; then body="$1"; shift; fi
  if [ "${1:-}" = "--agent" ]; then scope=agent; shift; fi
  local args=(-sS -X "$method" -H "Authorization: Bearer $(pc_key "$scope")")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  curl "${args[@]}" "$@" "$U$path"
}

pc_get()    { pc GET    "$1" "${@:2}"; }
pc_post()   { pc POST   "$1" "${2:-}" "${@:3}"; }
pc_patch()  { pc PATCH  "$1" "${2:-}" "${@:3}"; }
pc_delete() { pc DELETE "$1" "${@:2}"; }

# HTTP status only — for probing scope or existence.
pc_code() { local m="${2:-GET}"; curl -sS -o /dev/null -w '%{http_code}' \
  -X "$m" -H "Authorization: Bearer $(pc_key "${3:-board}")" "$U$1"; }

# Attachment upload. Run id is required for agent keys; harmless for board keys.
pc_attach() {
  local iid="$1" file="$2" runid="${3:-}"
  local args=(-sS -H "Authorization: Bearer $(pc_key board)")
  [ -n "$runid" ] && args+=(-H "X-Paperclip-Run-Id: $runid")
  curl "${args[@]}" -F "file=@$file" -F "originalFilename=$(basename "$file")" \
    "$U/api/companies/$CID/issues/$iid/attachments"
}

# Extract a top-level field from a JSON stream: ... | pc_field id
pc_field() { python3 -c 'import json,sys;d=json.load(sys.stdin);d=d.get("issue",d) if isinstance(d,dict) else d;print(d.get(sys.argv[1],""))' "$1"; }

# Delete an issue subtree leaves-first (a parent with children returns 500).
pc_delete_tree() {
  local root="$1" ids
  ids=$(pc_get "/api/issues/$root/diagnostics/subtree" | python3 -c '
import json,sys
d=json.load(sys.stdin)
out=[n.get("issue",n).get("id") for n in d.get("nodes",[])]
print("\n".join(x for x in out if x and x!=sys.argv[1]))' "$root")
  local id
  for id in $ids; do pc_delete "/api/issues/$id" >/dev/null; done
  pc_delete "/api/issues/$root" >/dev/null
}
