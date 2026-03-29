#!/usr/bin/env bash
# mirofish.sh — CLI for MiroFish multi-agent swarm intelligence simulation engine
# Base URL: http://10.0.0.100:5001 (no auth required)

set -euo pipefail

BASE_URL="${MIROFISH_URL:-http://10.0.0.100:5001}"

# Locate jq
if command -v jq &>/dev/null; then
  JQ="jq"
elif [ -x "/root/.openclaw/utilities/jq" ]; then
  JQ="/root/.openclaw/utilities/jq"
elif [ -x "/usr/local/bin/jq" ]; then
  JQ="/usr/local/bin/jq"
else
  echo "ERROR: jq not found" >&2
  exit 1
fi

# Detect agent mode (non-TTY stdout)
if [ -t 1 ]; then
  AGENT_MODE=false
else
  AGENT_MODE=true
fi

# Output helpers
agent_out() {
  local cmd="$1" ok="$2" result="$3"
  echo "{\"ok\":${ok},\"command\":\"${cmd}\",\"result\":${result},\"next_actions\":[]}"
}

pretty() {
  echo "$1" | $JQ .
}

# HTTP helpers
get() {
  curl -sf "${BASE_URL}${1}"
}

post_json() {
  curl -sf -X POST -H "Content-Type: application/json" -d "$2" "${BASE_URL}${1}"
}

delete_req() {
  curl -sf -X DELETE "${BASE_URL}${1}"
}

# ─── Commands ────────────────────────────────────────────────────────────────

