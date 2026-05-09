---
name: openclaw-setup
description: End-to-end OpenClaw client setup and agent deployment. Use when onboarding a new client, configuring a new agent, connecting external services, or deploying OpenClaw to production. Triggers on: "set up OpenClaw", "new client onboarding", "deploy agent", "configure OpenClaw", "agent setup", "external service integration", "production deployment", "client configuration". Works for any client or industry vertical. Platform-agnostic, bring-your-own-keys (BYOK).
compatibility: Requires openclaw CLI, curl/http client, JSON tooling, and access to the OpenClaw gateway being configured.
---

# OpenClaw Setup — Client Onboarding & Agent Deployment Skill

Deploy OpenClaw for a new client from scratch. Covers: discovering what's needed, configuring the agent stack, wiring external services, and launching production-ready.

**This skill is platform-agnostic and BYOK** — it works with any LLM provider, any external service, any vertical. The client owns their API keys and data.

---

## Workflow Overview

```
Client Discovery → Agent Design → External Services → Configuration → Launch → Handoff
```

---

## Phase 1: Client Discovery

Before touching any config, answer these questions. Some come from the client directly, some from research.

### The 12 Questions (Answer Every One)

1. **What does the client do?** (industry, size, revenue model)
2. **What is the client's primary goal?** (more clients, lower costs, better output, all of the above)
3. **Who are the end users?** (the client alone, their staff, their customers)
4. **What tools does the client already use?** (CRMs, ERPs, scheduling, communication)
5. **What does the client hate doing?** (the work that never gets done because it's tedious)
6. **What does the client do manually that should be automated?** (intake, follow-up, reporting, research)
7. **What is the client's budget?** (one-time setup, monthly recurring, or both)
8. **What is the client's timeline?** (need it yesterday, exploring, have a launch date)
9. **Who is the technical contact?** (someone who will be the gatekeeper for integrations)
10. **Who is the business decision maker?** (who signs off on proposals)
11. **Are there compliance requirements?** (HIPAA, SOC2, GDPR, bar association rules, industry regulations)
12. **What data is sensitive?** (PII, financial, medical, legal case data)

### Discovery Methods (In Order)

- **Existing vault research**: Check `/vault-cache/Rogue State/PHATT-TECH/Customers/<client-name>/` first. Don't redo work already done.
- **Client interview**: Direct conversation or questionnaire. Prefer async (email/Signal) for complex answers.
- **Website research**: Crawl the client's site. Understand their services, positioning, client-facing language.
- **Competitor research**: What do similar businesses in their space already automate? What's working?

### Output: Client Brief

Write a brief to `/tmp/client-brief.md`:

```markdown
# [Client Name] — Discovery Brief

## Business
- Industry: [industry]
- Size: [solo / small firm / mid-market / enterprise]
- Primary revenue model: [product / service / subscription / retainer]

## Goals
- [Goal 1]
- [Goal 2]

## Users
- [End user 1]: does [X]
- [End user 2]: does [Y]

## Existing Tools
- [Tool]: [what it does, what's missing]
- [Tool]: [what it does, what's missing]

## Pain Points (Automate These First)
1. [Pain point]: [what it costs the client today]
2. [Pain point]: [what it costs the client today]

## Budget
- Setup: $[amount]
- Monthly: $[amount]

## Timeline
- [Date or condition]

## Technical Contact
- [Name]: [email/Signal]

## Business Decision Maker
- [Name]: [email/Signal]

## Compliance
- [Requirement]: [implication for OpenClaw setup]

## Sensitive Data
- [Data type]: [storage requirement]

## Agent Recommendations
1. [Agent name] — [what it does]
2. [Agent name] — [what it does]
3. [Agent name] — [what it does]
```

---

## Phase 2: Agent Architecture Design

Design the agent stack before writing any config.

### Agent Design Principles

1. **One agent per domain**: Don't pile everything into one agent. Separate research from operations from communication.
2. **Human in the loop for client-facing**: Every agent action that touches the client or their customers gets a human approval gate.
3. **Native tools first**: Use built-in OpenClaw tools before adding external MCPs.
4. **Stateless where possible**: Agents that maintain state between calls are harder to debug and cost more.
5. **Trigger-based, not polling**: Agents respond to events (webhook, cron, user message) rather than constantly running.

### Standard Agent Types

| Agent | Purpose | Triggers | Tools |
|-------|---------|----------|-------|
| **Research Agent** | Deep-dive research, multi-source, structured output | On-demand, cron | web_search, crawl4ai, browser, reddit, twitter |
| **Operations Agent** | Routine tasks, data processing, CRM/ERP ops | Webhook, cron | REST APIs, file ops, scripting |
| **Communication Agent** | Drafting, email, Signal, approvals | User message, workflow trigger | Signal, email (ms-graph/resend), drafting |
| **Monitoring Agent** | Health checks, alerting, log review | Cron | glances-api, healthcheck, alerting |
| **Marketing Agent** | Content, social, SEO, lead gen | Cron, webhook | Platform APIs (Meta, Later, GBP), web tools |

### How Many Agents Does This Client Need?

- **1-2 agents**: Single-person business, clear primary use case (e.g., research + drafting)
- **3-4 agents**: Small team, multiple workflows (e.g., research + intake + billing + marketing)
- **5+ agents**: Complex operation, multiple client types, high volume

Start conservative. Clients can add agents. Removing agents is harder.

### Agent Interaction Design

Define how agents talk to each other:

```
User → Communication Agent → [approves] → Operations Agent → External Service
                                      ↓
                               Research Agent → [feeds context] → Operations Agent
```

Design the handoffs explicitly. Every handoff is a potential failure point — minimize them.

### Output: Agent Architecture Document

Write to `/tmp/agent-architecture.md`:

```markdown
# [Client Name] — Agent Architecture

## Agents

### Agent 1: [Name]
- **Role**: [one sentence]
- **Model**: [model to use, cost tier]
- **Trigger**: [what starts this agent's work]
- **Tools**: [list of tools, local scripts, MCPs]
- **Approval gate**: [yes/no, and what/who approves]
- **Input from**: [what other agents or systems feed this one]
- **Output to**: [what this agent produces]

### Agent 2: [Name]
[...]

## Agent Interaction Map

[Describe how agents hand off work]

## External Service Connections

| Service | Agent | What it does | Auth method |
|---------|-------|-------------|-------------|
| [Service] | [Agent] | [action] | [API key / OAuth / other] |

## Security Model

- [How are API keys stored?]
- [Who has access to what?]
- [Data residency / compliance notes]
```

---

## Phase 3: External Service Integration

For each external service the agents will use:

### Integration Checklist

For each service, document:

1. **Service name and purpose**
2. **Which agent uses it**
3. **What operations are needed** (read, write, or both)
4. **Authentication method** (API key, OAuth 2.0, username/password, service account)
5. **Rate limits and quotas**
6. **Where credentials are stored** (OpenClaw config, env vars, secret manager)
7. **Fallback behavior** (what if the service is unavailable)

### Credential Management Pattern

```bash
# Store in OpenClaw config.yaml under agents.[name].env
# Or use OpenClaw's secret management
# NEVER hardcode keys in agent workspace files

environment:
  SERVICE_API_KEY: "pcp_xxxx"  # Reference to secret, not raw value
  SERVICE_BASE_URL: "https://api.service.com"
```

### MCP Server vs Direct API

| Approach | When to use | Tradeoff |
|---------|-------------|---------|
| **MCP Server** | Multiple agents need the same service; standardized tool interface | More setup; better for complex services |
| **Direct API call** | Only one agent uses the service; simple operations | Less overhead; agent-specific code |
| **Webhook** | Service pushes data to OpenClaw (events, not queries) | Real-time; requires the service support webhooks |

### Output: Integration Spec

Write to `/tmp/integrations.md`:

```markdown
# [Client Name] — External Integrations

## [Service Name]

- **Purpose**: [what this service does for the client]
- **Agent owner**: [which agent uses it]
- **Operations**: [read/write/list/etc.]
- **Auth**: [method]
- **Rate limits**: [any known limits]
- **Credentials location**: [where stored]
- **Fallback**: [what happens if unavailable]
- **MCP or direct**: [which approach]
```

---

## Phase 4: Configuration

### OpenClaw Agent Config Template

For each agent, create a workspace config:

```yaml
# agents/[agent-name]/AGENTS.md
# Workspace-level config for this agent

model: litellm/minimax/MiniMax-M2.7    # Or client's preferred model
default_model: litellm/minimax/MiniMax-M2.7

channels:
  signal:          # If Signal integration needed
    enabled: true
  webhook:         # For incoming webhooks
    enabled: true

agents:
  [agent-name]:
    trigger:
      cron: "0 9 * * 1"    # Weekly Monday 9am, example
      # OR webhook: "/api/agents/[agent-name]/trigger"
    tools:
      - web_search
      - browser
      - file_read
    env:
      EXTERNAL_SERVICE_KEY: "ref://secret/service-key"
```

### Workspace File Structure

```
agents/[agent-name]/
├── AGENTS.md          # Agent configuration and identity
├── SOUL.md            # Agent persona and tone
├── USER.md            # User context (client info)
├── MEMORY.md          # Long-term memory / completed work log
├── TOOLS.md           # Tool configs and credentials refs
├── HEARTBEAT.md       # Periodic tasks (keep empty unless needed)
└── workspace/         # Agent's working files
```

### Critical Config Rules

1. **Never commit secrets**: Use `ref://secret/` references or environment variables, never raw API keys in config files.
2. **Model selection**: Match model to task complexity. Research = capable model (M2.7 or better). Simple tasks = cheaper model.
3. **Channel config**: Enable only channels the client actually uses. Don't configure Slack if they use Signal.
4. **Heartbeat**: Keep HEARTBEAT.md empty unless the agent genuinely needs periodic background tasks.

---

## Phase 5: Launch Checklist

Before going live with any client:

### Pre-Launch Verification (Run Every Item)

- [ ] **Vault created**: Client vault at `PHATT-TECH/Customers/<client-name>/`
- [ ] **Client brief saved**: `/tmp/client-brief.md` → vault
- [ ] **Agent architecture saved**: `/tmp/agent-architecture.md` → vault
- [ ] **Integration spec saved**: `/tmp/integrations.md` → vault
- [ ] **Credentials configured**: All API keys in OpenClaw config, not hardcoded
- [ ] **Signal channel tested**: Agent can send and receive from client's Signal
- [ ] **Webhook endpoints tested**: If used, verify endpoints receive and process correctly
- [ ] **Approval workflow tested**: From trigger → agent → approval → action end-to-end
- [ ] **Error handling verified**: Agent handles API failures gracefully (retry logic, alerting)
- [ ] **First-run manual override**: Someone monitors the first 24-48 hours closely
- [ ] **Client briefed**: Client knows what to expect, how to approve, how to escalate issues
- [ ] **Runbook delivered**: Client-facing doc explaining what the agent does, how to interact

### Client Runbook Template

```markdown
# [Client Name] — OpenClaw Runbook

## What We Built

[One paragraph: what the system does for the client]

## Your Agents

### [Agent Name]
- **What it does**: [description]
- **When it runs**: [frequency or trigger]
- **What you approve**: [what shows up in your Signal/email for approval]
- **How to request work**: [how to ask the agent to do something new]

## How to Work With the System

1. **Approvals**: You'll receive Signal messages when an action needs your approval. Reply with `APPROVE`, `EDIT`, or `SKIP`.
2. **New requests**: Message [Signal channel] with [what format]. The agent will acknowledge and get back to you.
3. **Issues**: If something looks wrong, message [PHATT TECH contact].

## What to Expect

- [Day 1]: [what happens]
- [Week 1]: [what happens]
- [Ongoing]: [what happens]

## What We Monitor

PHATT TECH monitors: [list what Van Dam/Ledger monitors]

## Emergency Contacts

- Technical issues: [contact]
- Billing questions: [contact]
```

---

## Phase 6: Post-Launch

### First Week

- Monitor agent outputs closely
- Log every deviation from expected behavior
- Collect client feedback on what feels right vs wrong
- Adjust prompts, tools, and workflows based on real usage

### First Month

- Generate a usage report: what agents did, what was approved vs skipped
- Identify: what got automated that the client didn't expect? What is still manual that should be?
- Review: are the right approval thresholds set? Too many approvals = friction. Too few = risk.
- Cost review: are the models being used efficiently? Any expensive calls that could be cheaper?

### Ongoing

- Monthly: check that integrations still work (API keys valid, permissions correct)
- Quarterly: client check-in — is the system still serving their goals?
- On-demand: when the client's business changes, the agent stack may need to change too

---

## Common Patterns

### Pattern: Approval Gate

```
Agent detects work to do
  ↓
Drafts content / action
  ↓
Sends to client via Signal: [preview] → APPROVE / EDIT / SKIP
  ↓
Client approves (one tap)
  ↓
Agent executes
```

### Pattern: Event-Triggered Pipeline

```
External event (webhook from CRM, form submit, etc.)
  ↓
OpenClaw receives event
  ↓
Agent processes and routes
  ↓
Appropriate action taken (update CRM, draft email, alert staff)
```

### Pattern: Scheduled Report

```
Cron trigger (e.g., every Monday 8am)
  ↓
Agent pulls data from integrations
  ↓
Compiles report
  ↓
Sends to client via Signal / email
```

### Pattern: Research Sprint

```
User requests research on [topic]
  ↓
Research agent runs 20-50 searches across multiple sources
  ↓
Agent cross-references and synthesizes
  ↓
Structured brief delivered to user
  ↓
User approves / requests follow-up
```

---

## Skills Reference

For common vertical use cases, check these existing skills before building custom:

| Need | Skill |
|------|-------|
| Legal research | Build custom (no good existing skill) |
| CRM operations (HubSpot, Clio) | ms-graph, phatt-claw |
| Social media | Build custom (Meta/Later APIs) |
| Financial data | mercury-bank, litellm |
| Meeting transcription | youtube-watcher, fathom |
| Cloud infrastructure | cloudflare, glances-api |
| Container management | phatt-claw, plex |

---

## File Output Conventions

All planning documents go to `/tmp/` first, then to the client vault:

```bash
# Write to vault
vault-write "PHATT-TECH/Customers/<client>/[document-name].md" --file /tmp/[document-name].md
```

All agent workspace files go in:
```
/root/.openclaw/workspace/agents/<agent-name>/
```

Never write directly to vault-cache — always use `vault-write`.
