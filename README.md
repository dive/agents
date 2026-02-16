# agents

Global instructions and setup for coding agents on this machine.

## Files

- `global/AGENTS.md` — canonical global instructions
- `setup.py` — links and health checks for agent instruction files
- `pi-extensions/` — local monorepo of separately installable pi extension packages

## Usage

### AGENTS.md link management

```bash
python3 setup.py list
python3 setup.py link --replace-symlinks
python3 setup.py health
```

### pi-extensions package management

```bash
python3 setup.py extensions health --scope both
python3 setup.py extensions install --scope global
python3 setup.py extensions install --scope local --package pi-ghostty
python3 setup.py extensions uninstall --scope global --dry-run
```

Or via mise tasks:

```bash
mise run list
mise run link
mise run link-replace
mise run health
mise run pi-extensions-health
mise run pi-extensions-install
mise run pi-extensions-install-local
mise run pi-extensions-uninstall
mise run pi-extensions-uninstall-local
```

## Notes

- Tools that support `~/.config/AGENTS.md` use the global fallback.
- `setup.py` avoids replacing existing regular files.
