import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printTable, printMessage, failure, success, isTTY } from "../lib/envelope.js";

interface SkuInfo {
  skuId: string;
  skuPartNumber: string;
  consumedUnits: number;
  prepaidUnits: { enabled: number; suspended: number; warning: number };
  capabilityStatus: string;
}

interface AssignedLicense {
  skuId: string;
  disabledPlans: string[];
}

export function registerLicenses(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("licenses").description("License management");

  cmd
    .command("list-skus")
    .description("List available license SKUs for the tenant")
    .action(async () => {
      const client = getClient();
      try {
        const res = await client.get<{ value: SkuInfo[] }>("/subscribedSkus");
        const skus = res.value || [];

        if (isTTY()) {
          printTable(
            "licenses list-skus",
            skus.map((s) => ({
              skuId: s.skuId,
              partNumber: s.skuPartNumber,
              enabled: String(s.prepaidUnits?.enabled ?? 0),
              consumed: String(s.consumedUnits),
              available: String((s.prepaidUnits?.enabled ?? 0) - s.consumedUnits),
              status: s.capabilityStatus,
            })),
            [
              { key: "partNumber", label: "SKU", width: 40 },
              { key: "enabled", label: "Seats", width: 8 },
              { key: "consumed", label: "Used", width: 8 },
              { key: "available", label: "Avail", width: 8 },
              { key: "status", label: "Status", width: 12 },
              { key: "skuId", label: "SKU ID", width: 38 },
            ]
          );
        } else {
          success("licenses list-skus", { items: skus, count: skus.length }, [
            "licenses assign <upn> --sku <skuId>",
          ]);
        }
      } catch (err) {
        failure("licenses list-skus", err);
      }
    });

  cmd
    .command("list <upn-or-id>")
    .description("List licenses assigned to a user")
    .action(async (id) => {
      const client = getClient();
      try {
        const user = await client.get<{ assignedLicenses: AssignedLicense[]; displayName: string; userPrincipalName: string }>(
          `/users/${encodeURIComponent(id)}?$select=displayName,userPrincipalName,assignedLicenses`
        );
        const licenses = user.assignedLicenses || [];

        // Fetch SKU details for names
        let skuMap: Record<string, string> = {};
        try {
          const skuRes = await client.get<{ value: SkuInfo[] }>("/subscribedSkus");
          for (const s of skuRes.value || []) {
            skuMap[s.skuId] = s.skuPartNumber;
          }
        } catch {
          // non-fatal
        }

        if (isTTY()) {
          console.log(`User: ${user.displayName} (${user.userPrincipalName})\n`);
          printTable(
            "licenses list",
            licenses.map((l) => ({
              skuId: l.skuId,
              name: skuMap[l.skuId] || "(unknown)",
              disabledPlans: l.disabledPlans.length.toString(),
            })),
            [
              { key: "name", label: "License", width: 40 },
              { key: "skuId", label: "SKU ID", width: 38 },
              { key: "disabledPlans", label: "Disabled Plans", width: 14 },
            ]
          );
        } else {
          const enriched = licenses.map((l) => ({
            ...l,
            skuPartNumber: skuMap[l.skuId] || null,
          }));
          success("licenses list", { user: user.userPrincipalName, items: enriched, count: enriched.length }, [
            "licenses assign <upn> --sku <skuId>",
            "licenses remove <upn> --sku <skuId>",
          ]);
        }
      } catch (err) {
        failure("licenses list", err);
      }
    });

  cmd
    .command("assign <upn-or-id>")
    .description("Assign a license to a user")
    .requiredOption("--sku <skuId>", "SKU ID")
    .action(async (id, opts) => {
      const client = getClient();
      try {
        await client.post(`/users/${encodeURIComponent(id)}/assignLicense`, {
          addLicenses: [{ skuId: opts.sku }],
          removeLicenses: [],
        });
        printMessage("licenses assign", `Assigned SKU ${opts.sku} to ${id}`, { id, skuId: opts.sku, action: "assigned" });
      } catch (err) {
        failure("licenses assign", err);
      }
    });

  cmd
    .command("remove <upn-or-id>")
    .description("Remove a license from a user")
    .requiredOption("--sku <skuId>", "SKU ID")
    .action(async (id, opts) => {
      const client = getClient();
      try {
        await client.post(`/users/${encodeURIComponent(id)}/assignLicense`, {
          addLicenses: [],
          removeLicenses: [opts.sku],
        });
        printMessage("licenses remove", `Removed SKU ${opts.sku} from ${id}`, { id, skuId: opts.sku, action: "removed" });
      } catch (err) {
        failure("licenses remove", err);
      }
    });
}
