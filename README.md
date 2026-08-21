# agents

Utilities, shared instructions, skills, prompts, plugins, and local extension packages for coding agents, focused on [Amp](https://ampcode.com), [`pi`](https://github.com/badlogic/pi-mono), and Ghostty.

## Repository Map

| Path | Purpose |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Contributor guide for working in this repository. |
| [`amp-plugins/`](amp-plugins/) | Public single-file Amp plugins, linked locally into `~/.config/amp/plugins/`. |
| [`destroot/pi/agent/prompts/`](destroot/pi/agent/prompts/) | Repo-managed pi prompt templates, linked into `~/.pi/agent/prompts/`. |
| [`docs/`](docs/) | Setup and operational documentation. |
| [`global/AGENTS.md`](global/AGENTS.md) | Shared global agent instructions linked into tool-specific locations. |
| [`mise.toml`](mise.toml) | Mise-managed tools, dotfiles, bootstrap behavior, and operational tasks. |
| [`pi-extensions/`](pi-extensions/) | Independently installable pi extension packages. |
| [`skills/`](skills/) | Repo-managed Agent Skills, linked into `~/.agents/skills/`. |

## Agent Skills

| Skill | What it adds | When to use |
| --- | --- | --- |
| [`gh-stack`](skills/gh-stack/) | GitHub CLI workflows for stacked branches and dependent pull requests. | Creating, updating, rebasing, navigating, or publishing a stack of reviewable PRs. |
| [`obsidian-cli`](skills/obsidian-cli/) | Obsidian vault workflows using the local `obsidian` CLI when its index/app state helps, and direct Markdown edits when plain file tools are better. | Notes, vaults, daily notes, tasks, links, tags, properties, bases, bookmarks, plugins, themes, sync, workspace state, or the `obsidian` command. |
| [`sentry-cli`](skills/sentry-cli/) | Sentry CLI workflows for issues, events, projects, organizations, API calls, and authentication. | Viewing issues, events, projects, organizations, making Sentry API calls, or authenticating with Sentry via CLI. |

Store skills as `skills/<skill-name>/SKILL.md`; the repo copy is the source of truth and local agents consume symlinked directories under `~/.agents/skills/`.

Use [`docs/setup-guide.md`](docs/setup-guide.md#2-agent-skills-management) for the operational workflow: importing skills with `gh skill`, updating GitHub-sourced skills, validating them with `skill-validator`, and applying the user-level links with Mise. [`skills/README.md`](skills/README.md) keeps the shorter format and layout notes.

## Amp Plugins

| Plugin | What it adds |
| --- | --- |
| [`caffeinate`](amp-plugins/caffeinate.ts) | Prevents macOS idle system sleep while interactive Amp agent turns are active. |

The local Mise setup links repo-managed plugins into `~/.config/amp/plugins/`. Other users can install the public plugin with automatic updates after it is published to `main`:

```bash
amp plugins add --auto-update \
  https://raw.githubusercontent.com/dive/agents/main/amp-plugins/caffeinate.ts
```

Run `amp plugins update caffeinate` to fetch a published update immediately, then reload plugins in Amp.

## Pi Prompt Templates

| Prompt | What it does | Usage |
| --- | --- | --- |
| [`review`](destroot/pi/agent/prompts/review.md) | Reviews a GitHub PR or local working tree changes with a structured senior-engineer review. | `/review [PR-URL\|PR-NUMBER]` |

Store prompt templates as direct Markdown files under `destroot/pi/agent/prompts/`.

## Pi Extension Packages

| Package | What it adds | Commands |
| --- | --- | --- |
| [`pi-ghostty`](pi-extensions/packages/pi-ghostty/) | Ghostty terminal title/status UX and opening the latest assistant response with `$EDITOR` in Ghostty. | `/open-response` |
| [`pi-notifications`](pi-extensions/packages/pi-notifications/) | Ghostty desktop notifications after the agent fully settles, including retries, queued continuations, duration, and result status. | *(no commands)* |
| [`pi-session-export-html`](pi-extensions/packages/pi-session-export-html/) | Exports the current pi session to `/tmp/*.html` and opens it in the default browser. | `/open-export` |

Each package is self-contained and can be installed directly from a local clone. More detail is in [`pi-extensions/README.md`](pi-extensions/README.md).

## Common Operations

```bash
# Preview or apply the complete machine setup
mise bootstrap --dry-run
mise bootstrap --yes

# Inspect or apply only repo-managed links
mise bootstrap dotfiles status --missing
mise bootstrap dotfiles apply --dry-run --verbose
mise bootstrap dotfiles apply --yes

# Apply only the local Amp plugin link
mise bootstrap dotfiles apply --yes ~/.config/amp/plugins/caffeinate.ts

# Import/update third-party skills into this repo's ./skills source tree
gh skill install OWNER/REPO SKILL_OR_PATH --dir skills --force
mise run skills-updates-check
mise run skills-update

# Validate skills and inspect pi package state
mise run skills-health
mise run pi-extensions-list
mise run pi-extensions-validate

# Install all pi extension packages
mise run pi-extensions-install
mise run pi-extensions-install-local
```

`mise bootstrap` installs the declared tools, applies dotfiles, and then installs the repo-managed pi extensions globally. Project-local pi installation remains opt-in.

To install one pi extension package manually:

```bash
REPO_DIR=/path/to/agents
pi install "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install -l "$REPO_DIR/pi-extensions/packages/pi-ghostty"
```

For detailed setup flows and task shortcuts, see [`docs/setup-guide.md`](docs/setup-guide.md).
