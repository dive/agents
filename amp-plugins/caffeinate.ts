import { spawn, type ChildProcess } from "node:child_process";
import type { PluginAPI, ThreadID, ThreadMessageID } from "@ampcode/plugin";

export const description =
  "Prevents macOS idle sleep while interactive Amp agent turns are active.";

function turnKey(threadID: ThreadID, messageID: ThreadMessageID): string {
  return JSON.stringify([threadID, messageID]);
}

export default function (amp: PluginAPI) {
  if (process.platform !== "darwin") return;

  const activeTurns = new Map<string, ChildProcess>();

  function removeIfCurrent(key: string, child: ChildProcess): boolean {
    if (activeTurns.get(key) !== child) return false;
    activeTurns.delete(key);
    return true;
  }

  amp.on("agent.start", (event) => {
    const key = turnKey(event.thread.id, event.id);
    if (activeTurns.has(key)) return;

    const child = spawn(
      "/usr/bin/caffeinate",
      ["-i", "-w", String(process.pid)],
      { stdio: "ignore" },
    );
    activeTurns.set(key, child);

    child.once("error", (error) => {
      if (!removeIfCurrent(key, child)) return;
      amp.logger.log("Failed to start caffeinate:", error);
    });

    child.once("exit", (code, signal) => {
      if (!removeIfCurrent(key, child)) return;
      amp.logger.log("caffeinate exited unexpectedly:", { code, signal });
    });
  });

  amp.on("agent.end", (event) => {
    const key = turnKey(event.thread.id, event.id);
    const child = activeTurns.get(key);
    if (!child) return;

    activeTurns.delete(key);
    child.kill("SIGTERM");
  });

  amp.onDispose(() => {
    const children = [...activeTurns.values()];
    activeTurns.clear();

    for (const child of children) {
      child.kill("SIGTERM");
    }
  });
}
