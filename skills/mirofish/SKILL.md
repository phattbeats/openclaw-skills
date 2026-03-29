---
name: mirofish
description: "Interact with MiroFish, a multi-agent swarm intelligence simulation engine. Use when asked to run a MiroFish simulation, build a knowledge graph, generate ontologies, simulate agents, interview agents, get prediction reports, or interact with the MiroFish API. Trigger phrases: MiroFish, swarm simulation, agent simulation, knowledge graph simulation, MiroFish report, interview agent, sim-create, sim-run, swarm intelligence."
---

# MiroFish Skill

MiroFish is a multi-agent swarm intelligence simulation engine.

- **Base URL:** `http://10.0.0.100:5001`
- **Auth:** None required
- **CLI:** `bash /root/.openclaw/workspace/skills/mirofish/scripts/mirofish.sh <command>`

> Simulations can take **several minutes** to complete. Always poll status after
> triggering long-running operations (build, prepare, run, report).

---

## CLI Reference

```bash
SCRIPT="bash /root/.openclaw/workspace/skills/mirofish/scripts/mirofish.sh"
```

### Health

```bash
$SCRIPT health
# → {"status":"ok","service":"MiroFish Backend"}
```

---

### Projects

```bash
# List all projects
$SCRIPT projects

# List with limit
$SCRIPT projects --limit 5

# Get project details
$SCRIPT project <project_id>

# Delete a project
$SCRIPT project-delete <project_id>
```

---

### Upload & Ontology Generation

Upload one or more seed files and generate an ontology. This creates a project.

```bash
$SCRIPT upload /path/to/seed.pdf \
  --name "Market Analysis 2025" \
  --requirement "Simulate how retail investors react to Fed rate decisions" \
  --context "Focus on Reddit and Twitter sentiment"
```

Returns a `project_id` and a background `task_id`. Poll with `task <task_id>`.

---

### Graph Build

Build a knowledge graph from a project. Returns a `task_id`.

```bash
$SCRIPT build <project_id>
# optionally specify a graph name:
$SCRIPT build <project_id> "my-graph-name"
```

---

### Tasks

```bash
# Check a single task
$SCRIPT task <task_id>

# List all tasks
$SCRIPT tasks
```

Task statuses: `pending`, `running`, `completed`, `failed`

---

### Nodes

```bash
# Current default graph nodes
$SCRIPT graph-nodes

# Specific graph
$SCRIPT graph-nodes <graph_id>
```

---

### Entities

```bash
# All entities in a graph
$SCRIPT entities <graph_id>

# Single entity detail
$SCRIPT entity <graph_id> <entity_uuid>
```

Filter by type via curl:
```bash
curl -s "http://10.0.0.100:5001/api/simulation/entities/<graph_id>/by-type/<type>"
```

---

### Simulation Management

```bash
# List all simulations
$SCRIPT sim-list

# Get simulation details
$SCRIPT sim-get <simulation_id>

# Create simulation (auto-detects graph_id from project; or pass explicitly)
$SCRIPT sim-create <project_id>
$SCRIPT sim-create <project_id> <graph_id>

# Prepare simulation environment (takes several minutes)
$SCRIPT sim-prepare <simulation_id>

# Check preparation / run status
$SCRIPT sim-status <simulation_id>

# Start the simulation run
$SCRIPT sim-run <simulation_id>

# Stop a running simulation
$SCRIPT sim-stop <simulation_id>
```

---

### Interview an Agent

After a simulation has run, you can interview individual agents:

```bash
$SCRIPT interview <simulation_id> <agent_id> "What do you think about the Fed's decision?"
```

---

### Reports

```bash
# List all reports
$SCRIPT report-list

# Get a specific report
$SCRIPT report-get <simulation_id>

# Generate a prediction report (async, poll status after)
$SCRIPT report <simulation_id>

# Check report generation status
$SCRIPT report-status <simulation_id>

# Chat with the ReportAgent
$SCRIPT report-chat <simulation_id> "Summarize the key findings"
```

---

## Full Simulation Workflow

This is the complete pipeline from raw data to actionable predictions.

### Step 1 — Upload seed file & generate ontology

```bash
$SCRIPT upload research_paper.pdf \
  --name "Fed Policy Sim" \
  --requirement "How will retail investors react to a 50bp rate hike?" \
  --context "Social media focus: Reddit r/investing, Twitter finance accounts"
# → returns project_id + task_id
```

### Step 2 — Wait for ontology task to complete

```bash
$SCRIPT task <task_id>
# poll until status == "completed"
```

### Step 3 — Build knowledge graph

```bash
$SCRIPT build <project_id>
# → returns task_id
$SCRIPT task <task_id>
# poll until completed → note graph_id from result
```

### Step 4 — Create simulation

```bash
$SCRIPT sim-create <project_id> <graph_id>
# → returns simulation_id
```

### Step 5 — Prepare simulation (agent profiling, ~5–15 min)

```bash
$SCRIPT sim-prepare <simulation_id>
# → returns task_id
$SCRIPT sim-status <simulation_id>
# poll until preparation complete
```

### Step 6 — Run simulation

```bash
$SCRIPT sim-run <simulation_id>
$SCRIPT sim-status <simulation_id>
# poll until run complete
```

### Step 7 — Generate prediction report

```bash
$SCRIPT report <simulation_id>
$SCRIPT report-status <simulation_id>
# poll until report generated
```

### Step 8 — Interact with results

```bash
# Chat with the ReportAgent for analysis
$SCRIPT report-chat <simulation_id> "What are the top 3 predicted outcomes?"

# Interview a specific agent
$SCRIPT entities <graph_id>   # find agent UUIDs
$SCRIPT interview <simulation_id> <agent_uuid> "How did you weigh the rate hike impact?"
```

---

## Agent Mode

When called from a non-TTY context (agent/pipeline mode), all commands output
JSON envelopes:

```json
{
  "ok": true,
  "command": "sim-status",
  "result": { ... },
  "next_actions": []
}
```

---

## Environment

| Variable | Default | Description |
|---|---|---|
| `MIROFISH_URL` | `http://10.0.0.100:5001` | Override base URL |
