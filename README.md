# agents

Utilities and extension packages for coding agents (focused on [`pi`](https://github.com/badlogic/pi-mono) + Ghostty).

## What is in this repo

- [`global/AGENTS.md`](global/AGENTS.md) — shared instructions used across coding tools
- [`setup.py`](setup.py) — helper for AGENTS link management + `pi` package operations
- [`pi-extensions/`](pi-extensions/) — installable `pi` extension packages

## pi extension packages

| Package | What it adds | Commands |
| --- | --- | --- |
| [`pi-ghostty`](pi-extensions/packages/pi-ghostty/) | Terminal title/status UX for Ghostty (spinner, tool name, result flash, git branch marker, model + thinking level) and OSC 11 light/dark theme sync. | `/pi-ghostty-test`, `/pi-ghostty-theme-sync-now` |
| [`pi-notifications`](pi-extensions/packages/pi-notifications/) | Ghostty desktop notifications on each completed agent turn, including duration and error/success status. | `/pi-notifications-test` |

More details: [`pi-extensions/README.md`](pi-extensions/README.md)

## Install from a local clone

```bash
REPO_DIR=/path/to/agents

# Global install
pi install "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install "$REPO_DIR/pi-extensions/packages/pi-notifications"

# Project-local install
pi install -l "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install -l "$REPO_DIR/pi-extensions/packages/pi-notifications"
```

## Setup and operations

- Setup guide: [`docs/setup-guide.md`](docs/setup-guide.md)
- Includes both CLI commands and `mise` task shortcuts

## License

MIT — see [`LICENSE`](LICENSE).
