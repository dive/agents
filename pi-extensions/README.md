# pi extensions

This directory is a local pi package containing multiple extensions.

## Structure

- `extensions/<extension-name>/index.ts` — one extension per directory

## Install

Global:

```bash
pi install /Users/dive/Projects/dive/agents/pi-extensions
```

Project-local:

```bash
pi install -l /Users/dive/Projects/dive/agents/pi-extensions
```

## Included

- `pi-ghostty` — Ghostty integration:
  - dynamic window title
  - animated braille spinner while the agent works
  - native Ghostty progress bar (indeterminate + completion flash)
  - test command: `/pi-ghostty-test`
- `pi-notifications` — Ghostty desktop notification when the agent finishes
  - Ghostty-only (no-op on other terminals)
  - notification rate limiting to avoid spam
  - test command: `/pi-notifications-test`
