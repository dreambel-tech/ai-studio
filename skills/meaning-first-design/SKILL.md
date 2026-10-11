---
name: meaning-first-design
description: Use whenever you design, build or review a user interface (a website, app screen, landing page, dashboard, component, prototype or design canvas), and whenever someone says a design looks generic, "AI-made", cluttered or soulless. It finds the meaning of the thing being made and lets that meaning decide every choice of form, colour, type, space, motion and words, instead of falling back on the most probable defaults.
---

# Meaning-first design

**A generic design is a design without meaning.**

Generic AI interfaces are rarely ugly. They are tidy, balanced and pleasant. The problem is that every choice in them is the most probable default: the usual font, the usual card, the usual gradient, the usual section order. Nothing in them belongs to the subject, so they could belong to any product, and the eye recognises that instantly.

The antidote is not a better style. It is a method:

1. Find the meaning of the thing being made.
2. Let that meaning decide every choice: forms, colour, type, space, motion, words.
3. Check that every element serves it, and remove what doesn't.

When you are about to make a choice and the only reason is "this is what interfaces usually look like", stop. That is the moment the design becomes generic.

## Choose the mode

- **Create**: you are designing something new. Follow the workflow below from step 1.
- **Review**: you are given an existing design, or told it looks generic. Follow "Reviewing an existing design" below.
- **Existing brand or design system**: if the project already has one, do not replace it. Find the meaning inside it (what the brand already says, which of its elements carry that) and apply the workflow within its constraints. Meaning usually lives in how the system is used, not in adding new parts to it.

## The workflow

### 1. Understand the context before drawing

Ask, or infer from what you have and state your assumptions:

- **Who looks at it, and where?** Projected in a room, a phone in one hand on a bus, a desk with two monitors, alone or in a group. This decides scale, density, contrast and input.
- **What emotion should remain at the end?** Calm, trust, appetite, pride, curiosity. One word is enough.
- **What must it absolutely do?** The one or two jobs that cannot fail.
- **What can be removed?** Ask this now, not at the end. Most first briefs contain things nobody will miss.
- **What existing reference is closest to the intent?** An object, a place, a printed thing, a ritual. Not another app.

If you cannot ask the user, answer these yourself in writing and show the answers with your first proposal so they can be corrected cheaply.

Detail and follow-up questions: `references/finding-meaning.md`.

### 2. Find the meaning

Write one sentence: what this project really says, and for whom.

Not a feature list and not a tagline. "A booking app for a yoga studio" is a description. "A place that tells people who are always rushing that they are allowed to arrive slowly" is a meaning. The second one can make decisions; the first one cannot.

### 3. Find an image drawn from the subject

Look for a metaphor, taken from the subject's own world, that carries the meaning. The image is what turns an abstract sentence into concrete design decisions. Examples of the kind of thing meant:

- a workshop about inner balance becomes a cairn of balanced stones;
- a travel journal becomes a riso-printed notebook with tickets and stamps;
- a thinking tool becomes a threshold, with time rendered as depth;
- a link page becomes a precious storehouse, with empty space as breathing room.

A good image is specific (you can picture its materials), native to the subject (not imported from tech), and productive (it answers questions such as "how does this move?" or "what colour is the background?").

Push the image into the names. Name colour tokens and components after it: `--paper`, `--ink`, `--stamp` rather than `--primary`, `--gray-100`; a `Threshold` component rather than `HeroSection`. Names are where the meaning survives once the design leaves your hands: every later contributor reads them.

### 4. Write a short art direction before any code

One paragraph that states the meaning and the image, followed by rules. Use `references/art-direction-template.md`. The rules cover:

- **Type.** Each typeface has a role (display, body, accent; or "the printed" versus "the handwritten"). Two families are usually enough. Contrast between them must mean something.
- **Colour.** Few colours, each with a meaning. Colour never decorates, and never categorises without a reason the user needs.
- **Motion.** A vocabulary derived from the image: what moves, how, with which easing, and what never moves.
- **Voice.** How the product speaks, and how microcopy (buttons, errors, empty states) sounds.
- **Banned for this project.** The specific defaults and clichés you will not use here, and why.

