import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { closeSync, openSync, writeSync } from "node:fs";
import path from "node:path";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;
const PROGRESS_KEEPALIVE_MS = 1_000;
const COMPLETION_FLASH_MS = 800;

const OSC = "\x1b]";
const ST = "\x1b\\"; // String Terminator (preferred for OSC in Ghostty docs)

function isGhosttyTerminal(): boolean {
  const termProgram = (process.env.TERM_PROGRAM ?? "").toLowerCase();
  return termProgram === "ghostty";
}

function getLastMapKey<K, V>(map: Map<K, V>): K | undefined {
  let key: K | undefined;
  for (const k of map.keys()) key = k;
  return key;
}

export default function (pi: ExtensionAPI) {
  let ttyFd: number | undefined;
  let currentModel: string | undefined;

  let spinnerTimer: ReturnType<typeof setInterval> | undefined;
  let progressKeepaliveTimer: ReturnType<typeof setInterval> | undefined;
  let completionTimer: ReturnType<typeof setTimeout> | undefined;

  let frameIndex = 0;
  let isWorking = false;

  const activeTools = new Map<string, string>();
  let activeToolCallId: string | undefined;

  const ghosttyEnabled = isGhosttyTerminal();

  function clearSpinnerTimer() {
    if (!spinnerTimer) return;
    clearInterval(spinnerTimer);
    spinnerTimer = undefined;
  }

  function clearProgressKeepaliveTimer() {
    if (!progressKeepaliveTimer) return;
    clearInterval(progressKeepaliveTimer);
    progressKeepaliveTimer = undefined;
  }

  function clearCompletionTimer() {
    if (!completionTimer) return;
    clearTimeout(completionTimer);
    completionTimer = undefined;
  }

  function ensureTtyFd(): number | undefined {
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
      // ignore close errors
    }
    ttyFd = undefined;
  }

  function writeOsc(payload: string) {
    if (!ghosttyEnabled) return;

    const fd = ensureTtyFd();
    if (fd === undefined) return;

    try {
      writeSync(fd, `${OSC}${payload}${ST}`);
    } catch {
      // fd may become invalid when terminal context changes; reopen lazily later
      closeTtyFd();
    }
  }

  function setGhosttyProgress(state: 0 | 1 | 2 | 3 | 4, value?: number) {
    const payload = value === undefined ? `9;4;${state}` : `9;4;${state};${value}`;
    writeOsc(payload);
  }

  function getActiveToolName(): string | undefined {
    if (!activeToolCallId) return undefined;
    return activeTools.get(activeToolCallId);
  }

  function buildBaseTitle(): string {
    const parts: string[] = ["π", path.basename(process.cwd())];
    const sessionName = pi.getSessionName();

    if (sessionName) parts.push(sessionName);
    if (currentModel) parts.push(currentModel);

    return parts.join(" · ");
  }

  function setIdleTitle(ctx: ExtensionContext) {
    ctx.ui.setTitle(buildBaseTitle());
  }

  function renderWorkingTitle(ctx: ExtensionContext) {
    const frame = BRAILLE_FRAMES[frameIndex % BRAILLE_FRAMES.length];
    frameIndex += 1;

    const base = buildBaseTitle();
    const tool = getActiveToolName();

    ctx.ui.setTitle(tool ? `${frame} ${base} · ${tool}` : `${frame} ${base}`);
  }

  function startWorking(ctx: ExtensionContext) {
    clearCompletionTimer();
    clearSpinnerTimer();
    clearProgressKeepaliveTimer();

    isWorking = true;
    frameIndex = 0;

    renderWorkingTitle(ctx);

    spinnerTimer = setInterval(() => {
      renderWorkingTitle(ctx);
    }, SPINNER_INTERVAL_MS);
    spinnerTimer.unref?.();

    // Ghostty progress bar best-practice: keep progress alive periodically,
    // otherwise Ghostty resets stale progress after ~15s.
    setGhosttyProgress(3);
    progressKeepaliveTimer = setInterval(() => {
      setGhosttyProgress(3);
    }, PROGRESS_KEEPALIVE_MS);
    progressKeepaliveTimer.unref?.();
  }

  function stopWorking(ctx: ExtensionContext) {
    isWorking = false;

    clearSpinnerTimer();
    clearProgressKeepaliveTimer();
    clearCompletionTimer();

    activeTools.clear();
    activeToolCallId = undefined;

    setIdleTitle(ctx);

    // Brief completion flash, then hide progress.
    setGhosttyProgress(1, 100);
    completionTimer = setTimeout(() => {
      setGhosttyProgress(0);
      completionTimer = undefined;
    }, COMPLETION_FLASH_MS);
    completionTimer.unref?.();
  }

  function resetAll(ctx?: ExtensionContext) {
    isWorking = false;

    clearSpinnerTimer();
    clearProgressKeepaliveTimer();
    clearCompletionTimer();

    activeTools.clear();
    activeToolCallId = undefined;

    if (ctx?.hasUI) {
      setIdleTitle(ctx);
    }

    setGhosttyProgress(0);
    closeTtyFd();
  }

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    currentModel = ctx.model?.id;
    setIdleTitle(ctx);
  });

  pi.on("model_select", async (event, ctx) => {
    if (!ctx.hasUI) return;
    currentModel = event.model.id;

    if (!isWorking) {
      setIdleTitle(ctx);
    }
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    startWorking(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    stopWorking(ctx);
  });

  pi.on("tool_execution_start", async (event, _ctx) => {
    activeTools.set(event.toolCallId, event.toolName);
    activeToolCallId = event.toolCallId;
  });

  pi.on("tool_execution_end", async (event, _ctx) => {
    activeTools.delete(event.toolCallId);

    if (activeToolCallId === event.toolCallId) {
      activeToolCallId = getLastMapKey(activeTools);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    resetAll(ctx);
  });
}
