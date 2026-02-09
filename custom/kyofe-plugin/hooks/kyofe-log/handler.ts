import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { HookHandler } from "../../../../src/hooks/hooks.js";

// Log file path: ~/.openclaw/logs/kyofe-messages.log
const LOG_DIR = path.join(os.homedir(), ".openclaw", "logs");
const LOG_FILE = path.join(LOG_DIR, "kyofe-messages.log");

/**
 * Ensures the log directory exists
 */
function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Appends a log entry to the log file
 */
function appendLog(entry: Record<string, unknown>): void {
  try {
    ensureLogDir();
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(LOG_FILE, line, "utf-8");
  } catch (err) {
    console.error(
      "[kyofe-log] Failed to write log:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Hook handler that logs all user input messages
 */
const handler: HookHandler = async (event) => {
  // Log entry structure
  const logEntry: Record<string, unknown> = {
    timestamp: event.timestamp.toISOString(),
    type: event.type,
    action: event.action,
    sessionKey: event.sessionKey,
    senderId: event.context?.senderId ?? null,
    source: event.context?.commandSource ?? null,
  };

  // Log the event
  appendLog(logEntry);

  console.log(
    `[kyofe-log] Logged ${event.type}:${event.action} from ${event.context?.senderId ?? "unknown"}`,
  );
};

export default handler;