cmd_health() {
  local res
  res=$(get /health)
  if $AGENT_MODE; then
    agent_out "health" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_projects() {
  local limit=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --limit) limit="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  local res
  res=$(get /api/graph/project/list)
  if [ -n "$limit" ]; then
    res=$(echo "$res" | $JQ ".[0:${limit}]" 2>/dev/null || echo "$res")
  fi
  if $AGENT_MODE; then
    agent_out "projects" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_project() {
  local id="${1:?project id required}"
  local res
  res=$(get "/api/graph/project/${id}")
  if $AGENT_MODE; then
    agent_out "project" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_project_delete() {
  local id="${1:?project id required}"
  local res
  res=$(delete_req "/api/graph/project/${id}")
  if $AGENT_MODE; then
    agent_out "project-delete" "true" "${res:-{}}"
  else
    echo "Deleted project ${id}"
    [ -n "$res" ] && pretty "$res" || true
  fi
}

cmd_upload() {
  local file="${1:?file path required}"; shift
  local name="" requirement="" context=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --name)        name="$2";        shift 2 ;;
      --requirement) requirement="$2"; shift 2 ;;
      --context)     context="$2";     shift 2 ;;
      *) shift ;;
    esac
  done
  [ -z "$name" ]        && { echo "ERROR: --name required" >&2; exit 1; }
  [ -z "$requirement" ] && { echo "ERROR: --requirement required" >&2; exit 1; }
  [ -f "$file" ]        || { echo "ERROR: file not found: $file" >&2; exit 1; }

  local args=(-sf -X POST)
  args+=(-F "files[]=@${file}")
  args+=(-F "project_name=${name}")
  args+=(-F "simulation_requirement=${requirement}")
  [ -n "$context" ] && args+=(-F "additional_context=${context}")

  local res
  res=$(curl "${args[@]}" "${BASE_URL}/api/graph/ontology/generate")
  if $AGENT_MODE; then
    agent_out "upload" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_build() {
  local project_id="${1:?project_id required}"
  local graph_name="${2:-${project_id}-graph}"
  local body
  body=$(printf '{"project_id":"%s","graph_name":"%s","force":false}' "$project_id" "$graph_name")
  local res
  res=$(post_json /api/graph/build "$body")
  if $AGENT_MODE; then
    agent_out "build" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_task() {
  local id="${1:?task_id required}"
  local res
  res=$(get "/api/graph/task/${id}")
  if $AGENT_MODE; then
    agent_out "task" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_tasks() {
  local res
  res=$(get /api/graph/tasks)
  if $AGENT_MODE; then
    agent_out "tasks" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_entities() {
  local graph_id="${1:?graph_id required}"
  local res
  res=$(get "/api/simulation/entities/${graph_id}")
  if $AGENT_MODE; then
    agent_out "entities" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_entity() {
  local graph_id="${1:?graph_id required}"
  local uuid="${2:?entity uuid required}"
  local res
  res=$(get "/api/simulation/entities/${graph_id}/${uuid}")
  if $AGENT_MODE; then
    agent_out "entity" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_sim_create() {
  local project_id="${1:?project_id required}"
  # graph_id can be passed as second arg or auto-detected from project
  local graph_id="${2:-}"
  if [ -z "$graph_id" ]; then
    local proj
    proj=$(get "/api/graph/project/${project_id}")
    graph_id=$(echo "$proj" | $JQ -r '.graph_id // .graphs[0].id // empty' 2>/dev/null || true)
    [ -z "$graph_id" ] && { echo "ERROR: could not determine graph_id; pass it as second argument" >&2; exit 1; }
  fi
  local body
  body=$(printf '{"project_id":"%s","graph_id":"%s","enable_twitter":true,"enable_reddit":true}' "$project_id" "$graph_id")
  local res
  res=$(post_json /api/simulation/create "$body")
  if $AGENT_MODE; then
    agent_out "sim-create" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_sim_prepare() {
  local simulation_id="${1:?simulation_id required}"
  local body
  body=$(printf '{"simulation_id":"%s","entity_types":[],"use_llm_for_profiles":true,"parallel_profile_count":5}' "$simulation_id")
  local res
  res=$(post_json /api/simulation/prepare "$body")
  if $AGENT_MODE; then
    agent_out "sim-prepare" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_sim_run() {
  local simulation_id="${1:?simulation_id required}"
  local body
  body=$(printf '{"simulation_id":"%s"}' "$simulation_id")
  local res
  res=$(post_json /api/simulation/run "$body")
  if $AGENT_MODE; then
    agent_out "sim-run" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_sim_status() {
  local simulation_id="${1:?simulation_id required}"
  local body
  body=$(printf '{"simulation_id":"%s"}' "$simulation_id")
  local res
  res=$(post_json /api/simulation/run/status "$body")
  if $AGENT_MODE; then
    agent_out "sim-status" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_interview() {
  local sim_id="${1:?sim_id required}"
  local agent_id="${2:?agent_id required}"
  local prompt="${3:?prompt required}"
  local body
  body=$(printf '{"simulation_id":"%s","agent_id":"%s","prompt":%s}' "$sim_id" "$agent_id" "$($JQ -n --arg p "$prompt" '$p')")
  local res
  res=$(post_json /api/simulation/interview "$body")
  if $AGENT_MODE; then
    agent_out "interview" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_report() {
  local simulation_id="${1:?simulation_id required}"
  local body
  body=$(printf '{"simulation_id":"%s","force_regenerate":false}' "$simulation_id")
  local res
  res=$(post_json /api/report/generate "$body")
  if $AGENT_MODE; then
    agent_out "report" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_report_status() {
  local simulation_id="${1:?simulation_id required}"
  local body
  body=$(printf '{"simulation_id":"%s"}' "$simulation_id")
  local res
  res=$(post_json /api/report/generate/status "$body")
  if $AGENT_MODE; then
    agent_out "report-status" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_sim_stop() {
  local simulation_id="${1:?simulation_id required}"
  local body
  body=$(printf '{"simulation_id":"%s"}' "$simulation_id")
  local res
  res=$(post_json /api/simulation/stop "$body")
  if $AGENT_MODE; then
    agent_out "sim-stop" "true" "${res:-{}}"
  else
    echo "Stopped simulation ${simulation_id}"
    [ -n "$res" ] && pretty "$res" || true
  fi
}

cmd_graph_nodes() {
  local graph_id="${1:-}"
  local res
  if [ -n "$graph_id" ]; then
    res=$(get "/api/graph/nodes?graph_id=${graph_id}")
  else
    res=$(get "/api/graph/nodes")
  fi
  if $AGENT_MODE; then
    agent_out "graph-nodes" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_sim_list() {
  local res
  res=$(get /api/simulation/list)
  if $AGENT_MODE; then
    agent_out "sim-list" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_sim_get() {
  local simulation_id="${1:?simulation_id required}"
  local res
  res=$(get "/api/simulation/${simulation_id}")
  if $AGENT_MODE; then
    agent_out "sim-get" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_report_list() {
  local res
  res=$(get /api/report/list)
  if $AGENT_MODE; then
    agent_out "report-list" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_report_get() {
  local simulation_id="${1:?simulation_id required}"
  local res
  res=$(get "/api/report/${simulation_id}")
  if $AGENT_MODE; then
    agent_out "report-get" "true" "$res"
  else
    pretty "$res"
  fi
}

cmd_report_chat() {
  local simulation_id="${1:?simulation_id required}"
  local message="${2:?message required}"
  local body
  body=$(printf '{"simulation_id":"%s","message":%s}' "$simulation_id" "$($JQ -n --arg m "$message" '$m')")
  local res
  res=$(post_json /api/report/chat "$body")
  if $AGENT_MODE; then
    agent_out "report-chat" "true" "$res"
  else
    pretty "$res"
  fi
}

usage() {
  cat <<EOF
mirofish — MiroFish swarm intelligence simulation CLI

COMMANDS:
  health                                          Health check
  projects [--limit N]                            List all projects
  project <id>                                    Get project details
  project-delete <id>                             Delete project
  upload <file> --name "..." --requirement "..."  Upload seed + generate ontology
         [--context "..."]
  build <project_id> [graph_name]                 Build knowledge graph
  task <task_id>                                  Check task status
  tasks                                           List all tasks
  entities <graph_id>                             List entities
  entity <graph_id> <uuid>                        Entity detail
  sim-create <project_id> [graph_id]              Create simulation
  sim-prepare <simulation_id>                     Prepare simulation
  sim-run <simulation_id>                         Run simulation
  sim-status <simulation_id>                      Check simulation status
  interview <sim_id> <agent_id> "<prompt>"        Interview an agent
  report <simulation_id>                          Generate prediction report
  report-status <simulation_id>                   Check report generation status
  report-chat <simulation_id> "<message>"         Chat with ReportAgent

BASE URL: ${BASE_URL}
EOF
}

# ─── Dispatch ─────────────────────────────────────────────────────────────────

CMD="${1:-}"
shift || true

case "$CMD" in
  health)          cmd_health "$@" ;;
  projects)        cmd_projects "$@" ;;
  project)         cmd_project "$@" ;;
  project-delete)  cmd_project_delete "$@" ;;
  upload)          cmd_upload "$@" ;;
  build)           cmd_build "$@" ;;
  task)            cmd_task "$@" ;;
  tasks)           cmd_tasks "$@" ;;
  entities)        cmd_entities "$@" ;;
  entity)          cmd_entity "$@" ;;
  sim-create)      cmd_sim_create "$@" ;;
  sim-prepare)     cmd_sim_prepare "$@" ;;
  sim-run)         cmd_sim_run "$@" ;;
  sim-status)      cmd_sim_status "$@" ;;
  sim-stop)        cmd_sim_stop "$@" ;;
  graph-nodes)     cmd_graph_nodes "$@" ;;
  sim-list)        cmd_sim_list "$@" ;;
  sim-get)         cmd_sim_get "$@" ;;
  report-list)     cmd_report_list "$@" ;;
  report-get)      cmd_report_get "$@" ;;
  interview)       cmd_interview "$@" ;;
  report)          cmd_report "$@" ;;
  report-status)   cmd_report_status "$@" ;;
  report-chat)     cmd_report_chat "$@" ;;
  ""|-h|--help|help) usage ;;
  *) echo "Unknown command: $CMD" >&2; usage; exit 1 ;;
esac
