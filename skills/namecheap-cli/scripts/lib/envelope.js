"use strict";
/**
 * Output envelope helpers — dual-mode output (human tables / JSON).
 */

let _mode = "human";

function setMode(mode) {
  _mode = mode;
}

function getMode() {
  return _mode;
}

function output(humanFn, data) {
  if (_mode === "json") {
    console.log(JSON.stringify(data, null, 2));
  } else {
    humanFn();
  }
}

/** Simple table renderer */
function printTable(rows, columns) {
  if (!rows || rows.length === 0) {
    console.log("(no results)");
    return;
  }
  const cols = columns || Object.keys(rows[0]);
  const widths = cols.map((c) => c.length);
  rows.forEach((row) => {
    cols.forEach((c, i) => {
      const val = String(row[c] ?? "");
      widths[i] = Math.max(widths[i], val.length);
    });
  });
  const header = cols.map((c, i) => c.toUpperCase().padEnd(widths[i])).join("  ");
  const divider = widths.map((w) => "─".repeat(w)).join("  ");
  console.log(header);
  console.log(divider);
  rows.forEach((row) => {
    const line = cols.map((c, i) => String(row[c] ?? "").padEnd(widths[i])).join("  ");
    console.log(line);
  });
}

function printKv(obj) {
  const maxKey = Math.max(...Object.keys(obj).map((k) => k.length));
  for (const [k, v] of Object.entries(obj)) {
    console.log(`  ${k.padEnd(maxKey)}  ${v}`);
  }
}

function handleError(err) {
  if (_mode === "json") {
    console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
  } else {
    console.error(`\x1b[31mError:\x1b[0m ${err instanceof Error ? err.message : err}`);
    if (err.rawXml) {
      console.error("\nRaw API Response (for debugging):");
      console.error(err.rawXml.slice(0, 1000));
    }
  }
  process.exit(1);
}

module.exports = { setMode, getMode, output, printTable, printKv, handleError };
