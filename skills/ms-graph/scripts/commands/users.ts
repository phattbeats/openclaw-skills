import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printTable, printItem, printMessage, failure, success, isTTY, color } from "../lib/envelope.js";

interface User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled: boolean;
  jobTitle?: string;
  department?: string;
  mail?: string;
  assignedLicenses?: { skuId: string }[];
}

export function registerUsers(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("users").description("User management");

  cmd
    .command("list")
    .description("List users")
    .option("--top <n>", "Max results", "25")
    .option("--filter <filter>", "OData filter")
    .option("--all", "Fetch all pages")
    .action(async (opts) => {
      const client = getClient();
      try {
        let users: User[];
        const select = "$select=id,displayName,userPrincipalName,accountEnabled,jobTitle,department,mail,assignedLicenses";
        if (opts.all) {
          users = await client.getAll<User>(`/users?${select}`);
        } else {
          const top = parseInt(opts.top, 10);
          let url = `/users?${select}&$top=${top}`;
          if (opts.filter) url += `&$filter=${encodeURIComponent(opts.filter)}`;
          const res = await client.get<{ value: User[] }>(url);
          users = res.value || [];
        }

        if (isTTY()) {
          printTable(
            "users list",
            users.map((u) => ({
              upn: u.userPrincipalName,
              name: u.displayName,
              enabled: u.accountEnabled ? "✓" : "✗",
              title: u.jobTitle || "",
              dept: u.department || "",
              licenses: (u.assignedLicenses?.length || 0).toString(),
            })),
            [
              { key: "upn", label: "UPN", width: 40 },
              { key: "name", label: "Display Name", width: 28 },
              { key: "enabled", label: "Enabled", width: 8 },
              { key: "title", label: "Title", width: 22 },
              { key: "dept", label: "Dept", width: 20 },
              { key: "licenses", label: "Licenses", width: 8 },
            ]
          );
        } else {
          success("users list", { items: users, count: users.length }, [
            "users get <upn>",
            "users reset-password <upn> --password <pw>",
          ]);
        }
      } catch (err) {
        failure("users list", err);
      }
    });

  cmd
    .command("get <upn-or-id>")
    .description("Get a user")
    .action(async (id) => {
      const client = getClient();
      try {
        const user = await client.get<User>(
          `/users/${encodeURIComponent(id)}?$select=id,displayName,userPrincipalName,accountEnabled,jobTitle,department,mail,assignedLicenses,createdDateTime,userType,officeLocation`
        );
        printItem("users get", user as unknown as Record<string, unknown>);
      } catch (err) {
        failure("users get", err);
      }
    });

  cmd
    .command("create")
    .description("Create a user")
    .requiredOption("--upn <upn>", "UserPrincipalName")
    .requiredOption("--display-name <name>", "Display name")
    .requiredOption("--password <pw>", "Initial password")
    .action(async (opts) => {
      const client = getClient();
      try {
        const user = await client.post<User>("/users", {
          accountEnabled: true,
          displayName: opts.displayName,
          userPrincipalName: opts.upn,
          passwordProfile: {
            forceChangePasswordNextSignIn: true,
            password: opts.password,
          },
          mailNickname: opts.upn.split("@")[0],
        });
        printMessage("users create", `Created user: ${user.userPrincipalName} (${user.id})`, user);
      } catch (err) {
        failure("users create", err);
      }
    });

  cmd
    .command("update <upn-or-id>")
    .description("Update user properties")
    .option("--display-name <name>")
    .option("--job-title <title>")
    .option("--department <dept>")
    .option("--office-location <loc>")
    .option("--mobile-phone <phone>")
    .action(async (id, opts) => {
      const client = getClient();
      try {
        const body: Record<string, string> = {};
        if (opts.displayName) body.displayName = opts.displayName;
        if (opts.jobTitle) body.jobTitle = opts.jobTitle;
        if (opts.department) body.department = opts.department;
        if (opts.officeLocation) body.officeLocation = opts.officeLocation;
        if (opts.mobilePhone) body.mobilePhone = opts.mobilePhone;
        if (Object.keys(body).length === 0) {
          throw new Error("No update fields provided");
        }
        await client.patch(`/users/${encodeURIComponent(id)}`, body);
        printMessage("users update", `Updated user: ${id}`, { id, updated: body });
      } catch (err) {
        failure("users update", err);
      }
    });

  cmd
    .command("delete <upn-or-id>")
    .description("Delete a user (soft delete, 30d recoverable)")
    .action(async (id) => {
      const client = getClient();
      try {
        await client.delete(`/users/${encodeURIComponent(id)}`);
        printMessage("users delete", `Deleted user: ${id}`, { id, deleted: true });
      } catch (err) {
        failure("users delete", err);
      }
    });

  cmd
    .command("reset-password <upn-or-id>")
    .description("Reset a user's password")
    .requiredOption("--password <pw>", "New password")
    .option("--no-force-change", "Don't require password change on next sign-in")
    .action(async (id, opts) => {
      const client = getClient();
      try {
        await client.patch(`/users/${encodeURIComponent(id)}`, {
          passwordProfile: {
            forceChangePasswordNextSignIn: opts.forceChange !== false,
            password: opts.password,
          },
        });
        printMessage("users reset-password", `Password reset for: ${id}`, { id, forceChange: opts.forceChange !== false });
      } catch (err) {
        failure("users reset-password", err);
      }
    });

  cmd
    .command("enable <upn-or-id>")
    .description("Enable a user account")
    .action(async (id) => {
      const client = getClient();
      try {
        await client.patch(`/users/${encodeURIComponent(id)}`, { accountEnabled: true });
        printMessage("users enable", `Enabled: ${id}`, { id, accountEnabled: true });
      } catch (err) {
        failure("users enable", err);
      }
    });

  cmd
    .command("disable <upn-or-id>")
    .description("Disable a user account")
    .action(async (id) => {
      const client = getClient();
      try {
        await client.patch(`/users/${encodeURIComponent(id)}`, { accountEnabled: false });
        printMessage("users disable", `Disabled: ${id}`, { id, accountEnabled: false });
      } catch (err) {
        failure("users disable", err);
      }
    });
}
