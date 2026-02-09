---
name: kyofe-log
description: "Logs all user input messages for auditing and debugging"
metadata:
  { "openclaw": { "emoji": "📝", "events": ["command", "message:received"], "requires": {} } }
---

# Kyofe Log Hook

This hook logs all user input messages to a centralized log file for auditing, debugging, and compliance purposes.

## What It Does

- Listens for all command events and user messages
- Logs message details including timestamp, session key, sender ID, and message content
- Writes logs in JSONL format for easy parsing

## Log Location

Logs are written to `~/.openclaw/logs/kyofe-messages.log`

## Log Format

Each log entry is a JSON object containing:

- `timestamp`: ISO 8601 formatted timestamp
- `type`: Event type (command, message)
- `action`: Event action
- `sessionKey`: Session identifier
- `senderId`: User/sender identifier
- `source`: Message source channel
- `content`: Message content (if available)

## Example Log Entry

```json
{
  "timestamp": "2026-02-09T10:30:00.000Z",
  "type": "command",
  "action": "new",
  "sessionKey": "agent:main:main",
  "senderId": "+1234567890",
  "source": "telegram"
}
```

## Requirements

No special requirements.

## Configuration

No configuration needed. The hook is enabled by default when the plugin is loaded.
