import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printTable, failure, success, isTTY, color } from "../lib/envelope.js";

interface SignIn {
  id: string;
  createdDateTime: string;
  userPrincipalName: string;
  appDisplayName?: string;
  ipAddress?: string;
  status?: { errorCode: number; failureReason?: string };
  location?: { city?: string; countryOrRegion?: string };
  conditionalAccessStatus?: string;
}

interface DirectoryAudit {
  id: string;
  activityDateTime: string;
  category: string;
  activityDisplayName: string;
  initiatedBy?: { user?: { userPrincipalName?: string }; app?: { displayName?: string } };
  targetResources?: { displayName?: string; type?: string }[];
  result: string;
}

export function registerAuditLogs(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("audit-logs").description("Audit log queries");

  cmd
    .command("sign-ins")
    .description("Query sign-in logs")
    .option("--user <upn>", "Filter by user")
    .option("--failures-only", "Only failed sign-ins")
    .option("--days <n>", "Look back N days", "7")
    .option("--top <n>", "Max results", "50")
    .action(async (opts) => {
      const client = getClient();
      try {
        const days = parseInt(opts.days, 10);
        const since = new Date(Date.now() - days * 86400 * 1000).toISOString();

        const filters: string[] = [`createdDateTime ge ${since}`];
        if (opts.user) filters.push(`userPrincipalName eq '${opts.user}'`);
        if (opts.failuresOnly) filters.push("status/errorCode ne 0");

        const filterStr = filters.join(" and ");
        const url = `/auditLogs/signIns?$filter=${encodeURIComponent(filterStr)}&$top=${opts.top}&$orderby=createdDateTime desc&$select=id,createdDateTime,userPrincipalName,appDisplayName,ipAddress,status,location,conditionalAccessStatus`;

        const res = await client.get<{ value: SignIn[] }>(url);
        const items = res.value || [];

        if (isTTY()) {
          printTable(
            "audit-logs sign-ins",
            items.map((s) => ({
              date: new Date(s.createdDateTime).toLocaleString(),
              user: s.userPrincipalName,
              app: (s.appDisplayName || "").substring(0, 25),
              ip: s.ipAddress || "",
              result: s.status?.errorCode === 0 ? color.green ? "✓" : "OK" : `✗ ${s.status?.errorCode}`,
              location: s.location ? `${s.location.city || ""}, ${s.location.countryOrRegion || ""}` : "",
            })),
            [
              { key: "date", label: "Date/Time", width: 20 },
              { key: "user", label: "User", width: 35 },
              { key: "app", label: "App", width: 26 },
              { key: "ip", label: "IP", width: 16 },
              { key: "result", label: "Result", width: 12 },
              { key: "location", label: "Location", width: 20 },
            ]
          );
        } else {
          success("audit-logs sign-ins", { items, count: items.length, filter: filterStr });
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("403")) {
          const tenantId = getClient().getTenantId();
          failure(
            "audit-logs sign-ins",
            `Access denied. This is likely because the tenant ('${tenantId}') does not have an Entra ID Premium P1 or P2 license, which is required for API access to sign-in logs.`,
            err.message
          );
        } else {
          failure("audit-logs sign-ins", err);
        }
      }
    });

  cmd
    .command("directory-audit")
    .description("Query directory audit logs")
    .option("--category <cat>", "Filter by category (e.g., UserManagement, GroupManagement)")
    .option("--user <upn>", "Filter by initiating user")
    .option("--days <n>", "Look back N days", "7")
    .option("--top <n>", "Max results", "50")
    .action(async (opts) => {
      const client = getClient();
      try {
        const days = parseInt(opts.days, 10);
        const since = new Date(Date.now() - days * 86400 * 1000).toISOString();

        const filters: string[] = [`activityDateTime ge ${since}`];
        if (opts.category) filters.push(`category eq '${opts.category}'`);
        if (opts.user) filters.push(`initiatedBy/user/userPrincipalName eq '${opts.user}'`);

        const filterStr = filters.join(" and ");
        const url = `/auditLogs/directoryAudits?$filter=${encodeURIComponent(filterStr)}&$top=${opts.top}&$orderby=activityDateTime desc&$select=id,activityDateTime,category,activityDisplayName,initiatedBy,targetResources,result`;

        const res = await client.get<{ value: DirectoryAudit[] }>(url);
        const items = res.value || [];

        if (isTTY()) {
          printTable(
            "audit-logs directory-audit",
            items.map((a) => ({
              date: new Date(a.activityDateTime).toLocaleString(),
              category: a.category,
              activity: a.activityDisplayName.substring(0, 35),
              by: a.initiatedBy?.user?.userPrincipalName || a.initiatedBy?.app?.displayName || "system",
              target: a.targetResources?.[0]?.displayName || "",
              result: a.result === "success" ? "✓" : "✗",
            })),
            [
              { key: "date", label: "Date/Time", width: 20 },
              { key: "category", label: "Category", width: 20 },
              { key: "activity", label: "Activity", width: 36 },
              { key: "by", label: "By", width: 30 },
              { key: "target", label: "Target", width: 25 },
              { key: "result", label: "Result", width: 7 },
            ]
          );
        } else {
          success("audit-logs directory-audit", { items, count: items.length, filter: filterStr });
        }
      } catch (err) {
        failure("audit-logs directory-audit", err);
      }
    });
}
