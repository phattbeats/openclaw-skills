import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printTable, printItem, failure, success, isTTY, color } from "../lib/envelope.js";

interface ServiceHealthIssue {
  id: string;
  title: string;
  service: string;
  status: string;
  impactDescription?: string;
  classification?: string;
  startDateTime?: string;
  lastModifiedDateTime?: string;
}

interface ServiceMessage {
  id: string;
  title: string;
  services: string[];
  startDateTime?: string;
  lastModifiedDateTime?: string;
  body?: { content: string };
}

function statusIcon(status: string): string {
  if (status?.toLowerCase().includes("resolved")) return "✅";
  if (status?.toLowerCase().includes("investigating")) return "🔴";
  if (status?.toLowerCase().includes("degraded")) return "🟡";
  return "⚪";
}

export function registerServiceHealth(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("service-health").description("M365 service health");

  cmd
    .command("list-issues")
    .description("List active service health issues")
    .option("--service <name>", "Filter by service name")
    .action(async (opts) => {
      const client = getClient();
      try {
        const res = await client.get<{ value: ServiceHealthIssue[] }>(
          "/admin/serviceAnnouncement/issues?$select=id,title,service,status,impactDescription,classification,startDateTime,lastModifiedDateTime"
        );
        let issues = res.value || [];

        if (opts.service) {
          const svc = opts.service.toLowerCase();
          issues = issues.filter((i) => i.service?.toLowerCase().includes(svc));
        }

        if (isTTY()) {
          if (issues.length === 0) {
            console.log(color.green("✓ No active service health issues"));
            return;
          }
          printTable(
            "service-health list-issues",
            issues.map((i) => ({
              status: `${statusIcon(i.status)} ${i.status}`,
              service: i.service,
              title: i.title.substring(0, 50),
              id: i.id,
              started: i.startDateTime ? new Date(i.startDateTime).toLocaleDateString() : "",
            })),
            [
              { key: "status", label: "Status", width: 20 },
              { key: "service", label: "Service", width: 28 },
              { key: "title", label: "Title", width: 52 },
              { key: "id", label: "ID", width: 16 },
            ]
          );
        } else {
          success("service-health list-issues", { items: issues, count: issues.length }, [
            "service-health get-issue <id>",
          ]);
        }
      } catch (err) {
        failure("service-health list-issues", err);
      }
    });

  cmd
    .command("list-messages")
    .description("List service announcements/messages")
    .option("--top <n>", "Max results", "20")
    .action(async (opts) => {
      const client = getClient();
      try {
        const res = await client.get<{ value: ServiceMessage[] }>(
          `/admin/serviceAnnouncement/messages?$select=id,title,services,startDateTime,lastModifiedDateTime&$top=${opts.top}&$orderby=startDateTime desc`
        );
        const messages = res.value || [];

        if (isTTY()) {
          printTable(
            "service-health list-messages",
            messages.map((m) => ({
              id: m.id,
              service: m.services.join(", "),
              title: m.title.substring(0, 55),
              date: m.startDateTime ? new Date(m.startDateTime).toLocaleDateString() : "",
            })),
            [
              { key: "date", label: "Date", width: 12 },
              { key: "type", label: "Type", width: 14 },
              { key: "service", label: "Service", width: 28 },
              { key: "title", label: "Title", width: 57 },
            ]
          );
        } else {
          success("service-health list-messages", { items: messages, count: messages.length });
        }
      } catch (err) {
        failure("service-health list-messages", err);
      }
    });

  cmd
    .command("get-issue <id>")
    .description("Get details of a service health issue")
    .action(async (id) => {
      const client = getClient();
      try {
        const issue = await client.get<ServiceHealthIssue & { posts?: { description?: { content: string } }[] }>(
          `/admin/serviceAnnouncement/issues/${id}`
        );

        if (isTTY()) {
          printItem("service-health get-issue", issue as unknown as Record<string, unknown>);
          if (issue.posts && issue.posts.length > 0) {
            console.log(`\n${color.bold("Latest Update:")}`);
            const latest = issue.posts[issue.posts.length - 1];
            console.log(latest.description?.content || "(no content)");
          }
        } else {
          success("service-health get-issue", issue);
        }
      } catch (err) {
        failure("service-health get-issue", err);
      }
    });
}
