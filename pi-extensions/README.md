# pi-extensions

Local monorepo for independently installable pi extensions.

## Structure

- `packages/pi-ghostty/` — Ghostty title/spinner/progress integration
- `packages/pi-notifications/` — Ghostty desktop notifications

Each package is a standalone pi package with its own `package.json` and `index.ts`.

## Install per extension

Global:

```bash
pi install /Users/dive/Projects/dive/agents/pi-extensions/packages/pi-ghostty
pi install /Users/dive/Projects/dive/agents/pi-extensions/packages/pi-notifications
```

Project-local:

```bash
pi install -l /Users/dive/Projects/dive/agents/pi-extensions/packages/pi-ghostty
pi install -l /Users/dive/Projects/dive/agents/pi-extensions/packages/pi-notifications
```

## Migration from old monolithic install

If you previously installed the root `pi-extensions` package and want full per-extension control:

```bash
pi remove /Users/dive/Projects/dive/agents/pi-extensions
# then install only what you want from /packages/*
```

## Test commands

- `/pi-ghostty-test`
- `/pi-notifications-test`
