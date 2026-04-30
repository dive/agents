# agents

Utilities, shared instructions, skills, prompts, and local extension packages for coding agents, focused on [`pi`](https://github.com/badlogic/pi-mono) and Ghostty.

## Repository Map

| Path | Purpose |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Contributor guide for working in this repository. |
| [`destroot/pi/agent/prompts/`](destroot/pi/agent/prompts/) | Repo-managed pi prompt templates, linked into `~/.pi/agent/prompts/`. |
| [`docs/`](docs/) | Setup and operational documentation. |
| [`global/AGENTS.md`](global/AGENTS.md) | Shared global agent instructions linked into tool-specific locations. |
| [`pi-extensions/`](pi-extensions/) | Independently installable pi extension packages. |
| [`setup.py`](setup.py) | Helper for links, health checks, prompt templates, skills, and pi extension operations. |
| [`skills/`](skills/) | Repo-managed Agent Skills, linked into `~/.agents/skills/`. |

## Agent Skills

| Skill | What it adds | When to use |
| --- | --- | --- |
| [`obsidian-cli`](skills/obsidian-cli/) | Obsidian vault workflows using the local `obsidian` CLI when its index/app state helps, and direct Markdown edits when plain file tools are better. | Notes, vaults, daily notes, tasks, links, tags, properties, bases, bookmarks, plugins, themes, sync, workspace state, or the `obsidian` command. |
| [`sentry-cli`](skills/sentry-cli/) | Sentry CLI workflows for issues, events, projects, organizations, API calls, and authentication. | Viewing issues, events, projects, organizations, making Sentry API calls, or authenticating with Sentry via CLI. |

Store skills as `skills/<skill-name>/SKILL.md`; the repo copy is the source of truth and local agents consume symlinked directories under `~/.agents/skills/`.

Use [`docs/setup-guide.md`](docs/setup-guide.md#2-agent-skills-management) for the operational workflow: importing skills with `gh skill`, updating GitHub-sourced skills, validating them with `setup.py`, and linking them into the user-level skills directory. [`skills/README.md`](skills/README.md) keeps the shorter format and layout notes.

## Pi Prompt Templates

| Prompt | What it does | Usage |
| --- | --- | --- |
| [`review`](destroot/pi/agent/prompts/review.md) | Reviews a GitHub PR or local working tree changes with a structured senior-engineer review. | `/review [PR-URL\|PR-NUMBER]` |

Store prompt templates as direct Markdown files under `destroot/pi/agent/prompts/`.

## Pi Extension Packages

| Package | What it adds | Commands |
| --- | --- | --- |
| [`pi-ghostty`](pi-extensions/packages/pi-ghostty/) | Ghostty terminal title/status UX, OSC 11 light/dark theme sync, and opening the latest assistant response with `$EDITOR` in Ghostty. | `/ghostty-sync`, `/open-response` |
| [`pi-notifications`](pi-extensions/packages/pi-notifications/) | Ghostty desktop notifications after each completed agent run, including duration and result status. | *(no commands)* |
| [`pi-session-export-html`](pi-extensions/packages/pi-session-export-html/) | Exports the current pi session to `/tmp/*.html` and opens it in the default browser. | `/open-export` |

Each package is self-contained and can be installed directly from a local clone. More detail is in [`pi-extensions/README.md`](pi-extensions/README.md).

## Common Operations

```bash
# Inspect available items
python3 setup.py list
python3 setup.py skills list
python3 setup.py prompts list

# Import/update third-party skills into this repo's ./skills source tree
gh skill install OWNER/REPO SKILL_OR_PATH --dir skills --force
mise run skills-updates-check
mise run skills-update

# Link repo-managed files into user-level locations
python3 setup.py link
python3 setup.py skills link
python3 setup.py prompts link

# Check link and install health
python3 setup.py health
python3 setup.py skills health
python3 setup.py prompts health
python3 setup.py extensions health --scope both

# Install all pi extension packages
python3 setup.py extensions install --scope global
python3 setup.py extensions install --scope local
```

Equivalent shortcuts are available in [`mise.toml`](mise.toml), for example `mise run skills-health`.

To install one pi extension package manually:

```bash
REPO_DIR=/path/to/agents
pi install "$REPO_DIR/pi-extensions/packages/pi-ghostty"
pi install -l "$REPO_DIR/pi-extensions/packages/pi-ghostty"
```

For detailed setup flows and task shortcuts, see [`docs/setup-guide.md`](docs/setup-guide.md).
