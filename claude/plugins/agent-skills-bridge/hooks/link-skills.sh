#!/bin/sh
# agent-skills-bridge: SessionStart hook for macOS and Linux (POSIX sh, no dependencies).
#
# For the session folder and each of its direct subfolders (an "umbrella" folder holding
# several projects), when the folder has a .agents/skills folder (the cross-tool Agent Skills
# convention), link its .claude/skills to it with a relative symlink so Claude Code discovers
# those skills.
#
# Never touches an existing .claude/skills folder or a link that points elsewhere.
# Never edits a .gitignore. Prints at most one message. Always exits 0.

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
            message "Could not start Windows PowerShell to link .claude/skills to .agents/skills."
        exit 0
        ;;
esac

# Physical path of a directory, or nothing when it cannot be resolved.
resolve() {
    (cd -P -- "$1" 2>/dev/null && pwd -P)
}

# Results, reported together in one message at the end.
linked=
untouched=
failed=
root_linked=
sub_linked=
append() { # append VAR TEXT SEPARATOR
    eval "current=\$$1"
    eval "$1=\${current:+\$current\$3}\$2"
}

# Subfolders never scanned: hidden ones, and heavy ones that hold dependencies or build output.
skip_subfolder() {
    case $1 in
        .* | node_modules | bower_components | vendor | dist | build | out | target | bin | obj | \
            coverage | __pycache__ | venv) return 0 ;;
    esac
    return 1
}

# Keep a new link out of git without editing any .gitignore: local-only exclude in the
# folder's own repository or, for a plain subfolder, in the session folder's repository.
exclude_link() { # exclude_link DIR LABEL
    if [ -d "$1/.git" ]; then
        repo=$1
        line='/.claude/skills'
    elif [ "$1" != "$root" ] && [ -d "$root/.git" ]; then
        repo=$root
        line="/$(printf '%s' "$2" | sed 's/[][*?\\]/\\&/g')/.claude/skills"
    else
        return 0
    fi
    exclude="$repo/.git/info/exclude"
    grep -qxF -- "$line" "$exclude" 2>/dev/null && return 0
    {
        mkdir -p -- "$repo/.git/info" &&
        if [ -s "$exclude" ] && [ -n "$(tail -c 1 "$exclude")" ]; then printf '\n' >>"$exclude"; fi &&
        printf '%s\n' "$line" >>"$exclude"
    } 2>/dev/null
}

link_folder() { # link_folder DIR LABEL
    target=$(resolve "$1/.agents/skills")
    if [ -z "$target" ]; then
        append failed "$2 (cannot resolve .agents/skills)" '; '
        return
    fi
    claude_dir="$1/.claude"
    claude_skills="$claude_dir/skills"
    # -L also catches broken links, which -e reports as missing.
    if [ -L "$claude_skills" ]; then
        [ "$(resolve "$claude_skills")" = "$target" ] && return
        append untouched "$2 (.claude/skills is a link to '$(readlink "$claude_skills")'; remove it to let the plugin link .agents/skills)" '; '
        return
    fi
    if [ -e "$claude_skills" ]; then
        append untouched "$2 (.claude/skills is a real folder; move its skills into .agents/skills, then remove it)" '; '
        return
    fi
    if ! err=$(mkdir -p -- "$claude_dir" 2>&1); then
        append failed "$2 ($err)" '; '
        return
    fi
    # A relative link survives moving or cloning the project. If .claude is itself a symlink,
    # a relative target would resolve from elsewhere, so use the absolute path instead.
    link_target=../.agents/skills
    [ -L "$claude_dir" ] && link_target=$target
    if ! err=$(ln -s -- "$link_target" "$claude_skills" 2>&1); then
        append failed "$2 ($err)" '; '
        return
    fi
    append linked "$2" ', '
    [ "$1" = "$root" ] && root_linked=1 || sub_linked=1
    exclude_link "$1" "$2" || append failed "$2 (linked, but not added to .git/info/exclude)" '; '
}

root=${CLAUDE_PROJECT_DIR:-}
if [ -z "$root" ]; then
    # Fallback: the "cwd" field of the hook input. No jq: a single top-level string field.
    root=$(tr -d '\n\r' | sed -n -E 's/.*"cwd"[[:space:]]*:[[:space:]]*"(([^"\\]|\\.)*)".*/\1/p' \
        | sed 's/\\"/"/g; s/\\\\/\\/g')
fi
[ -n "$root" ] || exit 0
[ "$root" = / ] || root=${root%/}
[ -d "$root" ] || exit 0

# The session folder itself, then its direct subfolders (one level, never recursive).
[ -d "$root/.agents/skills" ] && link_folder "$root" "$(basename -- "$root")"
for sub in "$root"/*/; do
    sub=${sub%/}
    name=${sub##*/}
    skip_subfolder "$name" && continue
    [ -d "$sub/.agents/skills" ] && link_folder "$sub" "$name"
done

text=
[ -n "$linked" ] && text="Linked .claude/skills to .agents/skills in $linked."
[ -n "$untouched" ] && text="${text:+$text }Left untouched: $untouched."
[ -n "$failed" ] && text="${text:+$text }Could not finish: $failed."
[ -n "$text" ] || exit 0

[ -n "$root_linked" ] && text="$text If the skills do not appear yet, restart the session."
# Claude Code loads a subfolder's skills the first time it reads or edits a file there.
[ -n "$sub_linked" ] &&
    text="$text Skills in a subfolder load once Claude reads or edits a file in it; run /add-dir with the subfolder to load them now."

if [ -n "$linked" ]; then
    # Ask Claude Code to re-scan skills so the linked ones appear in this session.
    message "$text" ',"hookSpecificOutput":{"hookEventName":"SessionStart","reloadSkills":true}'
else
    message "$text"
fi
exit 0
