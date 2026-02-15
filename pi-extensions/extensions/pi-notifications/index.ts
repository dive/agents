import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { closeSync, openSync, writeSync } from "node:fs";
import path from "node:path";

const OSC = "\x1b]";
const ST = "\x1b\\";
const MIN_NOTIFICATION_INTERVAL_MS = 1_500;

function isGhosttyTerminal(): boolean {
  return (process.env.TERM_PROGRAM ?? "").toLowerCase() === "ghostty";
}

function sanitize(input: string): string {
  // Prevent control-sequence injection and keep payload compact.
  return input.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
}

function wrapForTmux(sequence: string): string {
  if (!process.env.TMUX) return sequence;

  // tmux passthrough (DCS): escape inner ESC bytes then wrap.
  const escaped = sequence.replace(/\x1b/g, "\x1b\x1b");
  return `\x1bPtmux;${escaped}\x1b\\`;
}

export default function (pi: ExtensionAPI) {
  const enabled = isGhosttyTerminal();

  let ttyFd: number | undefined;
  let lastNotificationAt = 0;
  let wasWorking = false;

  function ensureTtyFd(): number | undefined {
    if (!enabled) return undefined;
    if (ttyFd !== undefined) return ttyFd;

    try {
      ttyFd = openSync("/dev/tty", "w");
      return ttyFd;
    } catch {
      return undefined;
    }
  }

  function closeTtyFd() {
    if (ttyFd === undefined) return;
    try {
      closeSync(ttyFd);
    } catch {
      // ignore close failures
    }
    ttyFd = undefined;
  }

  function notifyGhostty(message: string) {
    const fd = ensureTtyFd();
    if (fd === undefined) return;

    const payload = sanitize(message);
    if (!payload) return;

    // Ghostty supports OSC 9 desktop notifications.
    const sequence = `${OSC}9;${payload}${ST}`;
    const wrapped = wrapForTmux(sequence);

    try {
      writeSync(fd, wrapped);
    } catch {
      // Re-open lazily on next send.
      closeTtyFd();
    }
  }

  function shouldNotifyNow(): boolean {
    const now = Date.now();
    if (now - lastNotificationAt < MIN_NOTIFICATION_INTERVAL_MS) return false;
    lastNotificationAt = now;
    return true;
  }

  function buildNotificationMessage(): string {
    const cwd = path.basename(process.cwd());
    const session = pi.getSessionName();
    return session ? `pi ready: ${session} (${cwd})` : `pi ready: ${cwd}`;
  }

  pi.on("agent_start", async (_event, _ctx) => {
    wasWorking = true;
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!enabled || !ctx.hasUI) return;
    if (!wasWorking) return;

    wasWorking = false;

    if (!shouldNotifyNow()) return;
    notifyGhostty(buildNotificationMessage());
  });

  pi.on("session_shutdown", async () => {
    wasWorking = false;
    closeTtyFd();
  });
}
