import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import path from "node:path";

import { createOscWriter, isGhosttyTerminal } from "./shared/terminal-osc";

const MIN_NOTIFICATION_INTERVAL_MS = 1_500;
const MIN_SUCCESS_NOTIFICATION_DURATION_MS = 10_000;

function sanitize(input: string): string {
  return input.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  if (remainderSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainderSeconds}s`;
}

export default function (pi: ExtensionAPI) {
  const ghosttyEnabled = isGhosttyTerminal();
  const osc = createOscWriter();

  let lastNotificationAt = 0;
  let wasWorking = false;
  let turnStartedAt = 0;
  let turnHadError = false;

  function shouldNotifyNow(): boolean {
    const now = Date.now();
    if (now - lastNotificationAt < MIN_NOTIFICATION_INTERVAL_MS) return false;
    lastNotificationAt = now;
    return true;
  }

  function markNotifiedNow() {
    lastNotificationAt = Date.now();
  }

  function buildNotificationMessage(status: "done" | "error", durationMs: number): string {
    const cwd = path.basename(process.cwd());
    const session = pi.getSessionName();
    const duration = formatDuration(durationMs);
    const headline = status === "error" ? `pi error in ${duration}` : `pi done in ${duration}`;
    return sanitize(session ? `${headline}: ${session} (${cwd})` : `${headline}: ${cwd}`);
  }

  function notifyGhostty(message: string) {
    if (!ghosttyEnabled) return;
    if (!message) return;

    // Ghostty desktop notification via OSC 9.
    // Use BEL terminator for wide compatibility with notification protocols.
    osc.writeOsc(`9;${message}`, "bel");
  }

  pi.registerCommand("pi-notifications-test", {
    description: "Send a test Ghostty notification",
    handler: async (_args, ctx) => {
      if (!ghosttyEnabled) {
        ctx.ui.notify("pi-notifications: Ghostty not detected", "warning");
        return;
      }

      notifyGhostty(buildNotificationMessage("done", 0));
      ctx.ui.notify("pi-notifications: test sent", "success");
    },
  });

  pi.on("agent_start", async () => {
    wasWorking = true;
    turnStartedAt = Date.now();
    turnHadError = false;
  });

  pi.on("tool_execution_end", async (event) => {
    if (event.isError) {
      turnHadError = true;
    }
  });

  pi.on("agent_end", async () => {
    if (!ghosttyEnabled) return;
    if (!wasWorking) return;

    wasWorking = false;

    const durationMs = turnStartedAt > 0 ? Date.now() - turnStartedAt : 0;
    const hadError = turnHadError;

    turnStartedAt = 0;
    turnHadError = false;

    if (!hadError && durationMs < MIN_SUCCESS_NOTIFICATION_DURATION_MS) return;
    if (!hadError && !shouldNotifyNow()) return;
    if (hadError) markNotifiedNow();

    notifyGhostty(buildNotificationMessage(hadError ? "error" : "done", durationMs));
  });

  pi.on("session_shutdown", async () => {
    wasWorking = false;
    turnStartedAt = 0;
    turnHadError = false;
    osc.close();
  });
}
