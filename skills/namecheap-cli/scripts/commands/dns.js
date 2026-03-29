"use strict";
/**
 * DNS commands: get-nameservers, set-nameservers, get-hosts, set-hosts
 */

const { apiCall, splitDomain } = require("../lib/client.js");
const { output, printTable, printKv, handleError } = require("../lib/envelope.js");
const fs = require("fs");

function registerDns(program) {
  const dns = program.command("dns").description("DNS management");

  // ── get-nameservers ───────────────────────────────────────────────────────
  dns
    .command("get-nameservers <domain>")
    .description("Get current nameservers for a domain")
    .action(async (domain) => {
      try {
        const { sld, tld } = splitDomain(domain);
        const resp = await apiCall("domains.dns.getList", { SLD: sld, TLD: tld });

        const result = resp.all("DomainDNSGetListResult")[0];
        const attrs = result ? result.attrs() : {};
        const isUsingOurDNS = attrs.IsUsingOurDNS === "true";

        const nsItems = resp.all("Nameserver").map((n) => ({
          Nameserver: n.raw().replace(/<[^>]+>/g, "").trim(),
        }));

        const data = {
          domain,
          isUsingOurDNS,
          nameservers: nsItems.map((n) => n.Nameserver),
        };

        output(
          () => {
            console.log(`\nNameservers for ${domain}:`);
            console.log(`  Using Namecheap DNS: ${isUsingOurDNS ? "Yes" : "No"}\n`);
            printTable(nsItems, ["Nameserver"]);
            console.log();
          },
          data
        );
      } catch (err) {
        handleError(err);
      }
    });

  // ── set-nameservers ───────────────────────────────────────────────────────
  dns
    .command("set-nameservers <domain> <ns...>")
    .description(
      "Set custom nameservers for a domain (e.g. Cloudflare). Pass multiple NS as space-separated args."
    )
    .action(async (domain, nsList) => {
      try {
        const { sld, tld } = splitDomain(domain);
        const nameservers = nsList.join(",");

        console.log(`\nSetting nameservers for ${domain}:`);
        nsList.forEach((ns) => console.log(`  → ${ns}`));
        console.log();

        const resp = await apiCall("domains.dns.setCustom", {
          SLD: sld,
          TLD: tld,
          Nameservers: nameservers,
        });

        const result = resp.all("DomainDNSSetCustomResult")[0];
        const attrs = result ? result.attrs() : {};
        const success = attrs.Updated === "true";

        const data = { domain, nameservers: nsList, updated: success };

        output(
          () => {
            if (success) {
              console.log(`✅ Nameservers updated successfully for ${domain}\n`);
            } else {
              console.log(
                `⚠️  Response received but Updated flag was not 'true'. Verify in Namecheap dashboard.\n`
              );
            }
          },
          data
        );
      } catch (err) {
        handleError(err);
      }
    });

  // ── get-hosts ─────────────────────────────────────────────────────────────
  dns
    .command("get-hosts <domain>")
    .description("Get DNS host records (A, MX, CNAME, TXT, etc.)")
    .action(async (domain) => {
      try {
        const { sld, tld } = splitDomain(domain);
        const resp = await apiCall("domains.dns.getHosts", { SLD: sld, TLD: tld });

        const hosts = resp.all("host").map((h) => {
          const a = h.attrs();
          return {
            HostId: a.HostId || "",
            Name: a.Name || "",
            Type: a.Type || "",
            Address: a.Address || "",
            MXPref: a.MXPref || "",
            TTL: a.TTL || "",
          };
        });

        const data = { domain, records: hosts };

        output(
          () => {
            console.log(`\nDNS Records for ${domain} (${hosts.length} records):\n`);
            printTable(hosts, ["HostId", "Name", "Type", "Address", "MXPref", "TTL"]);
            console.log();
          },
          data
        );
      } catch (err) {
        handleError(err);
      }
    });

  // ── set-hosts ─────────────────────────────────────────────────────────────
  dns
    .command("set-hosts <domain>")
    .description(
      "Set DNS host records from a JSON file.\n" +
      "  ⚠️  REPLACES ALL RECORDS — not an append operation!\n" +
      "  JSON format: [{\"HostName\":\"@\",\"RecordType\":\"A\",\"Address\":\"1.2.3.4\",\"TTL\":\"1800\"}]"
    )
    .requiredOption(
      "-f, --file <path>",
      "JSON file with records array"
    )
    .action(async (domain, opts) => {
      try {
        const { sld, tld } = splitDomain(domain);

        const raw = fs.readFileSync(opts.file, "utf8");
        const records = JSON.parse(raw);

        if (!Array.isArray(records) || records.length === 0) {
          throw new Error("JSON file must contain a non-empty array of record objects.");
        }

        console.log(`\n⚠️  WARNING: This will REPLACE ALL DNS records for ${domain}.`);
        console.log(`   Records to set: ${records.length}`);
        records.forEach((r, i) => {
          console.log(`   ${i + 1}. ${r.RecordType} ${r.HostName} → ${r.Address}`);
        });
        console.log();

        const params = { SLD: sld, TLD: tld };
        records.forEach((r, i) => {
          const n = i + 1;
          params[`HostName${n}`] = r.HostName;
          params[`RecordType${n}`] = r.RecordType;
          params[`Address${n}`] = r.Address;
          params[`MXPref${n}`] = r.MXPref != null ? String(r.MXPref) : "10";
          params[`TTL${n}`] = r.TTL != null ? String(r.TTL) : "1800";
        });

        const resp = await apiCall("domains.dns.setHosts", params);
        const result = resp.all("DomainDNSSetHostsResult")[0];
        const attrs = result ? result.attrs() : {};
        const success = attrs.IsSuccess === "true";

        const data = { domain, recordsSet: records.length, success };

        output(
          () => {
            if (success) {
              console.log(`✅ DNS records updated successfully for ${domain} (${records.length} records)\n`);
            } else {
              console.log(
                `⚠️  Response received but IsSuccess was not 'true'. Verify in Namecheap dashboard.\n`
              );
            }
          },
          data
        );
      } catch (err) {
        handleError(err);
      }
    });
}

module.exports = { registerDns };
