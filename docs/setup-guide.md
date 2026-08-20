# Setup Guide

This repository uses Mise for its tools, user-level links, bootstrap flow, and operational tasks. The setup covers:

- `global/AGENTS.md` links for supported coding agents
- Agent Skills under `skills/` linked into `~/.agents/skills/`
- pi prompt templates linked into `~/.pi/agent/prompts/`
- repo-managed pi extension packages

For package feature details, see [`../pi-extensions/README.md`](../pi-extensions/README.md).

## Prerequisites and first run

Install [Mise](https://mise.jdx.dev/). The repository config declares GitHub CLI, Node.js, pi, and the pinned Agent Skills validator, so no separate Python setup dependency is required.

After cloning:

```bash
mise trust
mise bootstrap --dry-run
mise bootstrap --yes
```

`mise bootstrap` installs missing declared tools, applies the configured dotfiles, and runs the final `bootstrap` task. That task idempotently installs the repo-managed pi extensions in the global pi settings. Project-local pi installation is intentionally separate.

## 1) Dotfile and link management

The `[dotfiles]` section in `mise.toml` is the source of truth for all managed links. It uses explicit entries so Agent Skills remain directory symlinks and prompt templates remain file symlinks.

```bash
# Inspect all managed links; exit non-zero if any are out of sync.
mise bootstrap dotfiles status --missing

# Preview or apply link changes.
mise bootstrap dotfiles apply --dry-run --verbose
mise bootstrap dotfiles apply --yes

# Limit status or apply to one target.
mise bootstrap dotfiles status --missing ~/.config/amp/AGENTS.md
mise bootstrap dotfiles apply --yes ~/.config/amp/AGENTS.md
```

Mise repoints stale symlinks but refuses to replace conflicting regular files or directories by default. Do not add `--force` to repository tasks. If a managed declaration is being removed and its target should also be removed, run `mise bootstrap dotfiles unapply <target>` before deleting the entry.

Adding or removing a skill, prompt template, or global instruction target requires updating the corresponding `[dotfiles]` entry in `mise.toml`.

## 2) Agent Skills management

Store each skill as `skills/<skill-name>/SKILL.md`. The repo copy is the source of truth, and the matching `mise.toml` entry links the skill directory into `~/.agents/skills/<skill-name>`.

### Validation

```bash
mise run skills-health
```

The task uses the pinned `skill-validator` tool with extra frontmatter enabled. This preserves GitHub source metadata used by `gh skill update`. Specification errors fail the task; recommendations such as the 500-line limit remain visible warnings without failing it.

### Importing and updating external skills

Use `gh skill` to import external skills into this repo's source tree. Import updateable skills from GitHub so their `SKILL.md` retains the source metadata needed by `gh skill update`.

```bash
# Search or preview GitHub-hosted skills.
gh skill search QUERY
gh skill preview OWNER/REPO SKILL_OR_PATH

# Import one skill into ./skills/<skill-name>/.
gh skill install OWNER/REPO SKILL_OR_PATH --dir skills --force

# Preview and apply updates for tracked GitHub skills.
mise run skills-updates-check
mise run skills-update
```

After adding a skill, add its user-level target to `[dotfiles]` in `mise.toml`, update the skill inventory in `README.md`, validate it, and apply the new link.

## 3) Pi prompt template management

Store each prompt as a direct Markdown file under `destroot/pi/agent/prompts/`. Each template has an explicit `[dotfiles]` entry targeting `~/.pi/agent/prompts/<name>.md`.

```bash
mise bootstrap dotfiles status --missing ~/.pi/agent/prompts/review.md
mise bootstrap dotfiles apply --yes ~/.pi/agent/prompts/review.md
```

When adding or removing a prompt, update `mise.toml` and the prompt inventory in `README.md` alongside the source file.

## 4) Pi extension package management

The repo-managed packages live under `pi-extensions/packages/`. The install and uninstall tasks enumerate the packages explicitly so the bootstrap inventory is reviewable.

### Inspect and validate

```bash
# Show user and project packages known to pi.
mise run pi-extensions-health

# Typecheck and smoke-load extensions against the latest Pi release.
mise run pi-extensions-validate
```

### Install and uninstall

```bash
# User-level settings; also run by `mise bootstrap`.
mise run pi-extensions-install
mise run pi-extensions-uninstall

# Project-local .pi/settings.json.
mise run pi-extensions-install-local
mise run pi-extensions-uninstall-local
```

The install and uninstall tasks are idempotent. Pi resolves global settings through `PI_CODING_AGENT_DIR` when set and otherwise uses `~/.pi/agent/settings.json`. Project-local settings remain generated and ignored by Git.

For one package, call pi directly:

```bash
pi install ./pi-extensions/packages/pi-ghostty
pi install -l ./pi-extensions/packages/pi-ghostty
pi remove ./pi-extensions/packages/pi-ghostty
pi remove -l ./pi-extensions/packages/pi-ghostty
```

Preview a task without executing it with `mise run --dry-run <task>`. When adding or removing an extension package, update the relevant task command lists in `mise.toml` and the extension inventory in `README.md`.

## 5) Task inventory

```bash
mise tasks ls

mise run skills-health
mise run skills-updates-check
mise run skills-update

mise run pi-extensions-health
mise run pi-extensions-validate
mise run pi-extensions-install
mise run pi-extensions-install-local
mise run pi-extensions-uninstall
mise run pi-extensions-uninstall-local
```
