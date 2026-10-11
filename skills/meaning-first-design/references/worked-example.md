# Worked example: a community garden

A complete pass through the workflow on a fictional subject: the website of a small neighbourhood association that runs a shared garden, here called the Alder Street Garden. The association, its members and its details are invented.

## Contents

1. The generic first draft
2. Context questions and answers
3. Meaning and image
4. Art direction (chosen direction)
5. Two directions, one key screen each
6. Self-review: what was removed
7. What to take from this

---

## 1. The generic first draft

The brief was "a website for our community garden". The first draft, produced with no meaning in mind:

- A hero with a green-to-teal gradient, the headline "Grow Together. Unlock Your Green Potential." and a pill above it reading "COMMUNITY GARDEN".
- Three white rounded cards with soft shadows: Community, Sustainability, Events, each with a line icon in a mint rounded square.
- A stats band: "+250 members", "98 % satisfaction", "1,200 kg harvested".
- A testimonial carousel with stock portraits.
- A "Join now" button in a gradient pill, repeated three times.
- Poppins throughout, bold headings, regular body. Every section fades in upwards on scroll.

Nothing in it is wrong, and nothing in it is the Alder Street Garden. Replace the word "garden" with "coworking space" and almost every element still works. That is the diagnosis.

## 2. Context questions and answers

**Who looks at it, and where?**
Mostly neighbours on a phone, often standing at the garden gate after seeing the address on the sign, sometimes members at home checking who waters this week. Many are over sixty. Some see it on the committee's laptop at the monthly meeting.

**What emotion should remain at the end?**
Belonging: "this is ours, and I could be part of it". It must not feel like a company or a charity appeal.

**What must it absolutely do?**
Show what is happening in the garden this week (watering rota, the next workday, what is ready to pick or share), and let a neighbour ask for a plot.

**What can be removed?**
The statistics (invented anyway), the testimonials, the sustainability section (the garden shows it; no need to argue it), the newsletter pop-up, the team photo grid.

**What existing reference is closest?**
The noticeboard on the shed door: a hand-drawn plan of the plots, a watering rota on a sheet of paper, notes like "Courgettes on plot 4, help yourselves". Also the printed planting calendar the oldest member brings each spring.

## 3. Meaning and image

**Meaning sentence:**
"The Alder Street Garden shows its neighbours what is growing this week, so they feel it is theirs to tend."

**Candidate images:**

- **The shed door.** The noticeboard where the garden's life is pinned: the plot plan, the rota, notes between members.
- **The almanac.** A printed seasonal calendar: what to sow, tend and pick, week by week.

Both are native to the subject, specific and productive. They lead to the two directions below.

## 4. Art direction (chosen direction: The shed door)

> The site is the shed door, seen from the path. The plot plan is the centre of everything: neighbours find the garden by finding its plots. Members' notes are pinned around it in their own words. The page is quiet and weathered, never shiny, and it changes every week like the real board does.

**Type**
- "The painted sign": a sturdy, slightly wide sans, used for plot numbers, the garden name and section headings.
- "The note": a plain, highly legible face for all reading text. Handwriting is not simulated with a script font; notes feel handwritten through their words and their placement, which stays legible for older readers.

**Colour**
- `--board`: a warm, muted grey-brown. The ground of every page.
- `--paper`: off-white. Only for pinned notes and the rota sheet, the things that are actually paper on the door.
- `--pencil`: dark graphite. All text and the lines of the plot plan.
- `--pin`: one saturated colour. Marks only what is happening this week. Never used for buttons, decoration or alerts.
- No green "nature" accent: the plants are in the photos, not in the interface.

**Space and form**
- The plot plan sits alone at the top with generous space around it.
- Notes are the only containers. Nothing else is boxed.

**Motion**
- A new note settles into place once, short and soft, as if pinned.
- The plan never moves. No parallax, no scroll reveals.
- Reduced motion: notes simply appear.

**Voice**
- First person plural, neighbourly, short sentences. "We water at seven." not "Watering sessions are scheduled daily."
- Buttons say what happens: "Ask for a plot", "I'll water on Thursday".
- Errors: "That didn't send, the connection dropped. Your message is still here."

**Banned for this project**
- Gradients and leaf illustrations: they say "eco brand", not "our garden".
- Statistics and testimonials: neighbours trust what they can see this week.
- Wood-grain textures and kraft-paper backgrounds: the obvious "rustic" cliché, and heavy on phones.
- Red for removing yourself from the rota: stepping back is normal, not dangerous.

## 5. Two directions, one key screen each

Both were shown as a single phone home screen before anything else was built.

### Direction A: The shed door

The screen opens on the plot plan, drawn in fine graphite lines on the warm board colour: twelve plots, the shed, the water butt, the gate. Two plots carry a small `--pin` mark. Below, three notes on off-white paper, slightly irregular in alignment: "Courgettes ready on plot 4, help yourselves", "Workday Saturday 10:00, bring gloves", "Thanks to whoever fixed the gate". Then the rota as a simple list of days and first names, this week only. At the bottom, one sentence and one action: "Two plots are free this spring. Ask for a plot." No header navigation beyond the garden's name and a menu.

### Direction B: The almanac

The screen is a single printed page for this week: "Week 16, mid-spring" set large at the top, a thin band showing where the week sits in the season. Three short lists under plain headings: To sow, To tend, To pick, each item one line. The workday appears as a dated line in the same list. A book-like serif for reading, wide margins, a single accent for what can be picked now. The plot request is a line at the foot of the page, like a note in the margin.

### The choice

The committee chose A. The plot plan made people point at their own plot, which is exactly the feeling of ownership the meaning asks for. From B they kept one idea: the "To pick" list, added under the notes in A's language.

Note why B's serif was proposed: a printed almanac really is set in a book face. It was a reason, not a habit. In A, the same serif would have had no reason, so it does not appear.

## 6. Self-review: what was removed

After building the chosen direction, the self-review removed:

- **A legend box under the plot plan.** Labels now sit directly on the plots; the legend repeated them.
- **Hover lift on notes.** Paper pinned to a door does not rise. Notes are not clickable unless they link somewhere.
- **A second accent colour** that had crept in to distinguish events from harvests. `--pin` alone marks "this week"; the words say what kind of thing it is.
- **A duplicate "Ask for a plot" button in the header.** One action, at the moment the visitor has seen the garden.
- **A wood-grain background image** that was tried "for warmth". Flat `--board` is warmer on a phone and loads instantly.
- **A green success toast from the component library.** Replaced by a pinned note in the page's voice: "Thanks. Your name is on the list; someone from the garden will write to you within a week."
- **The red "Remove me" button on the rota.** Now a plain text action, "I can't make Thursday", with an undo.

The system-leak hunt found two hard-coded greys in the rota component and the framework's default blue focus ring; both now use the tokens (`--pencil` for lines, `--pin` for focus).

The care pass added a designed empty state for weeks with no notes ("Nothing pinned yet this week. The rota is below."), checked the plan's labels at the smallest phone width, and made the "Ask for a plot" form a bottom sheet with safe-area padding.

## 7. What to take from this

- The generic draft failed the swap test; the final design does not, because its central element (the plot plan) can only belong to this garden.
- Most of the improvement came from removal: stats, testimonials, cards, gradients, badges, a second accent, a duplicate button.
- The obvious "rustic" look was itself a cliché and was banned. The warmth comes from the content, the plan and the voice.
- Every rule traces back to one sentence about neighbours and what is growing this week.
