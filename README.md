# agents

Global instructions and setup for coding agents on this machine.

## Files

- `global/AGENTS.md` — canonical global instructions
- `setup.py` — links and health checks for agent instruction files
- `pi-extensions/` — local monorepo of separately installable pi extension packages

## Usage

```bash
python3 setup.py list
python3 setup.py link --replace-symlinks
python3 setup.py health
```

Or via mise tasks:

```bash
mise run setup-list
mise run setup-link
mise run setup-link-replace
mise run setup-health
```

## Notes

- Tools that support `~/.config/AGENTS.md` use the global fallback.
- `setup.py` avoids replacing existing regular files.