The art direction is short on purpose. If it takes more than a screen, it is a style guide, and it is too early for one.

### 5. Show directions before screens

Propose two or three contrasting directions. Give each a name and show it as **one** key screen, before building any full multi-screen prototype.

Contrast must be real: different images or different readings of the meaning, not the same layout in three palettes. Correcting an idea is cheap; correcting eight finished screens is not. Let the user choose, merge or reject before you go further.

### 6. Derive everything from the chosen direction

Every subsequent screen, state and component comes from the art direction. When you meet a decision the direction does not cover, go back to the meaning and the image and ask what they imply, then add the answer to the rules. Do not fill gaps with defaults.

### 7. Self-review before showing anything

Before you present any screen, ask:

- What can I still remove?
- Could this belong to any product? If you swapped the logo and copy, would anyone notice?
- Where is the empty space? Is it intentional, or did everything get boxed?
- Does each element serve the meaning? Name the reason for each one; delete those without a reason.

Then hunt for bypasses of the system, which is where generic defaults sneak back in:

- colours used outside the tokens, including hard-coded hex values;
- gradients, glows or shadows that reappeared "just for this one";
- stock success, warning and error colours from a framework;
- fallback greys and default borders;
- framework defaults for focus rings, radii and font stacks.

Full checklist: `references/review-checklist.md`.

### 8. Care pass

Meaning is lost in the details as easily as in the concept.

- **States.** Focus states in the brand colour, clearly visible. Empty, loading and error states that say what happened and what to do next, in the project's voice.
- **Motion.** Respect `prefers-reduced-motion` everywhere, not only on the hero. Reduced motion should still feel designed (a fade or nothing, not a broken layout).
- **Mobile.** Design the phone layout; do not squeeze the desktop one. Use bottom sheets with safe-area insets where they fit, put primary actions within thumb reach, check alignment at real widths.
- **Typography for the language.** French needs guillemets (« ») and non-breaking spaces before `: ; ! ?` and inside guillemets. Use a real ellipsis (…), correct apostrophes and quotes, and check accents and capitals with accents in the chosen fonts. Other languages have their own rules; follow them.
- **Destructive actions.** Ordinary destructive actions (remove an item, cancel a draft) do not need alarming red. Make them clear, reversible where possible, and confirm with words rather than colour. Reserve alarm for what is truly dangerous.

## Reviewing an existing design

1. **Diagnose.** Go through `references/anti-patterns.md` and list which patterns appear and where. Be concrete: "the three feature cards on the home screen", not "too many cards".
2. **Recover the meaning.** Answer the context questions from step 1, using the existing content, brand and audience. Write the meaning sentence and look for an image. Often the meaning is already present in the content and has been buried by the template.
3. **Propose subtractive fixes first.** Removing a gradient, a shadow, a badge row or a section often does more than adding anything. List removals before additions.
4. **Then propose meaning-driven changes.** Each change must cite the meaning or the image as its reason. If you cannot state the reason, do not propose the change.
5. **Respect what works.** Keep elements that already serve the meaning, even if they are conventional. Conventional is not the same as generic; a standard form field that does its job is fine.

## Don't swap one cliché for another

This skill never imposes a house style. There is no "correct" anti-generic look.

A serif italic accent word, a cream background, a condensed display font, grain textures, a blur-in animation, a monospace label: none of these are solutions in themselves. Each is right only when the meaning of the project calls for it. Repeated across projects because they "look designed", they become the next generic look, and they are already becoming it.

The test is always the same: can you explain why this choice belongs to this subject, and would it be wrong for a different one? If the answer is no, it is a default, however tasteful it looks.

## References

Load these only when needed:

- `references/finding-meaning.md`: the context questions in depth, and how to turn answers into a meaning sentence and an image.
- `references/art-direction-template.md`: the short template to fill in before coding.
- `references/anti-patterns.md`: the catalogue of generic patterns, why each reads as generic, and what to do instead.
- `references/review-checklist.md`: the self-review and care-pass checklist.
- `references/worked-example.md`: a complete fictional example, from generic draft to chosen direction.
