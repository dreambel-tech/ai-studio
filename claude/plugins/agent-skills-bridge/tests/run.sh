#!/usr/bin/env bash
# Tests for hooks/link-skills.sh on macOS and Linux. Usage: tests/run.sh [shell]
# The shell defaults to sh; try also "bash --posix" or dash. On Windows, use tests/run.ps1.
set -u
case $(uname -s) in MINGW* | MSYS* | CYGWIN*) echo "On Windows, run tests/run.ps1." >&2; exit 2 ;; esac

SHELL_UNDER_TEST=${1:-sh}
REPO=$(cd "$(dirname "$0")/.." && pwd)
SCRIPT="$REPO/hooks/link-skills.sh"
T=$(mktemp -d "${TMPDIR:-/tmp}/agent-skills-bridge-tests.XXXXXX")
trap 'rm -rf "$T"' EXIT
pass=0
fails=0

ok() { echo "PASS  $1"; pass=$((pass + 1)); }
ko() { echo "FAIL  $1"; [ -n "${2:-}" ] && echo "      got: $2"; fails=$((fails + 1)); }
check() { if eval "$2"; then ok "$1"; else ko "$1" "${3:-}"; fi; }

run() { CLAUDE_PROJECT_DIR="$1" $SHELL_UNDER_TEST "$SCRIPT" </dev/null; }
# A project with one skill; pass "git" as $2 to make it a git repository.
mkproj() {
    mkdir -p "$1/.agents/skills/demo"
    printf -- '---\nname: demo\ndescription: Demo skill.\n---\nHello from demo\n' >"$1/.agents/skills/demo/SKILL.md"
    [ "${2:-git}" = git ] && git -C "$1" init -q
    return 0
}
isjson() {
    command -v python3 >/dev/null 2>&1 || return 0
    printf '%s' "$1" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null
}
linked_to_agents() { [ -L "$1/.claude/skills" ] && grep -q "Hello from demo" "$1/.claude/skills/demo/SKILL.md"; }
git_clean() { [ -z "$(git -C "$1" status --porcelain --untracked-files=all | grep '\.claude')" ]; }

echo "== hooks/link-skills.sh under: $SHELL_UNDER_TEST =="

echo "-- session folder is the project"
P="$T/create"; mkproj "$P"; out=$(run "$P")
check "creates the link, one JSON object with reloadSkills" '[[ "$out" == *"Linked .claude/skills to .agents/skills in create."* && "$out" == *"\"reloadSkills\":true"* ]] && isjson "$out"' "$out"
check "relative symlink, skill visible through .claude/skills" '[ "$(readlink "$P/.claude/skills")" = ../.agents/skills ] && linked_to_agents "$P"'
check "adds /.claude/skills to .git/info/exclude, git status clean" 'grep -qx "/.claude/skills" "$P/.git/info/exclude" && git_clean "$P"'
check "never creates a .gitignore" '[ ! -e "$P/.gitignore" ]'
out=$(run "$P")
check "second run is silent" '[ -z "$out" ] && [ "$(grep -cx "/.claude/skills" "$P/.git/info/exclude")" = 1 ]' "$out"

P="$T/no-agents"; mkdir -p "$P"; out=$(run "$P")
check "no .agents folder: silent, nothing created" '[ -z "$out" ] && [ ! -e "$P/.claude" ]' "$out"

P="$T/real-folder"; mkproj "$P"; mkdir -p "$P/.claude/skills/own"; echo mine >"$P/.claude/skills/own/SKILL.md"
out=$(run "$P")
check "real .claude/skills folder: explained and left untouched" '[[ "$out" == *"real folder"* ]] && isjson "$out" && [ ! -L "$P/.claude/skills" ] && [ "$(cat "$P/.claude/skills/own/SKILL.md")" = mine ] && ! grep -q claude "$P/.git/info/exclude"' "$out"

P="$T/link-elsewhere"; mkproj "$P"; mkdir -p "$T/elsewhere" "$P/.claude"; ln -s "$T/elsewhere" "$P/.claude/skills"
out=$(run "$P")
check "link to somewhere else: explained and left untouched" '[[ "$out" == *"is a link to"* ]] && [ "$(readlink "$P/.claude/skills")" = "$T/elsewhere" ]' "$out"

P="$T/broken-link"; mkproj "$P"; mkdir -p "$P/.claude"; ln -s "$T/missing" "$P/.claude/skills"
out=$(run "$P")
check "broken link: explained and left untouched" '[[ "$out" == *"is a link to"* ]] && [ "$(readlink "$P/.claude/skills")" = "$T/missing" ]' "$out"

P="$T/stdin proj é \"q\""; mkproj "$P"
cwd=$(printf '%s' "$P" | sed 's/\\/\\\\/g; s/"/\\"/g')
out=$(printf '{"session_id":"t","cwd":"%s","hook_event_name":"SessionStart","source":"startup"}' "$cwd" |
    env -u CLAUDE_PROJECT_DIR $SHELL_UNDER_TEST "$SCRIPT")
