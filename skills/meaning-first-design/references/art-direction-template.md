# Art direction template

Fill this in before writing any interface code. Keep it to one screen. It is a decision record, not a style guide: its job is to make the next hundred small choices obvious.

Copy the block below and replace every bracket. If you cannot fill a line, go back to `finding-meaning.md` rather than writing a default.

---

```markdown
# Art direction: [project name] / [direction name]

## Context
- Seen by: [who], [where], [alone or together], [for how long]
- Must do: [one or two jobs that cannot fail]
- Removed: [what we chose not to include]
- Emotion at the end: [one word]

## Meaning
[One sentence: what this says, to whom, so that they feel or do what.]

## Image
[The metaphor drawn from the subject, in one or two sentences, with its materials.]

[One paragraph describing how the interface feels as a whole, in terms of the image.]

## Rules

Type
- [Role, e.g. "the printed"]: [typeface], used for [what]
- [Role, e.g. "the handwritten"]: [typeface], used for [what]
- [Any setting rule: case, tracking, sizes, language-specific typography]

Colour (tokens named after the image)
- --[name]: [value]. Means [what]. Used for [where].
- --[name]: [value]. Means [what]. Used for [where].
- --[name]: [value]. Means [what]. Used for [where].
- No colour outside these tokens. [State, if needed, how success, error and focus are expressed within them.]

Space and form
- [Where the empty space is and what it means]
- [Which things are containers and what they are made of; everything else is not boxed]

Motion
- Moves: [what], like [gesture from the image], [duration], [easing]
- Never moves: [what]
- Reduced motion: [what replaces it]

Voice
- [How it speaks: register, person, sentence length]
- Buttons: [principle, with one example]
- Errors and empty states: [principle, with one example]

Banned for this project
- [Specific default or cliché] because [reason tied to the meaning]
- [Specific default or cliché] because [reason tied to the meaning]
- [Specific default or cliché] because [reason tied to the meaning]
```

---

## Notes on filling it in

- **Few colours.** Three to five tokens is typical. If you need more, check whether some are only decorating or categorising without a reason.
- **Two typefaces.** Usually enough. A third needs a role the first two cannot play.
- **Easing from the image.** Stones settle (ease-out with a slow end), paper slides (linear-ish, short), doors open (ease-in-out, longer). Name the gesture before choosing the curve.
- **The banned list is project-specific.** Do not paste the whole anti-pattern catalogue. List the three to six temptations most likely for this subject, and include any "tasteful" clichés that would be wrong here.
- **One per direction.** When you propose two or three directions, write a short version of this for each. Expand only the chosen one.
