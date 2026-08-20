# pi-extensions

Local monorepo for independently installable [`pi`](https://github.com/badlogic/pi-mono) extensions.

> Note: packages in this repo are designed and tested primarily on macOS.

## Packages

### [`pi-ghostty`](packages/pi-ghostty/)

Extension entrypoints:

- [`ghostty-title-progress.ts`](packages/pi-ghostty/ghostty-title-progress.ts)
  - working and result state in the terminal title
  - active tool name while running
  - model + thinking level in title (`model (low|medium|high|...)`)
  - git branch marker with dirty state (`branch*`)
  - short result flash in title (`✓` / `✗`)
  - relies on pi's built-in animated terminal progress support
- [`ghostty-open-response.ts`](packages/pi-ghostty/ghostty-open-response.ts)
  - writes the latest assistant response Markdown unchanged to `/tmp`
  - opens it with `$EDITOR` in a new Ghostty window via Ghostty's macOS scripting dictionary
  - slash command: `/open-response`
  - shortcut: `alt+o`

### [`pi-notifications`](packages/pi-notifications/)

- [`index.ts`](packages/pi-notifications/index.ts)
  - sends one Ghostty desktop notification after the agent fully settles
  - includes retries and queued continuations in the duration
  - includes status (done/error) + duration in the message

### [`pi-session-export-html`](packages/pi-session-export-html/)

- [`index.ts`](packages/pi-session-export-html/index.ts)
  - calls built-in `pi --export` for the current session file
  - writes HTML to `/tmp`
  - opens the exported file in the default browser
  - slash command: `/open-export`

## Install all extensions

The workspace manifest aggregates all extension entrypoints, so install the workspace when all packages are wanted:

```bash
REPO_DIR=/path/to/agents

pi install "$REPO_DIR/pi-extensions"
pi install -l "$REPO_DIR/pi-extensions"
```

## Install per extension

Each package is self-contained, so these installs work directly from a local clone without running `npm install` in the monorepo first.

```bash
REPO_DIR=/path/to/agents

# Global
pi install "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install "$REPO_DIR/pi-extensions/packages/pi-notifications"
pi install "$REPO_DIR/pi-extensions/packages/pi-session-export-html"

# Project-local
pi install -l "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install -l "$REPO_DIR/pi-extensions/packages/pi-notifications"
pi install -l "$REPO_DIR/pi-extensions/packages/pi-session-export-html"
```

## Automatic light/dark themes

Pi handles terminal color-scheme changes natively. Configure the light theme first and dark theme second:

```json
{
  "theme": "light/dark"
}
```

## Commands

- `/open-response` — open the latest assistant response Markdown with `$EDITOR` in a new Ghostty window
- `/open-export` — export current session to `/tmp/*.html` and open it

`pi-notifications` has no slash commands. `pi-ghostty` also registers `alt+o` for `/open-response`.

## Validation

```bash
cd pi-extensions
npm run validate         # typecheck and smoke-load every package
npm run validate:latest  # also require the latest Pi CLI and type package
```

## Related docs

- Root overview: [`../README.md`](../README.md)
- Setup commands/tasks: [`../docs/setup-guide.md`](../docs/setup-guide.md)
