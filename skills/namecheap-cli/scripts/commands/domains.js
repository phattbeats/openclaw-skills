"use strict";
/**
 * Domains commands: list, info, check, renew
 */

const { apiCall, splitDomain, getClientIp } = require("../lib/client.js");
const { output, printTable, printKv, handleError } = require("../lib/envelope.js");

function registerDomains(program) {
  const domains = program.command("domains").description("Domain management");

  // ── list ──────────────────────────────────────────────────────────────────
  domains
    .command("list")
    .description("List all domains on the account")
    .option("-p, --page <n>", "Page number", "1")
    .option("-s, --page-size <n>", "Results per page (max 100)", "100")
    .option("--search <term>", "Filter by search term")
    .action(async (opts) => {
      try {
        const params = {
          Page: opts.page,
          PageSize: opts.pageSize,
        };
        if (opts.search) params.SearchTerm = opts.search;

        const resp = await apiCall("domains.getList", params);
        const domainList = resp.all("Domain").map((d) => d.attrs());

        output(
          () => {
            console.log(`\nDomains (${domainList.length}):\n`);
            printTable(domainList, ["Name", "Created", "Expires", "IsExpired", "AutoRenew", "IsLocked"]);
            console.log();
          },
          domainList
        );
      } catch (err) {
        handleError(err);
      }
    });

  // ── info ──────────────────────────────────────────────────────────────────
  domains
    .command("info <domain>")
    .description("Get detailed info for a domain (e.g. phatt.tech)")
    .action(async (domain) => {
      try {
        const { sld, tld } = splitDomain(domain);
        const resp = await apiCall("domains.getInfo", { DomainName: domain });

        const name = resp.attr("DomainGetInfoResult", "DomainName") || domain;
        const status = resp.attr("DomainGetInfoResult", "Status") || "";
        const id = resp.attr("DomainGetInfoResult", "ID") || "";
        const isOwner = resp.attr("DomainGetInfoResult", "IsOwner") || "";
        const created = resp.text("CreatedDate") || "";
        const expires = resp.text("ExpiredDate") || "";

        const nsItems = resp.all("Nameserver").map((n) => n.raw().replace(/<[^>]+>/g, "").trim());
        const nameservers = nsItems.join(", ");

        const data = { name, id, status, isOwner, created, expires, nameservers, sld, tld };

        output(
          () => {
            console.log(`\nDomain Info: ${name}\n`);
            printKv(data);
            console.log();
          },
          data
        );
      } catch (err) {
        handleError(err);
      }
    });

  // ── check ─────────────────────────────────────────────────────────────────
  domains
    .command("check <domains...>")
    .description("Check availability of one or more domains")
    .action(async (domainList) => {
      try {
        const resp = await apiCall("domains.check", {
          DomainList: domainList.join(","),
        });
        const results = resp.all("DomainCheckResult").map((d) => {
          const a = d.attrs();
          return {
            Domain: a.Domain || "",
            Available: a.Available === "true" ? "Yes" : "No",
            IsPremiumName: a.IsPremiumName || "",
            PremiumPrice: a.PremiumRegistrationPrice || "",
            ErrorNo: a.ErrorNo || "",
          };
        });

        output(
          () => {
            console.log("\nAvailability Check:\n");
            printTable(results, ["Domain", "Available", "IsPremiumName", "PremiumPrice"]);
            console.log();
          },
          results
        );
      } catch (err) {
        handleError(err);
      }
    });

  // ── renew ─────────────────────────────────────────────────────────────────
  domains
    .command("renew <domain>")
    .description("Renew a domain for N years")
    .option("-y, --years <n>", "Number of years to renew", "1")
    .action(async (domain, opts) => {
      try {
        const resp = await apiCall("domains.renew", {
          DomainName: domain,
          Years: opts.years,
        });

        const result = resp.all("DomainRenewResult")[0];
        const attrs = result ? result.attrs() : {};
        const data = {
          domain: attrs.DomainName || domain,
          renewed: attrs.Renewed || "",
          orderId: attrs.OrderID || "",
          transactionId: attrs.TransactionID || "",
          chargedAmount: attrs.ChargedAmount || "",
        };

        output(
          () => {
            console.log(`\nRenewal for ${domain}:\n`);
            printKv(data);
            console.log();
          },
          data
        );
      } catch (err) {
        handleError(err);
      }
    });

  // ── ip ────────────────────────────────────────────────────────────────────
  program
    .command("ip")
    .description("Show current public IP (must be whitelisted in Namecheap)")
    .action(async () => {
      try {
        const ip = await getClientIp();
        console.log(`\nCurrent public IP: \x1b[33m${ip}\x1b[0m`);
        console.log(`\nAdd this IP at:`);
        console.log(`  https://ap.www.namecheap.com/settings/tools/apiaccess/`);
        console.log(`\nAccount: phatt\n`);
      } catch (err) {
        handleError(err);
      }
    });
}

module.exports = { registerDomains };
