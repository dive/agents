# Repository Guidelines

## Project Structure & Module Organization

Use `README.md` for the repository inventory and package/skill lists. Use `docs/setup-guide.md` for setup flows and operational commands. When editing, keep changes scoped to the relevant surface: global agent instructions in `global/`, skills in `skills/`, pi prompt templates in `destroot/pi/agent/prompts/`, and pi extensions in `pi-extensions/packages/`.

Keep `README.md` up to date when adding, removing, or changing a skill, prompt template, or pi extension. The README is the public inventory for what this repo provides.

## Build, Test, and Development Commands

Run the narrow check for the area you changed:

- Global links: `python3 setup.py health`
- Skills: `python3 setup.py skills health --strict`
- Prompt templates: `python3 setup.py prompts health --strict`
- Pi extensions: `python3 setup.py extensions health --scope both`
- TypeScript extensions: `cd pi-extensions && npm run typecheck`

`mise run <task>` exposes the same workflows as shortcuts from `mise.toml`.

## Coding Style & Naming Conventions

Use small, focused changes and keep generated links out of commits. Python in `setup.py` uses 4-space indentation, type hints, dataclasses, and explicit `Path` handling. TypeScript pi extensions should stay self-contained inside their package directories. Skill names must be lowercase kebab-case and match their directory names, for example `skills/obsidian-cli/SKILL.md`. Markdown should be concise and use fenced code block languages.

## Testing Guidelines

There is no dedicated test tree today; validation is command-driven. Run the relevant health or typecheck command before reporting work as done. Add tests only when introducing a real testable behavior surface.

## Commit & Pull Request Guidelines

Recent history uses conventional-style summaries such as `fix: ...`, `docs: ...`, `feat(pi): ...`, and `chore(agents): ...`. Prefer that format and keep the scope accurate. Pull requests should describe the changed area, list validation commands run, and call out any link, install, or local-environment assumptions.

## Security & Configuration Tips

Do not commit user-local symlinks, secrets, vault contents, or machine-specific settings. `setup.py` is intentionally conservative and refuses to replace regular files; preserve that behavior when editing setup flows.
