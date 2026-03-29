import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printItem, printTable, failure, success, isTTY, color } from "../lib/envelope.js";

interface OrgInfo {
  id: string;
  displayName: string;
  city?: string;
  state?: string;
  country?: string;
  countryLetterCode?: string;
  tenantType?: string;
  createdDateTime?: string;
  verifiedDomains?: Domain[];
}

interface Domain {
  name: string;
  isDefault: boolean;
  isVerified: boolean;
  type: string;
  capabilities?: string;
}

export function registerOrg(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("org").description("Organization info");

  cmd
    .command("info")
    .description("Get organization details")
    .action(async () => {
      const client = getClient();
      try {
        const res = await client.get<{ value: OrgInfo[] }>(
          "/organization?$select=id,displayName,city,state,country,countryLetterCode,tenantType,createdDateTime,verifiedDomains"
        );
        const org = (res.value || [])[0];
        if (!org) throw new Error("No organization found");

        if (isTTY()) {
          const flat: Record<string, unknown> = {
            id: org.id,
            displayName: org.displayName,
            city: org.city,
            state: org.state,
            country: org.country,
            tenantType: org.tenantType,
            createdDateTime: org.createdDateTime,
            verifiedDomains: org.verifiedDomains?.map((d) => d.name).join(", "),
          };
          printItem("org info", flat);
        } else {
          success("org info", org, ["org domains", "org verified-domains"]);
        }
      } catch (err) {
        failure("org info", err);
      }
    });

  cmd
    .command("domains")
    .description("List all domains")
    .action(async () => {
      const client = getClient();
      try {
        const res = await client.get<{ value: Domain[] }>(
          "/domains?$select=id,isDefault,isVerified,supportedServices,authenticationType"
        );
        const domains = res.value || [];

        if (isTTY()) {
          printTable(
            "org domains",
            domains.map((d: Record<string, unknown>) => ({
              name: d.id as string,
              default: d.isDefault ? "✓" : "",
              verified: d.isVerified ? "✓" : "✗",
              auth: d.authenticationType as string || "",
              services: Array.isArray(d.supportedServices) ? (d.supportedServices as string[]).join(", ") : "",
            })),
            [
              { key: "name", label: "Domain", width: 40 },
              { key: "default", label: "Default", width: 8 },
              { key: "verified", label: "Verified", width: 9 },
              { key: "auth", label: "Auth Type", width: 15 },
              { key: "services", label: "Services", width: 30 },
            ]
          );
        } else {
          success("org domains", { items: domains, count: domains.length });
        }
      } catch (err) {
        failure("org domains", err);
      }
    });

  cmd
    .command("verified-domains")
    .description("List verified domains from org object")
    .action(async () => {
      const client = getClient();
      try {
        const res = await client.get<{ value: OrgInfo[] }>(
          "/organization?$select=verifiedDomains"
        );
        const org = (res.value || [])[0];
        const domains = (org?.verifiedDomains || []).filter((d) => d.isVerified);

        if (isTTY()) {
          printTable(
            "org verified-domains",
            domains.map((d) => ({
              name: d.name,
              default: d.isDefault ? "✓" : "",
              type: d.type,
              capabilities: d.capabilities || "",
            })),
            [
              { key: "name", label: "Domain", width: 40 },
              { key: "default", label: "Default", width: 8 },
              { key: "type", label: "Type", width: 12 },
              { key: "capabilities", label: "Capabilities", width: 30 },
            ]
          );
        } else {
          success("org verified-domains", { items: domains, count: domains.length });
        }
      } catch (err) {
        failure("org verified-domains", err);
      }
    });
}
