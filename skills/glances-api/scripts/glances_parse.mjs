#!/usr/bin/env node
// Parse and normalize Glances API output
// Usage: echo '<json>' | glances_parse.mjs <endpoint>
const endpoint = process.argv[2];
if (!endpoint) { console.error('Usage: glances_parse.mjs <endpoint>'); process.exit(1); }

const gb = v => Math.round((v / 1073741824) * 10) / 10;
const tb = v => Math.round((v / 1099511627776) * 100) / 100;
const pct = v => Math.round((v || 0) * 10) / 10;

const parsers = {
  cpu: raw => ({ percent: pct(100 - (raw.idle || 0)), user: pct(raw.user), system: pct(raw.system), iowait: pct(raw.iowait), cores: raw.cpucore || 0 }),
  mem: raw => ({ used_gb: gb(raw.used), total_gb: gb(raw.total), percent: pct(raw.percent), available_gb: gb(raw.available) }),
  memswap: raw => ({ used_gb: gb(raw.used), total_gb: gb(raw.total), percent: pct(raw.percent) }),
  load: raw => ({ min1: raw.min1, min5: raw.min5, min15: raw.min15, cores: raw.cpucore }),
  containers: raw => (Array.isArray(raw) ? raw : []).map(c => ({
    name: c.name, status: c.status, cpu: pct(c.cpu_percent), mem_gb: gb(c.memory_usage || 0), uptime: c.uptime || 'unknown'
  })).sort((a, b) => b.cpu - a.cpu),
  fs: raw => (Array.isArray(raw) ? raw : []).map(f => ({
    mount: f.mnt_point, percent: pct(f.percent), used_tb: tb(f.used), size_tb: tb(f.size), free_tb: tb(f.free)
  })).sort((a, b) => b.percent - a.percent),
  diskio: raw => (Array.isArray(raw) ? raw : []).map(d => ({
    disk: d.disk_name, read_mb_s: Math.round((d.read_bytes_rate_per_sec || 0) / 1048576 * 100) / 100,
    write_mb_s: Math.round((d.write_bytes_rate_per_sec || 0) / 1048576 * 100) / 100
  })).filter(d => d.read_mb_s > 0 || d.write_mb_s > 0),
  network: raw => (Array.isArray(raw) ? raw : []).map(n => ({
    iface: n.interface_name, rx_mb_s: Math.round((n.bytes_recv_rate_per_sec || 0) / 1048576 * 100) / 100,
    tx_mb_s: Math.round((n.bytes_sent_rate_per_sec || 0) / 1048576 * 100) / 100
  })).filter(n => n.rx_mb_s > 0.01 || n.tx_mb_s > 0.01),
  system: raw => ({ hostname: raw.hostname, os: raw.os_name, platform: raw.platform, version: raw.os_version }),
  percpu: raw => (Array.isArray(raw) ? raw : []).map(c => ({ core: c.cpu_number, percent: pct(100 - (c.idle || 0)) })),
  uptime: raw => raw,
  sensors: raw => (Array.isArray(raw) ? raw : []).map(s => ({ label: s.label, value: s.value, unit: s.unit, type: s.type })),
};

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const raw = JSON.parse(input);
    const parser = parsers[endpoint];
    if (!parser) { console.log(JSON.stringify(raw)); return; }
    console.log(JSON.stringify(parser(raw), null, 2));
  } catch (e) {
    console.error(`Parse error: ${e.message}`);
    process.exit(1);
  }
});
