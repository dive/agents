/**
 * Draft extension: sync pi dark/light theme from Ghostty via OSC 11 query.
 *
 * Requirements covered:
 * - Ghostty-only (uses pi-ghostty terminal helpers)
 * - No tmux/multiplexer handling
 * - Careful input filtering: only strips OSC 11 replies, never normal keys
 *
 * Usage:
 *   pi -e /path/to/agents/pi-extensions/packages/pi-ghostty/ghostty-theme-sync.ts
 *
 * Theme override sources (highest priority first):
 * 1) project settings: .pi/settings.json
 * 2) global settings:  ~/.pi/agent/settings.json
 * 3) env vars:         PI_GHOSTTY_THEME_DARK / PI_GHOSTTY_THEME_LIGHT
 * 4) built-in defaults: dark / light
 *
 * Settings shape:
 * {
 *   "pi-ghostty-extension": {
 *     "themes": {
 *       "dark": "my-dark-theme",
 *       "light": "my-light-theme"
 *     }
 *   }
 * }
 *
 * Optional env vars:
 *   PI_GHOSTTY_THEME_DARK=dark
 *   PI_GHOSTTY_THEME_LIGHT=light
 *   PI_GHOSTTY_THEME_LUMINANCE_THRESHOLD=0.42
 *   PI_GHOSTTY_THEME_INPUT_DEBOUNCE_MS=350
 */

import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

import { createOscWriter, isGhosttyTerminal } from "pi-terminal-osc";

const OSC11_QUERY = "11;?";
const OSC11_PREFIX = "\x1b]11;";
const BEL = "\x07";
const ST = "\x1b\\";

const ENV_DARK_THEME_NAME = process.env.PI_GHOSTTY_THEME_DARK;
const ENV_LIGHT_THEME_NAME = process.env.PI_GHOSTTY_THEME_LIGHT;

const DEFAULT_DARK_THEME_NAME = ENV_DARK_THEME_NAME ?? "dark";
const DEFAULT_LIGHT_THEME_NAME = ENV_LIGHT_THEME_NAME ?? "light";

const LUMINANCE_THRESHOLD = toSafeFloat(process.env.PI_GHOSTTY_THEME_LUMINANCE_THRESHOLD, 0.42);
const INPUT_DEBOUNCE_MS = toSafeInt(process.env.PI_GHOSTTY_THEME_INPUT_DEBOUNCE_MS, 350);
const REPLY_TIMEOUT_MS = 2_000;

function toSafeInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function toSafeFloat(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type ThemeMode = "dark" | "light";
type Rgb = { r: number; g: number; b: number };

type ThemeNames = {
  darkThemeName: string;
  lightThemeName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJsonFile(filePath: string): unknown {
  if (!existsSync(filePath)) return undefined;

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

function sanitizeThemeName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readThemeNamesFromSettings(settings: unknown): Partial<ThemeNames> {
  if (!isRecord(settings)) return {};

  const extensionConfig = settings["pi-ghostty-extension"];
  if (!isRecord(extensionConfig)) return {};

  const themesConfig = extensionConfig["themes"];
  if (!isRecord(themesConfig)) return {};

  return {
    darkThemeName: sanitizeThemeName(themesConfig["dark"]),
    lightThemeName: sanitizeThemeName(themesConfig["light"]),
  };
}

function resolveThemeNames(cwd: string): ThemeNames {
  const globalSettingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  const projectSettingsPath = path.join(cwd, ".pi", "settings.json");

  const globalNames = readThemeNamesFromSettings(readJsonFile(globalSettingsPath));
  const projectNames = readThemeNamesFromSettings(readJsonFile(projectSettingsPath));

  return {
    darkThemeName: projectNames.darkThemeName ?? globalNames.darkThemeName ?? DEFAULT_DARK_THEME_NAME,
    lightThemeName: projectNames.lightThemeName ?? globalNames.lightThemeName ?? DEFAULT_LIGHT_THEME_NAME,
  };
}

function clamp8(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

function parseHexChannel(hex: string): number | undefined {
  if (!/^[0-9a-f]+$/i.test(hex)) return undefined;

  const n = Number.parseInt(hex, 16);
  if (Number.isNaN(n)) return undefined;

  if (hex.length === 1) return n * 17; // 0..15 -> 0..255
  if (hex.length === 2) return n; // 8-bit
  if (hex.length === 3) return clamp8(Math.round((n / 0xfff) * 255)); // 12-bit
  if (hex.length === 4) return clamp8(Math.round((n / 0xffff) * 255)); // 16-bit

  return undefined;
}

function parseColorSpec(spec: string): Rgb | undefined {
  const value = spec.trim();

  // Typical OSC 11 reply format: rgb:RR/GG/BB (often 4 hex digits each)
  const rgbMatch = value.match(/^rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})$/i);
  if (rgbMatch) {
    const r = parseHexChannel(rgbMatch[1]);
    const g = parseHexChannel(rgbMatch[2]);
    const b = parseHexChannel(rgbMatch[3]);
    if (r === undefined || g === undefined || b === undefined) return undefined;
    return { r, g, b };
  }

  // Fallback formats: #RGB / #RRGGBB / #RRRRGGGGBBBB
  const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{12})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];

    if (raw.length === 3) {
      return {
        r: Number.parseInt(raw[0] + raw[0], 16),
        g: Number.parseInt(raw[1] + raw[1], 16),
        b: Number.parseInt(raw[2] + raw[2], 16),
      };
    }

    if (raw.length === 6) {
      return {
        r: Number.parseInt(raw.slice(0, 2), 16),
        g: Number.parseInt(raw.slice(2, 4), 16),
        b: Number.parseInt(raw.slice(4, 6), 16),
      };
    }

    return {
      r: clamp8(Math.round((Number.parseInt(raw.slice(0, 4), 16) / 0xffff) * 255)),
      g: clamp8(Math.round((Number.parseInt(raw.slice(4, 8), 16) / 0xffff) * 255)),
      b: clamp8(Math.round((Number.parseInt(raw.slice(8, 12), 16) / 0xffff) * 255)),
    };
  }

  return undefined;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  if (c <= 0.04045) return c / 12.92;
  return ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: Rgb): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function inferTheme(rgb: Rgb): ThemeMode {
  return relativeLuminance(rgb) < LUMINANCE_THRESHOLD ? "dark" : "light";
}

