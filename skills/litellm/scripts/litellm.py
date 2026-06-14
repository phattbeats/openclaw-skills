#!/usr/bin/env python3
"""
LiteLLM CLI — Usage stats, spend tracking, model info, key management for PHATT-RAID.
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta

# Internal LiteLLM (PHATT-RAID). URL is non-secret — keep as default fallback.
DEFAULT_URL = os.environ.get("LITELLM_URL", "http://10.0.0.100:4000")

# Auth: read from env. Required. Script aborts below if missing.
DEFAULT_KEY = os.environ.get("LITELLM_KEY") or os.environ.get("LITELLM_API_KEY")
if not DEFAULT_KEY:
    sys.exit("litellm: missing LITELLM_KEY (or LITELLM_API_KEY) env var")
PUPPETEER_PATH = '/root/.openclaw/utilities/tawk/node_modules/puppeteer-core'


def make_headers():
    return {"Authorization": f"Bearer {DEFAULT_KEY}"}


def api_get(path, params=None):
    url = f"{DEFAULT_URL}{path}"
    if params:
        qs = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        if qs:
            url = f"{url}?{qs}"
    req = urllib.request.Request(url, headers=make_headers())
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection failed: {e.reason}"}


def api_post(path, data=None):
    url = f"{DEFAULT_URL}{path}"
    body = json.dumps(data or {}).encode()
    headers = {**make_headers(), "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection failed: {e.reason}"}


def api_delete(path, data=None):
    url = f"{DEFAULT_URL}{path}"
    body = json.dumps(data or {}).encode() if data else None
    headers = {**make_headers(), "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=body, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection failed: {e.reason}"}


def output(data, json_mode, command=None):
    if json_mode:
        envelope = {"ok": "error" not in data, "command": command, "result": data}
        if "error" in data:
            envelope["error"] = data["error"]
        print(json.dumps(envelope, indent=2, default=str))
    else:
        print_human(data)


def print_human(data):
    if isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, (list, dict)):
                print(f"{k}:")
                print_human(v)
            else:
                print(f"  {k}: {v}")
    elif isinstance(data, list):
        if not data:
            print("  (empty)")
            return
        if all(isinstance(item, dict) for item in data):
            keys = sorted(set().union(*[item.keys() for item in data]))
            widths = {k: max(len(k), max(len(str(item.get(k, ""))) for item in data)) for k in keys}
            header = " | ".join(k.ljust(widths[k]) for k in keys)
            print(header)
            print("-" * len(header))
            for item in data:
                row = " | ".join(str(item.get(k, "")).ljust(widths[k]) for k in keys)
                print(row)
            print(f"\n  Total: {len(data)}")
        else:
            for item in data:
                print(f"  {item}")
    else:
        print(data)


# ── Commands ──

def cmd_health(args, json_mode):
    data = api_get("/health")
    if "error" not in data:
        result = {
            "healthy": data.get("healthy_count", 0),
            "unhealthy": data.get("unhealthy_count", 0),
            "db": data.get("db", "unknown"),
            "status": "ok" if data.get("healthy_count", 0) > 0 else "degraded",
        }
    else:
        result = data
    output(result, json_mode, "health")


def cmd_spend(args, json_mode):
    days = args.days or 7
    end = datetime.now()
    start = end - timedelta(days=days)
    params = {
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
    }
    logs = api_get("/spend/logs", params)
    if isinstance(logs, list):
        total = 0
        by_date = {}
        by_model = {}
        for log in logs:
            date = log.get("startTime", "unknown")[:10]
            spend = log.get("spend", 0)
            total += spend
            by_date[date] = by_date.get(date, 0) + spend
            models = log.get("models", {})
            if isinstance(models, dict):
                for model, model_spend in models.items():
                    if model:
                        by_model[model] = by_model.get(model, 0) + model_spend
        result = {
            "period": f"{params['start_date']} to {params['end_date']}",
            "total_spend": round(total, 4),
            "entries": len(logs),
            "by_date": {k: round(v, 4) for k, v in sorted(by_date.items())},
            "by_model": {k: round(v, 4) for k, v in sorted(by_model.items(), key=lambda x: -x[1])},
        }
    else:
        result = logs
    output(result, json_mode, "spend")


def cmd_models(args, json_mode):
    data = api_get("/model/info")
    models = data.get("data", data) if isinstance(data, dict) else data
    if isinstance(models, list):
        result = []
        for m in models:
            name = m.get("model_name", "?")
            info = m.get("model_info", {})
            result.append({
                "model": name,
                "input_per_1m": round(info.get("input_cost_per_token", 0) * 1_000_000, 2),
                "output_per_1m": round(info.get("output_cost_per_token", 0) * 1_000_000, 2),
            })
        result.sort(key=lambda x: x["model"])
    else:
        result = models
    output(result, json_mode, "models")


def cmd_global_spend(args, json_mode):
    data = api_get("/global/spend")
    if "error" not in data:
        result = {
            "total_spend": round(data.get("spend", 0), 4),
            "max_budget": data.get("max_budget", 0),
        }
    else:
        result = data
    output(result, json_mode, "global-spend")


def cmd_users(args, json_mode):
    data = api_get("/user/list")
    users = data.get("users", data.get("data", [])) if isinstance(data, dict) else data
    if isinstance(users, list):
        result = [{"user_id": u.get("user_id", "?"), "spend": round(u.get("spend", 0), 4)} for u in users]
        result.sort(key=lambda x: -x["spend"])
    else:
        result = users
    output(result, json_mode, "users")


def cmd_keys_list(args, json_mode):
    data = api_get("/key/list")
    keys = data.get("keys", data) if isinstance(data, dict) else data
    if isinstance(keys, list):
        result = []
        for k in keys:
            key_val = k.get("key", "")
            result.append({
                "alias": k.get("key_alias", "-"),
                "key": key_val[:12] + "..." if len(key_val) > 12 else key_val,
                "spend": round(k.get("spend", 0), 4),
                "models": ", ".join(k.get("models", [])[:3]) or "all",
            })
    else:
        result = keys
    output(result, json_mode, "keys-list")


def cmd_key_create(args, json_mode):
    data = {"key_alias": args.alias, "duration": args.duration or "30d"}
    if args.models:
        data["models"] = args.models.split(",")
    result = api_post("/key/generate", data)
    if "error" not in result and "key" in result:
        result = {
            "key": result["key"][:12] + "...",
            "alias": result.get("key_alias", args.alias),
            "note": "Full key returned by API",
        }
    output(result, json_mode, "key-create")


def cmd_key_delete(args, json_mode):
    result = api_delete("/key/delete", {"keys": [args.key]})
    output(result, json_mode, "key-delete")


def cmd_overview(args, json_mode):
    health = api_get("/health")
    global_spend = api_get("/global/spend")
    today = datetime.now().strftime("%Y-%m-%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    logs = api_get("/spend/logs", {"start_date": week_ago, "end_date": today})
    today_spend = 0
    week_spend = 0
    if isinstance(logs, list):
        for l in logs:
            spend = l.get("spend", 0)
            week_spend += spend
            if l.get("startTime", "").startswith(today):
                today_spend += spend
    result = {
        "health": {
            "status": "ok" if health.get("healthy_count", 0) > 0 else "degraded",
            "healthy": health.get("healthy_count", 0),
            "unhealthy": health.get("unhealthy_count", 0),
        },
        "spend": {
            "today": round(today_spend, 4),
            "week": round(week_spend, 4),
            "total": round(global_spend.get("spend", 0), 4),
        },
    }
    output(result, json_mode, "overview")


def cmd_usage(args, json_mode):
    """Daily usage with token counts via /user/daily/activity."""
    days = args.days or 7
    end = datetime.now()
    start = end - timedelta(days=days)
    params = {
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
    }
    data = api_get("/user/daily/activity", params)
    
    if "error" in data:
        output(data, json_mode, "usage")
        return
    
    results = data.get("results", [])
    if not results:
        output({"message": "No usage data found"}, json_mode, "usage")
        return
    
    # Aggregate
    total_requests = 0
    total_tokens = 0
    total_spend = 0
    total_prompt = 0
    total_completion = 0
    by_model = {}
    by_date = {}
    
    for day in results:
        m = day.get("metrics", {})
        date = day.get("date", "?")
        total_requests += m.get("api_requests", 0)
        total_tokens += m.get("total_tokens", 0)
        total_spend += m.get("spend", 0)
        total_prompt += m.get("prompt_tokens", 0)
        total_completion += m.get("completion_tokens", 0)
        
        by_date[date] = {
            "requests": m.get("api_requests", 0),
            "tokens": m.get("total_tokens", 0),
            "spend": round(m.get("spend", 0), 4),
            "success": m.get("successful_requests", 0),
            "failed": m.get("failed_requests", 0),
        }
        
        models = day.get("breakdown", {}).get("models", {})
        for model_name, model_data in models.items():
            mm = model_data.get("metrics", {})
            if model_name not in by_model:
                by_model[model_name] = {"tokens": 0, "requests": 0, "spend": 0}
            by_model[model_name]["tokens"] += mm.get("total_tokens", 0)
            by_model[model_name]["requests"] += mm.get("api_requests", 0)
            by_model[model_name]["spend"] += mm.get("spend", 0)
    
    # Sort models by tokens
    by_model_sorted = dict(sorted(by_model.items(), key=lambda x: -x[1]["tokens"]))
    # Round spend
    for k in by_model_sorted:
        by_model_sorted[k]["spend"] = round(by_model_sorted[k]["spend"], 4)
    
    result = {
        "period": f"{params['start_date']} to {params['end_date']}",
        "total": {
            "requests": total_requests,
            "tokens": total_tokens,
            "prompt_tokens": total_prompt,
            "completion_tokens": total_completion,
            "spend": round(total_spend, 4),
        },
        "by_date": dict(sorted(by_date.items(), reverse=True)),
        "by_model": by_model_sorted,
    }
    
    output(result, json_mode, "usage")


def cmd_logs(args, json_mode):
    """Scrape the LiteLLM UI for per-request logs with token counts."""
    limit = args.limit or 25
    
    js_code = f"""
