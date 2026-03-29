#!/bin/bash
# Persist/read state for Glances checks
# Usage: glances_state.sh read|write [path] [data]
action=$1
path=${2:-/root/.openclaw/workspace/skills/glances-api/glances-state.json}
case "$action" in
  read)  [ -f "$path" ] && cat "$path" || echo '{}' ;;
  write) echo "$3" > "$path" ;;
  *)     echo '{"error":"usage: glances_state.sh read|write [path] [data]"}'; exit 1 ;;
esac