type ExtractResult = {
  filtered: string;
  payloads: string[];
  partial: string;
};

/**
 * Removes OSC 11 replies from `input` and returns extracted payloads.
 *
 * We intentionally only look for OSC 11 and leave all other input untouched.
 */
function extractOsc11Replies(input: string, maxMatches: number): ExtractResult {
  if (maxMatches <= 0 || input.length === 0) {
    return { filtered: input, payloads: [], partial: "" };
  }

  let filtered = "";
  const payloads: string[] = [];

  let cursor = 0;

  while (cursor < input.length && payloads.length < maxMatches) {
    const start = input.indexOf(OSC11_PREFIX, cursor);
    if (start === -1) {
      filtered += input.slice(cursor);
      return { filtered, payloads, partial: "" };
    }

    filtered += input.slice(cursor, start);

    const payloadStart = start + OSC11_PREFIX.length;
    const belIndex = input.indexOf(BEL, payloadStart);
    const stIndex = input.indexOf(ST, payloadStart);

    let end = -1;
    let terminatorLength = 0;

    if (belIndex !== -1 && stIndex !== -1) {
      if (belIndex < stIndex) {
        end = belIndex;
        terminatorLength = BEL.length;
      } else {
        end = stIndex;
        terminatorLength = ST.length;
      }
    } else if (belIndex !== -1) {
      end = belIndex;
      terminatorLength = BEL.length;
    } else if (stIndex !== -1) {
      end = stIndex;
      terminatorLength = ST.length;
    }

    if (end === -1) {
      // Incomplete OSC 11 reply; keep it buffered and do not forward to editor.
      return { filtered, payloads, partial: input.slice(start) };
    }

    payloads.push(input.slice(payloadStart, end));
    cursor = end + terminatorLength;
  }

  filtered += input.slice(cursor);
  return { filtered, payloads, partial: "" };
}

function applyTheme(
  ctx: ExtensionContext,
  mode: ThemeMode,
  themeNames: ThemeNames,
): { mode: ThemeMode; appliedThemeName: string } | undefined {
  const themeName = mode === "dark" ? themeNames.darkThemeName : themeNames.lightThemeName;
  const result = ctx.ui.setTheme(themeName);

  if (result.success) {
    return { mode, appliedThemeName: themeName };
  }

  // Fallback to built-ins if custom names are invalid.
  const fallbackName = mode;
  const fallback = ctx.ui.setTheme(fallbackName);
  if (fallback.success) {
    return { mode, appliedThemeName: fallbackName };
  }

  ctx.ui.notify(
    `ghostty-sync: failed to set \"${themeName}\" (${result.error ?? "unknown"})`,
    "warning",
  );
  return undefined;
}

