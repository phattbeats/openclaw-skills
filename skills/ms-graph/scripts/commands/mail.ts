import { Command } from "commander";
import { GraphClient } from "../lib/client.js";
import { printTable, printItem, printMessage, failure, success, isTTY, color } from "../lib/envelope.js";
import * as fs from "fs";
import * as path from "path";

interface MailFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

interface Message {
  id: string;
  subject: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  receivedDateTime?: string;
  isRead?: boolean;
  bodyPreview?: string;
  body?: { content: string; contentType: string };
  toRecipients?: { emailAddress: { address: string; name?: string } }[];
}

const WELL_KNOWN_FOLDERS: Record<string, string> = {
  inbox: "inbox",
  sent: "sentItems",
  sentitems: "sentItems",
  drafts: "drafts",
  deleted: "deletedItems",
  deleteditems: "deletedItems",
  junk: "junkemail",
  junkemail: "junkemail",
};

function resolveFolder(folderIdOrName: string): string {
  const lower = folderIdOrName.toLowerCase();
  return WELL_KNOWN_FOLDERS[lower] || folderIdOrName;
}

export function registerMail(program: Command, getClient: () => GraphClient) {
  const cmd = program.command("mail").description("Mail operations");

  cmd
    .command("send")
    .description("Send an email as a user")
    .requiredOption("--from <upn>", "Sender UPN")
    .requiredOption("--to <addr>", "Recipient email (comma-separated for multiple)")
    .requiredOption("--subject <s>", "Subject")
    .requiredOption("--body <b>", "Body text")
    .option("--html", "Body is HTML")
    .option("-a, --attachment <path>", "File attachment (repeatable)", (v, arr: string[]) => (arr || []).concat(v), [])
    .action(async (opts) => {
      const client = getClient();
      try {
        const toAddresses = opts.to.split(",").map((a: string) => a.trim());
        const sender = opts.from;
        const attachments: string[] = opts.attachment || [];

        // Validate attachment files
        for (const filePath of attachments) {
          if (!fs.existsSync(filePath)) {
            failure("mail send", new Error(`Attachment not found: ${filePath}`));
            return;
          }
          const stat = fs.statSync(filePath);
          if (stat.size > 150 * 1024 * 1024) {
            failure("mail send", new Error(`Attachment too large (>150MB): ${filePath}`));
            return;
          }
        }

        // Create draft message
        const draft = await client.post<{ id: string }>(
          `/users/${encodeURIComponent(sender)}/messages`,
          {
            subject: opts.subject,
            body: {
              contentType: opts.html ? "HTML" : "Text",
              content: opts.body,
            },
            toRecipients: toAddresses.map((addr: string) => ({
              emailAddress: { address: addr },
            })),
          }
        );

        // Upload attachments
        for (const filePath of attachments) {
          const fileData = fs.readFileSync(filePath);
          const b64 = fileData.toString("base64");
          const mimeType = getMimeType(filePath);
          await client.post(
            `/users/${encodeURIComponent(sender)}/messages/${draft.id}/attachments`,
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: path.basename(filePath),
              contentType: mimeType,
              contentBytes: b64,
              size: fileData.length,
            }
          );
        }

        // Send the draft
        await client.post(`/users/${encodeURIComponent(sender)}/messages/${draft.id}/send`, {});

        printMessage("mail send", `Email sent from ${sender} to ${opts.to}${attachments.length ? ` with ${attachments.length} attachment(s)` : ""}`, {
          from: sender,
          to: toAddresses,
          subject: opts.subject,
          attachments: attachments.map((p) => path.basename(p)),
          sent: true,
        });
      } catch (err) {
        failure("mail send", err);
      }
    });

  cmd
    .command("list-folders <upn>")
    .description("List mail folders for a user")
    .action(async (upn) => {
      const client = getClient();
      try {
        const res = await client.get<{ value: MailFolder[] }>(
          `/users/${encodeURIComponent(upn)}/mailFolders?$select=id,displayName,totalItemCount,unreadItemCount`
        );
        const folders = res.value || [];

        if (isTTY()) {
          printTable(
            "mail list-folders",
            folders.map((f) => ({
              name: f.displayName,
              total: String(f.totalItemCount),
              unread: String(f.unreadItemCount),
              id: f.id,
            })),
            [
              { key: "name", label: "Folder", width: 30 },
              { key: "total", label: "Total", width: 8 },
              { key: "unread", label: "Unread", width: 8 },
              { key: "id", label: "ID", width: 40 },
            ]
          );
        } else {
          success("mail list-folders", { upn, items: folders, count: folders.length }, [
            "mail list-messages <upn> --folder <id-or-name>",
          ]);
        }
      } catch (err) {
        failure("mail list-folders", err);
      }
    });

  cmd
    .command("list-messages <upn>")
    .description("List messages in a folder")
    .option("--folder <id-or-name>", "Folder ID or well-known name", "inbox")
    .option("--top <n>", "Max results", "20")
    .action(async (upn, opts) => {
      const client = getClient();
      try {
        const folder = resolveFolder(opts.folder);
        const select = "$select=id,subject,from,receivedDateTime,isRead,bodyPreview";
        const res = await client.get<{ value: Message[] }>(
          `/users/${encodeURIComponent(upn)}/mailFolders/${folder}/messages?${select}&$top=${opts.top}&$orderby=receivedDateTime desc`
        );
        const messages = res.value || [];

        if (isTTY()) {
          printTable(
            "mail list-messages",
            messages.map((m) => ({
              read: m.isRead ? "  " : "●",
              from: m.from?.emailAddress?.address || "",
              subject: m.subject.substring(0, 50),
              date: m.receivedDateTime ? new Date(m.receivedDateTime).toLocaleDateString() : "",
              id: m.id.substring(0, 20) + "...",
            })),
            [
              { key: "read", label: " ", width: 3 },
              { key: "date", label: "Date", width: 12 },
              { key: "from", label: "From", width: 35 },
              { key: "subject", label: "Subject", width: 52 },
            ]
          );
        } else {
          success("mail list-messages", { upn, folder, items: messages, count: messages.length }, [
            "mail get-message <upn> <message-id>",
          ]);
        }
      } catch (err) {
        failure("mail list-messages", err);
      }
    });

  cmd
    .command("get-message <upn> <message-id>")
    .description("Get a specific message with full body")
    .action(async (upn, messageId) => {
      const client = getClient();
      try {
        const message = await client.get<Message>(
          `/users/${encodeURIComponent(upn)}/messages/${messageId}?$select=id,subject,from,toRecipients,receivedDateTime,isRead,body,bodyPreview`
        );

        if (isTTY()) {
          console.log(`${color.bold("Subject:")} ${message.subject}`);
          console.log(`${color.bold("From:")}    ${message.from?.emailAddress?.address || ""}`);
          console.log(`${color.bold("Date:")}    ${message.receivedDateTime || ""}`);
          console.log(`${color.bold("Read:")}    ${message.isRead}`);
          console.log("");
          // Strip HTML for display
          const body = message.body?.content || message.bodyPreview || "";
          const text = body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
          console.log(text.substring(0, 2000));
        } else {
          success("mail get-message", message);
        }
      } catch (err) {
        failure("mail get-message", err);
      }
    });
}

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".txt": "text/plain",
  ".html": "text/html",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}