check "project path read from the hook input (space, accent, quote)" '[[ "$out" == *"Linked"* ]] && isjson "$out" && linked_to_agents "$P"' "$out"

P="$T/exclude-eol"; mkproj "$P"; printf 'foo' >"$P/.git/info/exclude"; run "$P" >/dev/null
check "exclude without a final newline: line added on its own line" '[ "$(cat "$P/.git/info/exclude")" = "$(printf "foo\n/.claude/skills")" ]' "$(cat "$P/.git/info/exclude")"

P="$T/no-git"; mkproj "$P" nogit; out=$(run "$P")
check "not a git repository: link only" '[[ "$out" == *"Linked"* ]] && [ ! -e "$P/.git" ]' "$out"

P="$T/symlinked-claude"; mkproj "$P"; mkdir -p "$T/claude-elsewhere"; ln -s "$T/claude-elsewhere" "$P/.claude"; run "$P" >/dev/null
check ".claude is itself a symlink: absolute link that resolves" 'grep -q "Hello from demo" "$P/.claude/skills/demo/SKILL.md"'

echo "-- umbrella folder holding several projects"
U="$T/umbrella"; mkdir -p "$U"; mkproj "$U/app-a"; mkdir -p "$U/app-b"; git -C "$U/app-b" init -q
out=$(run "$U")
check "links the subproject that has .agents/skills, names it" '[[ "$out" == *"Linked .claude/skills to .agents/skills in app-a."* ]] && isjson "$out" && linked_to_agents "$U/app-a"' "$out"
check "message explains when subfolder skills load" '[[ "$out" == *"/add-dir"* && "$out" != *"restart the session"* ]]' "$out"
check "subproject without .agents and parent are left alone" '[ ! -e "$U/app-b/.claude" ] && [ ! -e "$U/.claude" ]'
check "subproject's own .git/info/exclude updated, git status clean" 'grep -qx "/.claude/skills" "$U/app-a/.git/info/exclude" && git_clean "$U/app-a"'
out=$(run "$U")
check "umbrella second run is silent" '[ -z "$out" ]' "$out"

U="$T/umbrella-real"; mkdir -p "$U"; mkproj "$U/app-a"; mkproj "$U/app-c"
mkdir -p "$U/app-c/.claude/skills/own"; echo mine >"$U/app-c/.claude/skills/own/SKILL.md"
out=$(run "$U")
check "one message for both: app-a linked, app-c left untouched" '[[ "$out" == *"in app-a."* && "$out" == *"Left untouched: app-c (.claude/skills is a real folder"* ]] && isjson "$out" && [ "$(printf "%s\n" "$out" | wc -l | tr -d " ")" = 1 ]' "$out"
check "subproject's real .claude/skills folder untouched" '[ ! -L "$U/app-c/.claude/skills" ] && [ "$(cat "$U/app-c/.claude/skills/own/SKILL.md")" = mine ]'

U="$T/umbrella-skip"; mkdir -p "$U"
for d in node_modules .hidden dist; do mkproj "$U/$d" nogit; done
out=$(run "$U")
check "node_modules, hidden and build folders are ignored" '[ -z "$out" ] && [ ! -e "$U/node_modules/.claude" ] && [ ! -e "$U/.hidden/.claude" ] && [ ! -e "$U/dist/.claude" ]' "$out"

U="$T/umbrella-deep"; mkproj "$U/group/app" nogit
out=$(run "$U")
check "only one level deep: grandchildren are not scanned" '[ -z "$out" ] && [ ! -e "$U/group/app/.claude" ]' "$out"

U="$T/monorepo"; mkproj "$U"; mkproj "$U/pkg" nogit
out=$(run "$U")
check "project with a subpackage: both linked in one message" '[[ "$out" == *"in monorepo, pkg."* && "$out" == *"restart the session"* && "$out" == *"/add-dir"* ]] && linked_to_agents "$U" && linked_to_agents "$U/pkg"' "$out"
check "plain subfolder excluded in the session folder's repository" 'grep -qx "/pkg/.claude/skills" "$U/.git/info/exclude" && git_clean "$U"' "$(git -C "$U" status --porcelain)"

echo "-- hooks.json command, run with sh -c as Claude Code does on macOS and Linux"
CMD=$(tr -d '\r' <"$REPO/hooks/hooks.json" | sed -n 's/^ *"command": "\(.*\)",$/\1/p' | sed 's/\\"/"/g')
P="$T/hook-command"; mkproj "$P"
out=$(CLAUDE_PLUGIN_ROOT="$REPO" CLAUDE_PROJECT_DIR="$P" sh -c "$CMD" </dev/null 2>"$T/stderr"); code=$?
check "link created, one JSON object, exit 0, nothing on stderr" '[ $code = 0 ] && isjson "$out" && linked_to_agents "$P" && [ ! -s "$T/stderr" ]' "code=$code out=$out err=$(cat "$T/stderr")"

echo
echo "$pass passed, $fails failed"
[ "$fails" = 0 ]
