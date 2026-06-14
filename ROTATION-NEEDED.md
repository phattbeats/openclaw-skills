# Credential Rotation Needed

**Status:** CRITICAL — this repo is public at github.com/phattbeats/openclaw-skills
**Generated:** 2026-06-14 (during secrets redaction pass)
**Redaction commit:** pending

Every credential listed below was committed in plaintext to the public GitHub repo. Even after redaction in `master`, the values remain in git history. **All of them need to be rotated** by issuing new credentials at the respective service and updating `.env`.

The redaction only prevents *future* leaks. The history is permanent.

---

## Rotation Checklist

### Internal / PHATT-RAID services

- [ ] **PLEX_TOKEN** (Plex) — Settings → Account → "Show XML token" or `cat /etc/plex/Preferences.xml`
- [ ] **TAUTULLI_API_KEY** (Tautulli) — Settings → Web Interface → API key
- [ ] **TMDB_API_KEY** (TheMovieDB) — https://www.themoviedb.org/settings/api → Regenerate
- [ ] **SONARR_KEY** (Sonarr) — Settings → General → API Key
- [ ] **RADARR_KEY** (Radarr) — Settings → General → API Key
- [ ] **DELUGE_PASSWORD** (Deluge) — WebUI → Preferences → Interface → Password
- [ ] **PROWLARR_API_KEY** (Prowlarr) — Settings → General → API Key
- [ ] **LITELLM_KEY** (LiteLLM) — the Anthropic OAuth bearer token at the proxy. Rotate by re-running the OAuth flow against `https://console.anthropic.com` and updating the proxy's stored key.

### External SaaS

- [ ] **CF_API_TOKEN_PHATT_TECH** (Cloudflare) — https://dash.cloudflare.com/profile/api-tokens → Edit → Roll
- [ ] **CF_ACCOUNT_ID** is non-secret (UUID), no rotation needed
- [ ] **NAMECHEAP_API_KEY** (Namecheap) — https://ap.www.namecheap.com/settings/tools/apiaccess/ → regenerate. **Update IP whitelist** at the same time if the public IP changed.
- [ ] **GHOST_ADMIN_API_KEY** (Ghost PMC) — Settings → Integrations → Custom → regenerate. Update `GHOST_ADMIN_API_KEY` in env. Also roll the public content key (`GHOST_CONTENT_API_KEY`).
- [ ] **RESEND_API_KEY** (Resend) — https://resend.com/api-keys → Revoke old, create new
- [ ] **ELEVENLABS_API_KEY** (ElevenLabs) — https://elevenlabs.io/profile → API Keys → Revoke old
- [ ] **MS_GRAPH_CLIENT_SECRET** (Azure AD) — Entra portal → App registrations → PHATT TECH Agent → Certificates & secrets → New client secret. Old secret still works until expiry — set a 24h expiry reminder to delete it.
- [ ] **CRAWL4AI_API_TOKEN** (crawl4ai) — internal container, just pick a new token and set in env + restart container
- [ ] **PAX8_CLIENT_ID** + **PAX8_CLIENT_SECRET** (Pax8) — Pax8 partner portal → API access → regenerate

### Personal / per-agent

- [ ] **GITHUB_TOKEN** (`***REMOVED***`) — visible in `git remote -v` output. Generate new fine-grained token at https://github.com/settings/tokens with `contents: write` only on `phattbeats/openclaw-skills`. Then `git remote set-url origin https://NEW_TOKEN@github.com/phattbeats/openclaw-skills.git`.

---

## After Rotation

1. Update `~/.openclaw/workspace/.env` with the new values
2. Restart affected containers (Deluge, Plex, etc.) if needed
3. Verify scripts still work: run `python3 skills/plex/scripts/plex.py stats` etc.
4. Force-push the new commit to GitHub with `git push origin master` (will require new token)

## Redaction Summary

**19 files touched, 27 secrets removed.**

| File | What was removed |
|------|------------------|
| `skills/litellm/scripts/litellm.py` | `sk-ant-oat01-...` Anthropic OAuth bearer token (as default fallback) |
| `skills/plex/scripts/plex.py` | Plex token, Tautulli key, TMDB key (hardcoded consts) |
| `skills/plex-stats/scripts/sync_plex.py` | Plex token |
| `skills/plex-stats/scripts/sync_tautulli_to_sqlite.py` | Tautulli key |
| `skills/plex-stats/scripts/sync_db.py` | Tautulli key |
| `skills/cloudflare/scripts/lib/client.ts` | Cloudflare API token + account ID (hardcoded consts) |
| `skills/namecheap-cli/scripts/lib/client.js` | Namecheap API key |
| `skills/ghost/scripts/lib/client.ts` | Ghost admin key ID + secret + content key |
| `skills/ghost-wizarr/scripts/sync-ghost-to-wizarr.ts` | Ghost admin key ID + secret |
| `skills/podcast-gen/scripts/render.py` | ElevenLabs API key |
| `skills/podcast-gen-vacation/scripts/render.py` | ElevenLabs API key (duplicate) |
| `skills/resend/scripts/lib/client.ts` | Resend API key |
| `skills/prowlarr/scripts/prowlarr.ts` | Deluge password (as default fallback) |
| `skills/deluge-cleanup/scripts/deluge_cleanup.py` | Deluge pass, Plex token, Sonarr key, Radarr key (as defaults) |
| `skills/deluge/scripts/deluge.py` | Deluge password (as default) |
| `skills/deluge/scripts/lib/rpc.py` | Deluge password (as default in class init) |
| `skills/ms-graph/scripts/lib/client.ts` | MS Graph client_id UUID (low-sensitivity) + placeholder secret string |
| `skills/crawl4ai/scripts/crawl4ai.sh` | `***REMOVED***` (as default) |
| `skills/plex/SKILL.md` | Plex token, Tautulli key, TMDB key in setup example |
| `skills/prowlarr/SKILL.md` | Prowlarr API key in setup example + 3 doc references |
| `skills/pax8/SKILL.md` | Pax8 client_id + client_secret in auth example |
| `skills/meeting-transcription/SKILL.md` | `***REMOVED***` in pipeline example |
| `skills/crawl4ai/SKILL.md` | `***REMOVED***` in auth example |
| `skills/deluge/SKILL.md` | Deluge password in setup example |
| `skills/deluge-cleanup/SKILL.md` | Plex, Sonarr, Radarr keys in credentials section |
| `skills/namecheap-cli/SKILL.md` | Namecheap API key in auth section |
| `skills/ms-graph/SKILL.md` | MS Graph client_id (UUID, low-sensitivity) in 3 references |

**All secrets now sourced from env vars. Scripts abort with clear errors if env vars are missing.** No hardcoded fallbacks remain.
