# Traps

Each trap below produced a real defect, in work written by two different agent tools and then
caught by a fresh reviewer or by the product owner. Each one comes from an intention or an existing
state that was misunderstood. The question under each trap is the one that would have prevented it.

## Claiming done what is not

A safety rule ("insert the text only into the open field, never into another recipient's
conversation") was announced as done in a progress note. The code never read the recipient, and a
test locked in the forbidden behaviour under a name that sounded like the rule.

A note stated "style A is chosen" with no trace of anyone choosing it.

> Can I point at the proof of each sentence I am about to write? Does this test check the rule, or
> only something that looks like it?

## Rewriting history

A decision record, historical by rule, was rewritten in place to match the new behaviour. Its own
text said it kept the original value.

> Is this document a record of the past? Then add to it; do not edit what was decided.

## Losing a guarantee in a rewrite

Rewriting a set of cards, a three-second countdown lost its minimum duration: with the system
setting that removes animations, the action fired at once. It also lost its screen-reader
announcement and its single execution, and ended up with two owners running at the same time.

> What did the old version promise, including what it never wrote down? Where is each promise in
> the new one?

## Fixing what was reported, losing what was next to it

The reported bug gets fixed, and something the code already did is lost on the way, with or
without the skill loaded. It takes three shapes:

- A function is replaced to fix its result; the old one also wrote an audit entry, and the new one
  does not.
- To stop one kind of input from failing a check, the fix exempts it, and the condition it uses
  exempts the ordinary inputs as well.
- A fix picks a new behaviour for a screen, while a decision record of that area already names the
  intended one.

The final report then mentions only the part that was asked for, so nobody sees the loss.

> What did the code I am changing do besides the bug? Where is each of those things after my
> change, and does my report name them?

## Removing something shared without finding its readers

Removing a duplicate entrance animation also removed the "card is arriving" signal that another
component read to draw a route. The route never animated again.

> Who reads what I am removing: not only who calls it, but who listens to what it produces?

## Deriving state from presentation

"We are listening to an instruction" was deduced from the text shown in a status line. At the first
word the status changed, and the screen fell back to plain dictation.

> Which typed source owns this state? Am I reading the state, or a picture of it?

## Hidden pending action

After the app was reopened, a send countdown was hidden but still running: the message left
without being visible or cancellable.

> When this surface disappears, what is still running behind it? Cancel it, or show it.

## Early exit that skips the cleanup

`cancel()` returned when its target was null, before cancelling anything: the cancel button did
nothing and the message was sent anyway.

> What does this early return skip? Do the cleanup first, then branch.

## Tests that prove nothing

Tests checked constants and surface states, never the guarantees: sent exactly once, double tap,
cancel at the wrong moment, reopen.

> If the guarantee broke, would one of these tests fail?

## A trade-off hidden in an interface change

Shortening a silence timeout to 12 seconds also cut the fallback to another speech engine, because
that delay was how a stuck engine was detected. It also changed dictation elsewhere in the app,
outside the task. It was not presented as a decision. Asked plainly, the owner accepted the risk:
what was missing was the question, not the change.

> What else did this value do? Who decides whether that loss is acceptable?

## The real platform behaves differently

- An empty text field reported its placeholder ("Message") as its text.
- A regular expression accepted by the desktop runtime was rejected by the phone's engine.
- The phone's animation scale shortened timers built on animations.
- A shell rewrote a file path, and a screen recording never started.

> What does this primitive do on the platform where it will actually run? Did I check, or assume?

## States between states

A container took the height of the taller of two contents during a transition, then dropped it: an
8 dp jump in a single frame. The outgoing content stayed touchable while fading out, and an
invisible tap erased the dictated words.

> What does the user see and touch during the transition, not only before and after it?

## Correcting an intention

A chip shown on an empty field looked like a defect. It was meant to let people give an instruction
before dictating; only its label was wrong. A fix that removed it was ready and was dropped before
being pushed.

> Did someone want this? What would the owner say if I removed it?

## Unread outputs and shared resources

- Nobody read the output of a recording command that had failed ("Must specify output file").
- A reviewer stopped the build daemon that other sessions were using.
- Two sessions installed the app on the same phone during a test, and one cleared the other's logs.

> Did I read what my command printed? Is this device, daemon or log mine alone?

## Patching the symptom or inventing data

- A UI failed to refresh across in-page tabs because an object was mutated in place instead of
  receiving a new reference. A fix added a 2-second polling loop with synchronisation signatures
  and introduced race conditions — while the real fix was one line.
- An absurd numeric input overflowed a database column. The fix widened 18 columns across two
  modules instead of distinguishing an invalid input from an out-of-range measurement.
- A chart tab stayed hidden when a device had no history yet. The fix copied the current reading
  into the history array, fabricating a zero standard deviation and plotting the same point twice,
  while hiding a deeper query filter bug.

> What is the actual root cause in the existing code? Am I fixing the cause, or making the symptom
> disappear by inventing data or looping around it?

## Generic changes without field semantics

- A single shared database domain was applied to 18 fields, turning integer measurements into
  decimals and reverting an earlier precision decision.
- A shared display helper rounded every number to two decimal places, formatting card IDs with
  trailing decimals because their legacy column type was a decimal amount.
- A layout fix targeted a shared tab container selector, changing the layout of every tab in the
  screen without visual verification.

> Does this shared type, helper, component, or selector carry different meanings across its
> callers? Confirm scope before changing a shared surface.

## Taking an ambiguous or AI-reworded ticket literally

"Real-time updates across tabs" (reworded by an assistant) referred to in-page workflow tabs, not
browser tabs — and turned into server polling. "Fix it on all fields" turned into a single generic
type for unrelated quantities.

> Does the literal wording match how the system actually works, or is it a shorthand for a simpler
> goal?

## Accepting a broken data model silently

A fix worked around an identifier stored as a decimal amount, or omitted a status tag missing from
the data model, without mentioning the underlying defect. The workaround shipped and locked in the
confusion.

> Did I spot a model mismatch or missing concept while implementing? Fix it if in scope, or flag
> it explicitly in the report instead of hiding it.

## Reading an existing test as the specification

A review demanded "no chart for a channel without data" because an older coverage test asserted
it, while the spec required four charts and the product owner wanted the device always shown.
Another test asserted "record unchanged" while that very rule was still an open question with the
client.

> Where does this test come from, and what decision does it encode? If the ticket, spec, or
> requested correction says otherwise, the test is what changes — and the report says so.

## Concluding from one source

- Asked "how did we do it on the sister project?", an agent answered "the same" after reading only
  the internal repository; the fix existed only in the copy delivered to the client.
- A green test read a folder outside its module that the delivered repository did not contain.
- An action link was judged "visible to everyone" from the spec of the tab showing it, without
  checking that the target page was restricted to another role.

> How many places govern this (repositories, environments, code paths, target permissions)? Which
> ones did I actually read, and which ones did I not?

## Diagnosing the code before checking what runs

A bug reported "still broken" after a merge was tested on a staging environment deployed half an
hour before that merge. Another check ran against the shared test server when "dev" meant the
local branch.

> Which commit is actually running where this was observed? When a word names two things (`dev`,
> `staging`, `the release`), which one is meant?

## One rule, several copies

A rule was computed on page load (in five places) and forgotten in every user action; one domain
concept had four slightly different definitions; a field was formatted three ways across three
screens, one of them wrong.

> Where else is this rule, field, or concept computed? Does my change leave one shared place, or
> add another copy?

## Defending a first reading

After the owner picked another option, the agent recommended its own again; asked to edit
directly, it opened a branch and worktree by reflex; it proposed only a structural overhaul when a
simple reversible fallback existed.

> Have I stated my view once, with its risk and the simplest reversible option? Once the owner
> decides, execute what was chosen.

## The same traps outside code

- **Document**: a status page listing as done what was only planned; a summary that drops the
  condition a decision depended on.
- **Research**: citing a source not actually read; reporting a number without its date or scope.
- **Review**: accepting a test because its name matches the rule; reviewing the description
  instead of the diff.
- **Design**: replacing a deliberate oddity with the usual default; a mock-up that drops a state
  the current screen handles (empty, error, pending).
