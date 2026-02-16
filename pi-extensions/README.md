# pi-extensions

Local monorepo for independently installable [`pi`](https://github.com/badlogic/pi-mono) extensions.

## Packages

### [`pi-ghostty`](packages/pi-ghostty/)

Extension entrypoints:

- [`ghostty-title-progress.ts`](packages/pi-ghostty/ghostty-title-progress.ts)
  - animated working spinner in terminal title
  - active tool name while running
  - model + thinking level in title (`model (low|medium|high|...)`)
  - git branch marker with dirty state (`branch*`)
  - short result flash in title (`✓` / `✗`)
  - Ghostty progress integration
- [`ghostty-theme-sync.ts`](packages/pi-ghostty/ghostty-theme-sync.ts)
  - OSC 11 background query parsing
  - auto switch between light/dark pi themes in Ghostty
  - slash command: `/ghostty-sync`

### [`pi-notifications`](packages/pi-notifications/)

- [`index.ts`](packages/pi-notifications/index.ts)
  - sends Ghostty desktop notification after each completed agent turn
  - includes status (done/error) + duration in the message

### [`pi-session-export-html`](packages/pi-session-export-html/)

- [`index.ts`](packages/pi-session-export-html/index.ts)
  - calls built-in `pi --export` for the current session file
  - writes HTML to `/tmp`
  - opens the exported file in the default browser
  - slash command: `/export-open`
  - macOS only

## Install per extension

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

## Theme sync customization (pi-ghostty)

`ghostty-theme-sync.ts` reads theme names from settings (project overrides global):

- `.pi/settings.json`
- `~/.pi/agent/settings.json`

```json
{
  "pi-ghostty-extension": {
    "themes": {
      "dark": "dark",
      "light": "light"
    }
  }
}
```

Fallback environment variables:

- `PI_GHOSTTY_THEME_DARK`
- `PI_GHOSTTY_THEME_LIGHT`

## Commands

- `/ghostty-sync` — force a manual Ghostty OSC 11 theme sync
- `/export-open` — export current session to `/tmp/*.html` and open it (macOS)

`pi-notifications` has no slash commands.

## Related docs

- Root overview: [`../README.md`](../README.md)
- Setup commands/tasks: [`../docs/setup-guide.md`](../docs/setup-guide.md)
