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
| O | Open audience window |
| + / - | Notes text size |
| [ / ] | Zoom the whole presenter view |
| , / > | Resize the slide column vs the notes column (or drag the bar between them; double-click it to reset) |
| L | Show or hide the running order |
| T | Restart the timer for the current talk |
| F (audience window) | Toggle fullscreen |

Click a row in the running order to jump straight to that part of the block (for example the break slide). A block runs from start to finish: speaker card, talk, then the break slide.

## CH4, Danique Bras: her own deck, not this bundle

**Her talk is the one part of the day that does not run from these files.** She presents from her own Google Slides, because the clips are embedded in it and play from there.

In the running order her session shows as **"Danique's own Google Slides (not in this bundle)"**. Open that row and the full instructions are in the notes panel, with the link. The audience screen goes black there on purpose: that is the cue to switch the projector to her deck, not a fault.

1. When CH3 finishes and Sam introduces her, the speaker card is the last slide this bundle shows.
2. Click the row after it. The notes panel gives you the link: open it in Chrome, then **Slideshow, then Presenter view**.
3. Slideshow on the projector, her presenter view on the desk screen.
4. **This is the only part of the day that needs internet.** Load her deck before the block starts, not at 11:40.
5. **Check the room's sound before she starts.** Her clips have audio; page 26 is the first one.
6. When she finishes, come back to this window and press Right for the lunch slide. The talk timer in the top bar keeps running while she is on, so it still tells you where she is against her 35 minutes.

Her PDF is the backup if her deck will not open: `day-1/ch4-stand-out-as-a-human/deck.pdf` on the shared Drive. It has no video, so the clip pages are stills.

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
