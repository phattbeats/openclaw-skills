#!/usr/bin/env python3
"""
Glances CLI — Server monitoring for PHATT-RAID.
Replaces fetch/parse/threshold/quickcheck scripts with one unified CLI.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_URL = os.environ.get("GLANCES_BASE_URL", "http://10.0.0.100:61208/api/4")

# Thresholds
THRESHOLDS = {
    "cpu": {"warning": 85, "critical": 95},
    "mem": {"warning": 80, "critical": 90},
    "fs": {"warning": 85, "critical": 95},
    "load": {"warning": 10, "critical": 12},
    "temp": {"warning": 80, "critical": 90},
}

CRITICAL_CONTAINERS = ["OpenClaw", "swag", "nextcloud", "browserless", "PlexMediaServer"]


def api_get(endpoint):
    url = f"{DEFAULT_URL}/{endpoint}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, json.JSONDecodeError, Exception) as e:
        return {"error": str(e)}


def status_icon(value, metric):
    """Return status icon based on thresholds."""
    t = THRESHOLDS.get(metric, {})
    if value >= t.get("critical", 999):
        return "🔴"
    elif value >= t.get("warning", 999):
        return "🟡"
    return "🟢"


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
            print(f"\n  {len(data)} item(s)")
        else:
            for item in data:
                print(f"  {item}")
    else:
        print(data)


# ── Commands ──

def cmd_cpu(args, json_mode):
    data = api_get("cpu")
    if "error" in data:
        output(data, json_mode, "cpu")
        return
    
    result = {
        "percent": data.get("total", 0),
        "user": data.get("user", 0),
        "system": data.get("system", 0),
        "iowait": data.get("iowait", 0),
        "cores": data.get("cpucore", 0),
        "status": status_icon(data.get("total", 0), "cpu"),
    }
    output(result, json_mode, "cpu")


def cmd_mem(args, json_mode):
    data = api_get("mem")
    if "error" in data:
        output(data, json_mode, "mem")
        return
    
    total = data.get("total", 0)
    used = data.get("used", 0)
    percent = (used / total * 100) if total > 0 else 0
    
    result = {
        "used_gb": round(used / (1024**3), 1),
        "total_gb": round(total / (1024**3), 1),
        "available_gb": round(data.get("available", 0) / (1024**3), 1),
        "percent": round(percent, 1),
        "status": status_icon(percent, "mem"),
    }
    output(result, json_mode, "mem")


def cmd_load(args, json_mode):
    data = api_get("load")
    if "error" in data:
        output(data, json_mode, "load")
        return
    
    min1 = data.get("min1", 0)
    result = {
        "min1": min1,
        "min5": data.get("min5", 0),
        "min15": data.get("min15", 0),
        "cores": data.get("cpucore", 0),
        "status": status_icon(min1, "load"),
    }
    output(result, json_mode, "load")


def cmd_containers(args, json_mode):
    data = api_get("containers")
    if "error" in data:
        output(data, json_mode, "containers")
        return
    
    containers = []
    for c in data:
        cpu = c.get("cpu", 0)
        if isinstance(cpu, dict):
            cpu = cpu.get("total", 0)
        mem = c.get("memory", 0)
        if isinstance(mem, dict):
            mem = mem.get("usage", 0)
        containers.append({
            "name": c.get("name", "?"),
            "status": c.get("status", "?"),
            "cpu": round(float(cpu or 0), 1),
            "mem_gb": round(float(mem or 0) / (1024**3), 2),
            "uptime": c.get("uptime", "-"),
        })
    
    # Sort by CPU descending
    containers.sort(key=lambda x: -x["cpu"])
    
    # Filter by name if specified
    if hasattr(args, 'filter') and args.filter:
        containers = [c for c in containers if args.filter.lower() in c["name"].lower()]
    
    # Limit
    if hasattr(args, 'limit') and args.limit:
        containers = containers[:args.limit]
    
    # Check for missing critical containers
    running = {c["name"] for c in containers if c["status"] in ("running", "healthy")}
    missing = [name for name in CRITICAL_CONTAINERS if name not in running]
    
    result = {"containers": containers}
    if missing:
        result["missing_critical"] = missing
        result["alert"] = f"🔴 Missing: {', '.join(missing)}"
    
    output(result, json_mode, "containers")


def cmd_fs(args, json_mode):
    data = api_get("fs")
    if "error" in data:
        output(data, json_mode, "fs")
        return
    
    disks = []
    for d in data:
        total = d.get("size", 0)
        used = d.get("used", 0)
        percent = (used / total * 100) if total > 0 else 0
        disks.append({
            "mount": d.get("mnt_point", "?"),
            "percent": round(percent, 1),
            "used_tb": round(used / (1024**4), 2),
            "total_tb": round(total / (1024**4), 2),
            "free_tb": round((total - used) / (1024**4), 2),
            "status": status_icon(percent, "fs"),
        })
    
    disks.sort(key=lambda x: -x["percent"])
    output({"disks": disks}, json_mode, "fs")


def cmd_diskio(args, json_mode):
    data = api_get("diskio")
    if "error" in data:
        output(data, json_mode, "diskio")
        return
    
    disks = []
    for d in data:
        read = d.get("read_bytes", 0)
        write = d.get("write_bytes", 0)
        if read > 0 or write > 0:
            disks.append({
                "disk": d.get("disk_name", "?"),
                "read_mb_s": round(read / (1024**2), 1),
                "write_mb_s": round(write / (1024**2), 1),
            })
    
    disks.sort(key=lambda x: -(x["read_mb_s"] + x["write_mb_s"]))
    output({"active_disks": disks}, json_mode, "diskio")


def cmd_network(args, json_mode):
    data = api_get("network")
    if "error" in data:
        output(data, json_mode, "network")
        return
    
    interfaces = []
    for iface in data:
        rx = iface.get("rx", 0)
        tx = iface.get("tx", 0)
        if rx > 0 or tx > 0:
            interfaces.append({
                "interface": iface.get("interface_name", "?"),
                "rx_mb_s": round(rx / (1024**2), 2),
                "tx_mb_s": round(tx / (1024**2), 2),
            })
    
    interfaces.sort(key=lambda x: -(x["rx_mb_s"] + x["tx_mb_s"]))
    output({"interfaces": interfaces}, json_mode, "network")


def cmd_temp(args, json_mode):
    data = api_get("sensors")
    if "error" in data:
        output(data, json_mode, "temp")
        return
    
    temps = []
    for s in data:
        if s.get("unit") == "C" and s.get("value", 0) > 0:
            val = s.get("value", 0)
            temps.append({
                "sensor": s.get("label", "?"),
                "celsius": val,
                "status": status_icon(val, "temp"),
            })
    
    temps.sort(key=lambda x: -x["celsius"])
    output({"temperatures": temps}, json_mode, "temp")


def cmd_overview(args, json_mode):
    """Quick health check — the 'am I okay?' command."""
    cpu = api_get("cpu")
    mem = api_get("mem")
    load_data = api_get("load")
    fs = api_get("fs")
    containers = api_get("containers")
    sensors = api_get("sensors")
    
    if "error" in cpu:
        output({"error": "Glances unreachable"}, json_mode, "overview")
        return
    
    # CPU
    cpu_pct = cpu.get("total", 0)
    
    # Memory
    mem_total = mem.get("total", 0)
    mem_used = mem.get("used", 0)
    mem_pct = (mem_used / mem_total * 100) if mem_total > 0 else 0
    
    # Load
    load1 = load_data.get("min1", 0)
    
    # Temp
    temp_c = 0
    for s in sensors:
        if s.get("label") == "Tctl" and s.get("unit") == "C":
            temp_c = s.get("value", 0)
            break
    
    # Containers
    running = set()
    for c in containers:
        if c.get("status") in ("running", "healthy"):
            running.add(c.get("name", ""))
    missing = [n for n in CRITICAL_CONTAINERS if n not in running]
    
    # Build summary
    alerts = []
    if cpu_pct >= THRESHOLDS["cpu"]["warning"]:
        alerts.append(f"{'🔴' if cpu_pct >= THRESHOLDS['cpu']['critical'] else '🟡'} CPU at {cpu_pct}%")
    if mem_pct >= THRESHOLDS["mem"]["warning"]:
        alerts.append(f"{'🔴' if mem_pct >= THRESHOLDS['mem']['critical'] else '🟡'} RAM at {mem_pct:.0f}%")
    if temp_c >= THRESHOLDS["temp"]["warning"]:
        alerts.append(f"{'🔴' if temp_c >= THRESHOLDS['temp']['critical'] else '🟡'} CPU temp {temp_c}°C")
    if missing:
        alerts.append(f"🔴 Containers down: {', '.join(missing)}")
    
    result = {
        "cpu": {"percent": cpu_pct, "status": status_icon(cpu_pct, "cpu")},
        "memory": {"percent": round(mem_pct, 1), "used_gb": round(mem_used / (1024**3), 1), "total_gb": round(mem_total / (1024**3), 1), "status": status_icon(mem_pct, "mem")},
        "load": {"min1": load1, "status": status_icon(load1, "load")},
        "temp_celsius": temp_c,
        "containers": {"running": len(running), "missing_critical": missing},
        "overall": "ok" if not alerts else ("warning" if not any("🔴" in a for a in alerts) else "critical"),
    }
    if alerts:
        result["alerts"] = alerts
    
    output(result, json_mode, "overview")


def cmd_system(args, json_mode):
    data = api_get("system")
    if "error" in data:
        output(data, json_mode, "system")
        return
    
    result = {
        "hostname": data.get("hostname", "?"),
        "os": data.get("os_name", "?"),
        "version": data.get("os_version", "?"),
        "platform": data.get("platform", "?"),
        "uptime": data.get("uptime", "?"),
    }
    output(result, json_mode, "system")


def main():
    parser = argparse.ArgumentParser(prog="glances", description="Glances CLI — Server monitoring for PHATT-RAID")
    parser.add_argument("--json", action="store_true", help="Force JSON output")
    sub = parser.add_subparsers(dest="command")
    
    sub.add_parser("cpu", help="CPU usage")
    sub.add_parser("mem", help="Memory usage")
    sub.add_parser("load", help="System load")
    p_containers = sub.add_parser("containers", help="Docker containers")
    p_containers.add_argument("--filter", help="Filter by name")
    p_containers.add_argument("--limit", type=int, help="Limit results")
    sub.add_parser("fs", help="Filesystem usage")
    sub.add_parser("diskio", help="Disk I/O (active only)")
    sub.add_parser("network", help="Network interfaces (active only)")
    sub.add_parser("temp", help="Temperature sensors")
    sub.add_parser("overview", help="Quick health check")
    sub.add_parser("system", help="System info")
    
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    json_mode = args.json or not sys.stdout.isatty()
    
    commands = {
        "cpu": lambda: cmd_cpu(args, json_mode),
        "mem": lambda: cmd_mem(args, json_mode),
        "load": lambda: cmd_load(args, json_mode),
        "containers": lambda: cmd_containers(args, json_mode),
        "fs": lambda: cmd_fs(args, json_mode),
        "diskio": lambda: cmd_diskio(args, json_mode),
        "network": lambda: cmd_network(args, json_mode),
        "temp": lambda: cmd_temp(args, json_mode),
        "overview": lambda: cmd_overview(args, json_mode),
        "system": lambda: cmd_system(args, json_mode),
    }
    
    cmd = commands.get(args.command)
    if cmd:
        cmd()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
