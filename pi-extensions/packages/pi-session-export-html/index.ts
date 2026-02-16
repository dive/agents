import { spawn } from "node:child_process";
import path from "node:path";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function sanitizeForFileName(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "session";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPiInvocationCandidates(): Array<{ command: string; argsPrefix: string[]; label: string }> {
  const candidates: Array<{ command: string; argsPrefix: string[]; label: string }> = [{ command: "pi", argsPrefix: [], label: "pi" }];

  const cliScript = process.argv[1]?.trim();
  if (cliScript) {
    candidates.push({
      command: process.execPath,
      argsPrefix: [cliScript],
      label: `${process.execPath} ${cliScript}`,
    });
  }

  return candidates;
}

async function runCommand(command: string, args: string[], cwd: string, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve();
        return;
      }

      const details = stderr.trim() || (signal ? `terminated by ${signal}` : `exit code ${code ?? "unknown"}`);
      reject(new Error(details));
    });
  });
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("open-export", {
    description: "Export current session to /tmp HTML via pi --export and open it",
    handler: async (_args, ctx) => {
      await ctx.waitForIdle();

      const sessionFile = ctx.sessionManager.getSessionFile();
      if (!sessionFile) {
        if (ctx.hasUI) {
          ctx.ui.notify("open-export: no session file (ephemeral mode?)", "warning");
        }
        return;
      }

      const sessionName = pi.getSessionName();
      const sessionId = ctx.sessionManager.getSessionId();
      const label = sanitizeForFileName(sessionName || sessionId.slice(0, 8));
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const outputPath = path.join("/tmp", `pi-session-${label}-${timestamp}.html`);

      const invocations = getPiInvocationCandidates();
      let exportSucceeded = false;
      const failures: string[] = [];

      for (const invocation of invocations) {
        const exportArgs = [...invocation.argsPrefix, "--export", sessionFile, outputPath];

        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            await runCommand(invocation.command, exportArgs, ctx.cwd, 30_000);
            exportSucceeded = true;
            break;
          } catch (error) {
            const message = error instanceof Error ? error.message : "unknown export error";
            failures.push(`${invocation.label} (attempt ${attempt}): ${message}`);

            if (attempt < 2) {
              await sleep(200);
            }
          }
        }

        if (exportSucceeded) break;
      }

      if (!exportSucceeded) {
        const reason = failures[failures.length - 1] ?? "unknown export error";
        if (ctx.hasUI) ctx.ui.notify(`open-export: export failed (${reason})`, "error");
        return;
      }

      try {
        await runCommand("open", [outputPath], ctx.cwd, 5_000);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unknown open error";
        if (ctx.hasUI) ctx.ui.notify(`open-export: exported but failed to open (${reason})`, "warning");
        return;
      }

      if (ctx.hasUI) {
        ctx.ui.notify(`open-export: opened ${outputPath}`, "info");
      }
    },
  });
}
