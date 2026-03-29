import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printTable, printItem, failure, success, isTTY, color } from "../lib/envelope.js";

interface SecurityAlert {
  id: string;
  title: string;
  status: string;
  severity: string;
  category?: string;
  createdDateTime: string;
  lastUpdatedDateTime?: string;
  actorDisplayName?: string;
  impactedResources?: { resourceType?: string; name?: string }[];
}

export function registerSecurity(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("security").description("Security alerts and assessments");

  cmd
    .command("alerts")
    .description("List security alerts")
    .option("--top <n>", "Max results", "25")
    .option("--severity <level>", "Filter by severity (low, medium, high, critical)")
    .option("--status <status>", "Filter by status (new, inProgress, resolved)")
    .action(async (opts) => {
      const client = getClient();
      try {
        const filters: string[] = [];
        if (opts.severity) filters.push(`severity eq '${opts.severity}'`);
        if (opts.status) filters.push(`status eq '${opts.status}'`);

        let url = `/security/alerts?$select=id,title,status,severity,category,createdDateTime,lastUpdatedDateTime,actorDisplayName,impactedResources&$top=${opts.top}&$orderby=createdDateTime desc`;
        if (filters.length > 0) {
          url += `&$filter=${encodeURIComponent(filters.join(" and "))}`;
        }

        const res = await client.get<{ value: SecurityAlert[] }>(url);
        const alerts = res.value || [];

        if (isTTY()) {
          if (alerts.length === 0) {
            console.log(color.green("✓ No security alerts found"));
            return;
          }
          printTable(
            "security alerts",
            alerts.map((a) => ({
              date: a.createdDateTime ? new Date(a.createdDateTime).toLocaleDateString() : "",
              severity: a.severity || "",
              status: a.status || "",
              title: (a.title || "").substring(0, 50),
              id: a.id,
            })),
            [
              { key: "date", label: "Date", width: 12 },
              { key: "severity", label: "Severity", width: 10 },
              { key: "status", label: "Status", width: 14 },
              { key: "title", label: "Title", width: 52 },
              { key: "id", label: "ID", width: 40 },
            ]
          );
        } else {
          success("security alerts", { items: alerts, count: alerts.length }, [
            "security alert-detail <id>",
          ]);
        }
      } catch (err) {
        failure("security alerts", err);
      }
    });

  cmd
    .command("alert-detail <id>")
    .description("Get details of a specific security alert")
    .action(async (id) => {
      const client = getClient();
      try {
        const alert = await client.get<Record<string, unknown>>(
          `/security/alerts/${encodeURIComponent(id)}`
        );
        printItem("security alert-detail", alert);
      } catch (err) {
        failure("security alert-detail", err);
      }
    });

  cmd
    .command("secure-scores")
    .description("List secure scores (security posture over time)")
    .option("--top <n>", "Max results", "10")
    .action(async (opts) => {
      const client = getClient();
      try {
        const res = await client.get<{ value: Record<string, unknown>[] }>(
          `/security/secureScores?$top=${opts.top}&$orderby=createdDateTime desc`
        );
        const scores = res.value || [];

        if (isTTY()) {
          if (scores.length === 0) {
            console.log(color.dim("No secure scores available"));
            return;
          }
          printTable(
            "security secure-scores",
            scores.map((s: any) => ({
              date: s.createdDateTime ? new Date(s.createdDateTime).toLocaleDateString() : "",
              score: `${s.currentScore ?? "?"} / ${s.maxScore ?? "?"}`,
              percentage: s.maxScore && s.currentScore ? `${Math.round((s.currentScore / s.maxScore) * 100)}%` : "",
            })),
            [
              { key: "date", label: "Date", width: 14 },
              { key: "score", label: "Score", width: 18 },
              { key: "percentage", label: "%", width: 8 },
            ]
          );
        } else {
          success("security secure-scores", { items: scores, count: scores.length });
        }
      } catch (err) {
        failure("security secure-scores", err);
      }
    });
}
