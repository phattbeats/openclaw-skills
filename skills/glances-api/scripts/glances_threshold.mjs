#!/usr/bin/env node
// Check a metric value against warning/critical thresholds
// Usage: glances_threshold.mjs <metric> <value> [--warning=85] [--critical=95] [--op=gt]
const [,, metric, value, ...args] = process.argv;
if (!metric || !value) { console.error('Usage: glances_threshold.mjs <metric> <value>'); process.exit(1); }

const num = parseFloat(value);
const getArg = (name, def) => parseFloat((args.find(a => a.startsWith(`--${name}=`)) || '').split('=')[1]) || def;
const warning = getArg('warning', 85);
const critical = getArg('critical', 95);
const op = (args.find(a => a.startsWith('--op=')) || '').split('=')[1] || 'gt';

const check = op === 'gt' ? v => v > warning : v => v < warning;
const checkCrit = op === 'gt' ? v => v > critical : v => v < critical;
const status = checkCrit(num) ? 'critical' : check(num) ? 'warning' : 'ok';

console.log(JSON.stringify({ status, metric, value: num, warning, critical }));
