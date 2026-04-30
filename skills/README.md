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

Import updateable external skills from GitHub with `gh skill`:

```bash
gh skill install OWNER/REPO SKILL_OR_PATH --dir skills --force
gh skill update --dir skills --dry-run
gh skill update --dir skills --all
```

Link repo skills into the user-level interoperability path:

```bash
python3 setup.py skills link
```

Check discovery, validation, and link status:

```bash
python3 setup.py skills health
python3 setup.py skills list
```

The links are created under `~/.agents/skills/<skill-name>`.
