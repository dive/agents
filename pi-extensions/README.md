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

### [`pi-notifications`](packages/pi-notifications/)

- [`index.ts`](packages/pi-notifications/index.ts)
  - sends Ghostty desktop notification after each completed agent turn
  - includes status (done/error) + duration in the message

## Install per extension

```bash
REPO_DIR=/path/to/agents

# Global
pi install "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install "$REPO_DIR/pi-extensions/packages/pi-notifications"

# Project-local
pi install -l "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install -l "$REPO_DIR/pi-extensions/packages/pi-notifications"
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

## Test commands

- `/pi-ghostty-test`
- `/pi-ghostty-theme-sync-now`
- `/pi-notifications-test`

## Related docs

- Root overview: [`../README.md`](../README.md)
- Setup commands/tasks: [`../docs/setup-guide.md`](../docs/setup-guide.md)
