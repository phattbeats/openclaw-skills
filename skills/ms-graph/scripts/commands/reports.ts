import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { failure, success, isTTY, color } from "../lib/envelope.js";

type Period = "D7" | "D30" | "D90" | "D180";

function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"(.*)"$/, "$1"));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"(.*)"$/, "$1"));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = vals[i] || ""));
    return obj;
  });
}

export function registerReports(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("reports").description("M365 usage reports");

  cmd
    .command("active-users")
    .description("Active users report")
    .option("--period <p>", "Period (D7|D30|D90|D180)", "D30")
    .action(async (opts) => {
      const client = getClient();
      try {
        const period = opts.period as Period;
        const csvData = await client.getRaw(
          `/reports/getOffice365ActiveUserDetail(period='${period}')`
        );
        const rows = parseCsv(csvData);

        if (isTTY()) {
          console.log(color.bold(`Active Users Report — Period: ${period}`));
          console.log(`${rows.length} users in report.`);
        } else {
          success("reports active-users", { period, data: rows });
        }
      } catch (err) {
        failure("reports active-users", err);
      }
    });

  cmd
    .command("mailbox-usage")
    .description("Mailbox usage report")
    .option("--period <p>", "Period (D7|D30|D90|D180)", "D30")
    .action(async (opts) => {
      const client = getClient();
      try {
        const period = opts.period as Period;
        const csvData = await client.getRaw(
          `/reports/getMailboxUsageDetail(period='${period}')`
        );
        const rows = parseCsv(csvData);

        if (isTTY()) {
          console.log(color.bold(`Mailbox Usage — Period: ${period}`));
          console.log(`${rows.length} mailboxes in report`);
          if (rows.length > 0) {
            const sample = rows.slice(0, 5);
            for (const row of sample) {
              const upn = row["User Principal Name"] || row["userPrincipalName"] || "";
              const size = row["Storage Used (Byte)"] || row["storageUsedInBytes"] || "";
              if (upn) console.log(`  ${upn}: ${parseInt(size || "0").toLocaleString()} bytes`);
            }
          }
        } else {
          success("reports mailbox-usage", { period, data: rows });
        }
      } catch (err) {
        failure("reports mailbox-usage", err);
      }
    });
}
