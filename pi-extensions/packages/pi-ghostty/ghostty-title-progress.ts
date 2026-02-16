import { execFile } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import path from "node:path";
import { promisify } from "node:util";

import { createOscWriter, isGhosttyTerminal } from "./shared/terminal-osc";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;
const PROGRESS_KEEPALIVE_MS = 1_000;
const COMPLETION_FLASH_MS = 800;
const RESULT_FLASH_MS = 900;
const GIT_REFRESH_INTERVAL_MS = 5_000;

const execFileAsync = promisify(execFile);

type ProgressState = 0 | 1 | 2 | 3 | 4;

function getLastMapKey<K, V>(map: Map<K, V>): K | undefined {
  let key: K | undefined;
  for (const k of map.keys()) key = k;
  return key;
}

export default function (pi: ExtensionAPI) {
  const ghosttyEnabled = isGhosttyTerminal();
  const osc = createOscWriter();

  let currentModel: string | undefined;

  let spinnerTimer: ReturnType<typeof setInterval> | undefined;
  let progressKeepaliveTimer: ReturnType<typeof setInterval> | undefined;
  let completionTimer: ReturnType<typeof setTimeout> | undefined;
  let resultFlashTimer: ReturnType<typeof setTimeout> | undefined;

  let frameIndex = 0;
  let isWorking = false;
  let lastTurnHadError = false;
  let gitLabel: string | undefined;
  let gitRefreshTimer: ReturnType<typeof setInterval> | undefined;
  let gitRefreshInFlight = false;

  const activeTools = new Map<string, string>();
  let activeToolCallId: string | undefined;

  function setGhosttyProgress(state: ProgressState, value?: number) {
    if (!ghosttyEnabled) return;
    const payload = value === undefined ? `9;4;${state}` : `9;4;${state};${value}`;
    osc.writeOsc(payload, "st");
  }

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

  function clearResultFlashTimer() {
    if (!resultFlashTimer) return;
    clearTimeout(resultFlashTimer);
    resultFlashTimer = undefined;
  }

  function getActiveToolName(): string | undefined {
    if (!activeToolCallId) return undefined;
    return activeTools.get(activeToolCallId);
  }

  function clearGitRefreshTimer() {
    if (!gitRefreshTimer) return;
    clearInterval(gitRefreshTimer);
    gitRefreshTimer = undefined;
  }

  async function refreshGitLabel() {
    if (gitRefreshInFlight) return;
    gitRefreshInFlight = true;

    try {
      const { stdout: branchStdout } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: process.cwd(),
        timeout: 1_500,
        maxBuffer: 128 * 1024,
      });

      const branch = branchStdout.trim();
      if (!branch) {
        gitLabel = undefined;
        return;
      }

      const { stdout: statusStdout } = await execFileAsync("git", ["status", "--porcelain"], {
        cwd: process.cwd(),
        timeout: 1_500,
        maxBuffer: 256 * 1024,
      });

      const dirty = statusStdout.trim().length > 0;
      gitLabel = dirty ? `${branch}*` : branch;
    } catch {
      gitLabel = undefined;
    } finally {
      gitRefreshInFlight = false;
    }
  }

  async function refreshGitLabelAndRender(ctx: ExtensionContext) {
    const previous = gitLabel;
    await refreshGitLabel();
    if (!isWorking && previous !== gitLabel) {
      setIdleTitle(ctx);
    }
  }

  function startGitRefreshLoop(ctx: ExtensionContext) {
    clearGitRefreshTimer();
    void refreshGitLabelAndRender(ctx);

    gitRefreshTimer = setInterval(() => {
      void refreshGitLabelAndRender(ctx);
    }, GIT_REFRESH_INTERVAL_MS);
    gitRefreshTimer.unref?.();
  }

  function buildBaseTitle(): string {
    const parts: string[] = ["π", path.basename(process.cwd())];
    const sessionName = pi.getSessionName();
    const thinkingLevel = pi.getThinkingLevel();

    if (gitLabel) parts.push(gitLabel);
    if (sessionName) parts.push(sessionName);
    if (currentModel) {
      parts.push(`${currentModel} (${thinkingLevel})`);
    } else {
      parts.push(`thinking:${thinkingLevel}`);
    }

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
    clearResultFlashTimer();

    isWorking = true;
    frameIndex = 0;

    renderWorkingTitle(ctx);

    spinnerTimer = setInterval(() => {
      renderWorkingTitle(ctx);
    }, SPINNER_INTERVAL_MS);
    spinnerTimer.unref?.();

    // Ghostty resets stale progress after ~15s. Keep alive while working.
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
    clearResultFlashTimer();

    activeTools.clear();
    activeToolCallId = undefined;

    const base = buildBaseTitle();
    const resultSymbol = lastTurnHadError ? "✗" : "✓";
    ctx.ui.setTitle(`${resultSymbol} ${base}`);

    resultFlashTimer = setTimeout(() => {
      setIdleTitle(ctx);
      resultFlashTimer = undefined;
    }, RESULT_FLASH_MS);
    resultFlashTimer.unref?.();

    setGhosttyProgress(1, 100);
    completionTimer = setTimeout(() => {
      setGhosttyProgress(0);
      completionTimer = undefined;
    }, COMPLETION_FLASH_MS);
    completionTimer.unref?.();
  }

  function resetAll(ctx?: ExtensionContext) {
    isWorking = false;
    lastTurnHadError = false;
    gitLabel = undefined;

    clearSpinnerTimer();
    clearProgressKeepaliveTimer();
    clearCompletionTimer();
    clearResultFlashTimer();
    clearGitRefreshTimer();

    activeTools.clear();
    activeToolCallId = undefined;

    if (ctx?.hasUI) setIdleTitle(ctx);

    setGhosttyProgress(0);
    osc.close();
  }

  pi.registerCommand("pi-ghostty-test", {
    description: "Smoke test Ghostty integration (title + progress)",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("pi-ghostty: no UI in current mode", "warning");
        return;
      }
      if (!ghosttyEnabled) {
        ctx.ui.notify("pi-ghostty: Ghostty not detected", "warning");
        return;
      }

      ctx.ui.notify("pi-ghostty: running 2s test", "info");
      startWorking(ctx);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      stopWorking(ctx);
      ctx.ui.notify("pi-ghostty: test complete", "success");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    currentModel = ctx.model?.id;
    startGitRefreshLoop(ctx);
    setIdleTitle(ctx);
  });

  pi.on("model_select", async (event, ctx) => {
    if (!ctx.hasUI) return;
    currentModel = event.model.id;
    if (!isWorking) setIdleTitle(ctx);
  });

  pi.on("session_switch", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    startGitRefreshLoop(ctx);
    if (!isWorking) setIdleTitle(ctx);
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    lastTurnHadError = false;
    startWorking(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    await refreshGitLabel();
    stopWorking(ctx);
  });

  pi.on("tool_execution_start", async (event, _ctx) => {
    activeTools.set(event.toolCallId, event.toolName);
    activeToolCallId = event.toolCallId;
  });

  pi.on("tool_execution_end", async (event, _ctx) => {
    activeTools.delete(event.toolCallId);
    if (event.isError) {
      lastTurnHadError = true;
    }
    if (activeToolCallId === event.toolCallId) {
      activeToolCallId = getLastMapKey(activeTools);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    resetAll(ctx);
  });
}
