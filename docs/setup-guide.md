# Setup Guide

This guide covers operational commands for this repository.

The repo supports four setup flows:

- `global/AGENTS.md` symlink management
- Agent Skills storage under `skills/` plus symlinks into `~/.agents/skills/`
- pi prompt templates under `destroot/pi/agent/prompts/` plus symlinks into `~/.pi/agent/prompts/`
- local `pi` extension package management

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

## 2) Agent Skills management

Store each skill as `skills/<skill-name>/SKILL.md` following the Agent Skills spec.

The repo-level source of truth is:

- `skills/*/SKILL.md`

These commands discover skills, validate the required frontmatter fields used by the spec (`name`, `description`, optional `compatibility` length), and link each valid skill directory into:

- `~/.agents/skills/<skill-name>`

### Commands

```bash
python3 setup.py skills list
python3 setup.py skills health
python3 setup.py skills health --strict
python3 setup.py skills link
python3 setup.py skills link --replace-symlinks
```

### Notes

- `skills link` is safe by default and will not replace existing regular files.
- `skills link --replace-symlinks` only replaces stale symlinks.
- Only directories directly under `skills/` that contain `SKILL.md` are treated as skills.
- For full external validation, you can also run `skills-ref validate ./skills/<skill-name>`.

---

## 3) Pi prompt template management

Store each pi prompt template as a direct Markdown file under:

- `destroot/pi/agent/prompts/*.md`

This mirrors the layout used in the `dot` repo, where `destroot/pi/agent/...` maps to `~/.pi/agent/...`.

These commands discover direct `*.md` files in the repo prompts root and link each one into:

- `~/.pi/agent/prompts/<name>.md`

### Commands

```bash
python3 setup.py prompts list
python3 setup.py prompts health
python3 setup.py prompts health --strict
python3 setup.py prompts link
python3 setup.py prompts link --replace-symlinks
```

### Notes

- Prompt template discovery is non-recursive, matching pi's prompt template loading rules.
- `prompts link` is safe by default and will not replace existing regular files.
- `prompts link --replace-symlinks` only replaces stale symlinks.

---

## 4) pi extension package management

The repo discovers installable pi packages from:

- `pi-extensions/packages/*/package.json` with a `pi` manifest

Shared workspace-only helper packages are ignored by `setup.py extensions ...` commands.

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

## 5) mise task shortcuts

Equivalent shortcuts in `mise.toml`:

```bash
# AGENTS setup tasks
mise run list
mise run link
mise run link-replace
mise run health

# Agent Skills tasks
mise run skills-list
mise run skills-health
mise run skills-link
mise run skills-link-replace

# pi prompt template tasks
mise run prompts-list
mise run prompts-health
mise run prompts-link
mise run prompts-link-replace

# pi extension tasks
mise run pi-extensions-health
mise run pi-extensions-install
mise run pi-extensions-install-local
mise run pi-extensions-uninstall
mise run pi-extensions-uninstall-local
```
