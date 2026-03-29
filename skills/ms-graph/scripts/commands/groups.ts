import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printTable, printItem, printMessage, failure, success, isTTY } from "../lib/envelope.js";

interface Group {
  id: string;
  displayName: string;
  groupTypes: string[];
  mailEnabled: boolean;
  securityEnabled: boolean;
  description?: string;
  mail?: string;
}

interface Member {
  id: string;
  displayName: string;
  userPrincipalName?: string;
  "@odata.type": string;
}

export function registerGroups(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("groups").description("Group management");

  cmd
    .command("list")
    .description("List groups")
    .option("--top <n>", "Max results", "25")
    .option("--all", "Fetch all pages")
    .action(async (opts) => {
      const client = getClient();
      try {
        let groups: Group[];
        const select = "$select=id,displayName,groupTypes,mailEnabled,securityEnabled,description,mail";
        if (opts.all) {
          groups = await client.getAll<Group>(`/groups?${select}`);
        } else {
          const res = await client.get<{ value: Group[] }>(`/groups?${select}&$top=${opts.top}`);
          groups = res.value || [];
        }

        if (isTTY()) {
          printTable(
            "groups list",
            groups.map((g) => ({
              id: g.id,
              name: g.displayName,
              type: g.groupTypes?.includes("Unified") ? "M365" : g.securityEnabled ? "Security" : "Distribution",
              mail: g.mail || "",
              desc: (g.description || "").substring(0, 30),
            })),
            [
              { key: "name", label: "Name", width: 35 },
              { key: "type", label: "Type", width: 12 },
              { key: "mail", label: "Mail", width: 35 },
              { key: "id", label: "ID", width: 38 },
            ]
          );
        } else {
          success("groups list", { items: groups, count: groups.length }, [
            "groups get <group-id>",
            "groups list-members <group-id>",
          ]);
        }
      } catch (err) {
        failure("groups list", err);
      }
    });

  cmd
    .command("get <group-id>")
    .description("Get group details")
    .action(async (id) => {
      const client = getClient();
      try {
        const group = await client.get<Group>(
          `/groups/${encodeURIComponent(id)}?$select=id,displayName,groupTypes,mailEnabled,securityEnabled,description,mail,createdDateTime,membershipRule`
        );
        printItem("groups get", group as unknown as Record<string, unknown>);
      } catch (err) {
        failure("groups get", err);
      }
    });

  cmd
    .command("create")
    .description("Create a group")
    .requiredOption("--name <name>", "Group display name")
    .option("--m365", "Create as Microsoft 365 group (default: security group)")
    .option("--description <desc>", "Group description")
    .action(async (opts) => {
      const client = getClient();
      try {
        const body: Record<string, unknown> = {
          displayName: opts.name,
          mailNickname: opts.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
          mailEnabled: opts.m365 ? true : false,
          securityEnabled: true,
          groupTypes: opts.m365 ? ["Unified"] : [],
        };
        if (opts.description) body.description = opts.description;

        const group = await client.post<Group>("/groups", body);
        printMessage("groups create", `Created group: ${group.displayName} (${group.id})`, group);
      } catch (err) {
        failure("groups create", err);
      }
    });

  cmd
    .command("add-member <group-id> <upn-or-id>")
    .description("Add a member to a group")
    .action(async (groupId, memberId) => {
      const client = getClient();
      try {
        // Resolve user ID if UPN given
        let userId = memberId;
        if (memberId.includes("@")) {
          const user = await client.get<{ id: string }>(`/users/${encodeURIComponent(memberId)}?$select=id`);
          userId = user.id;
        }
        await client.post(`/groups/${groupId}/members/$ref`, {
          "@odata.id": `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`,
        });
        printMessage("groups add-member", `Added ${memberId} to group ${groupId}`, { groupId, memberId, action: "added" });
      } catch (err) {
        failure("groups add-member", err);
      }
    });

  cmd
    .command("remove-member <group-id> <upn-or-id>")
    .description("Remove a member from a group")
    .action(async (groupId, memberId) => {
      const client = getClient();
      try {
        let userId = memberId;
        if (memberId.includes("@")) {
          const user = await client.get<{ id: string }>(`/users/${encodeURIComponent(memberId)}?$select=id`);
          userId = user.id;
        }
        await client.delete(`/groups/${groupId}/members/${userId}/$ref`);
        printMessage("groups remove-member", `Removed ${memberId} from group ${groupId}`, { groupId, memberId, action: "removed" });
      } catch (err) {
        failure("groups remove-member", err);
      }
    });

  cmd
    .command("list-members <group-id>")
    .description("List group members")
    .action(async (groupId) => {
      const client = getClient();
      try {
        const members = await client.getAll<Member>(
          `/groups/${groupId}/members?$select=id,displayName,userPrincipalName`
        );

        if (isTTY()) {
          printTable(
            "groups list-members",
            members.map((m) => ({
              name: m.displayName,
              upn: m.userPrincipalName || "(non-user)",
              id: m.id,
              type: m["@odata.type"]?.split(".").pop() || "",
            })),
            [
              { key: "name", label: "Name", width: 30 },
              { key: "upn", label: "UPN", width: 40 },
              { key: "type", label: "Type", width: 12 },
              { key: "id", label: "ID", width: 38 },
            ]
          );
        } else {
          success("groups list-members", { groupId, items: members, count: members.length });
        }
      } catch (err) {
        failure("groups list-members", err);
      }
    });
}
