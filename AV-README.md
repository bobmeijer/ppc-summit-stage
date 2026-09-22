# PPC Summit 2026: stage decks

Everything runs offline in Chrome or Edge. You don't need to install anything or run a server, and no internet is required.

## Setup (once per machine)

1. Unzip `summit-stage-all.zip` to a local folder, such as the Desktop. Don't run it from inside the zip.
2. Set the projector as an **extended** display, not mirrored.
3. Open `index.html` in Chrome or Edge. You'll see a card for each block.

## Running a block

1. On the block's card, click **Presenter**.
2. In the presenter view, click **Open audience** (or press `O`).
   - If the browser asks whether the page may manage windows on all displays, click **Allow**. The audience window then opens on the projector.
   - If the pop-up is blocked, allow pop-ups for this page and click again.
3. Click once on the audience window to make it fullscreen. If it opened on the laptop screen, drag it to the projector first, then click.
4. **Click back on the presenter window.** The clicker controls whichever window is focused. Both windows work, but the presenter view is the one with the notes.
5. HTML decks keep loading for a few seconds after the audience window opens. While they load, the running order shows `(loading)` next to them.

## Keys (the clicker sends the same keys)

| Key | Action |
|---|---|
| Right, Down, PageDown, Space | Next slide or build step |
| Left, Up, PageUp | Previous |
| B or . | Black screen on/off |
| V | Replay the clip on this slide |
| O | Open audience window |
| + / - | Notes text size |
| [ / ] | Zoom the whole presenter view |
| , / > | Resize the slide column vs the notes column (or drag the bar between them; double-click it to reset) |
| L | Show or hide the running order |
| T | Restart the timer for the current talk |
| F (audience window) | Toggle fullscreen |

Click a row in the running order to jump straight to that part of the block (for example the break slide). A block runs from start to finish: speaker card, talk, then the break slide.

## Slides with video (CH4, Danique Bras)

Eight of her pages have a clip on them, and one page has four. They do not start by themselves.

- **A forward click plays the clip, with sound. It does not move to the next slide.** The click after it moves on.
- On the page with four clips they play one per click, left to right. The fifth click moves on.
- The line under the slide in the presenter view always says which one the next click will do, for example *Playing, 0:12 left, next click moves on*.
- **V** replays the clip. **B** blacks the screen and pauses the sound with it; pressing **B** again picks it up where it stopped.
- Going back a slide and forward again replays the clip from the start.
- **If that line says NO SOUND:** the audience window was never clicked. Click it once, then press **V** to replay with sound. Doing step 3 above prevents this.

Turn the room's sound on before her talk and check page 26 in rehearsal.

## Timers

The top of the presenter view shows **Current time** (Lisbon) and **Time left** for the part on stage:

- **Talks:** the countdown uses the agenda length (35 min for Day 1 talks, 20 min for CH9, 60 min for each workshop, 12 min for each case study). It starts when the speaker's deck opens, not on the speaker card.
- **Breaks and lunch:** count down to the "back at" time.
- **Colours:** amber under 5 minutes, red under 1 minute. After zero it shows **Overtime** in red.
- **Restart:** if a talk starts late after its deck is already open, press **T** or click **Restart timer**.

## If something goes wrong

- **A deck shows a blank or frozen screen:** click **Reload deck** in the presenter view, wait 5 seconds, then press Right.
- **The presenter view says "Rehearsal (no audience window)" even though the audience window is open:** press Right in the audience window once. The two windows reconnect automatically.
- **The presenter window was closed:** reopen `presenter.html` for the same block. The audience window keeps its position and reconnects.
- **Single screen fallback:** on the block card, click **Audience only** and drive that window with the clicker directly. There are no notes in this mode.
- **Close and reopen:** reopening the audience window resumes at the last slide, because the position is kept in the address bar.

Videos in decks can only play with sound after the audience window has been clicked once. That click happens in step 3 above.
