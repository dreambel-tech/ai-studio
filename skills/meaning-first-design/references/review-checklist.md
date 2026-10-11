# Review checklist

Run this before showing any screen, and when reviewing someone else's design. Work through it in order: meaning first, then subtraction, then system leaks, then care. Fix as you go.

## 1. Meaning

- [ ] I can state the meaning sentence and the image without looking them up.
- [ ] Swap test: if I replaced the logo and the copy with another product's, would anything look wrong? If not, the design has no meaning yet.
- [ ] For each visible element, I can name the reason it is there, and the reason refers to the meaning, the image or a user need.
- [ ] The structure follows what this visitor needs in this order, not a borrowed page skeleton.

## 2. Subtraction

- [ ] What can I still remove? I tried removing each section, container, label, icon and decoration, and kept only what was missed.
- [ ] Where is the empty space? There is at least one place where nothing happens on purpose.
- [ ] No element is boxed only because the previous one was.
- [ ] No label repeats what the content already says.
- [ ] No more than one thing per screen is asking for attention.

## 3. Anti-patterns

Count occurrences, using `anti-patterns.md`:

- [ ] Rounded white cards with soft shadows
- [ ] Pastel trio or category colours without a user need
- [ ] Gradients, glows, neon
- [ ] Glass and backdrop blur
- [ ] A single friendly font with bold-titles / regular-body as the only contrast
- [ ] Pills, tags, eyebrow badges
- [ ] Icons in rounded tiles, emoji as icons
- [ ] Big step numerals
- [ ] Equal columns, recoloured repeated templates
- [ ] Hero / benefits / testimonials / CTA skeleton
- [ ] Everything boxed and labelled
- [ ] Fade-in-up everywhere, blobs, pulses, hover lift on every card
- [ ] Invented statistics
- [ ] Marketing copy and feature lists
- [ ] Generic error text
- [ ] Red for ordinary destructive actions

For each one present: remove it, or write down the reason this subject calls for it.

- [ ] I have not replaced a removed cliché with another one (serif italic accent word, cream background, condensed display, grain, blur-in) without a reason from the meaning.

## 4. System leaks

Search the code, not only the screen:

- [ ] Every colour comes from a token. No hard-coded hex, rgb or named colours in components.
- [ ] No gradient, glow or shadow outside what the art direction allows.
- [ ] No stock success, warning, error or info colours from a framework or component library.
- [ ] No fallback greys or default borders (`#ccc`, `gray-200`, `border-gray-*`, and similar).
- [ ] Focus rings, radii, font stacks and transitions are set by the project, not inherited from framework defaults.
- [ ] Token and component names come from the image where clarity allows.

## 5. Care

States
- [ ] Focus states are visible, in the brand colour, on every interactive element, including custom ones.
- [ ] Empty states say what this place is for and what to do first.
- [ ] Loading states are calm and shaped like the content that is coming, where practical.
- [ ] Error states say what happened, whether work is safe, and what to do next, in the project's voice.
- [ ] Ordinary destructive actions are clear in words and reversible where possible; strong warning is reserved for truly costly, irreversible actions.

Motion
- [ ] `prefers-reduced-motion` is respected everywhere, including page transitions and small hovers.
- [ ] The reduced version still feels designed.
- [ ] Nothing animates that the art direction says never moves.

Mobile
- [ ] The phone layout is designed, not squeezed: hierarchy reconsidered, not just stacked.
- [ ] Primary actions sit within thumb reach; bottom sheets respect safe-area insets.
- [ ] Touch targets are large enough; nothing relies on hover.
- [ ] Alignment checked at real widths (small phones included), with no horizontal scroll.

Typography and language
- [ ] Typography follows the rules of the language. For French: guillemets (« »), non-breaking spaces before `: ; ! ?` and inside guillemets, correct apostrophes.
- [ ] Real ellipsis (…), real quotes and apostrophes, real dashes where needed.
- [ ] Accents and accented capitals render correctly in every chosen font and weight.
- [ ] No widows or orphans in display type; line length comfortable in body text.

Accessibility
- [ ] Text contrast meets WCAG AA at minimum against its actual background.
- [ ] Meaning never depends on colour alone.
- [ ] Headings, landmarks and labels are present for assistive technology.

## 6. Final question

- [ ] If the user saw only this screen, would they understand what the project means?
