---
name: obsidian-cli
description: Work with Obsidian vaults using the local `obsidian` CLI when its index or app state adds value, and direct Markdown edits when plain file tools are better. Trigger for Obsidian notes, vaults, daily notes, tasks, links, tags, properties, bases, bookmarks, plugins, themes, sync, workspace state, or the `obsidian` command.
compatibility: Requires the local `obsidian` CLI and an accessible Obsidian vault.
---

# Obsidian CLI

Use the local `obsidian` command when Obsidian's index or app state adds value. Prefer explicit, inspectable operations over guessing vault paths or relying on the active file.

## Tool Choice

| Situation | Prefer |
| --- | --- |
| Backlinks, unresolved links, tags, properties, tasks, aliases, daily-note resolution, bases, bookmarks, active file, vault metadata, workspace, sync, plugins, or themes | `obsidian` CLI |
| Known Markdown file reads, prose edits, large or precise content changes, bulk text replacement, or grep-style searches across notes | Direct filesystem tools |
| Deletion, restore, sync changes, plugin/theme changes, restricted mode, reload/restart, developer commands, or JavaScript eval | Ask for confirmation first |

## First Checks

- Confirm the CLI is available with `command -v obsidian`.
- Inspect the available interface with `obsidian --help` and focused help such as `obsidian help read` when command details matter.
- List vaults with `obsidian vaults verbose` when the target vault is unclear.
- When multiple vaults exist, pass `vault=<name>` explicitly.
- Prefer `path=<folder/note.md>` for exact targets. Use `file=<name>` only when name-based wikilink-style resolution is intended.
- Before direct file edits, find the vault root with `obsidian vault info=path vault=<name>` or `obsidian vaults verbose`, then work under that directory.
- Remember that many commands default to the active Obsidian file when `file` and `path` are omitted. Avoid relying on that default unless the user explicitly asked for the active file.

## Safety

- Read before writing when changing an existing note: use `obsidian read path=<path>` or another relevant inspection command first.
- Mutate note content only when the user asked for that outcome. Use `create`, `append`, `prepend`, `property:set`, `property:remove`, `task`, `move`, or `rename` as directly as possible.
- Ask for confirmation before destructive or broad app-state changes: `delete`, `delete permanent`, `history:restore`, `sync:restore`, `sync on/off`, `plugin:*`, `theme:*`, `plugins:restrict`, `reload`, `restart`, `dev:*`, `devtools`, and `eval`.
- Do not use `permanent` deletion unless the user explicitly requested irreversible deletion.
- Do not edit `.obsidian/` config files directly unless the user explicitly asks; prefer CLI commands for app, plugin, theme, workspace, sync, and developer state.
- Avoid logging or quoting sensitive note content unless it is needed to answer the user. Summarize large private notes instead of pasting them wholesale.

## Direct File Edits

- Use normal filesystem tools for plain Markdown work when Obsidian's index or app state does not add value: reading a known file, editing prose, bulk text replacement, or grep-style searches across notes.
- Rule of thumb: use `obsidian` when backlinks, tags, properties, tasks, daily-note resolution, bases, active file state, or vault metadata matter. Use direct file edits for ordinary text manipulation.
- Prefer direct edits for large, precise, or multiline Markdown changes because shell quoting `content=<text>` becomes fragile. Open the `.md` file, change it, and verify the file contents. Obsidian will pick up valid vault file changes.

## Command Patterns

- Vault discovery:

  ```bash
  obsidian vaults verbose
  obsidian vault info=path vault=<name>
  ```

- Search and inspect:

  ```bash
  obsidian search query="<text>" format=json vault=<name>
  obsidian search:context query="<text>" format=json vault=<name>
  obsidian read path="<folder/note.md>" vault=<name>
  obsidian file path="<folder/note.md>" vault=<name>
  ```

- Links, tags, properties, and outline:

  ```bash
  obsidian backlinks path="<folder/note.md>" format=json vault=<name>
  obsidian links path="<folder/note.md>" vault=<name>
  obsidian tags path="<folder/note.md>" format=json vault=<name>
  obsidian properties path="<folder/note.md>" format=json vault=<name>
  obsidian outline path="<folder/note.md>" format=json vault=<name>
  ```

- Daily notes and tasks:

  ```bash
  obsidian daily:path vault=<name>
  obsidian daily:read vault=<name>
  obsidian tasks todo format=json vault=<name>
  obsidian task ref="<path:line>" done vault=<name>
  ```

- Create or update notes:

  ```bash
  obsidian create path="<folder/note.md>" content="<text>" vault=<name>
  obsidian append path="<folder/note.md>" content="<text>" vault=<name>
  obsidian prepend path="<folder/note.md>" content="<text>" vault=<name>
  obsidian property:set path="<folder/note.md>" name="<property>" value="<value>" type=text vault=<name>
  ```

## Output Handling

- Prefer `format=json` when a command supports it and the output will be parsed or compared.
- Use `total` count commands for quick scope checks before broad listing.
- Quote values that contain spaces: `path="Folder/My Note.md"`.
- Use literal `\n` and `\t` in `content=<text>` values when multi-line or tabbed content is needed.
- For large updates, prepare the exact replacement text in the response or a local temporary artifact only if necessary, then apply with the smallest Obsidian command that matches the task.

## Verification

- After writing, re-read the changed note or query the changed field/task to confirm the result.
- For move/rename/delete actions, verify with `obsidian file`, `obsidian files`, or `obsidian search` as appropriate.
- Report the exact command category used and any verification command that passed; do not claim vault changes were made if the CLI returned an error or the follow-up read did not confirm them.