const puppeteer = require('{PUPPETEER_PATH}');
const MASTER_KEY = '{DEFAULT_KEY}';

(async () => {{
  try {{
    const browser = await puppeteer.connect({{ browserWSEndpoint: 'ws://browserless:3000' }});
    const page = await browser.newPage();
    
    await page.goto('{DEFAULT_URL}/ui/', {{ waitUntil: 'networkidle2', timeout: 15000 }});
    await page.waitForSelector('input[placeholder="Enter your username"]', {{ timeout: 10000 }});
    await page.type('input[placeholder="Enter your username"]', 'admin');
    await page.type('input[placeholder="Enter your password"]', MASTER_KEY);
    await page.click('button');
    await new Promise(r => setTimeout(r, 3000));
    
    await page.goto('{DEFAULT_URL}/ui/logs', {{ waitUntil: 'domcontentloaded', timeout: 20000 }});
    await new Promise(r => setTimeout(r, 3000));
    
    // Click "Last 24 Hours" filter to get recent data
    await page.evaluate(() => {{
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Last 24'));
      if (btn) btn.click();
    }});
    await new Promise(r => setTimeout(r, 1500));
    
    // Click "Fetch" to load filtered data
    await page.evaluate(() => {{
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === 'Fetch');
      if (btn) btn.click();
    }});
    await new Promise(r => setTimeout(r, 4000));
    
    // Click "Previous" to get to newest entries
    await page.evaluate(() => {{
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === 'Previous');
      if (btn) btn.click();
    }});
    await new Promise(r => setTimeout(r, 2000));
    
    const text = await page.evaluate(() => document.body.innerText);
    await browser.disconnect();
    
    // Each entry is multi-line, starting with timestamp "MM/DD/YYYY HH:MM:SS AM/PM"
    const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
    const tsRe = /^\d{{2}}\/\d{{2}}\/\d{{4}}\s+\d{{2}}:\d{{2}}:\d{{2}}\s+[AP]M$/;
    
    const entries = [];
    let cur = null;
    for (const line of lines) {{
      if (tsRe.test(line)) {{
        if (cur && cur.length >= 8) entries.push(cur);
        cur = [line];
      }} else if (cur) {{
        cur.push(line);
      }}
    }}
    if (cur && cur.length >= 8) entries.push(cur);
    
    // Parse fields by pattern, not position (UI layout varies)
    const parsed = entries.slice(-{limit}).map(f => {{
      const ts = f[0];
      // f[1] is "LLM\tSuccess" or "LLM\tFailure" — split on tab
      const typeAndStatus = (f[1] || '').split('\\t');
      const status = typeAndStatus[1] || '-';
      const costField = f[4] && f[4].startsWith('$') ? f[4] : '-';
      const tokenField = f.find(x => /^\\d+\\(\\d+\\+\\d+\\)$/.test(x));
      
      return {{
        time: ts,
        status,
        cost: costField,
        latency: f[5] || '-',
        ttft: f[6] || '-',
        model: f[10] || '-',
        tokens: tokenField ? (() => {{ const m = tokenField.match(/(\\d+)\\((\\d+)\\+(\\d+)\\)/); return {{ total:+m[1], input:+m[2], output:+m[3] }}; }})() : null,
      }};
    }});
    
    console.log(JSON.stringify({{ ok: true, logs: parsed }}));
    process.exit(0);
  }} catch (e) {{
    console.error(JSON.stringify({{ ok: false, error: e.message }}));
    process.exit(1);
  }}
}})();
"""
    
    try:
        result = subprocess.run(['node', '-e', js_code], capture_output=True, text=True, timeout=45)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            logs = data.get("logs", [])
            if json_mode:
                output({"logs": logs, "count": len(logs)}, json_mode, "logs")
            else:
                if not logs:
                    print("  No logs found (check browserless is running)")
                    return
                print(f"{'Time':<22} {'Status':<8} {'Cost':<10} {'Latency':<8} {'Tokens':<18} {'Model'}")
                print("-" * 100)
                for l in logs:
                    tok = f"{l['tokens']['total']:,}" if l.get('tokens') else "-"
                    print(f"{l['time']:<22} {l['status']:<8} {l['cost']:<10} {l['latency']:<8} {tok:<18} {l['model']}")
                print(f"\n  {len(logs)} requests")
        else:
            err = json.loads(result.stderr) if result.stderr else {"error": "Scraping failed"}
            output(err, json_mode, "logs")
    except subprocess.TimeoutExpired:
        output({"error": "Scraping timed out (45s)"}, json_mode, "logs")
    except Exception as e:
        output({"error": str(e)}, json_mode, "logs")


def main():
    parser = argparse.ArgumentParser(prog="litellm", description="LiteLLM CLI")
    parser.add_argument("--json", action="store_true", help="Force JSON output")
    sub = parser.add_subparsers(dest="command")
    
    sub.add_parser("health", help="Health check")
    p_spend = sub.add_parser("spend", help="Spend by date range")
    p_spend.add_argument("--days", type=int, default=7)
    sub.add_parser("models", help="List models + pricing")
    sub.add_parser("global-spend", help="Total lifetime spend")
    sub.add_parser("users", help="Per-user spend")
    
    p_keys = sub.add_parser("keys", help="Key management")
    keys_sub = p_keys.add_subparsers(dest="keys_command")
    keys_sub.add_parser("list")
    p_create = keys_sub.add_parser("create")
    p_create.add_argument("alias")
    p_create.add_argument("--duration")
    p_create.add_argument("--models")
    p_delete = keys_sub.add_parser("delete")
    p_delete.add_argument("key")
    
    sub.add_parser("overview", help="Health + spend snapshot")
    p_usage = sub.add_parser("usage", help="Daily usage with token counts")
    p_usage.add_argument("--days", type=int, default=7)
    p_logs = sub.add_parser("logs", help="Per-request logs (UI scraping, ~30s)")
    p_logs.add_argument("--limit", type=int, default=25)
    
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    json_mode = args.json or not sys.stdout.isatty()
    
    cmd_map = {
        "health": lambda: cmd_health(args, json_mode),
        "spend": lambda: cmd_spend(args, json_mode),
        "models": lambda: cmd_models(args, json_mode),
        "global-spend": lambda: cmd_global_spend(args, json_mode),
        "users": lambda: cmd_users(args, json_mode),
        "overview": lambda: cmd_overview(args, json_mode),
        "usage": lambda: cmd_usage(args, json_mode),
        "logs": lambda: cmd_logs(args, json_mode),
        "keys": lambda: (
            cmd_keys_list(args, json_mode) if args.keys_command == "list"
            else cmd_key_create(args, json_mode) if args.keys_command == "create"
            else cmd_key_delete(args, json_mode) if args.keys_command == "delete"
            else (parser.print_help(), sys.exit(1))
        ),
    }
    
    cmd = cmd_map.get(args.command)
    if cmd:
        cmd()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
