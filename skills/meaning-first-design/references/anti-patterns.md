# Anti-pattern catalogue

Each pattern below is a probable default: the thing a model, a template or a hurried designer reaches for when no meaning is guiding the choice. None of them is forbidden. Each becomes a problem when it appears without a reason that comes from the subject.

Use this catalogue in two ways: to diagnose an existing design, and to check your own work before showing it. For every entry, the "instead" is subtractive or meaning-driven. It never says "use style X", because replacing one default with another solves nothing.

## Contents

- Surfaces and colour: cards, pastel trio, gradients and glows, glassmorphism
- Type: the single friendly font
- Ornament: pills and badges, icon tiles and emoji, big numerals
- Layout: mechanical symmetry, the landing skeleton, boxing everything
- Motion: tutorial animations
- Words: invented statistics, marketing copy, generic errors
- States: red alarms
- A note on frequency

---

## Surfaces and colour

### Cards everywhere: white, very rounded, soft shadow

**Why it reads as generic.** The card is the default container of every UI kit. When every piece of content sits in the same white rounded rectangle with the same diffuse shadow, the layout announces "component library" before it says anything about the subject. Shadows also imply physical layering that usually means nothing.

**Instead.** Remove the containers and see what holds without them. Group with space, alignment and type first. Keep a container only where the content really is a discrete object the user handles (a ticket, an order, a photo), and let its form come from that object: a ticket can have a perforated edge, an order can look like a slip, a photo can be a print.

### The pastel trio on a grey-blue or off-white background

**Why it reads as generic.** Soft mint, lavender and peach (or their cousins) on a pale neutral is the palette of a thousand dashboards and illustrations. It is chosen because it is inoffensive, which is exactly why it carries no meaning. It usually categorises things that do not need categories.

**Instead.** Start from the image and its materials: what colours does that world actually have? Reduce to a background, an ink and at most one or two accents, and write down what each one means. If a colour is only there to make three columns look different, remove it.

### Purple-blue or pink gradients, glows, neon on near-black

**Why it reads as generic.** This is the visual shorthand for "tech" and "AI" in general. It signals a category, not a product. Glows and neon also lower legibility and age quickly.

**Instead.** Ask whether the subject has any light source, depth or energy that a gradient would represent. If it does (dusk for an evening event, heat for a forge), derive the gradient from it and use it once, where that meaning lives. If it does not, use flat colour and let contrast do the work.

### Glassmorphism and heavy backdrop blur

**Why it reads as generic.** Frosted panels over blurred colour blobs became a trend precisely because they look rich with no content behind them. They reduce contrast, cost performance and hide the hierarchy behind a material effect.

**Instead.** Remove the blur and check the hierarchy still reads. If translucency matters (a sheet over a map the user still needs to see), keep it light and functional. Otherwise use an opaque surface whose colour comes from the image.

## Type

### One "friendly" rounded font family, bold titles, regular body

**Why it reads as generic.** Inter, Poppins, Nunito, Fredoka, Roboto and similar families are excellent tools and the most probable choice. Used alone, with titles in bold and body in regular, they give the page one voice at two volumes. There is no contrast and no character, so the type says nothing about the subject.

**Instead.** Give each typeface a role. Decide what the display type represents in the image (the printed label, the carved sign, the handwritten note) and what the body type represents (the readable record). Choose faces for those roles. Contrast can come from the pairing, from scale, from width or from setting, not only from weight. A single family is fine when it is a deliberate choice that fits the meaning.

## Ornament

### Pills, tags and badges everywhere; uppercase eyebrow badges

**Why it reads as generic.** A rounded pill above every heading ("NEW", "FEATURES", "HOW IT WORKS") and tag chips on every item add noise that looks like information. Eyebrow badges in particular are a template signature: they label a section the heading already names.

**Instead.** Remove them and read the page again. Keep a tag only when the user filters or scans by it, and style it as part of the image (a stamp, a label, a margin note) rather than as a capsule. Let headings stand on their own.

### Icons inside rounded squares; emoji used as icons

**Why it reads as generic.** A line icon in a pastel rounded tile is the default "feature" visual. It decorates without explaining. Emoji used as icons import a platform's visual language and tone into your product, and render differently on every system.

