import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printTable, printItem, printMessage, failure, success, isTTY } from "../lib/envelope.js";

interface AuthenticationMethod {
  id: string;
  displayName?: string;
  methodType: string;
  createdDateTime?: string;
}

export function registerAuthMethods(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("auth-methods").description("User authentication methods (MFA)");

  cmd
    .command("list <upn-or-id>")
    .description("List authentication methods registered by a user")
    .action(async (userId) => {
      const client = getClient();
      try {
        const res = await client.get<{ value: AuthenticationMethod[] }>(
          `/users/${encodeURIComponent(userId)}/authentication/methods`
        );
        const methods = res.value || [];

        if (isTTY()) {
          printTable(
            "auth-methods list",
            methods.map((m) => ({
              id: m.id,
              type: m.methodType || m["@odata.type"]?.split(".").pop() || "unknown",
              name: m.displayName || "",
            })),
            [
              { key: "type", label: "Method Type", width: 35 },
              { key: "name", label: "Name", width: 30 },
              { key: "id", label: "ID", width: 40 },
            ]
          );
        } else {
          success("auth-methods list", { userId, items: methods, count: methods.length }, [
            "auth-methods list <upn-or-id>",
            "auth-methods reset-password <upn-or-id>",
          ]);
        }
      } catch (err) {
        failure("auth-methods list", err);
      }
    });

  cmd
    .command("get-phone <upn-or-id>")
    .description("Get a user's phone authentication method")
    .action(async (userId) => {
      const client = getClient();
      try {
        const method = await client.get<Record<string, unknown>>(
          `/users/${encodeURIComponent(userId)}/authentication/phoneMethods`
        );
        const items = (method as any).value || [method];

        if (isTTY()) {
          for (const item of items) {
            console.log(`Type: ${item.phoneType || "unknown"}`);
            console.log(`Number: ${item.phoneNumber || "(not set)"}`);
            console.log(`SMS sign-in: ${item.smsSignInState || "n/a"}`);
            console.log(`ID: ${item.id}`);
            console.log("---");
          }
        } else {
          success("auth-methods get-phone", { userId, items, count: items.length });
        }
      } catch (err) {
        failure("auth-methods get-phone", err);
      }
    });

  cmd
    .command("enable-sms <upn-or-id>")
    .description("Enable SMS authentication for a user")
    .requiredOption("--phone <number>", "Phone number (e.g., +16145551234)")
    .action(async (userId, opts) => {
      const client = getClient();
      try {
        const method = await client.post<Record<string, unknown>>(
          `/users/${encodeURIComponent(userId)}/authentication/phoneMethods`,
          {
            phoneNumber: opts.phone,
            phoneType: "mobile",
          }
        );
        printMessage("auth-methods enable-sms", `SMS authentication enabled for ${userId}`, method);
      } catch (err) {
        failure("auth-methods enable-sms", err);
      }
    });

  cmd
    .command("reset-password <upn-or-id>")
    .description("Force password reset at next login (invalidate sessions)")
    .action(async (userId) => {
      const client = getClient();
      try {
        // Force password change by setting forceChangePasswordNextSignIn
        await client.patch(`/users/${encodeURIComponent(userId)}`, {
          passwordProfile: {
            forceChangePasswordNextSignIn: true,
            password: "TempP@ss_" + Math.random().toString(36).substring(2, 10),
          },
        });
        printMessage(
          "auth-methods reset-password",
          `Password reset forced for ${userId} — user must set new password at next login`,
          { userId, forceChange: true }
        );
      } catch (err) {
        failure("auth-methods reset-password", err);
      }
    });
}
