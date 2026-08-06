import { execFile } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import { promisify } from "node:util";

import { isGhosttyTerminal } from "./terminal-osc";

const RESULT_FLASH_MS = 900;
const GIT_REFRESH_INTERVAL_MS = 5_000;

const execFileAsync = promisify(execFile);

function getLastMapKey<K, V>(map: Map<K, V>): K | undefined {
  let key: K | undefined;
  for (const k of map.keys()) key = k;
  return key;
}

function didAgentEndWithError(messages: Array<{ role: string; stopReason?: string }>): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    return message.stopReason === "error" || message.stopReason === "aborted";
  }
  return false;
}

export default function (pi: ExtensionAPI) {
  const ghosttyEnabled = isGhosttyTerminal();

  let currentModel: string | undefined;
  let currentCwd: string = process.cwd();

  let resultFlashTimer: ReturnType<typeof setTimeout> | undefined;

  let isWorking = false;
  let lastRunHadError = false;
  let sessionActive = false;
  let gitLabel: string | undefined;
  let gitRefreshTimer: ReturnType<typeof setInterval> | undefined;
  let gitRefreshInFlight = false;

  const activeTools = new Map<string, string>();
  let activeToolCallId: string | undefined;

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
        cwd: currentCwd,
        timeout: 1_500,
        maxBuffer: 128 * 1024,
      });

      const branch = branchStdout.trim();
      if (!branch) {
        gitLabel = undefined;
        return;
      }

      const { stdout: statusStdout } = await execFileAsync("git", ["status", "--porcelain"], {
        cwd: currentCwd,
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
    if (sessionActive && previous !== gitLabel) {
      renderCurrentTitle(ctx);
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
    const parts: string[] = ["π", path.basename(currentCwd)];
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
    const base = buildBaseTitle();
    const tool = getActiveToolName();

    ctx.ui.setTitle(tool ? `… ${base} · ${tool}` : `… ${base}`);
  }

  function renderCurrentTitle(ctx: ExtensionContext) {
    if (isWorking) renderWorkingTitle(ctx);
    else setIdleTitle(ctx);
  }

  function startWorking(ctx: ExtensionContext) {
    clearResultFlashTimer();
    isWorking = true;
    renderWorkingTitle(ctx);
  }

  function stopWorking(ctx: ExtensionContext) {
    isWorking = false;
    clearResultFlashTimer();

    activeTools.clear();
    activeToolCallId = undefined;

    const base = buildBaseTitle();
    const resultSymbol = lastRunHadError ? "✗" : "✓";
    ctx.ui.setTitle(`${resultSymbol} ${base}`);

    resultFlashTimer = setTimeout(() => {
      setIdleTitle(ctx);
      resultFlashTimer = undefined;
    }, RESULT_FLASH_MS);
    resultFlashTimer.unref?.();
  }

  function resetAll(ctx?: ExtensionContext) {
    isWorking = false;
    lastRunHadError = false;
    gitLabel = undefined;

    clearResultFlashTimer();
    clearGitRefreshTimer();

    activeTools.clear();
    activeToolCallId = undefined;

    if (ghosttyEnabled && ctx?.mode === "tui") setIdleTitle(ctx);
  }

  pi.on("session_start", async (_event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    sessionActive = true;
    currentModel = ctx.model?.id;
    currentCwd = ctx.cwd;
    startGitRefreshLoop(ctx);
    setIdleTitle(ctx);
  });

  pi.on("session_info_changed", async (_event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    renderCurrentTitle(ctx);
  });

  pi.on("model_select", async (event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    currentModel = event.model.id;
    renderCurrentTitle(ctx);
  });

  pi.on("thinking_level_select", async (_event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    renderCurrentTitle(ctx);
  });

  pi.on("agent_start", async (_event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    if (isWorking) return;

    lastRunHadError = false;
    startWorking(ctx);
  });

  pi.on("agent_end", async (event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    if (!isWorking) return;

    lastRunHadError = didAgentEndWithError(event.messages);
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (!ghosttyEnabled || ctx.mode !== "tui") return;
    if (!isWorking) return;

    await refreshGitLabel();
    if (sessionActive) stopWorking(ctx);
  });

  pi.on("tool_execution_start", async (event, ctx) => {
    if (!isWorking) return;
    activeTools.set(event.toolCallId, event.toolName);
    activeToolCallId = event.toolCallId;
    renderWorkingTitle(ctx);
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    if (!isWorking) return;
    activeTools.delete(event.toolCallId);
    if (activeToolCallId === event.toolCallId) {
      activeToolCallId = getLastMapKey(activeTools);
    }
    renderWorkingTitle(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    sessionActive = false;
    resetAll(ctx);
  });
}
