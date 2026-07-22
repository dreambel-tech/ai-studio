---
name: index-agents-skill
description: Use when creating, adding, renaming, moving, or updating a skill in the agents-skills repository. Ensures the root README.md includes a short description and a Markdown link for each skill folder at the repository root, while excluding internal skills under .agents/skills.
---

# Index Agents Skill

## Goal

Keep `README.md` as the public catalogue of this repository whenever a skill is added or changed.

This skill is repository-specific. It applies to `agents-skills` and should run as part of any new skill creation workflow in this repo.

## Workflow

1. Create or update the skill folder first. Only skills whose folder is a direct child of the repository root belong in the public README index; skills under `.agents/skills` are internal and excluded.
2. Confirm the skill has a valid `SKILL.md` with `name` and `description` frontmatter.
3. Write a short README-facing description:
   - Prefer `agents/openai.yaml` `short_description` when it exists and is accurate.
   - Otherwise write one clear sentence fragment, usually 6-18 words.
   - Avoid copying a long trigger description into the README.
4. Add or update the root `README.md` skill index with:
   - a Markdown link to the skill folder
   - the short description
5. Validate that the link target exists and that the README entry names the same skill as `SKILL.md`.

## README Index

Use the root `README.md`, not a README inside the skill folder. Skills should not carry their own auxiliary README unless the user explicitly asks for one.

Preferred table format:

```markdown
## Skills

<!-- agents-skills:index:start -->
| Skill | Description |
| --- | --- |
| [skill-name](path/to/skill/) | Short description. |
<!-- agents-skills:index:end -->
```

If the markers already exist, keep them and update only the generated block between them. If they do not exist, add a `## Skills` section near the top-level project description.

## Scripted Update

Run the bundled script from the repository root when you want a deterministic refresh:

```powershell
python .agents/skills/index-agents-skill/scripts/update_readme_index.py
```

The script scans only direct child folders for `SKILL.md`, skips internal `.agents/skills` entries and other artefacts, reads `agents/openai.yaml` `short_description` when available, and rewrites the marked README table.

After running it, inspect `README.md`. If an auto-generated description is too long or too generic, edit the relevant skill's `agents/openai.yaml` `short_description` or manually refine the README entry.

## Checks Before Finishing

- [ ] The new or changed skill folder exists.
- [ ] The skill folder contains `SKILL.md`.
- [ ] The root `README.md` has one entry for the skill.
- [ ] The README entry links to the skill folder with a relative Markdown link.
- [ ] The README description is short and useful to a human browsing the repository.
- [ ] No `.codex`, `.codex-*`, logs, screenshots, or temporary Codex artefacts were left in the project.