export default function (pi: ExtensionAPI) {
  const ghosttyEnabled = isGhosttyTerminal();
  const osc = createOscWriter();

  let stopTerminalListener: (() => void) | undefined;

  let pendingReplies = 0;
  let partialOscBuffer = "";
  let inputDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  let startupQueryTimer: ReturnType<typeof setTimeout> | undefined;
  let replyTimeoutTimer: ReturnType<typeof setTimeout> | undefined;

  let themeNames: ThemeNames = {
    darkThemeName: DEFAULT_DARK_THEME_NAME,
    lightThemeName: DEFAULT_LIGHT_THEME_NAME,
  };

  let lastAppliedMode: ThemeMode | undefined;

  function clearInputDebounce() {
    if (!inputDebounceTimer) return;
    clearTimeout(inputDebounceTimer);
    inputDebounceTimer = undefined;
  }

  function clearStartupQueryTimer() {
    if (!startupQueryTimer) return;
    clearTimeout(startupQueryTimer);
    startupQueryTimer = undefined;
  }

  function clearReplyTimeout() {
    if (!replyTimeoutTimer) return;
    clearTimeout(replyTimeoutTimer);
    replyTimeoutTimer = undefined;
  }

  function startReplyTimeout() {
    clearReplyTimeout();
    replyTimeoutTimer = setTimeout(() => {
      replyTimeoutTimer = undefined;
      pendingReplies = 0;
      partialOscBuffer = "";
    }, REPLY_TIMEOUT_MS);
    replyTimeoutTimer.unref?.();
  }

  function scheduleStartupQuery() {
    clearStartupQueryTimer();
    startupQueryTimer = setTimeout(() => {
      startupQueryTimer = undefined;
      if (pendingReplies > 0) return;
      sendOsc11Query();
    }, 0);
    startupQueryTimer.unref?.();
  }

  function sendOsc11Query() {
    pendingReplies += 1;
    osc.writeOsc(OSC11_QUERY, "st");
    startReplyTimeout();
  }

  function queueSyncFromInput() {
    if (inputDebounceTimer) return;
    inputDebounceTimer = setTimeout(() => {
      inputDebounceTimer = undefined;
      if (pendingReplies > 0) return;
      sendOsc11Query();
    }, INPUT_DEBOUNCE_MS);
    inputDebounceTimer.unref?.();
  }

  function processOscReplyPayload(ctx: ExtensionContext, payload: string, reason: "manual" | "auto") {
    const rgb = parseColorSpec(payload);
    if (!rgb) {
      if (reason === "manual") {
        ctx.ui.notify(`ghostty-sync: unsupported OSC 11 payload: ${payload}`, "warning");
      }
      return;
    }

    const nextMode = inferTheme(rgb);
    if (nextMode === lastAppliedMode) {
      if (reason === "manual") {
        ctx.ui.notify(`ghostty-sync: already ${nextMode} (rgb ${rgb.r},${rgb.g},${rgb.b})`, "info");
      }
      return;
    }

    const applied = applyTheme(ctx, nextMode, themeNames);
    if (!applied) return;

    lastAppliedMode = nextMode;

    if (reason === "manual") {
      ctx.ui.notify(
        `ghostty-sync: switched to ${applied.mode} via OSC 11 (${rgb.r},${rgb.g},${rgb.b})`,
        "info",
      );
    }
  }

  function reset() {
    clearInputDebounce();
    clearStartupQueryTimer();
    clearReplyTimeout();
    stopTerminalListener?.();
    stopTerminalListener = undefined;

    pendingReplies = 0;
    partialOscBuffer = "";

    osc.close();
  }

  pi.registerCommand("ghostty-sync", {
    description: "Sync pi theme from current Ghostty background (OSC 11)",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      if (!ghosttyEnabled) {
        ctx.ui.notify("ghostty-sync: Ghostty not detected", "warning");
        return;
      }

      sendOsc11Query();
      ctx.ui.notify("ghostty-sync: sent OSC 11 query", "info");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    if (!ghosttyEnabled) return;

    themeNames = resolveThemeNames(ctx.cwd);

    stopTerminalListener?.();

    stopTerminalListener = ctx.ui.onTerminalInput((data) => {
      // Keep input untouched unless we are expecting OSC 11 replies.
      if (pendingReplies <= 0 && partialOscBuffer.length === 0) {
        queueSyncFromInput();
        return undefined;
      }

      const combined = partialOscBuffer + data;
      const extracted = extractOsc11Replies(combined, pendingReplies);

      partialOscBuffer = extracted.partial;

      if (extracted.payloads.length > 0) {
        pendingReplies = Math.max(0, pendingReplies - extracted.payloads.length);
        if (pendingReplies === 0) clearReplyTimeout();
        for (const payload of extracted.payloads) {
          processOscReplyPayload(ctx, payload, "auto");
        }
      }

      // Query again after real user input (but not after pure OSC replies).
      if (extracted.filtered.length > 0) {
        queueSyncFromInput();
      }

      // If we stripped OSC replies or buffered partial OSC data, forward only filtered input.
      const changed = extracted.filtered !== data || partialOscBuffer.length > 0;
      if (!changed) return undefined;
      if (extracted.filtered.length === 0) return { consume: true };
      return { data: extracted.filtered };
    });

    // Defer initial query until interactive mode has started reading input.
    scheduleStartupQuery();
  });

  pi.on("session_switch", async (_event, ctx) => {
    if (!ctx.hasUI) return;
    if (!ghosttyEnabled) return;

    themeNames = resolveThemeNames(ctx.cwd);
    scheduleStartupQuery();
  });

  pi.on("session_shutdown", async () => {
    reset();
  });
}
