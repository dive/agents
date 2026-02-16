# agents

Utilities and extension packages for coding agents (with a focus on `pi` + Ghostty).

This repository contains:

- shared `AGENTS.md` guidance used across multiple coding tools
- a small setup helper (`setup.py`) for link management and `pi` extension install workflows
- installable `pi` extension packages under `pi-extensions/packages/`

## pi extensions in this repo

| Package | Description | Test commands |
| --- | --- | --- |
| `pi-ghostty` | Ghostty-focused UX enhancements for `pi`: dynamic terminal title, spinner, progress integration, plus automatic dark/light theme sync via OSC 11 query. | `/pi-ghostty-test`, `/pi-ghostty-theme-sync-now` |
| `pi-notifications` | Sends Ghostty desktop notifications when `pi` finishes a response. | `/pi-notifications-test` |

## Quick install (from a local clone)

```bash
REPO_DIR=/path/to/agents

# Global install
pi install "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install "$REPO_DIR/pi-extensions/packages/pi-notifications"

# Project-local install
pi install -l "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install -l "$REPO_DIR/pi-extensions/packages/pi-notifications"
```

## Repository layout

- `global/AGENTS.md` — canonical shared instructions
- `setup.py` — setup/ops helper for AGENTS links + `pi` package management
- `pi-extensions/` — local monorepo of installable `pi` packages
- `docs/setup-guide.md` — setup command reference (CLI + mise tasks)

## Setup and operations

For setup commands and task shortcuts, see:

- [`docs/setup-guide.md`](docs/setup-guide.md)

## License

MIT (see [`LICENSE`](LICENSE)).
