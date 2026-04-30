# Agent Skills

[Agent Skills Specification](https://agentskills.io/specification.md)

Store repo-managed skills here as one directory per skill:

```text
skills/
└── <skill-name>/
    └── SKILL.md
```

Requirements from the Agent Skills spec:

- each skill lives in its own directory
- each skill directory must contain `SKILL.md`
- `SKILL.md` must start with YAML frontmatter
- `name` is required, must match the directory name, and should use lowercase letters, numbers, and hyphens
- `description` is required and should say what the skill does and when to use it

This directory is the repo-managed source of truth. Local agent hosts consume the same skill directories through symlinks created under `~/.agents/skills/<skill-name>`.

For the operational workflow, use [`../docs/setup-guide.md`](../docs/setup-guide.md#2-agent-skills-management). That guide covers `gh skill` imports and updates, `setup.py` validation, and linking repo skills into the user-level skills directory.
