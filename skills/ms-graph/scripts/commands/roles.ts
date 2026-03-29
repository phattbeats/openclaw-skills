import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printTable, printMessage, failure, success, isTTY, color } from "../lib/envelope.js";

interface RoleDefinition {
  id: string;
  displayName: string;
  description?: string;
  isBuiltIn?: boolean;
  isEnabled?: boolean;
}

interface RoleAssignment {
  id: string;
  roleDefinitionId: string;
  principalId: string;
  directoryScopeId: string;
}

interface DirectoryRole {
  id: string;
  displayName: string;
  description?: string;
  roleTemplateId?: string;
}

interface RoleMember {
  id: string;
  displayName: string;
  userPrincipalName?: string;
}

export function registerRoles(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("roles").description("Role management");

  cmd
    .command("list")
    .description("List active directory roles (or all role definitions)")
    .option("--all-defs", "List all role definitions instead of active roles")
    .action(async (opts) => {
      const client = getClient();
      try {
        if (opts.allDefs) {
          // Role definitions (full catalog)
          const res = await client.get<{ value: RoleDefinition[] }>(
            "/roleManagement/directory/roleDefinitions?$select=id,displayName,description,isBuiltIn,isEnabled&$top=200"
          );
          const defs = res.value || [];

          if (isTTY()) {
            printTable(
              "roles list --all-defs",
              defs.filter((d) => d.isEnabled).map((d) => ({
                name: d.displayName,
                builtin: d.isBuiltIn ? "✓" : "",
                id: d.id,
                desc: (d.description || "").substring(0, 50),
              })),
              [
                { key: "name", label: "Role Name", width: 40 },
                { key: "builtin", label: "Built-in", width: 9 },
                { key: "id", label: "ID", width: 38 },
              ]
            );
          } else {
            success("roles list --all-defs", { items: defs, count: defs.length });
          }
        } else {
          // Active directory roles
          const res = await client.get<{ value: DirectoryRole[] }>(
            "/directoryRoles?$select=id,displayName,description,roleTemplateId"
          );
          const roles = res.value || [];

          if (isTTY()) {
            printTable(
              "roles list",
              roles.map((r) => ({
                name: r.displayName,
                id: r.id,
                templateId: r.roleTemplateId || "",
                desc: (r.description || "").substring(0, 45),
              })),
              [
                { key: "name", label: "Role", width: 40 },
                { key: "id", label: "ID", width: 38 },
              ]
            );
          } else {
            success("roles list", { items: roles, count: roles.length }, [
              "roles list-members <role-id>",
            ]);
          }
        }
      } catch (err) {
        failure("roles list", err);
      }
    });

  cmd
    .command("list-members <role-id>")
    .description("List members of a directory role")
    .action(async (roleId) => {
      const client = getClient();
      try {
        const res = await client.get<{ value: RoleMember[] }>(
          `/directoryRoles/${roleId}/members?$select=id,displayName,userPrincipalName`
        );
        const members = res.value || [];

        if (isTTY()) {
          printTable(
            "roles list-members",
            members.map((m) => ({
              name: m.displayName,
              upn: m.userPrincipalName || "(non-user)",
              id: m.id,
            })),
            [
              { key: "name", label: "Name", width: 35 },
              { key: "upn", label: "UPN", width: 40 },
              { key: "id", label: "ID", width: 38 },
            ]
          );
        } else {
          success("roles list-members", { roleId, items: members, count: members.length });
        }
      } catch (err) {
        failure("roles list-members", err);
      }
    });

  cmd
    .command("assign <role-id> <upn-or-id>")
    .description("Assign a directory role to a user")
    .action(async (roleId, userId) => {
      const client = getClient();
      try {
        // Resolve user ID if UPN given
        let principalId = userId;
        if (userId.includes("@")) {
          const user = await client.get<{ id: string }>(`/users/${encodeURIComponent(userId)}?$select=id`);
          principalId = user.id;
        }

        // Add member to directory role
        await client.post(`/directoryRoles/${roleId}/members/$ref`, {
          "@odata.id": `https://graph.microsoft.com/v1.0/directoryObjects/${principalId}`,
        });
        printMessage("roles assign", `Assigned role ${roleId} to ${userId}`, { roleId, userId, principalId, action: "assigned" });
      } catch (err) {
        failure("roles assign", err);
      }
    });

  cmd
    .command("remove <role-id> <upn-or-id>")
    .description("Remove a directory role from a user")
    .action(async (roleId, userId) => {
      const client = getClient();
      try {
        let principalId = userId;
        if (userId.includes("@")) {
          const user = await client.get<{ id: string }>(`/users/${encodeURIComponent(userId)}?$select=id`);
          principalId = user.id;
        }
        await client.delete(`/directoryRoles/${roleId}/members/${principalId}/$ref`);
        printMessage("roles remove", `Removed role ${roleId} from ${userId}`, { roleId, userId, principalId, action: "removed" });
      } catch (err) {
        failure("roles remove", err);
      }
    });

  cmd
    .command("list-user-roles <upn-or-id>")
    .description("List all roles assigned to a user")
    .action(async (userId) => {
      const client = getClient();
      try {
        const url = `/users/${encodeURIComponent(userId)}/memberOf?$select=id,displayName`;
        const res = await client.get<{ value: { id: string; displayName: string; "@odata.type": string }[] }>(url);
        const all = res.value || [];
        const roles = all.filter((r) => r["@odata.type"]?.includes("directoryRole"));

        if (isTTY()) {
          if (roles.length === 0) {
            console.log(color.dim(`No directory roles assigned to ${userId}`));
            return;
          }
          printTable(
            "roles list-user-roles",
            roles.map((r) => ({ name: r.displayName, id: r.id })),
            [
              { key: "name", label: "Role", width: 45 },
              { key: "id", label: "ID", width: 38 },
            ]
          );
        } else {
          success("roles list-user-roles", { userId, items: roles, count: roles.length });
        }
      } catch (err) {
        failure("roles list-user-roles", err);
      }
    });
}
