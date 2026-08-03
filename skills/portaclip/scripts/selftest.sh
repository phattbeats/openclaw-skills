#!/usr/bin/env bash
# portaclip selftest — verifies the behaviours SKILL.md claims, against a live board.
#
#   bash scripts/selftest.sh          # read-only checks + create/teardown tree
#   bash scripts/selftest.sh --read-only
#
# Creates issues titled [portaclip-selftest] under an existing goal, asserts, then
# deletes them leaves-first. Everything it makes, it removes. Run after a board
# upgrade: a failure here means SKILL.md is stale, not that your task is broken.

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
source scripts/pc.sh || exit 1

PASS=0; FAIL=0; READONLY=0
[ "${1:-}" = "--read-only" ] && READONLY=1

ok()   { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %s — %s\n' "$1" "${2:-}"; }
is()   { [ "$2" = "$3" ] && ok "$1" || bad "$1" "expected $3, got $2"; }

echo "== reachability =="
is "health ok"            "$(pc_get /api/health | pc_field status)" "ok"
is "board scope reaches companies"  "$(pc_code /api/companies)" "200"
is "board key refused on agents/me" "$(pc_code /api/agents/me)" "401"
[ -n "$AKEY" ] && is "agent scope reaches agents/me" "$(pc_code /api/agents/me GET agent)" "200"

echo "== spec + reference =="
pc_get /api/openapi.json > /tmp/pc_spec.json
SPEC_N=$(python3 -c 'import json;print(len(json.load(open("/tmp/pc_spec.json"))["paths"]))')
MISS=$(python3 -c '
import json,sys
spec=json.load(open("/tmp/pc_spec.json"))["paths"]
ref=open("references/routes.md").read()
print(sum(1 for p in spec if f"`{p}`" not in ref))')
echo "  spec paths: $SPEC_N"
is "routes.md covers every path" "$MISS" "0"
[ "$MISS" != "0" ] && echo "     → regenerate: python3 scripts/gen_routes.py /tmp/pc_spec.json > references/routes.md"

echo "== cost + monitoring routes =="
is "bare /costs is absent"     "$(pc_code /api/companies/$CID/costs)" "404"
is "/costs/summary lives"      "$(pc_code /api/companies/$CID/costs/summary)" "200"
is "/dashboard lives"          "$(pc_code /api/companies/$CID/dashboard)" "200"
is "/artifacts lives"          "$(pc_code /api/companies/$CID/artifacts)" "200"
pc_get "/api/companies/$CID/costs/quota-windows" | python3 -c '
import json, sys
for prov in json.load(sys.stdin):
    name = prov.get("provider")
    if not prov.get("ok"):
        print("  note", name + ":", prov.get("error"))
        continue
    for w in prov.get("windows", []):
        pct = w.get("usedPercent")
        if pct is not None:
            print("  quota", name, w.get("label") + ":", str(pct) + "%")
'

echo "== labels =="
is "3-digit hex rejected" "$(pc_post "/api/companies/$CID/labels" '{"name":"pc-selftest","color":"#fff"}' \
   | python3 -c 'import json,sys;print(json.load(sys.stdin).get("error",""))')" "Validation error"

[ "$READONLY" = "1" ] && { echo; echo "read-only: $PASS passed, $FAIL failed"; exit $((FAIL>0)); }

echo "== issue tree (creates and deletes) =="
GOAL=$(pc_get "/api/companies/$CID/goals" | python3 -c 'import json,sys;d=json.load(sys.stdin);g=d if isinstance(d,list) else d.get("goals",[]);print(g[0]["id"] if g else "")')
[ -z "$GOAL" ] && { echo "  no goal found; skipping write tests"; exit $((FAIL>0)); }

EPIC=$(pc_post "/api/companies/$CID/issues" "$(printf '{"title":"[portaclip-selftest] epic","status":"todo","priority":"low","goalId":"%s","description":"Automated selftest. Deleted automatically."}' "$GOAL")" | pc_field id)
[ -z "$EPIC" ] && { bad "create epic" "no id returned"; exit 1; }
ok "create epic (goal-linked)"
trap 'pc_delete_tree "$EPIC" 2>/dev/null' EXIT

C1=$(pc_post "/api/issues/$EPIC/children" '{"title":"[portaclip-selftest] step 1","status":"todo","priority":"low","description":"selftest"}' | pc_field id)
C2=$(pc_post "/api/issues/$EPIC/children" "$(printf '{"title":"[portaclip-selftest] step 2","status":"todo","priority":"low","description":"selftest","blockedByIssueIds":["%s"],"acceptanceCriteria":["array not string"]}' "$C1")" | pc_field id)
[ -n "$C1" ] && ok "create child" || bad "create child"
[ -n "$C2" ] && ok "create blocked child with acceptanceCriteria array" || bad "create blocked child"

is "acceptanceCriteria rejects a bare string" \
  "$(pc_post "/api/issues/$EPIC/children" '{"title":"[portaclip-selftest] bad","status":"todo","description":"x","acceptanceCriteria":"string"}' \
   | python3 -c 'import json,sys;print(json.load(sys.stdin).get("error",""))')" "Validation error"

is "blockedBy reads back" \
  "$(pc_get "/api/issues/$C2" | python3 -c 'import json,sys;d=json.load(sys.stdin);d=d.get("issue",d);print(len(d.get("blockedBy") or []))')" "1"

pc_get "/api/issues/$C2/diagnostics/blockers" | python3 -c '
import json,sys
d=json.load(sys.stdin); r=d.get("readiness") or {}
print(("  PASS" if r.get("isDependencyReady") is False else "  FAIL"),"blockers diagnostic reports readiness")
print("   ",d.get("diagnosis"))'

LAB=$(pc_get "/api/companies/$CID/labels" | python3 -c 'import json,sys;l=json.load(sys.stdin);print(l[0]["id"] if l else "")')
if [ -n "$LAB" ]; then
  is "PATCH echoes labels" \
    "$(pc_patch "/api/issues/$EPIC" "$(printf '{"labelIds":["%s"]}' "$LAB")" | python3 -c 'import json,sys;print(len(json.load(sys.stdin).get("labels") or []))')" "1"
  is "labelIds is full-replace" \
    "$(pc_patch "/api/issues/$EPIC" '{"labelIds":[]}' | python3 -c 'import json,sys;print(len(json.load(sys.stdin).get("labels") or []))')" "0"
fi

is "parent delete with children is a 500" "$(pc_code "/api/issues/$EPIC" DELETE)" "500"

echo "== teardown =="
pc_delete_tree "$EPIC"; trap - EXIT
is "tree removed" "$(pc_code "/api/issues/$EPIC")" "404"

echo
echo "$PASS passed, $FAIL failed"
exit $((FAIL>0))
