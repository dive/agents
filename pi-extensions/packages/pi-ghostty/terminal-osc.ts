import { closeSync, openSync, writeSync } from "node:fs";

const OSC = "\x1b]";
const ST = "\x1b\\";
const BEL = "\x07";

export type OscTerminator = "st" | "bel";

export function isGhosttyTerminal(): boolean {
  const termProgram = (process.env.TERM_PROGRAM ?? "").toLowerCase();
  const term = (process.env.TERM ?? "").toLowerCase();
  return termProgram === "ghostty" || term.includes("ghostty");
}

export function createOscWriter() {
  let ttyFd: number | undefined;

  function ensureFd(): number | undefined {
    if (ttyFd !== undefined) return ttyFd;
    try {
      ttyFd = openSync("/dev/tty", "w");
      return ttyFd;
    } catch {
      return undefined;
    }
  }

  function close() {
    if (ttyFd === undefined) return;
    try {
      closeSync(ttyFd);
    } catch {
      // ignore close failures
    }
    ttyFd = undefined;
  }

  function writeRaw(sequence: string) {
    if (process.stdout.isTTY) {
      try {
        process.stdout.write(sequence);
        return;
      } catch {
        // Fall through to /dev/tty fallback.
      }
    }

    const fd = ensureFd();
    if (fd === undefined) return;

    try {
      writeSync(fd, sequence);
    } catch {
      close();
    }
  }

  function writeOsc(payload: string, terminator: OscTerminator = "st") {
    const end = terminator === "bel" ? BEL : ST;
    writeRaw(`${OSC}${payload}${end}`);
  }

  return {
    writeRaw,
    writeOsc,
    close,
  };
}
