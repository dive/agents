# AGENTS.md

## Agent Protocol

- Contact: Artem Loenko (@justsitandgrin, artyom.loenko@mac.com)
- Deletions: use `trash`
- Web: search early; quote exact errors; prefer 2024–2026 sources
- Style: concise; minimal tokens in this file and replies
- IMPORTANT: prefer retrieval-led reasoning over pre-training for dev tasks

## Development

- Prefer system components/tools over third parties (esp. iOS/macOS)
- Only touch files relevant to the task; avoid drive-by refactors
- Delete obsolete files when changes make them irrelevant
- Moving/renaming allowed

## Testing

- Run tests/lint/typecheck after changes (find via `README`, `package.json`, `mise.toml`)
- If no tests: manual verify + lint; flag gaps
- If skipping tests, say why
- Fix failures before commits

## iOS & macOS Development

- Follow Apple HIG best practices; flag conflicts with user requests

## Git

- DO NOT commit without an explicit consent
- Commit format: Conventional Commits (feat|fix|refactor|build|ci|chore|docs|style|perf|test)
- Explicitly allowed commands: `add|commit|status|log`
- Protected ops (branch changes, destructive commands like `reset --hard`, `rm`, `checkout` old commit) need explicit consent
- Don't revert files you didn't author
- Verify `git status` before commits

## Environment

- NEVER edit `.env` or env files; only user may change
- Never commit secrets, API keys, or credentials

## Critical Thinking & Escalation

- Fix root cause, not band-aid
- If unsure: read more; if still stuck, ask with short options
- Call out conflicts; choose safer path
- Unrecognized changes: assume other agent; keep going; focus your changes; if issues, stop + ask
- Stop + ask before destructive changes
- Present options when possible (e.g., "Choose approach A or B")
- Leave breadcrumb notes in thread

## Error Handling

- Report errors with file paths and line numbers
- Unexpected errors: try once, then ask with context
- Include error messages in responses

## Documentation

- Update docs when behavior/APIs change; keep docs practical
- Add brief NOTE comments for non-obvious logic
- New files: prefer dashes over underscores (`new-spec-file.md`)

## Tools

CLI tools available on user machines.

### trash

Move files to Trash: `trash ...` (macOS system command)

### mise

Development environment tool that installs/manages dev tools and runs tasks. Check `mise.toml` for project tasks. Global tools: `mise list --global`
