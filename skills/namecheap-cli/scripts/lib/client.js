"use strict";
/**
 * Namecheap API Client
 * Handles auth, IP detection, XML parsing, and HTTP requests.
 */

const { execSync } = require("child_process");
const https = require("https");
const querystring = require("querystring");

const API_KEY = "71decf0d8e7841cc9a9325a74f5d8127";
const API_USER = "phatt";
const API_ENDPOINT = "https://api.namecheap.com/xml.response";

let _cachedIp = null;

async function getClientIp() {
  if (_cachedIp) return _cachedIp;
  const sources = [
    "curl -s --max-time 5 https://ifconfig.me",
    "curl -s --max-time 5 https://api.ipify.org",
    "curl -s --max-time 5 https://checkip.amazonaws.com",
  ];
  for (const cmd of sources) {
    try {
      const ip = execSync(cmd, { encoding: "utf8" }).trim();
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
        _cachedIp = ip;
        return ip;
      }
    } catch {}
  }
  throw new Error("Could not detect public IP. Check network connectivity.");
}

// ─── XML Parser ────────────────────────────────────────────────────────────────

class ParsedXml {
  constructor(xml) {
    this.xml = xml;
  }

  /** Get attribute value from the first matching tag */
  attr(tag, attribute) {
    const tagPattern = new RegExp(`<${tag}[^>]*>|<${tag}[^/]*/>`);
    const match = this.xml.match(tagPattern);
    if (!match) return null;
    const attrMatch = match[0].match(new RegExp(`${attribute}="([^"]*)"`));
    return attrMatch ? attrMatch[1] : null;
  }

  /** Get text content of a tag */
  text(tag) {
    const match = this.xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1].trim() : null;
  }

  /** Get status from ApiResponse */
  status() {
    return this.attr("ApiResponse", "Status") || "UNKNOWN";
  }

  /** Get error message if status is ERROR */
  errorMessage() {
    const match = this.xml.match(/<Error[^>]*>([\s\S]*?)<\/Error>/);
    return match ? match[1].trim() : null;
  }

  /** Extract all elements matching a tag, return array of ParsedXml snippets */
  all(tag) {
    const results = [];
    const pattern = new RegExp(`<${tag}([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${tag}>)`, "g");
    let match;
    while ((match = pattern.exec(this.xml)) !== null) {
      results.push(new ParsedXml(match[0]));
    }
    return results;
  }

  /** Get all attributes of the root element as a key-value object */
  attrs() {
    const tagMatch = this.xml.match(/^<(\w+)([^>]*)>/);
    if (!tagMatch) return {};
    const attrStr = tagMatch[2];
    const result = {};
    const attrPattern = /(\w+)="([^"]*)"/g;
    let m;
    while ((m = attrPattern.exec(attrStr)) !== null) {
      result[m[1]] = m[2];
    }
    return result;
  }

  /** Raw XML string */
  raw() {
    return this.xml;
  }
}

function parseXml(xml) {
  return new ParsedXml(xml);
}

// ─── HTTP Request ───────────────────────────────────────────────────────────────

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── API Call ──────────────────────────────────────────────────────────────────

async function apiCall(command, params = {}) {
  const ip = await getClientIp();
  const body = querystring.stringify({
    ApiUser: API_USER,
    ApiKey: API_KEY,
    UserName: API_USER,
    ClientIp: ip,
    Command: `namecheap.${command}`,
    ...params,
  });

  const rawXml = await httpsPost(API_ENDPOINT, body);
  const parsed = parseXml(rawXml);

  if (parsed.status() === "ERROR") {
    const msg = parsed.errorMessage() || "Unknown API error";
    const err = new Error(msg);
    err.rawXml = rawXml;
    err.name = "NamecheapApiError";
    throw err;
  }

  return parsed;
}

/** Split "phatt.tech" → { sld: "phatt", tld: "tech" } */
function splitDomain(domain) {
  const parts = domain.split(".");
  if (parts.length < 2) {
    throw new Error(
      `Invalid domain: "${domain}". Expected format: domain.tld (e.g. phatt.tech)`
    );
  }
  const tld = parts.slice(1).join(".");
  const sld = parts[0];
  return { sld, tld };
}

module.exports = { getClientIp, parseXml, ParsedXml, apiCall, splitDomain };
