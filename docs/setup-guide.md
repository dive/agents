# Setup Guide

This guide covers operational commands for this repository.

For package feature details, see:

- [`../pi-extensions/README.md`](../pi-extensions/README.md)

## Prerequisites

- Python 3 (`python3`)
- [`pi`](https://github.com/badlogic/pi-mono) CLI (for extension install/uninstall flows)
- Optional: `mise` for task shortcuts

---

## 1) AGENTS.md link management

Use these commands to link `global/AGENTS.md` into tool-specific locations.

```bash
python3 setup.py list
python3 setup.py link
python3 setup.py link --replace-symlinks
python3 setup.py health
```

### Notes

- `link` is safe by default and will not replace existing regular files.
- `link --replace-symlinks` only replaces stale symlinks.

---

## 2) pi extension package management

The repo discovers packages from:

- `pi-extensions/packages/*/package.json`

### Health

```bash
# Inspect global + local state
python3 setup.py extensions health --scope both

# Strict mode: non-zero exit if missing packages/settings errors are found
python3 setup.py extensions health --scope both --strict
```

### Install

```bash
# Install all discovered packages globally
python3 setup.py extensions install --scope global

# Install all discovered packages in project-local .pi/settings.json
python3 setup.py extensions install --scope local

# Install selected package(s)
python3 setup.py extensions install --scope local --package pi-ghostty
```

### Uninstall

```bash
# Remove all discovered packages from global settings
python3 setup.py extensions uninstall --scope global

# Remove selected package(s)
python3 setup.py extensions uninstall --scope local --package pi-ghostty
```

### Dry runs

```bash
python3 setup.py extensions install --scope global --dry-run
python3 setup.py extensions uninstall --scope local --package pi-ghostty --dry-run
```

---

## 3) mise task shortcuts

Equivalent shortcuts in `mise.toml`:

```bash
# AGENTS setup tasks
mise run list
mise run link
mise run link-replace
mise run health

# pi extension tasks
mise run pi-extensions-health
mise run pi-extensions-install
mise run pi-extensions-install-local
mise run pi-extensions-uninstall
mise run pi-extensions-uninstall-local
```
