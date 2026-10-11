#!/bin/sh
# agent-skills-bridge: SessionStart hook for macOS and Linux (POSIX sh, no dependencies).
#
# When the project has a .agents/skills folder (the cross-tool Agent Skills convention), link
# .claude/skills to it with a relative symlink so Claude Code discovers those skills.
#
# Never touches an existing .claude/skills folder or a link that points elsewhere.
# Never edits the project's .gitignore. Always exits 0.

message() {
    escaped=$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n\r')
    printf '{"systemMessage":"agent-skills-bridge: %s"%s}\n' "$escaped" "${2:-}"
}

# Windows shells (Git Bash, MSYS2, Cygwin): ln -s there copies files by default instead of
# linking, so hand over to the PowerShell script, which creates a directory junction.
case $(uname -s 2>/dev/null) in
    MINGW* | MSYS* | CYGWIN*)
        ps1="$(dirname -- "$0")/link-skills.ps1"
        command -v cygpath >/dev/null 2>&1 && ps1=$(cygpath -w -- "$ps1")
        powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$ps1" ||
            message "could not start Windows PowerShell to link .claude/skills to .agents/skills."
        exit 0
        ;;
esac

# After creating the link, ask Claude Code to re-scan skills so they appear in this session.
linked() {
    message "$1 If the skills do not appear yet, restart the session." \
        ',"hookSpecificOutput":{"hookEventName":"SessionStart","reloadSkills":true}'
}

fail() {
    message "could not link .claude/skills to .agents/skills: $1"
    exit 0
}

# Physical path of a directory, or nothing when it cannot be resolved.
resolve() {
    (cd -P -- "$1" 2>/dev/null && pwd -P)
}

root=${CLAUDE_PROJECT_DIR:-}
if [ -z "$root" ]; then
    # Fallback: the "cwd" field of the hook input. No jq: a single top-level string field.
    root=$(tr -d '\n\r' | sed -n -E 's/.*"cwd"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p' \
        | sed 's/\\"/"/g; s/\\\\/\\/g')
fi
[ -n "$root" ] || exit 0

agents_skills="$root/.agents/skills"
[ -d "$agents_skills" ] || exit 0

claude_dir="$root/.claude"
claude_skills="$claude_dir/skills"
target=$(resolve "$agents_skills")
[ -n "$target" ] || fail "cannot resolve $agents_skills"

# -L also catches broken links, which -e reports as missing.
if [ -L "$claude_skills" ]; then
    [ "$(resolve "$claude_skills")" = "$target" ] && exit 0
    message ".claude/skills is a link to '$(readlink "$claude_skills")', not to .agents/skills, so it was left untouched. Remove that link to let the plugin link .agents/skills."
    exit 0
fi
if [ -e "$claude_skills" ]; then
    message ".claude/skills is a real folder, so it was left untouched. Move its skills into .agents/skills, then remove .claude/skills; the link is created at the next session start."
    exit 0
fi

err=$(mkdir -p -- "$claude_dir" 2>&1) || fail "$err"
# A relative link survives moving or cloning the project. If .claude is itself a symlink,
# a relative target would resolve from elsewhere, so use the absolute path instead.
link_target=../.agents/skills
[ -L "$claude_dir" ] && link_target=$target
err=$(ln -s -- "$link_target" "$claude_skills" 2>&1) || fail "$err"

# Keep the link out of git without editing the project's .gitignore: local-only exclude.
if [ -d "$root/.git" ]; then
    exclude="$root/.git/info/exclude"
    line='/.claude/skills'
    if ! grep -qxF -- "$line" "$exclude" 2>/dev/null; then
        {
            mkdir -p -- "$root/.git/info" &&
            if [ -s "$exclude" ] && [ -n "$(tail -c 1 "$exclude")" ]; then printf '\n' >>"$exclude"; fi &&
            printf '%s\n' "$line" >>"$exclude"
        } 2>/dev/null || {
            linked "linked .claude/skills to .agents/skills, but could not add it to .git/info/exclude."
            exit 0
        }
    fi
fi

linked "linked .claude/skills to .agents/skills."
exit 0
