---
name: private-email
description: Read, search, and send email from Brandon's personal account (brandon@shadekelly.com) via himalaya-cli. Use when Brandon asks to check his personal email, find a message, search inbox, or send an email from his shadekelly address. Triggers on: "personal email", "shadekelly", "check my email", "read email", "send from personal", "my private email".
---

# private-email skill

Manage Brandon's personal email at `brandon@shadekelly.com` using **himalaya-cli**.

## himalaya config

Account is already configured at `~/.config/himalaya/config.toml`.

## Core commands

### List emails
```
himalaya email list                    # inbox (default)
himalaya email list --folder "INBOX.Sent"   # sent
himalaya email list --folder "INBOX"    # explicit inbox
```
Flags: `-d` (detailed, shows From/To/Subject/Date), `-s 50` (page size).

### Read an email
```
himalaya email read <id>
himalaya email read 42 --plain         # raw body, no formatting
```

### Search
```
himalaya email search "from:priceline subject:confirmation"
himalaya email search "subject:trip"
himalaya email search "since:2026-04-15"
```
Searches current folder. Use `--folder` to search a specific folder.

### Send email
```
himalaya email write \
  --from "brandon@shadekelly.com" \
  --to "recipient@example.com" \
  --subject "Subject here" \
  --body "Message body"
```
Body defaults to stdin if `--body` is omitted (pipe in content).

### Delete
```
himalaya email delete <id>
```

### Mark read/unread
```
himalaya email flag -f +seen <id>     # mark read
himalaya email flag -f +flagged <id>  # mark flagged
himalaya email flag -f -seen <id>      # mark unread
```

### List folders
```
himalaya folder list
```

## Environment

Password comes from `PRIVATE_EMAIL_PASSWORD` env var. No password entry needed in config — himalaya reads it from the env.

If himalaya fails with auth error, verify the env var is set in the container:
```
echo $PRIVATE_EMAIL_PASSWORD
```

## Troubleshooting

**"certificate verify failed"**: PrivateEmail uses a standard SSL cert. If you get this, the CA certs package may be missing. Install with: `apt-get install -y ca-certificates`

**Empty output**: himalaya may need to be run from the correct working directory or with full path. Try: `~/.cargo/bin/himalaya` if plain `himalaya` returns nothing.

**IMAP connection refused**: Check that the container can reach `mail.privateemail.com:993`. Run: `nc -zv mail.privateemail.com 993`
