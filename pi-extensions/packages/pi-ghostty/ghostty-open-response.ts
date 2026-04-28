import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ExtensionAPI, ExtensionContext, SessionEntry, SessionMessageEntry } from "@mariozechner/pi-coding-agent";

const OUTPUT_DIR = path.join(os.tmpdir(), "pi-ghostty-responses");

type AssistantContentBlock = {
  type: string;
  text?: string;
};

type AssistantTextMessageEntry = SessionMessageEntry & {
  message: {
    role: "assistant";
    content: AssistantContentBlock[];
  };
};

function isAssistantTextMessageEntry(entry: SessionEntry): entry is AssistantTextMessageEntry {
  return entry.type === "message" && entry.message.role === "assistant" && Array.isArray(entry.message.content);
}

function getAssistantText(entry: AssistantTextMessageEntry): string {
  return entry.message.content
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("");
}

function getLatestAssistantText(ctx: ExtensionContext): string | undefined {
  const branch = ctx.sessionManager.getBranch();

  for (let i = branch.length - 1; i >= 0; i -= 1) {
    const entry = branch[i];
    if (!isAssistantTextMessageEntry(entry)) continue;

    const markdown = getAssistantText(entry);
    if (markdown.trim().length > 0) return markdown;
  }

  return undefined;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function appleScriptQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function writeMarkdown(markdown: string): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(OUTPUT_DIR, `latest-response-${timestamp}.md`);
  await writeFile(outputPath, markdown, "utf8");
  return outputPath;
}

async function openInGhostty(pi: ExtensionAPI, ctx: ExtensionContext, markdownPath: string): Promise<void> {
  const shellPath = process.env.SHELL || "/bin/zsh";
  const editorScript = 'if [ -z "$EDITOR" ]; then echo "open-response: EDITOR is not set"; exit 1; fi; eval "exec $EDITOR \\\"\\$1\\\""';
  const command = `${shellQuote(shellPath)} -lc ${shellQuote(editorScript)} open-response ${shellQuote(markdownPath)}`;
  const environment = process.env.EDITOR ? `, environment variables:{${appleScriptQuote(`EDITOR=${process.env.EDITOR}`)}}` : "";
  const script = [
    'tell application "Ghostty"',
    `set cfg to new surface configuration from {command:${appleScriptQuote(command)}, initial working directory:${appleScriptQuote(ctx.cwd)}, wait after command:true${environment}}`,
    "set win to new window with configuration cfg",
    "activate window win",
    "end tell",
  ];

  const result = await pi.exec("osascript", script.flatMap((line) => ["-e", line]), {
    cwd: ctx.cwd,
    timeout: 5_000,
  });

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `osascript exited with code ${result.code}`);
  }
}

async function openLatestResponse(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  if (process.platform !== "darwin") {
    if (ctx.hasUI) ctx.ui.notify("open-response: macOS only", "warning");
    return;
  }

  if (!ctx.isIdle()) {
    if (ctx.hasUI) ctx.ui.notify("open-response: wait until the current response finishes", "warning");
    return;
  }

  const markdown = getLatestAssistantText(ctx);
  if (!markdown) {
    if (ctx.hasUI) ctx.ui.notify("open-response: no assistant response found", "warning");
    return;
  }

  let markdownPath: string;
  try {
    markdownPath = await writeMarkdown(markdown);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown file write error";
    if (ctx.hasUI) ctx.ui.notify(`open-response: failed to write Markdown (${reason})`, "error");
    return;
  }

  try {
    await openInGhostty(pi, ctx, markdownPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown AppleScript error";
    if (ctx.hasUI) ctx.ui.notify(`open-response: failed to open Ghostty (${reason})`, "error");
    return;
  }

  if (ctx.hasUI) ctx.ui.notify(`open-response: opened ${markdownPath}`, "info");
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("open-response", {
    description: "Open the latest assistant response Markdown in a new Ghostty window with $EDITOR",
    handler: async (_args, ctx) => {
      await ctx.waitForIdle();
      await openLatestResponse(pi, ctx);
    },
  });

  pi.registerShortcut("alt+o", {
    description: "Open latest assistant response in Ghostty $EDITOR",
    handler: async (ctx) => openLatestResponse(pi, ctx),
  });
}
