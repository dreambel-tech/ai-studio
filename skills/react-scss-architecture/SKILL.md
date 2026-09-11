---
name: react-scss-architecture
description: Create or evolve maintainable React/Vite applications with strict TypeScript, explicit component boundaries, global co-located SCSS, and i18n-backed UI text. Use for new React frontends or structural UI changes where source discoverability and styling conventions matter; do not use for Tailwind-first, CSS-in-JS, or non-React projects.
---

# React + SCSS Architecture

Use this skill when building or changing a React application whose visual language is
implemented with conventional SCSS files. Keep the codebase easy to inspect in the DOM,
the editor, and the browser's style panel.

## Foundation

- Start with React and Vite unless the repository already has an established equivalent
  that the request requires preserving.
- Use TypeScript strict mode from the beginning. Source files are `.ts` and `.tsx` only;
  do not add `.js` or `.jsx` source files.
- Type component props explicitly with an interface or type. Prefer `unknown` plus
  narrowing to `any`; isolate the rare `any` needed at an untyped third-party boundary.
- Keep code, identifiers, comments, filenames, and locale keys in English. Put every
  visible user-facing string behind the existing i18n layer and keep translations in
  locale files, never inline in JSX.

## Component and class structure

Give every component its own directory:

```text
src/components/Workspace/
  Workspace.tsx
  Workspace.scss
  index.ts
  Header/
    Header.tsx
    Header.scss
    index.ts
```

Apply the same rule recursively to sub-components. Add an `index.ts` re-export when it
improves imports or is already the repository convention; do not create empty ceremony.

The first rendered JSX element of a component is its identifiable root and carries a
class derived from the component name in kebab-case:

```tsx
export interface WorkspaceProps {
  isOpen: boolean;
}

export function Workspace({ isOpen }: WorkspaceProps) {
  const className = `workspace${isOpen ? ' workspace--open' : ''}`;

  return <section className={className}>{isOpen ? <div className="workspace__content" /> : null}</section>;
}
```

Use readable block/element/modifier names so DOM inspection maps directly back to source,
for example `.workspace`, `.workspace__header-actions`, and `.workspace--open`. Keep
component-specific selectors in that component's SCSS file.

## SCSS boundaries

The co-located SCSS is intentionally global: this architecture does not use CSS Modules
or another file-level encapsulation mechanism. Treat that as a deliberate convention, not
as a defect to repair. Prevent collisions with explicit component blocks and structured
descendants rather than vague names such as `.container` or `.active`.

Keep shared foundations in a styles directory, such as:

- design tokens and CSS custom properties;
- theme definitions;
- reset and base rules;
- shared mixins and other genuinely global foundations.

Do not move a component's local presentation into global styles merely for convenience.
Do not introduce Tailwind, UnoCSS, CSS-in-JS, or styled-components. Prefer CSS transitions
and keyframes for motion. Add an animation library only when the interaction cannot be
expressed cleanly and maintainably in CSS, and record that boundary in the project's
existing decision log when one exists.

## Abstraction and maintainability

Keep logic close to its only consumer. Extract a hook, utility, or shared module only when
it is actually reused or creates a clear architectural boundary (for example, an i18n
adapter or a domain-facing data contract). Similar-looking code is not by itself enough;
avoid speculative generic components, hooks, and helpers.

Favor accessible native elements and semantics, keyboard operation, visible focus states,
appropriate labels, and components that remain straightforward to inspect and test.
Preserve existing product behavior and repository conventions unless the request changes
them explicitly.

## Delivery check

Before declaring a change complete:

1. Inspect the affected component tree, its co-located SCSS, shared style foundations,
   and i18n conventions before adding a parallel pattern.
2. Confirm new components have typed props, the expected root class, explicit selectors,
   and no hard-coded visible strings.
3. Run the repository's typecheck and build commands. Add or run focused tests when the
   behavior has meaningful logic; perform a visual/browser check when layout, styling,
   motion, responsiveness, or accessibility is relevant.
4. Report validation limits honestly, especially when a visual or interaction property
   was reasoned about but not manually exercised.