**Instead.** Ask whether the icon helps the user recognise or act. If not, remove it and let the words work. If it does, draw from the image (the stamp, the seed packet, the stone) or use a plain glyph without a tile. Never use emoji as interface icons.

### Big "01 / 02 / 03" numerals

**Why it reads as generic.** Oversized step numbers fill space and create the impression of a process where there often is none. They are a layout device, not content.

**Instead.** Use numbers only when order matters to the user, and size them as information, not decoration. If the steps are a real sequence, find how the subject expresses sequence (days, rows in a garden, stations on a route).

## Layout

### Mechanical symmetry: three identical columns, the same template recoloured

**Why it reads as generic.** Three equal columns, or one block repeated with a different accent colour each time, show the grid rather than the content. Real content is rarely equal in importance or length.

**Instead.** Let importance decide size and position. Give the one thing that matters most more room. Allow asymmetry where the content is asymmetrical. If three items truly are equal, consider whether they need to be three blocks at all, or one sentence.

### Hero, three benefits, testimonials, CTA, applied to everything

**Why it reads as generic.** This marketing skeleton is the most probable page structure on the web. Applied to an app screen, a portfolio, an event or a dashboard, it forces every subject into the same story.

**Instead.** Ask what the visitor needs, in what order, for this subject. A menu needs dishes first. An event needs date and place first. A tool needs the tool first. Build the structure from that sequence and from the image (a notebook has pages, a threshold has a before and after).

### Every piece of information boxed and labelled

**Why it reads as generic.** When every value gets a container, a label and a border, the page has no empty space and no hierarchy. Everything is equally loud, so nothing is important.

**Instead.** Remove boxes and redundant labels; a well-formatted value often needs no label. Treat empty space as a material that carries meaning (calm, value, breathing room). Decide what can be quiet.

## Motion

### Tutorial animations

Fade-in-up on every element, floating blobs, pulsing circles, hover lift on every card.

**Why it reads as generic.** These are the first animations every tutorial teaches. Applied everywhere, they make the page feel busy and identical to every other page. Motion that does not say anything distracts and tires.

**Instead.** Derive a small motion vocabulary from the image: paper slides, stones settle, ink appears, a door opens. Decide what never moves. Animate only what the user needs to notice or understand (a change of state, a transition between places). Most elements should simply be there.

## Words

### Invented statistics ("+250 %")

**Why it reads as generic.** Placeholder numbers are a template staple, and users have learned to distrust them. An invented figure in a design also tends to survive into production.

**Instead.** Use real figures from the client or none. If a number matters to the story, ask for it. In mockups, mark placeholders visibly so they cannot ship by accident.

### Marketing copy and feature lists instead of a story

"Unlock your potential", "Start your journey", "Seamless", "Powerful", "All-in-one".

**Why it reads as generic.** These phrases could describe anything, so they describe nothing. A list of features tells the visitor what the product contains, not why it matters to them.

**Instead.** Write from the meaning sentence. Say what the thing is, for whom, in the plain words that person would use. Prefer one concrete sentence about a real situation over three abstract benefits.

### Generic error text ("An error occurred")

**Why it reads as generic.** Default framework messages break the voice exactly when the user is most attentive, and give them nothing to do.

**Instead.** Say what happened, whether their work is safe, and what to do next, in the project's voice. "We couldn't save your order because the connection dropped. Your basket is still here; try again." is longer and much better.

## States

### Red alarms for ordinary destructive actions

**Why it reads as generic.** Framework defaults paint every delete, remove or cancel in red. That trains users to ignore red, makes calm products feel anxious, and pulls a colour into the palette that the meaning never asked for.

**Instead.** Make ordinary destructive actions clear in words ("Remove from basket"), reversible where possible (undo), and styled within the palette. Reserve a strong warning for actions that are truly irreversible and costly, and even then let the wording do most of the work.

---

## A note on frequency

One rounded card or one pill is not a sin. The generic look comes from accumulation: when most choices on a screen are the default, the screen belongs to no one. When diagnosing, count. When fixing, start with the patterns that appear most often and remove them first.
