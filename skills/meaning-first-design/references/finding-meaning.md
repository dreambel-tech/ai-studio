# Finding the meaning

This file covers steps 1 to 3 of the workflow: understanding the context, writing the meaning sentence, and finding an image. It ends with how to turn those into concrete decisions.

## Contents

- The context questions
- When you cannot ask
- From answers to a meaning sentence
- From meaning to an image
- Testing an image
- Turning the image into decisions
- Pushing the image into names

---

## The context questions

Ask these before drawing anything. Each one has a reason; the reason tells you what to listen for.

**1. Who looks at it, and where?**
Physical context decides more than taste does. A screen projected in a room is read from five metres by a group, so it needs large type, few elements and high contrast. A phone in one hand is read in seconds, with a thumb, often outdoors. A desk tool is read for hours, so it needs calm density. Ask also: alone or together? In a hurry or at leisure? For the first time, or every day?

Follow-ups: How long do they look at it? What are they doing just before and just after?

**2. What emotion should remain at the end?**
Not what the product does: what the person feels when they close it. Calm, confidence, appetite, belonging, pride, wonder. Push for one word. This decides tempo, density and colour temperature more than any feature does.

Follow-ups: What emotion must it avoid? (Often more revealing: "it must not feel like a bank", "it must not feel like homework".)

**3. What must it absolutely do?**
The one or two jobs that cannot fail. Everything else is secondary and can be quieter, later or gone.

Follow-ups: If the user could only do one thing, what would it be?

**4. What can be removed?**
Ask early. Briefs accumulate sections because other sites have them. Every element removed now is one less place for a default to hide.

Follow-ups: Which sections exist only because "sites usually have them"? Which would nobody notice missing?

**5. What existing reference is closest to the intent?**
Ask for a thing, not an app: an object, a place, a printed piece, a ritual, a craft. "Like the chalkboard menu in a café." "Like a museum label." "Like a seed catalogue." These references are where images come from.

Follow-ups: What do you like about it, specifically? Its materials, its pace, its tone?

## When you cannot ask

Often you are working alone from a short prompt. Then:

1. Answer the five questions yourself, in writing, from whatever context you have.
2. Mark each answer as an assumption.
3. Show these assumptions with your first proposal, before the directions, so the user can correct the premise rather than the pixels.

A wrong assumption stated openly is cheap. A wrong assumption baked silently into eight screens is expensive.

## From answers to a meaning sentence

Write: **"[This] tells [whom] that [what], so that they [feel or do what]."** Then simplify.

Good meaning sentences:

- are about a person and a change in them, not about features;
- could not describe a competitor without lying;
- contain a tension or a promise ("allowed to arrive slowly", "small enough to know everyone");
- are short enough to remember.

Weak: "A modern platform for managing community garden plots."
Strong: "A garden that shows neighbours what is growing, so they feel it is theirs to tend."

If you produce two or three candidate sentences, that is useful: they often become the seeds of contrasting directions in step 5.

## From meaning to an image

Look for the image inside the subject's own world. Sources, in rough order of usefulness:

- **Objects of the subject.** Tools, materials, containers, documents: the seed packet, the receipt, the ticket, the jar.
- **Places of the subject.** The workshop, the counter, the threshold, the shelf, the field.
- **Rituals and gestures.** Stamping, kneading, stacking, planting, signing.
- **Time and change in the subject.** Seasons, rising dough, wear, layering, growth.
- **The printed or crafted forms the subject has produced.** Menus, almanacs, labels, notebooks, posters.

Avoid images borrowed from technology (rockets, circuits, glowing orbs) unless the subject is that technology, and avoid images so universal that they could fit anything (journeys, lightbulbs, puzzles).

## Testing an image

A good image passes all four:

1. **Specific.** You can name its materials, colours and textures.
2. **Native.** It comes from the subject, not from the visual language of software.
3. **Productive.** It answers design questions. What is the background? (The paper.) How does a new item appear? (It is stamped.) What never moves? (The ground.)
4. **Carries the meaning.** It expresses the emotion and promise of the meaning sentence, not just the topic.

If an image is on-topic but does not carry the meaning, it becomes decoration: a bakery site covered in wheat illustrations is on-topic and still generic. The image is a logic for decisions, not a motif to paste on.

## Turning the image into decisions

Walk through each design dimension and ask what the image implies.

| Dimension | Question to ask the image |
|---|---|
| Surface | What is the ground everything sits on? |
| Containers | Which things are discrete objects, and what are they made of? |
| Colour | What colours does this world actually contain? What does each mean? |
| Type | What is printed, what is written by hand, what is carved or stamped? |
| Space | Where does this world breathe? What is crowded, what is empty? |
| Motion | What moves in this world, how fast, and what is still? |
| Sound of words | How do people in this world talk? |
| What it is not | What would be absurd in this world? (This becomes the banned list.) |

Write the answers down; they become the rules of the art direction.

## Pushing the image into names

Names carry the meaning into code and into the hands of whoever comes next.

- Colour tokens named after materials or roles in the image: `--paper`, `--ink`, `--soil`, `--crust`, `--stamp`, rather than `--primary`, `--blue-500`, `--gray-100`.
- Components named after objects: `SeedPacket`, `Threshold`, `OrderSlip`, rather than `Card`, `HeroSection`, `Modal`.
- Motion named after gestures: `settle`, `stamp`, `unfold`, rather than `fadeInUp`.

Keep functional names where clarity matters more (form fields, layout primitives). The goal is meaning in the vocabulary, not a riddle.
