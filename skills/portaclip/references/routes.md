# Paperclip route map (generated)

602 operations across 37 groups, generated from a live
`/api/openapi.json` by `scripts/gen_routes.py`. Regenerate after a board
upgrade rather than editing by hand.

`board` = board key or session only. `board_or_agent` = either. `public` = no auth.
Spec auth annotations are advisory and occasionally wrong (the `/api/agents/me`
family is annotated `board_or_agent` but rejects board keys) -- probe to confirm.

## Contents

- [access](#access) (37)
- [activity](#activity) (5)
- [adapters](#adapters) (14)
- [admin](#admin) (5)
- [agents](#agents) (47)
- [approvals](#approvals) (10)
- [assets](#assets) (6)
- [auth](#auth) (4)
- [cloud-upstreams](#cloud-upstreams) (8)
- [companies](#companies) (29)
- [costs](#costs) (20)
- [dashboard](#dashboard) (2)
- [decision-training](#decision-training) (7)
- [environments](#environments) (19)
- [execution-workspaces](#execution-workspaces) (9)
- [folders](#folders) (7)
- [goals](#goals) (5)
- [health](#health) (3)
- [inbox](#inbox) (4)
- [instance](#instance) (8)
- [instance-settings](#instance-settings) (2)
- [issues](#issues) (81)
- [llms](#llms) (3)
- [plugins](#plugins) (31)
- [projects](#projects) (12)
- [resource-memberships](#resource-memberships) (3)
- [routines](#routines) (18)
- [runs](#runs) (11)
- [secrets](#secrets) (31)
- [sidebar](#sidebar) (5)
- [skills](#skills) (47)
- [status-cards](#status-cards) (12)
- [summaries](#summaries) (4)
- [teams](#teams) (6)
- [tool-access](#tool-access) (67)
- [tool-gateway](#tool-gateway) (19)
- [tools](#tools) (1)

## access

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/board-api-keys` | board | List board API keys |
| POST | `/api/board-api-keys` | board | Create a named board API key |
| DELETE | `/api/board-api-keys/{keyId}` | board | Revoke a board API key |
| GET | `/api/board-claim/{token}` | public | Get board claim details by token |
| POST | `/api/board-claim/{token}/claim` | board | Claim a board token |
| POST | `/api/bootstrap/claim` | board | Claim first instance admin from a browser session |
| POST | `/api/cli-auth/challenges` | public | Create a CLI auth challenge |
| GET | `/api/cli-auth/challenges/{id}` | public | Get a CLI auth challenge |
| POST | `/api/cli-auth/challenges/{id}/approve` | board_or_agent | Approve a CLI auth challenge |
| POST | `/api/cli-auth/challenges/{id}/cancel` | public | Cancel a CLI auth challenge |
| GET | `/api/cli-auth/me` | board | Get current CLI auth session |
| POST | `/api/cli-auth/revoke-current` | board_or_agent | Revoke current CLI auth session |
| GET | `/api/companies/{companyId}/invites` | board | List company invites |
| POST | `/api/companies/{companyId}/invites` | board | Create a company invite |
| GET | `/api/companies/{companyId}/join-requests` | board | List company join requests |
| POST | `/api/companies/{companyId}/join-requests/{requestId}/approve` | board | Approve a company join request |
| POST | `/api/companies/{companyId}/join-requests/{requestId}/reject` | board | Reject a company join request |
| GET | `/api/companies/{companyId}/members` | board | List company members |
| PATCH | `/api/companies/{companyId}/members/{memberId}` | board | Update a company member status or role |
| POST | `/api/companies/{companyId}/members/{memberId}/archive` | board | Archive a company member |
| PATCH | `/api/companies/{companyId}/members/{memberId}/permissions` | board | Update explicit company member permissions |
| PATCH | `/api/companies/{companyId}/members/{memberId}/role-and-grants` | board | Update a company member role and explicit grants |
| POST | `/api/companies/{companyId}/openclaw/invite-prompt` | board | Create an OpenClaw invite prompt bundle |
| GET | `/api/companies/{companyId}/user-directory` | board | Get company user directory |
| POST | `/api/invites/{inviteId}/revoke` | board_or_agent | Revoke an invite |
| GET | `/api/invites/{token}` | public | Get an invite by token |
| POST | `/api/invites/{token}/accept` | public | Accept an invite and create or replay a join request |
| GET | `/api/invites/{token}/logo` | public | Get company logo for an invite |
| GET | `/api/invites/{token}/onboarding` | public | Get onboarding data for an invite |
| GET | `/api/invites/{token}/onboarding.txt` | public | Get onboarding instructions as plain text |
| GET | `/api/invites/{token}/skills/index` | public | Get skills index for an invite |
| GET | `/api/invites/{token}/skills/{skillName}` | public | Get a skill by name for an invite |
| GET | `/api/invites/{token}/test-resolution` | public | Test invite token resolution |
| POST | `/api/join-requests/{requestId}/claim-api-key` | public | Claim the initial API key for an approved agent join request |
| GET | `/api/skills/available` | board_or_agent | List available skills |
| GET | `/api/skills/index` | board_or_agent | Get skills index |
| GET | `/api/skills/{skillName}` | board_or_agent | Get a skill by name |

## activity

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/activity` | board_or_agent | List company activity |
| POST | `/api/companies/{companyId}/activity` | board_or_agent | Create an activity entry |
| GET | `/api/heartbeat-runs/{runId}/issues` | board_or_agent | List issues for a heartbeat run |
| GET | `/api/issues/{id}/activity` | board_or_agent | List activity for an issue |
| GET | `/api/issues/{id}/runs` | board_or_agent | List runs for an issue |

## adapters

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/adapters` | board_or_agent | List all adapters |
| POST | `/api/adapters/install` | board_or_agent | Install an adapter |
| DELETE | `/api/adapters/{type}` | board_or_agent | Delete an adapter |
| GET | `/api/adapters/{type}` | board_or_agent | Get adapter registration details |
| PATCH | `/api/adapters/{type}` | board_or_agent | Enable or disable an adapter |
| GET | `/api/adapters/{type}/config-schema` | board_or_agent | Get adapter config schema |
| PATCH | `/api/adapters/{type}/override` | board_or_agent | Pause or resume an adapter's override of a builtin |
| POST | `/api/adapters/{type}/reinstall` | board_or_agent | Reinstall an adapter |
| POST | `/api/adapters/{type}/reload` | board_or_agent | Reload an adapter |
| GET | `/api/adapters/{type}/ui-parser.js` | board_or_agent | Get adapter UI parser script |
| GET | `/api/companies/{companyId}/adapters/{type}/detect-model` | board_or_agent | Detect active model for an adapter |
| GET | `/api/companies/{companyId}/adapters/{type}/model-profiles` | board_or_agent | List adapter model profiles for a company |
| GET | `/api/companies/{companyId}/adapters/{type}/models` | board_or_agent | List models for an adapter type |
| POST | `/api/companies/{companyId}/adapters/{type}/test-environment` | board_or_agent | Validate adapter environment access for a company |

## admin

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/admin/users` | board | List all users (admin) |
| GET | `/api/admin/users/{userId}/company-access` | board | Get company access for a user (admin) |
| PUT | `/api/admin/users/{userId}/company-access` | board | Set company access for a user (admin) |
| POST | `/api/admin/users/{userId}/demote-instance-admin` | board | Demote a user from instance admin |
| POST | `/api/admin/users/{userId}/promote-instance-admin` | board | Promote a user to instance admin |

## agents

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/agents/me` | board_or_agent | Get the current agent |
| GET | `/api/agents/me/inbox-lite` | board_or_agent | Get current agent inbox (lite) |
| GET | `/api/agents/me/inbox/mine` | board_or_agent | Get current agent assigned inbox items |
| DELETE | `/api/agents/{id}` | board_or_agent | Delete an agent |
| GET | `/api/agents/{id}` | board_or_agent | Get an agent |
| PATCH | `/api/agents/{id}` | board_or_agent | Update an agent |
| POST | `/api/agents/{id}/approve` | board_or_agent | Approve a pending agent action |
| POST | `/api/agents/{id}/claude-login` | board_or_agent | Trigger Claude login for agent |
| POST | `/api/agents/{id}/clear-error` | board_or_agent | Clear an agent error |
| GET | `/api/agents/{id}/config-revisions` | board_or_agent | List agent config revisions |
| GET | `/api/agents/{id}/config-revisions/{revisionId}` | board_or_agent | Get an agent config revision |
| POST | `/api/agents/{id}/config-revisions/{revisionId}/rollback` | board_or_agent | Roll back to a config revision |
| GET | `/api/agents/{id}/configuration` | board_or_agent | Get agent configuration |
| POST | `/api/agents/{id}/heartbeat/invoke` | board_or_agent | Invoke agent heartbeat |
| GET | `/api/agents/{id}/instructions-bundle` | board_or_agent | Get agent instructions bundle |
| PATCH | `/api/agents/{id}/instructions-bundle` | board_or_agent | Update agent instructions bundle |
| DELETE | `/api/agents/{id}/instructions-bundle/file` | board_or_agent | Delete agent instructions file |
| GET | `/api/agents/{id}/instructions-bundle/file` | board_or_agent | Get agent instructions file |
| PUT | `/api/agents/{id}/instructions-bundle/file` | board_or_agent | Upsert agent instructions file |
| PATCH | `/api/agents/{id}/instructions-path` | board_or_agent | Update agent instructions path |
| GET | `/api/agents/{id}/keys` | board_or_agent | List agent API keys |
| POST | `/api/agents/{id}/keys` | board_or_agent | Create an agent API key |
| DELETE | `/api/agents/{id}/keys/{keyId}` | board_or_agent | Delete an agent API key |
| POST | `/api/agents/{id}/pause` | board_or_agent | Pause an agent |
| PATCH | `/api/agents/{id}/permissions` | board_or_agent | Update agent permissions |
| POST | `/api/agents/{id}/resume` | board_or_agent | Resume an agent |
| GET | `/api/agents/{id}/runtime-state` | board_or_agent | Get agent runtime state |
| POST | `/api/agents/{id}/runtime-state/reset-session` | board_or_agent | Reset agent session |
| GET | `/api/agents/{id}/skills` | board_or_agent | List agent skills |
| POST | `/api/agents/{id}/skills/sync` | board_or_agent | Sync desired skills onto an agent configuration |
| GET | `/api/agents/{id}/task-sessions` | board_or_agent | List agent task sessions |
| POST | `/api/agents/{id}/terminate` | board_or_agent | Terminate an agent |
| POST | `/api/agents/{id}/wakeup` | board_or_agent | Wake up an agent |
| GET | `/api/companies/{companyId}/agent-configurations` | board_or_agent | List agent configurations for a company |
| POST | `/api/companies/{companyId}/agent-hires` | board_or_agent | Hire an agent |
| GET | `/api/companies/{companyId}/agents` | board_or_agent | List agents in a company |
| POST | `/api/companies/{companyId}/agents` | board_or_agent | Create an agent |
| GET | `/api/companies/{companyId}/built-in-agents` | board_or_agent | List built-in agent provisioning state |
| POST | `/api/companies/{companyId}/built-in-agents/{key}/provision` | board_or_agent | Provision a built-in agent |
| POST | `/api/companies/{companyId}/built-in-agents/{key}/reconcile` | board_or_agent | Reconcile built-in agent managed resources |
| POST | `/api/companies/{companyId}/built-in-agents/{key}/reset` | board_or_agent | Reset a built-in agent |
| POST | `/api/companies/{companyId}/built-in-agents/{key}/routines/{routineKey}/disable` | board_or_agent | Disable a built-in routine schedule |
| POST | `/api/companies/{companyId}/built-in-agents/{key}/routines/{routineKey}/enable` | board_or_agent | Enable a built-in routine schedule |
| POST | `/api/companies/{companyId}/built-in-agents/{key}/routines/{routineKey}/run` | board_or_agent | Run a built-in routine once |
| GET | `/api/companies/{companyId}/built-in-agents/{key}/status` | board_or_agent | Get built-in agent bundle status |
| GET | `/api/companies/{companyId}/org` | board_or_agent | Get org chart data |
| GET | `/api/instance/scheduler-heartbeats` | board | List scheduler heartbeats |

## approvals

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/approvals/{id}` | board_or_agent | Get an approval |
| POST | `/api/approvals/{id}/approve` | board_or_agent | Approve an approval |
| GET | `/api/approvals/{id}/comments` | board_or_agent | List approval comments |
| POST | `/api/approvals/{id}/comments` | board_or_agent | Add a comment to an approval |
| GET | `/api/approvals/{id}/issues` | board_or_agent | List issues linked to an approval |
| POST | `/api/approvals/{id}/reject` | board_or_agent | Reject an approval |
| POST | `/api/approvals/{id}/request-revision` | board_or_agent | Request revision on an approval |
| POST | `/api/approvals/{id}/resubmit` | board_or_agent | Resubmit an approval |
| GET | `/api/companies/{companyId}/approvals` | board_or_agent | List approvals in a company |
| POST | `/api/companies/{companyId}/approvals` | board_or_agent | Create an approval |

## assets

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/assets/{assetId}/content` | board_or_agent | Download asset content |
| DELETE | `/api/attachments/{attachmentId}` | board_or_agent | Delete an attachment |
| GET | `/api/attachments/{attachmentId}/content` | board_or_agent | Download attachment content |
| POST | `/api/companies/{companyId}/assets/images` | board_or_agent | Upload an image asset |
| POST | `/api/companies/{companyId}/issues/{issueId}/attachments` | board_or_agent | Upload an attachment to an issue |
| POST | `/api/companies/{companyId}/logo` | board_or_agent | Upload company logo |

## auth

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/auth/get-session` | board | Get current session |
| GET | `/api/auth/profile` | board | Get current user profile |
| PATCH | `/api/auth/profile` | board | Update current user profile |
| GET | `/api/companies/{companyId}/users/{userSlug}/profile` | board_or_agent | Get a user profile within a company |

## cloud-upstreams

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/cloud-upstreams` | board | List cloud upstream connections |
| POST | `/api/cloud-upstreams/connect/finish` | board | Finish a cloud upstream connection |
| POST | `/api/cloud-upstreams/connect/start` | board | Start a cloud upstream connection |
| POST | `/api/cloud-upstreams/{connectionId}/push-runs` | board | Create a cloud upstream push run |
| POST | `/api/cloud-upstreams/{connectionId}/push-runs/preview` | board | Preview a cloud upstream push run |
| GET | `/api/cloud-upstreams/{connectionId}/push-runs/{runId}` | board | Get a cloud upstream push run |
| POST | `/api/cloud-upstreams/{connectionId}/push-runs/{runId}/activation` | board | Activate cloud upstream push run entities |
| POST | `/api/cloud-upstreams/{connectionId}/push-runs/{runId}/cancel` | board | Cancel a cloud upstream push run |

## companies

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies` | board | List companies |
| POST | `/api/companies` | board | Create a company |
| POST | `/api/companies/import` | board_or_agent | Apply a company import (legacy route) |
| GET | `/api/companies/import/jobs/{jobId}` | board_or_agent | Get company import job status |
| POST | `/api/companies/import/preview` | board_or_agent | Preview a company import (legacy route) |
| GET | `/api/companies/issues` | board | Legacy — returns error directing to correct issues path |
| GET | `/api/companies/stats` | board | Company stats |
| DELETE | `/api/companies/{companyId}` | board_or_agent | Delete a company |
| GET | `/api/companies/{companyId}` | board_or_agent | Get a company |
| PATCH | `/api/companies/{companyId}` | board_or_agent | Update a company |
| POST | `/api/companies/{companyId}/archive` | board_or_agent | Archive a company |
| GET | `/api/companies/{companyId}/artifacts` | board_or_agent | List company artifacts |
| PATCH | `/api/companies/{companyId}/branding` | board_or_agent | Update company branding |
| POST | `/api/companies/{companyId}/export` | board_or_agent | Export a company (legacy singular form) |
| POST | `/api/companies/{companyId}/exports` | board_or_agent | Export company data |
| POST | `/api/companies/{companyId}/exports/preview` | board_or_agent | Preview company export |
| GET | `/api/companies/{companyId}/feedback-traces` | board_or_agent | List company feedback traces |
| POST | `/api/companies/{companyId}/imports/apply` | board_or_agent | Apply company import |
| POST | `/api/companies/{companyId}/imports/preview` | board_or_agent | Preview company import |
| GET | `/api/companies/{companyId}/issues/count` | board_or_agent | Count issues in a company |
| GET | `/api/companies/{companyId}/org.png` | board_or_agent | Get org chart as PNG |
| GET | `/api/companies/{companyId}/org.svg` | board_or_agent | Get org chart as SVG |
| GET | `/api/companies/{companyId}/search` | board_or_agent | Search company data |
| GET | `/api/companies/{companyId}/search/extract` | board_or_agent | Extract company search matches |
| GET | `/api/companies/{companyId}/timeline` | board_or_agent | Get company work timeline |
| GET | `/api/companies/{companyId}/users/me/inbox-agent-policy` | board_or_agent | Get the current user's inbox agent policy |
| PUT | `/api/companies/{companyId}/users/me/inbox-agent-policy` | board_or_agent | Update the current user's inbox agent policy |
| GET | `/api/companies/{companyId}/users/{userId}/inbox-agent-policy` | board_or_agent | Get a company user's inbox agent policy |
| PUT | `/api/companies/{companyId}/users/{userId}/inbox-agent-policy` | board_or_agent | Update a company user's inbox agent policy |

## costs

| Method | Route | Actor | Summary |
|---|---|---|---|
| PATCH | `/api/agents/{agentId}/budgets` | board_or_agent | Update agent budget |
| POST | `/api/companies/{companyId}/budget-incidents/{incidentId}/resolve` | board_or_agent | Resolve a budget incident |
| PATCH | `/api/companies/{companyId}/budgets` | board_or_agent | Update company budget |
| GET | `/api/companies/{companyId}/budgets/overview` | board_or_agent | Get budget overview |
| POST | `/api/companies/{companyId}/budgets/policies` | board_or_agent | Create or update a budget policy |
| POST | `/api/companies/{companyId}/cost-events` | board_or_agent | Record a cost event |
| GET | `/api/companies/{companyId}/costs/by-agent` | board_or_agent | Cost report: by-agent |
| GET | `/api/companies/{companyId}/costs/by-agent-model` | board_or_agent | Cost report: by-agent-model |
| GET | `/api/companies/{companyId}/costs/by-biller` | board_or_agent | Cost report: by-biller |
| GET | `/api/companies/{companyId}/costs/by-project` | board_or_agent | Cost report: by-project |
| GET | `/api/companies/{companyId}/costs/by-provider` | board_or_agent | Cost report: by-provider |
| GET | `/api/companies/{companyId}/costs/finance-by-biller` | board_or_agent | Cost report: finance-by-biller |
| GET | `/api/companies/{companyId}/costs/finance-by-kind` | board_or_agent | Cost report: finance-by-kind |
| GET | `/api/companies/{companyId}/costs/finance-events` | board_or_agent | Cost report: finance-events |
| GET | `/api/companies/{companyId}/costs/finance-summary` | board_or_agent | Cost report: finance-summary |
| GET | `/api/companies/{companyId}/costs/quota-windows` | board_or_agent | Cost report: quota-windows |
| GET | `/api/companies/{companyId}/costs/summary` | board_or_agent | Cost report: summary |
| GET | `/api/companies/{companyId}/costs/window-spend` | board_or_agent | Cost report: window-spend |
| POST | `/api/companies/{companyId}/finance-events` | board_or_agent | Record a finance event |
| GET | `/api/issues/{id}/cost-summary` | board_or_agent | Get issue cost summary |

## dashboard

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/dashboard` | board_or_agent | Get dashboard data |
| GET | `/api/companies/{companyId}/recovery-observability` | board_or_agent | Get recovery observability report |

## decision-training

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/decision-training` | board_or_agent | List decision training examples |
| POST | `/api/companies/{companyId}/decision-training` | board_or_agent | Capture a decision training example |
| GET | `/api/companies/{companyId}/decision-training/export.jsonl` | board_or_agent | Export decision training examples as JSONL |
| POST | `/api/companies/{companyId}/decision-training/preview` | board_or_agent | Preview a decision training snapshot |
| DELETE | `/api/decision-training/{id}` | board_or_agent | Delete a decision training example |
| GET | `/api/decision-training/{id}` | board_or_agent | Get a decision training example |
| PATCH | `/api/decision-training/{id}` | board_or_agent | Update decision training notes |

## environments

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/environments` | board_or_agent | List environments for a company |
| POST | `/api/companies/{companyId}/environments` | board_or_agent | Create an environment |
| GET | `/api/companies/{companyId}/environments/capabilities` | board_or_agent | Get environment capabilities |
| POST | `/api/companies/{companyId}/environments/probe-config` | board_or_agent | Probe environment config |
| GET | `/api/environment-custom-image-setup-sessions/{sessionId}` | board_or_agent | Get and refresh an environment customImage setup session |
| POST | `/api/environment-custom-image-setup-sessions/{sessionId}/cancel` | board_or_agent | Cancel an environment customImage setup session |
| POST | `/api/environment-custom-image-setup-sessions/{sessionId}/finish` | board_or_agent | Capture and promote an environment customImage setup session |
| POST | `/api/environment-custom-image-setup-sessions/{sessionId}/terminal-session-token` | board_or_agent | Mint a short-lived terminal websocket token for a customImage SSH setup session |
| GET | `/api/environment-leases/{leaseId}` | board_or_agent | Get an environment lease |
| POST | `/api/environments/{environmentId}/custom-image-setup-sessions` | board_or_agent | Start an interactive environment customImage setup session |
| DELETE | `/api/environments/{environmentId}/custom-image-template` | board_or_agent | Disable the active environment customImage template |
| GET | `/api/environments/{environmentId}/custom-image-template` | board_or_agent | Get the active customImage template and setup status for an environment |
| POST | `/api/environments/{environmentId}/custom-image-template/rollback` | board_or_agent | Roll back an environment customImage template to the previous captured template |
| DELETE | `/api/environments/{id}` | board_or_agent | Delete an environment |
| GET | `/api/environments/{id}` | board_or_agent | Get an environment |
| PATCH | `/api/environments/{id}` | board_or_agent | Update an environment |
| GET | `/api/environments/{id}/delete-blast-radius` | board_or_agent | Get environment delete blast radius |
| GET | `/api/environments/{id}/leases` | board_or_agent | List leases for an environment |
| POST | `/api/environments/{id}/probe` | board_or_agent | Probe an environment |

## execution-workspaces

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/execution-workspaces` | board_or_agent | List execution workspaces for a company |
| GET | `/api/companies/{companyId}/workspace-overview` | board_or_agent | List bounded execution workspace overview rows for a company |
| GET | `/api/execution-workspaces/{id}` | board_or_agent | Get an execution workspace |
| PATCH | `/api/execution-workspaces/{id}` | board_or_agent | Update an execution workspace |
| GET | `/api/execution-workspaces/{id}/close-readiness` | board_or_agent | Check close-readiness of a workspace |
| POST | `/api/execution-workspaces/{id}/reconcile-branch` | board | Reconcile an execution workspace branch record |
| POST | `/api/execution-workspaces/{id}/runtime-commands/{action}` | board_or_agent | Run a runtime command in a workspace |
| POST | `/api/execution-workspaces/{id}/runtime-services/{action}` | board_or_agent | Control a runtime service in a workspace |
| GET | `/api/execution-workspaces/{id}/workspace-operations` | board_or_agent | List workspace operations |

## folders

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/folders` | board_or_agent | List folders for a company item kind |
| POST | `/api/companies/{companyId}/folders` | board_or_agent | Create a folder |
| POST | `/api/companies/{companyId}/folders/ensure-my` | board_or_agent | Ensure the current user's personal skill folder exists |
| POST | `/api/companies/{companyId}/folders/items/move` | board_or_agent | Move an item into or out of a folder |
| DELETE | `/api/companies/{companyId}/folders/{folderId}` | board_or_agent | Delete a folder |
| PATCH | `/api/companies/{companyId}/folders/{folderId}` | board_or_agent | Update a folder |
| POST | `/api/companies/{companyId}/folders/{folderId}/move` | board_or_agent | Move or reorder a folder |

## goals

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/goals` | board_or_agent | List goals in a company |
| POST | `/api/companies/{companyId}/goals` | board_or_agent | Create a goal |
| DELETE | `/api/goals/{id}` | board_or_agent | Delete a goal |
| GET | `/api/goals/{id}` | board_or_agent | Get a goal |
| PATCH | `/api/goals/{id}` | board_or_agent | Update a goal |

## health

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/health` | public | Health check |
| POST | `/api/health/dev-server/restart` | board | Request a managed dev-server restart |
| GET | `/api/openapi.json` | public | Get the generated OpenAPI document |

## inbox

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/attention` | board_or_agent | List decision-only attention feed items |
| GET | `/api/companies/{companyId}/inbox-dismissals` | board_or_agent | List inbox dismissals |
| POST | `/api/companies/{companyId}/inbox-dismissals` | board_or_agent | Create an inbox dismissal or snooze |
| DELETE | `/api/companies/{companyId}/inbox-dismissals/{itemKey}` | board_or_agent | Restore an inbox dismissal or snooze |

## instance

| Method | Route | Actor | Summary |
|---|---|---|---|
| POST | `/api/board/chat/stream` | board_or_agent | Stream a board-level chat response (requires enableConferenceRoomChat) |
| POST | `/api/instance/database-backups` | board | Trigger a database backup |
| GET | `/api/instance/settings` | board | Get instance settings |
| PATCH | `/api/instance/settings` | board | Update instance settings |
| GET | `/api/instance/settings/experimental` | board | Get experimental instance settings |
| PATCH | `/api/instance/settings/experimental` | board | Update experimental instance settings |
| GET | `/api/instance/settings/general` | board | Get general instance settings |
| PATCH | `/api/instance/settings/general` | board | Update general instance settings |

## instance-settings

| Method | Route | Actor | Summary |
|---|---|---|---|
| POST | `/api/instance/settings/experimental/issue-graph-liveness-auto-recovery/preview` | board | Preview issue graph liveness auto-recovery |
| POST | `/api/instance/settings/experimental/issue-graph-liveness-auto-recovery/run` | board | Run issue graph liveness auto-recovery |

## issues

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/issues` | board_or_agent | List issues in a company |
| POST | `/api/companies/{companyId}/issues` | board_or_agent | Create an issue |
| POST | `/api/companies/{companyId}/issues/external-object-summaries` | board_or_agent | Get external object status summaries for issues |
| GET | `/api/companies/{companyId}/labels` | board_or_agent | List labels in a company |
| POST | `/api/companies/{companyId}/labels` | board_or_agent | Create a label |
| GET | `/api/feedback-traces/{traceId}` | board_or_agent | Get a feedback trace |
| GET | `/api/feedback-traces/{traceId}/bundle` | board_or_agent | Get a feedback trace bundle |
| GET | `/api/issues` | board_or_agent | Legacy — returns error directing to /api/companies/{companyId}/issues |
| DELETE | `/api/issues/{id}` | board_or_agent | Delete an issue |
| GET | `/api/issues/{id}` | board_or_agent | Get an issue |
| PATCH | `/api/issues/{id}` | board_or_agent | Update an issue |
| GET | `/api/issues/{id}/accepted-plan-decompositions` | board_or_agent | List accepted plan decompositions |
| POST | `/api/issues/{id}/accepted-plan-decompositions` | board_or_agent | Create accepted plan decomposition child issues |
| POST | `/api/issues/{id}/admin/force-release` | board_or_agent | Force-release an issue (admin) |
| GET | `/api/issues/{id}/approvals` | board_or_agent | List issue approvals |
| POST | `/api/issues/{id}/approvals` | board_or_agent | Link an approval to an issue |
| DELETE | `/api/issues/{id}/approvals/{approvalId}` | board_or_agent | Unlink an approval from an issue |
| GET | `/api/issues/{id}/attachments` | board_or_agent | List issue attachments |
| POST | `/api/issues/{id}/checkout` | board_or_agent | Check out an issue |
| POST | `/api/issues/{id}/children` | board_or_agent | Create child issues |
| GET | `/api/issues/{id}/comments` | board_or_agent | List issue comments |
| POST | `/api/issues/{id}/comments` | board_or_agent | Add a comment to an issue |
| DELETE | `/api/issues/{id}/comments/{commentId}` | board_or_agent | Delete an issue comment |
| GET | `/api/issues/{id}/comments/{commentId}` | board_or_agent | Get a single issue comment |
| GET | `/api/issues/{id}/diagnostics/blockers` | board_or_agent | Get blocker diagnostics for an issue |
| GET | `/api/issues/{id}/diagnostics/subtree` | board_or_agent | Get bounded subtree wake and blocker diagnostics for an issue |
| GET | `/api/issues/{id}/diagnostics/wakes` | board_or_agent | Get wake diagnostics for an issue |
| GET | `/api/issues/{id}/documents` | board_or_agent | List issue documents |
| DELETE | `/api/issues/{id}/documents/{key}` | board_or_agent | Delete an issue document |
| GET | `/api/issues/{id}/documents/{key}` | board_or_agent | Get an issue document |
| PUT | `/api/issues/{id}/documents/{key}` | board_or_agent | Upsert an issue document |
| GET | `/api/issues/{id}/documents/{key}/annotations` | board_or_agent | List document annotation threads |
| POST | `/api/issues/{id}/documents/{key}/annotations` | board_or_agent | Create a document annotation thread |
| GET | `/api/issues/{id}/documents/{key}/annotations/{threadId}` | board_or_agent | Get a document annotation thread |
| PATCH | `/api/issues/{id}/documents/{key}/annotations/{threadId}` | board_or_agent | Update a document annotation thread |
| POST | `/api/issues/{id}/documents/{key}/annotations/{threadId}/comments` | board_or_agent | Add a document annotation comment |
| POST | `/api/issues/{id}/documents/{key}/lock` | board_or_agent | Lock an issue document |
| GET | `/api/issues/{id}/documents/{key}/revisions` | board_or_agent | List issue document revisions |
| POST | `/api/issues/{id}/documents/{key}/revisions/{revisionId}/restore` | board_or_agent | Restore a document revision |
| POST | `/api/issues/{id}/documents/{key}/unlock` | board_or_agent | Unlock an issue document |
| GET | `/api/issues/{id}/external-object-summary` | board_or_agent | Get external object status summary for an issue |
| GET | `/api/issues/{id}/external-objects` | board_or_agent | List external objects mentioned by an issue |
| POST | `/api/issues/{id}/external-objects/refresh` | board_or_agent | Refresh external objects mentioned by an issue |
| GET | `/api/issues/{id}/feedback-traces` | board_or_agent | List issue feedback traces |
| GET | `/api/issues/{id}/feedback-votes` | board_or_agent | List issue feedback votes |
| POST | `/api/issues/{id}/feedback-votes` | board_or_agent | Upsert a feedback vote |
| GET | `/api/issues/{id}/heartbeat-context` | board_or_agent | Get issue heartbeat context |
| DELETE | `/api/issues/{id}/inbox-archive` | board_or_agent | Un-archive issue from inbox |
| POST | `/api/issues/{id}/inbox-archive` | board_or_agent | Archive issue from inbox |
| GET | `/api/issues/{id}/interactions` | board_or_agent | List issue thread interactions |
| POST | `/api/issues/{id}/interactions` | board_or_agent | Create an issue thread interaction |
| POST | `/api/issues/{id}/interactions/{interactionId}/accept` | board | Accept an issue thread interaction |
| POST | `/api/issues/{id}/interactions/{interactionId}/cancel` | board_or_agent | Cancel an issue question interaction |
| POST | `/api/issues/{id}/interactions/{interactionId}/reject` | board | Reject an issue thread interaction |
| POST | `/api/issues/{id}/interactions/{interactionId}/respond` | board | Answer questions on an issue thread interaction |
| POST | `/api/issues/{id}/interactions/{interactionId}/verdicts` | board_or_agent | Submit item verdicts on an issue thread interaction |
| POST | `/api/issues/{id}/low-trust/promotions` | board_or_agent | Promote quarantined low-trust output |
| POST | `/api/issues/{id}/monitor/check-now` | board_or_agent | Run an issue monitor check now |
| DELETE | `/api/issues/{id}/read` | board_or_agent | Mark an issue as unread |
| POST | `/api/issues/{id}/read` | board_or_agent | Mark an issue as read |
| GET | `/api/issues/{id}/recovery-actions` | board_or_agent | List issue recovery actions |
| POST | `/api/issues/{id}/recovery-actions/resolve` | board_or_agent | Resolve an issue recovery action |
| POST | `/api/issues/{id}/release` | board_or_agent | Release an issue |
| POST | `/api/issues/{id}/scheduled-retry/retry-now` | board_or_agent | Retry a scheduled issue run now |
| POST | `/api/issues/{id}/tree-control/preview` | board_or_agent | Preview issue tree control changes |
| GET | `/api/issues/{id}/tree-control/state` | board_or_agent | Get issue tree control state |
| GET | `/api/issues/{id}/tree-holds` | board_or_agent | List issue tree holds |
| POST | `/api/issues/{id}/tree-holds` | board_or_agent | Create an issue tree hold |
| GET | `/api/issues/{id}/tree-holds/{holdId}` | board_or_agent | Get an issue tree hold |
| POST | `/api/issues/{id}/tree-holds/{holdId}/release` | board_or_agent | Release an issue tree hold |
| DELETE | `/api/issues/{id}/watchdog` | board_or_agent | Disable an issue watchdog |
| GET | `/api/issues/{id}/watchdog` | board_or_agent | Get active issue watchdog |
| PUT | `/api/issues/{id}/watchdog` | board_or_agent | Create or update an issue watchdog |
| GET | `/api/issues/{id}/work-products` | board_or_agent | List issue work products |
| POST | `/api/issues/{id}/work-products` | board_or_agent | Create an issue work product |
| GET | `/api/issues/{issueId}/file-resources/content` | board | Read issue workspace file content |
| GET | `/api/issues/{issueId}/file-resources/list` | board | List workspace files for an issue |
| GET | `/api/issues/{issueId}/file-resources/resolve` | board | Resolve an issue workspace file |
| DELETE | `/api/labels/{labelId}` | board_or_agent | Delete a label |
| DELETE | `/api/work-products/{id}` | board_or_agent | Delete a work product |
| PATCH | `/api/work-products/{id}` | board_or_agent | Update a work product |

## llms

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/llms/agent-configuration.txt` | board_or_agent | Get agent configuration as plain text (for LLM context) |
| GET | `/api/llms/agent-configuration/{adapterType}.txt` | board_or_agent | Get agent configuration for a specific adapter type |
| GET | `/api/llms/agent-icons.txt` | board_or_agent | Get agent icon names as plain text |

## plugins

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/_plugins/{pluginId}/ui/{filePath}` | board_or_agent | Serve plugin UI static file |
| GET | `/api/plugins` | board | List installed plugins |
| GET | `/api/plugins/examples` | board | List example plugins |
| POST | `/api/plugins/install` | board | Install a plugin |
| GET | `/api/plugins/tools` | board | List plugin tools |
| POST | `/api/plugins/tools/execute` | board | Execute a plugin tool |
| GET | `/api/plugins/ui-contributions` | board | List plugin UI contributions |
| DELETE | `/api/plugins/{pluginId}` | board | Delete a plugin |
| GET | `/api/plugins/{pluginId}` | board | Get a plugin |
| POST | `/api/plugins/{pluginId}/actions/{key}` | board | Invoke a plugin action (URL-keyed bridge) |
| POST | `/api/plugins/{pluginId}/bridge/action` | board | Send action via plugin bridge |
| POST | `/api/plugins/{pluginId}/bridge/data` | board | Send data via plugin bridge |
| GET | `/api/plugins/{pluginId}/bridge/stream/{channel}` | board | Subscribe to a plugin bridge SSE stream |
| GET | `/api/plugins/{pluginId}/companies/{companyId}/local-folders` | board | List plugin local folders |
| PUT | `/api/plugins/{pluginId}/companies/{companyId}/local-folders/{folderKey}` | board | Save a plugin local folder |
| GET | `/api/plugins/{pluginId}/companies/{companyId}/local-folders/{folderKey}/status` | board | Get plugin local folder status |
| POST | `/api/plugins/{pluginId}/companies/{companyId}/local-folders/{folderKey}/validate` | board | Validate a plugin local folder |
| GET | `/api/plugins/{pluginId}/config` | board | Get company-scoped plugin config |
| POST | `/api/plugins/{pluginId}/config` | board | Set company-scoped plugin config |
| POST | `/api/plugins/{pluginId}/config/test` | board | Test company-scoped plugin config |
| GET | `/api/plugins/{pluginId}/dashboard` | board | Get plugin dashboard data |
| POST | `/api/plugins/{pluginId}/data/{key}` | board | Get plugin data by key (URL-keyed bridge) |
| POST | `/api/plugins/{pluginId}/disable` | board | Disable a plugin |
| POST | `/api/plugins/{pluginId}/enable` | board | Enable a plugin |
| GET | `/api/plugins/{pluginId}/health` | board | Get plugin health |
| GET | `/api/plugins/{pluginId}/jobs` | board | List plugin jobs |
| GET | `/api/plugins/{pluginId}/jobs/{jobId}/runs` | board | List runs for a plugin job |
| POST | `/api/plugins/{pluginId}/jobs/{jobId}/trigger` | board | Trigger a plugin job |
| GET | `/api/plugins/{pluginId}/logs` | board | Get plugin logs |
| POST | `/api/plugins/{pluginId}/upgrade` | board | Upgrade a plugin |
| POST | `/api/plugins/{pluginId}/webhooks/{endpointKey}` | board | Deliver an external webhook payload to a plugin |

## projects

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/projects` | board_or_agent | List projects in a company |
| POST | `/api/companies/{companyId}/projects` | board_or_agent | Create a project |
| DELETE | `/api/projects/{id}` | board_or_agent | Delete a project |
| GET | `/api/projects/{id}` | board_or_agent | Get a project |
| PATCH | `/api/projects/{id}` | board_or_agent | Update a project |
| GET | `/api/projects/{id}/external-object-summary` | board_or_agent | Get external object status summary for a project |
| GET | `/api/projects/{id}/workspaces` | board_or_agent | List project workspaces |
| POST | `/api/projects/{id}/workspaces` | board_or_agent | Create a project workspace |
| DELETE | `/api/projects/{id}/workspaces/{workspaceId}` | board_or_agent | Delete a project workspace |
| PATCH | `/api/projects/{id}/workspaces/{workspaceId}` | board_or_agent | Update a project workspace |
| POST | `/api/projects/{id}/workspaces/{workspaceId}/runtime-commands/{action}` | board_or_agent | Run a runtime command in a project workspace |
| POST | `/api/projects/{id}/workspaces/{workspaceId}/runtime-services/{action}` | board_or_agent | Control a runtime service in a project workspace |

## resource-memberships

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/resource-memberships/me` | board | List current user's resource memberships |
| PUT | `/api/companies/{companyId}/resource-memberships/me/agents/{agentId}` | board | Join or leave an agent resource |
| PUT | `/api/companies/{companyId}/resource-memberships/me/projects/{projectId}` | board | Join or leave a project resource |

## routines

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/routines` | board_or_agent | List routines in a company |
| POST | `/api/companies/{companyId}/routines` | board_or_agent | Create a routine |
| POST | `/api/routine-triggers/public/{publicId}/fire` | board_or_agent | Fire a public routine trigger |
| DELETE | `/api/routine-triggers/{id}` | board_or_agent | Delete a routine trigger |
| PATCH | `/api/routine-triggers/{id}` | board_or_agent | Update a routine trigger |
| POST | `/api/routine-triggers/{id}/rotate-secret` | board_or_agent | Rotate a routine trigger secret |
| GET | `/api/routines/{id}` | board_or_agent | Get a routine |
| PATCH | `/api/routines/{id}` | board_or_agent | Update a routine |
| GET | `/api/routines/{id}/description/annotations` | board_or_agent | List routine description annotation threads |
| POST | `/api/routines/{id}/description/annotations` | board_or_agent | Create a routine description annotation thread |
| GET | `/api/routines/{id}/description/annotations/{threadId}` | board_or_agent | Get a routine description annotation thread |
| PATCH | `/api/routines/{id}/description/annotations/{threadId}` | board_or_agent | Update a routine description annotation thread |
| POST | `/api/routines/{id}/description/annotations/{threadId}/comments` | board_or_agent | Add a routine description annotation comment |
| GET | `/api/routines/{id}/revisions` | board_or_agent | List routine revisions |
| POST | `/api/routines/{id}/revisions/{revisionId}/restore` | board_or_agent | Restore a routine revision |
| POST | `/api/routines/{id}/run` | board_or_agent | Manually run a routine |
| GET | `/api/routines/{id}/runs` | board_or_agent | List runs for a routine |
| POST | `/api/routines/{id}/triggers` | board_or_agent | Create a routine trigger |

## runs

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/heartbeat-runs` | board_or_agent | List heartbeat runs for a company |
| GET | `/api/companies/{companyId}/live-runs` | board_or_agent | List live runs for a company |
| GET | `/api/heartbeat-runs/{runId}` | board_or_agent | Get a heartbeat run |
| POST | `/api/heartbeat-runs/{runId}/cancel` | board_or_agent | Cancel a heartbeat run |
| GET | `/api/heartbeat-runs/{runId}/events` | board_or_agent | Get events for a heartbeat run |
| GET | `/api/heartbeat-runs/{runId}/log` | board_or_agent | Get log for a heartbeat run |
| POST | `/api/heartbeat-runs/{runId}/watchdog-decisions` | board_or_agent | Submit watchdog decisions for a run |
| GET | `/api/heartbeat-runs/{runId}/workspace-operations` | board_or_agent | List workspace operations for a run |
| GET | `/api/issues/{issueId}/active-run` | board_or_agent | Get active run for an issue |
| GET | `/api/issues/{issueId}/live-runs` | board_or_agent | List live runs for an issue |
| GET | `/api/workspace-operations/{operationId}/log` | board_or_agent | Get log for a workspace operation |

## secrets

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/agents/me/secrets` | board_or_agent | List secrets accessible to the current agent run |
| POST | `/api/agents/me/secrets/{key}/value` | board_or_agent | Fetch one secret value for the current agent run |
| GET | `/api/companies/{companyId}/me/user-secrets` | board | List my user secret values |
| POST | `/api/companies/{companyId}/me/user-secrets` | board | Create my user secret value |
| DELETE | `/api/companies/{companyId}/me/user-secrets/{secretId}` | board | Delete my user secret value |
| PATCH | `/api/companies/{companyId}/me/user-secrets/{secretId}` | board | Update my user secret value |
| POST | `/api/companies/{companyId}/me/user-secrets/{secretId}/rotate` | board | Rotate my user secret value |
| GET | `/api/companies/{companyId}/secret-provider-configs` | board | List secret provider configurations |
| POST | `/api/companies/{companyId}/secret-provider-configs` | board | Create a secret provider configuration |
| POST | `/api/companies/{companyId}/secret-provider-configs/discovery/preview` | board | Preview secret provider discovery |
| GET | `/api/companies/{companyId}/secret-providers` | board_or_agent | List secret providers |
| GET | `/api/companies/{companyId}/secret-providers/health` | board | Check configured secret providers |
| GET | `/api/companies/{companyId}/secrets` | board_or_agent | List secrets in a company |
| POST | `/api/companies/{companyId}/secrets` | board_or_agent | Create a secret |
| POST | `/api/companies/{companyId}/secrets/remote-import` | board | Import remote secrets |
| POST | `/api/companies/{companyId}/secrets/remote-import/preview` | board | Preview remote secret import |
| GET | `/api/companies/{companyId}/user-secret-definitions` | board | List user secret definitions |
| POST | `/api/companies/{companyId}/user-secret-definitions` | board | Create a user secret definition |
| DELETE | `/api/companies/{companyId}/user-secret-definitions/{definitionId}` | board | Delete a user secret definition |
| PATCH | `/api/companies/{companyId}/user-secret-definitions/{definitionId}` | board | Update a user secret definition |
| GET | `/api/companies/{companyId}/user-secret-definitions/{definitionId}/coverage` | board | Get user secret definition coverage |
| DELETE | `/api/secret-provider-configs/{id}` | board | Delete a secret provider configuration |
| GET | `/api/secret-provider-configs/{id}` | board | Get a secret provider configuration |
| PATCH | `/api/secret-provider-configs/{id}` | board | Update a secret provider configuration |
| POST | `/api/secret-provider-configs/{id}/default` | board | Set the default secret provider configuration |
| POST | `/api/secret-provider-configs/{id}/health` | board | Check a secret provider configuration |
| DELETE | `/api/secrets/{id}` | board_or_agent | Delete a secret |
| PATCH | `/api/secrets/{id}` | board_or_agent | Update a secret |
| GET | `/api/secrets/{id}/access-events` | board | List secret access events |
| POST | `/api/secrets/{id}/rotate` | board_or_agent | Rotate a secret |
| GET | `/api/secrets/{id}/usage` | board | Get secret usage |

## sidebar

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/sidebar-badges` | board_or_agent | Get sidebar badge counts |
| GET | `/api/companies/{companyId}/sidebar-preferences/me` | board_or_agent | Get sidebar preferences for company |
| PUT | `/api/companies/{companyId}/sidebar-preferences/me` | board_or_agent | Update sidebar preferences for company |
| GET | `/api/sidebar-preferences/me` | board_or_agent | Get current user sidebar preferences |
| PUT | `/api/sidebar-preferences/me` | board_or_agent | Update current user sidebar preferences |

## skills

| Method | Route | Actor | Summary |
|---|---|---|---|
| DELETE | `/api/companies/{companyId}/skill-policy` | board_or_agent | Reset the company skill policy to the open default |
| GET | `/api/companies/{companyId}/skill-policy` | board_or_agent | Get the effective company skill policy |
| PUT | `/api/companies/{companyId}/skill-policy` | board_or_agent | Replace the company skill policy |
| POST | `/api/companies/{companyId}/skill-policy/evaluate` | board_or_agent | Evaluate a company skill policy decision |
| GET | `/api/companies/{companyId}/skill-test-run-templates` | board_or_agent | List skill test-run templates |
| POST | `/api/companies/{companyId}/skill-test-run-templates` | board_or_agent | Create a skill test-run template |
| DELETE | `/api/companies/{companyId}/skill-test-run-templates/{templateId}` | board_or_agent | Delete a skill test-run template |
| PATCH | `/api/companies/{companyId}/skill-test-run-templates/{templateId}` | board_or_agent | Update a skill test-run template |
| GET | `/api/companies/{companyId}/skills` | board_or_agent | List skills for a company |
| POST | `/api/companies/{companyId}/skills` | board_or_agent | Create a company skill |
| GET | `/api/companies/{companyId}/skills/categories` | board_or_agent | List company skill categories |
| POST | `/api/companies/{companyId}/skills/import` | board_or_agent | Import a skill |
| POST | `/api/companies/{companyId}/skills/install-catalog` | board_or_agent | Install a catalog skill |
| POST | `/api/companies/{companyId}/skills/scan-projects` | board_or_agent | Scan project for skills |
| DELETE | `/api/companies/{companyId}/skills/{skillId}` | board_or_agent | Delete a company skill |
| GET | `/api/companies/{companyId}/skills/{skillId}` | board_or_agent | Get a company skill |
| PATCH | `/api/companies/{companyId}/skills/{skillId}` | board_or_agent | Update a company skill |
| POST | `/api/companies/{companyId}/skills/{skillId}/audit` | board_or_agent | Audit a company skill |
| GET | `/api/companies/{companyId}/skills/{skillId}/comments` | board_or_agent | List skill comments |
| POST | `/api/companies/{companyId}/skills/{skillId}/comments` | board_or_agent | Create a skill comment |
| DELETE | `/api/companies/{companyId}/skills/{skillId}/comments/{commentId}` | board_or_agent | Delete a skill comment |
| PATCH | `/api/companies/{companyId}/skills/{skillId}/comments/{commentId}` | board_or_agent | Update a skill comment |
| DELETE | `/api/companies/{companyId}/skills/{skillId}/files` | board_or_agent | Delete a skill file or folder |
| GET | `/api/companies/{companyId}/skills/{skillId}/files` | board_or_agent | List skill files |
| PATCH | `/api/companies/{companyId}/skills/{skillId}/files` | board_or_agent | Update a skill file |
| POST | `/api/companies/{companyId}/skills/{skillId}/fork` | board_or_agent | Fork a company skill |
| GET | `/api/companies/{companyId}/skills/{skillId}/fork-precheck` | board_or_agent | Preview company skill fork impact |
| POST | `/api/companies/{companyId}/skills/{skillId}/install-update` | board_or_agent | Install a skill update |
| POST | `/api/companies/{companyId}/skills/{skillId}/reset` | board_or_agent | Reset a company skill |
| DELETE | `/api/companies/{companyId}/skills/{skillId}/star` | board_or_agent | Unstar a company skill |
| POST | `/api/companies/{companyId}/skills/{skillId}/star` | board_or_agent | Star a company skill |
| GET | `/api/companies/{companyId}/skills/{skillId}/test-inputs` | board_or_agent | List skill test inputs |
| POST | `/api/companies/{companyId}/skills/{skillId}/test-inputs` | board_or_agent | Create a skill test input |
| DELETE | `/api/companies/{companyId}/skills/{skillId}/test-inputs/{inputId}` | board_or_agent | Delete a skill test input |
| PATCH | `/api/companies/{companyId}/skills/{skillId}/test-inputs/{inputId}` | board_or_agent | Update a skill test input |
| GET | `/api/companies/{companyId}/skills/{skillId}/test-runs` | board_or_agent | List skill test runs |
| POST | `/api/companies/{companyId}/skills/{skillId}/test-runs` | board_or_agent | Create a skill test run |
| DELETE | `/api/companies/{companyId}/skills/{skillId}/test-runs/{runId}` | board_or_agent | Delete a skill test run |
| GET | `/api/companies/{companyId}/skills/{skillId}/test-runs/{runId}` | board_or_agent | Get a skill test run |
| POST | `/api/companies/{companyId}/skills/{skillId}/test-runs/{runId}/cancel` | board_or_agent | Cancel a skill test run |
| GET | `/api/companies/{companyId}/skills/{skillId}/update-status` | board_or_agent | Get skill update status |
| GET | `/api/companies/{companyId}/skills/{skillId}/versions` | board_or_agent | List skill versions |
| POST | `/api/companies/{companyId}/skills/{skillId}/versions` | board_or_agent | Create a skill version |
| GET | `/api/companies/{companyId}/skills/{skillId}/versions/{versionId}` | board_or_agent | Get a skill version |
| GET | `/api/skills/catalog` | board_or_agent | List catalog skills |
| GET | `/api/skills/catalog/{catalogId}` | board_or_agent | Get a catalog skill |
| GET | `/api/skills/catalog/{catalogId}/files` | board_or_agent | List catalog skill files |

## status-cards

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/status-cards` | board_or_agent | List status cards |
| POST | `/api/companies/{companyId}/status-cards` | board_or_agent | Create a status card |
| DELETE | `/api/status-cards/{id}` | board_or_agent | Delete a status card |
| GET | `/api/status-cards/{id}` | board_or_agent | Get a status card |
| PATCH | `/api/status-cards/{id}` | board_or_agent | Update, archive, or restore a status card |
| GET | `/api/status-cards/{id}/dry-run` | board_or_agent | Execute stored status card queries without an LLM |
| PUT | `/api/status-cards/{id}/query` | board_or_agent | Write a compiled status card query |
| POST | `/api/status-cards/{id}/recompile` | board_or_agent | Recompile a status card query |
| POST | `/api/status-cards/{id}/refresh` | board_or_agent | Refresh a status card |
| PUT | `/api/status-cards/{id}/summary` | board_or_agent | Write a generated status card summary |
| GET | `/api/status-cards/{id}/summary-revisions` | board_or_agent | List status card summary revisions |
| GET | `/api/status-cards/{id}/updates` | board_or_agent | List status card updates |

## summaries

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/summary-slots/{scopeKind}/{slotKey}` | board_or_agent | Get a summary slot with its latest document and generation state |
| PUT | `/api/companies/{companyId}/summary-slots/{scopeKind}/{slotKey}` | board_or_agent | Write a summary revision (Summarizer built-in agent only) |
| POST | `/api/companies/{companyId}/summary-slots/{scopeKind}/{slotKey}/generate` | board_or_agent | Manually generate (or refresh) a summary slot |
| GET | `/api/companies/{companyId}/summary-slots/{scopeKind}/{slotKey}/revisions` | board_or_agent | List dated revisions for a summary slot |

## teams

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/teams/catalog/installed` | board_or_agent | List installed catalog teams |
| POST | `/api/companies/{companyId}/teams/catalog/{catalogId}/install` | board_or_agent | Install catalog team |
| POST | `/api/companies/{companyId}/teams/catalog/{catalogId}/preview` | board_or_agent | Preview catalog team install |
| GET | `/api/teams/catalog` | board_or_agent | List catalog teams |
| GET | `/api/teams/catalog/{catalogId}` | board_or_agent | Get catalog team |
| GET | `/api/teams/catalog/{catalogId}/files` | board_or_agent | Get catalog team file |

## tool-access

| Method | Route | Actor | Summary |
|---|---|---|---|
| POST | `/api/agents/me/connections/{connectionId}/start-authorization` | board | Start user authorization for an agent tool connection |
| GET | `/api/companies/{companyId}/tools/action-requests` | board | List pending tool action requests |
| POST | `/api/companies/{companyId}/tools/action-requests/{actionRequestId}/trust-rule` | board | Create a tool trust rule from an action request |
| GET | `/api/companies/{companyId}/tools/applications` | board | List tool applications |
| POST | `/api/companies/{companyId}/tools/applications` | board | Create a tool application |
| GET | `/api/companies/{companyId}/tools/apps/attention` | board | List tool apps needing attention |
| POST | `/api/companies/{companyId}/tools/apps/connect` | board | Create a draft app connection from gallery input |
| POST | `/api/companies/{companyId}/tools/apps/{connectionId}/finish` | board | Finish a gallery app connection and profile setup |
| GET | `/api/companies/{companyId}/tools/connections` | board | List tool connections |
| POST | `/api/companies/{companyId}/tools/connections` | board | Create a tool connection |
| POST | `/api/companies/{companyId}/tools/connections/{connectionId}/start-authorization` | board | Start user authorization for a tool connection |
| GET | `/api/companies/{companyId}/tools/examples` | board | List installable tool examples |
| POST | `/api/companies/{companyId}/tools/examples/{id}/install` | board | Install a safe tool example |
| POST | `/api/companies/{companyId}/tools/examples/{id}/smoke` | board | Run tool example governance smoke checks |
| GET | `/api/companies/{companyId}/tools/gallery` | board | List tool app gallery entries |
| POST | `/api/companies/{companyId}/tools/mcp/import-json` | board | Preview MCP JSON import |
| GET | `/api/companies/{companyId}/tools/policies` | board | List tool policies |
| POST | `/api/companies/{companyId}/tools/policies` | board | Create a tool policy |
| POST | `/api/companies/{companyId}/tools/policies/reorder` | board | Reorder tool policies |
| DELETE | `/api/companies/{companyId}/tools/policies/{policyId}` | board | Delete a tool policy |
| PATCH | `/api/companies/{companyId}/tools/policies/{policyId}` | board | Update a tool policy |
| POST | `/api/companies/{companyId}/tools/policies/{policyId}/duplicate` | board | Duplicate a tool policy |
| POST | `/api/companies/{companyId}/tools/policy/test` | board | Test tool policy decision |
| GET | `/api/companies/{companyId}/tools/profiles` | board | List tool access profiles with entries and bindings |
| POST | `/api/companies/{companyId}/tools/profiles` | board | Create a tool access profile |
| GET | `/api/companies/{companyId}/tools/profiles/effective/agents/{agentId}` | board | Resolve effective tool access profiles for an agent |
| POST | `/api/companies/{companyId}/tools/profiles/{profileId}/bind` | board | Bind a tool access profile to a company, agent, project, routine, or issue |
| POST | `/api/companies/{companyId}/tools/profiles/{profileId}/unbind` | board | Unbind a tool access profile from a company, agent, project, routine, or issue |
| GET | `/api/companies/{companyId}/tools/runs/{runId}/decisions` | board | Get governed tool decisions for a run transcript |
| GET | `/api/companies/{companyId}/tools/runtime-health` | board | Summarize MCP runtime health and alert recommendations |
| GET | `/api/companies/{companyId}/tools/runtime-slots` | board | List MCP runtime slots |
| POST | `/api/companies/{companyId}/tools/runtime-slots/{id}/restart` | board | Restart a local stdio MCP runtime slot |
| POST | `/api/companies/{companyId}/tools/runtime-slots/{id}/stop` | board | Stop a local stdio MCP runtime slot |
| GET | `/api/companies/{companyId}/tools/stdio-templates` | board | List approved stdio MCP templates |
| POST | `/api/companies/{companyId}/tools/stdio-templates` | board | Create an approved stdio MCP template |
| POST | `/api/companies/{companyId}/tools/stdio-templates/{templateId}/disable` | board | Disable an approved stdio MCP template |
| GET | `/api/companies/{companyId}/tools/trust-rules` | board | List tool trust rules |
| POST | `/api/companies/{companyId}/tools/trust-rules/{policyId}/revoke` | board | Revoke a tool trust rule |
| DELETE | `/api/tool-applications/{applicationId}` | board | Delete a tool application |
| PATCH | `/api/tool-applications/{applicationId}` | board | Update a tool application |
| DELETE | `/api/tool-connections/{connectionId}` | board | Archive a tool connection |
| GET | `/api/tool-connections/{connectionId}` | board | Get a tool connection |
| PATCH | `/api/tool-connections/{connectionId}` | board | Update a tool connection |
| GET | `/api/tool-connections/{connectionId}/activity` | board | List tool connection activity |
| GET | `/api/tool-connections/{connectionId}/catalog` | board | List a tool connection catalog |
| POST | `/api/tool-connections/{connectionId}/catalog/refresh` | board | Refresh a tool connection catalog |
| GET | `/api/tool-connections/{connectionId}/grants` | board | List tool connection grants |
| POST | `/api/tool-connections/{connectionId}/grants/installations` | board | Add an installation grant to a tool connection |
| DELETE | `/api/tool-connections/{connectionId}/grants/{grantId}` | board | Revoke a tool connection grant |
| POST | `/api/tool-connections/{connectionId}/health-check` | board | Run a tool connection health check |
| GET | `/api/tool-connections/{connectionId}/installs` | board_or_agent | List tool connection installs |
| PUT | `/api/tool-connections/{connectionId}/installs` | board_or_agent | Sync tool connection installs |
| POST | `/api/tool-connections/{connectionId}/reconnect` | board | Reconnect a tool app with replacement credentials |
| GET | `/api/tool-connections/{connectionId}/test-agents` | board | List agents available for tool connection test calls |
| POST | `/api/tool-connections/{connectionId}/test-calls` | board | Run a tool connection test call |
| GET | `/api/tool-connections/{connectionId}/test-calls/{actionRequestId}` | board | Get a tool connection test call status |
| GET | `/api/tool-connections/{connectionId}/usage` | board | Get tool connection usage |
| DELETE | `/api/tool-profile-entries/{entryId}` | board | Delete a tool access profile entry |
| PATCH | `/api/tool-profile-entries/{entryId}` | board | Update a tool access profile entry |
| DELETE | `/api/tool-profiles/{profileId}` | board | Delete a tool access profile |
| PATCH | `/api/tool-profiles/{profileId}` | board | Update a tool access profile |
| POST | `/api/tool-profiles/{profileId}/duplicate` | board | Duplicate a tool access profile |
| POST | `/api/tool-profiles/{profileId}/entries` | board | Create a tool access profile entry |
| GET | `/api/tool-profiles/{profileId}/new-tools` | board | List new catalog tools pending profile review |
| POST | `/api/tool-profiles/{profileId}/new-tools/review` | board | Review new catalog tools for a profile |
| GET | `/api/tools/oauth/callback` | board | Handle a tool app OAuth callback |
| POST | `/api/tools/oauth/{connectionId}/start` | board | Start OAuth sign-in for a tool connection |

## tool-gateway

| Method | Route | Actor | Summary |
|---|---|---|---|
| GET | `/api/companies/{companyId}/tools/gateways` | board | List named MCP gateways |
| POST | `/api/companies/{companyId}/tools/gateways` | board | Create a named MCP gateway |
| POST | `/api/tool-gateway/action-requests/{id}/approve` | board | Approve a deferred tool gateway action request |
| POST | `/api/tool-gateway/action-requests/{id}/decline` | board | Decline a deferred tool gateway action request |
| GET | `/api/tool-gateway/audit` | board_or_agent | List tool gateway audit events |
| POST | `/api/tool-gateway/gateway-tokens/{tokenId}/revoke` | board | Revoke a named MCP gateway token |
| PATCH | `/api/tool-gateway/gateways/{gatewayId}` | board | Update a named MCP gateway |
| GET | `/api/tool-gateway/gateways/{gatewayId}/mcp` | public | Describe a named MCP gateway endpoint |
| POST | `/api/tool-gateway/gateways/{gatewayId}/mcp` | public | Handle named MCP gateway protocol requests |
| POST | `/api/tool-gateway/gateways/{gatewayId}/tokens` | board | Create a named MCP gateway token |
| GET | `/api/tool-gateway/runtime-slots` | board_or_agent | List gateway runtime slots |
| POST | `/api/tool-gateway/runtime-slots/{slotId}/restart` | board_or_agent | Restart a gateway runtime slot |
| POST | `/api/tool-gateway/runtime-slots/{slotId}/stop` | board_or_agent | Stop a gateway runtime slot |
| POST | `/api/tool-gateway/sessions` | board_or_agent | Create a tool gateway session |
| POST | `/api/tool-gateway/sessions/{sessionId}/revoke` | board_or_agent | Revoke a tool gateway session |
| GET | `/api/tool-gateway/tools` | board_or_agent | List tools available to a gateway session |
| POST | `/api/tool-gateway/tools/call` | board_or_agent | Execute a tool through the gateway |
| GET | `/mcp/gateways/{gatewayPublicId}` | public | Describe a public MCP gateway endpoint |
| POST | `/mcp/gateways/{gatewayPublicId}` | public | Handle MCP gateway protocol requests by public id |

## tools

| Method | Route | Actor | Summary |
|---|---|---|---|
| POST | `/api/agents/me/connections/{connectionId}/token` | board | Mint a short-lived token for an agent connection |

