import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import path from "node:path";

import { createOscWriter, isGhosttyTerminal } from "./shared/terminal-osc";

const MIN_NOTIFICATION_INTERVAL_MS = 1_500;

function sanitize(input: string): string {
  return input.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
}

export default function (pi: ExtensionAPI) {
  const ghosttyEnabled = isGhosttyTerminal();
  const osc = createOscWriter();

  let lastNotificationAt = 0;
  let wasWorking = false;

  function shouldNotifyNow(): boolean {
    const now = Date.now();
    if (now - lastNotificationAt < MIN_NOTIFICATION_INTERVAL_MS) return false;
    lastNotificationAt = now;
    return true;
  }

  function buildNotificationMessage(): string {
    const cwd = path.basename(process.cwd());
    const session = pi.getSessionName();
    return sanitize(session ? `pi ready: ${session} (${cwd})` : `pi ready: ${cwd}`);
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

      notifyGhostty(buildNotificationMessage());
      ctx.ui.notify("pi-notifications: test sent", "success");
    },
  });

  pi.on("agent_start", async () => {
    wasWorking = true;
  });

  pi.on("agent_end", async () => {
    if (!ghosttyEnabled) return;
    if (!wasWorking) return;

    wasWorking = false;
    if (!shouldNotifyNow()) return;

    notifyGhostty(buildNotificationMessage());
  });

  pi.on("session_shutdown", async () => {
    wasWorking = false;
    osc.close();
  });
}
