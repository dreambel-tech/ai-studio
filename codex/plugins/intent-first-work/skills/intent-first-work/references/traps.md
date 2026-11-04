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

## The same traps outside code

- **Document**: a status page listing as done what was only planned; a summary that drops the
  condition a decision depended on.
- **Research**: citing a source not actually read; reporting a number without its date or scope.
- **Review**: accepting a test because its name matches the rule; reviewing the description
  instead of the diff.
- **Design**: replacing a deliberate oddity with the usual default; a mock-up that drops a state
  the current screen handles (empty, error, pending).
