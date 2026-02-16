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

## Test commands

- `/pi-ghostty-test`
- `/pi-ghostty-theme-sync-now`
- `/pi-notifications-test`
