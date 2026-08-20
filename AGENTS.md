# Repository Guidelines

## Project Structure & Module Organization

Use `README.md` for the repository inventory and package/skill lists. Use `docs/setup-guide.md` for setup flows and operational commands. When editing, keep changes scoped to the relevant surface: global agent instructions in `global/`, skills in `skills/`, pi prompt templates in `destroot/pi/agent/prompts/`, and pi extensions in `pi-extensions/packages/`.

Keep `README.md` up to date when adding, removing, or changing a skill, prompt template, or pi extension. The README is the public inventory for what this repo provides.

## Build, Test, and Development Commands

Run the narrow check for the area you changed:

- Global links: `mise bootstrap dotfiles status --missing`
- Skills: `mise run skills-health`
- Prompt templates: `mise bootstrap dotfiles status --missing ~/.pi/agent/prompts/review.md`
- Pi extension inventory: `mise run pi-extensions-list`
- TypeScript extensions: `cd pi-extensions && npm run typecheck`

`mise bootstrap` installs declared tools, applies dotfiles, and runs the final bootstrap task. `mise run <task>` exposes narrower operational workflows from `mise.toml`.

## Coding Style & Naming Conventions

Use small, focused changes and keep generated links out of commits. Keep `mise.toml` declarations explicit and conservative. TypeScript pi extensions should stay self-contained inside their package directories. Skill names must be lowercase kebab-case and match their directory names, for example `skills/obsidian-cli/SKILL.md`. Markdown should be concise and use fenced code block languages.

## Testing Guidelines

There is no dedicated test tree today; validation is command-driven. Run the relevant health or typecheck command before reporting work as done. Add tests only when introducing a real testable behavior surface.

## Commit & Pull Request Guidelines

Recent history uses conventional-style summaries such as `fix: ...`, `docs: ...`, `feat(pi): ...`, and `chore(agents): ...`. Prefer that format and keep the scope accurate. Pull requests should describe the changed area, list validation commands run, and call out any link, install, or local-environment assumptions.

## Security & Configuration Tips

Do not commit user-local symlinks, secrets, vault contents, or machine-specific settings. Mise dotfiles intentionally refuse to replace conflicting regular files by default; do not use `--force` in setup tasks.
