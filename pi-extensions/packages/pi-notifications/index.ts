import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import path from "node:path";

import { createOscWriter, isGhosttyTerminal } from "./terminal-osc";

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

  let wasWorking = false;
  let turnStartedAt = 0;
  let currentCwd: string = process.cwd();
  let lastRunHadError = false;

  function buildNotificationMessage(status: "done" | "error", durationMs: number): string {
    const cwd = path.basename(currentCwd);
    const session = pi.getSessionName();
    const duration = formatDuration(durationMs);
    const headline = status === "error" ? `pi error in ${duration}` : `pi done in ${duration}`;
    return sanitize(session ? `${headline}: ${session} (${cwd})` : `${headline}: ${cwd}`);
  }

  function didAgentEndWithError(messages: Array<{ role: string; stopReason?: string }>): boolean {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role !== "assistant") continue;
      return message.stopReason === "error" || message.stopReason === "aborted";
    }
    return false;
  }

  function notifyGhostty(message: string) {
    if (!ghosttyEnabled) return;
    if (!message) return;

    // Ghostty desktop notification via OSC 9.
    // Use BEL terminator for wide compatibility with notification protocols.
    osc.writeOsc(`9;${message}`, "bel");
  }

  pi.on("session_start", async (_event, ctx) => {
    currentCwd = ctx.cwd;
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    if (wasWorking) return;

    wasWorking = true;
    turnStartedAt = Date.now();
    lastRunHadError = false;
  });

  pi.on("agent_end", async (event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    if (!wasWorking) return;

    lastRunHadError = didAgentEndWithError(event.messages);
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    if (!wasWorking) return;

    const durationMs = turnStartedAt > 0 ? Date.now() - turnStartedAt : 0;
    notifyGhostty(buildNotificationMessage(lastRunHadError ? "error" : "done", durationMs));

    wasWorking = false;
    turnStartedAt = 0;
    lastRunHadError = false;
  });

  pi.on("session_shutdown", async () => {
    wasWorking = false;
    turnStartedAt = 0;
    lastRunHadError = false;
    osc.close();
  });
}
