# pi-extensions

Local monorepo for independently installable `pi` extensions.

## Packages

- `packages/pi-ghostty/` — Ghostty title/spinner/progress integration + dark/light theme sync
- `packages/pi-notifications/` — Ghostty desktop notifications when the agent finishes

Each package is standalone and can be installed independently.

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

You can override which pi theme is used for Ghostty dark/light detection.

`pi-ghostty` reads these keys (project overrides global):

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

Environment variables still work as fallback:

- `PI_GHOSTTY_THEME_DARK`
- `PI_GHOSTTY_THEME_LIGHT`

## Test commands

- `/pi-ghostty-test`
- `/pi-ghostty-theme-sync-now`
- `/pi-notifications-test`
