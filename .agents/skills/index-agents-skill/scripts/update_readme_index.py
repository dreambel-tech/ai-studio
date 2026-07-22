#!/usr/bin/env python3
"""Update the root README skill index for the agents-skills repository."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


START = "<!-- agents-skills:index:start -->"
END = "<!-- agents-skills:index:end -->"
SKIP_DIRS = {".git", ".codex", "node_modules", "__pycache__"}


def parse_frontmatter(skill_md: Path) -> dict[str, str]:
    text = skill_md.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}

    end = text.find("\n---", 3)
    if end == -1:
        return {}

    frontmatter = text[3:end].strip().splitlines()
    values: dict[str, str] = {}
    for line in frontmatter:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip().strip("'\"")
    return values


def read_openai_short_description(skill_dir: Path) -> str | None:
    openai_yaml = skill_dir / "agents" / "openai.yaml"
    if not openai_yaml.exists():
        return None

    for line in openai_yaml.read_text(encoding="utf-8").splitlines():
        match = re.match(r"\s*short_description:\s*(.+?)\s*$", line)
        if match:
            return match.group(1).strip().strip("'\"") or None
    return None


def compact_description(description: str) -> str:
    description = re.sub(r"\s+", " ", description).strip()
    if not description:
        return "Skill workflow."

    sentence = re.split(r"(?<=[.!?])\s+", description, maxsplit=1)[0]
    if len(sentence) <= 120:
        return sentence

    words: list[str] = []
    for word in sentence.split():
        candidate = " ".join([*words, word])
        if len(candidate) > 117:
            break
        words.append(word)
    return f"{' '.join(words).rstrip('.,;:')}..."


def markdown_escape(value: str) -> str:
    return value.replace("|", "\\|")


def read_existing_descriptions(readme_text: str) -> tuple[dict[str, str], dict[str, str]]:
    by_name: dict[str, str] = {}
    by_link: dict[str, str] = {}
    pattern = re.compile(r"^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*(.*?)\s*\|$", re.MULTILINE)
    for name, link, description in pattern.findall(readme_text):
        if name == "Skill":
            continue
        by_name[name] = description
        by_link[link] = description
    return by_name, by_link


def find_skill_entries(
    repo_root: Path,
    existing_by_name: dict[str, str],
    existing_by_link: dict[str, str],
) -> list[tuple[str, str, str]]:
    entries: list[tuple[str, str, str]] = []
    for skill_dir in sorted(repo_root.iterdir(), key=lambda path: path.name.lower()):
        if not skill_dir.is_dir():
            continue
        if skill_dir.name in SKIP_DIRS or skill_dir.name.startswith(".codex-"):
            continue

        skill_md = skill_dir / "SKILL.md"
        if not skill_md.is_file():
            continue

        metadata = parse_frontmatter(skill_md)
        name = metadata.get("name") or skill_dir.name
        long_description = metadata.get("description", "")
        relative_link = skill_dir.relative_to(repo_root).as_posix() + "/"
        short_description = (
            read_openai_short_description(skill_dir)
            or existing_by_name.get(name)
            or existing_by_link.get(relative_link)
            or compact_description(long_description)
        )
        entries.append((name, relative_link, short_description))

    return sorted(entries, key=lambda entry: entry[0].lower())


def build_index(entries: list[tuple[str, str, str]]) -> str:
    lines = [
        START,
        "| Skill | Description |",
        "| --- | --- |",
    ]
    for name, link, description in entries:
        lines.append(
            f"| [{markdown_escape(name)}]({link}) | {markdown_escape(description)} |"
        )
    lines.append(END)
    return "\n".join(lines)


def update_readme(repo_root: Path) -> Path:
    readme = repo_root / "README.md"
    if not readme.exists():
        raise FileNotFoundError(f"README.md not found at {readme}")

    text = readme.read_text(encoding="utf-8").rstrip()
    existing_by_name, existing_by_link = read_existing_descriptions(text)
    index = build_index(find_skill_entries(repo_root, existing_by_name, existing_by_link))

    if START in text and END in text:
        pattern = re.compile(
            rf"{re.escape(START)}.*?{re.escape(END)}",
            flags=re.DOTALL,
        )
        updated = pattern.sub(index, text)
    else:
        section = f"## Skills\n\n{index}"
        updated = f"{text}\n\n{section}" if text else section

    readme.write_text(f"{updated.rstrip()}\n", encoding="utf-8")
    return readme


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path.cwd(),
        help="Path to the agents-skills repository root.",
    )
    args = parser.parse_args()

    readme = update_readme(args.repo_root.resolve())
    print(f"Updated {readme}")


if __name__ == "__main__":
    main()
