# Evidence for the #1117 fix

Captured runs of **the project's own test page**, `tests/all.html`, in a real browser —
first against unmodified upstream source, then with the fix applied. Nothing here needs to
be shipped, and nothing here adds a dependency to the project: the tests are ordinary
additions to `tests/all.html` and run exactly the way every other abcjs test does.

| file | what it shows |
|---|---|
| `01-before-fix-7f637619.txt` | The two new test files added to a clean checkout of `7f637619`, nothing under `src/` touched. **238 passing, 30 failing** — with the 10 relevant failures quoted in full. |
| `02-after-fix-7f637619.txt` | Same page, same checkout, `fix.patch` applied and nothing else changed. **248 passing, 20 failing.** |
| `03-failure-diff-7f637619.txt` | Every failing test name from both runs, compared: **10 fixed, 0 regressions, 20 pre-existing and identical.** |
| `fix.patch` | The one-file diff applied between run 01 and run 02. |

## How these were produced

A detached worktree at `7f637619` with only the patch's test files added:

    git worktree add --detach /tmp/stock HEAD
    ln -s "$PWD/node_modules" /tmp/stock/node_modules
    cp tests/synth/tuplet-duration.test.js tests/synth/tuplet-midi.test.js /tmp/stock/tests/synth/
    cp tests/all.html /tmp/stock/tests/all.html

    cd /tmp/stock
    git status --short            # confirms nothing under src/ is modified
    npx http-server -p 8282 -c-1

then the page in headless Chrome, once before and once after `git apply fix.patch`:

    'Google Chrome' --headless=new --virtual-time-budget=120000 \
        --dump-dom http://127.0.0.1:8282/tests/all.html

`tests/all.html` loads abcjs from `../index.js` via Tarp.require, so it runs the source
tree directly — no build step, and the patch takes effect immediately.

`src/synth/abc_midi_sequencer.js` is byte-identical at the 6.7.0 release commit
(`4006ea06`) and at `7f637619`, so run 01 is against the released code:

    $ git diff 4006ea06 HEAD -- src/synth/abc_midi_sequencer.js
    (empty)

## The failures, on unmodified 6.7.0

    (3G>FE| note durations: expected '0.125000 0.041667 0.208333'
                            to equal  '0.125000 0.041667 0.083333'

    (3G<FE| note durations: expected '0.041667 0.125000 -0.041667'   <- negative
                            to equal  '0.041667 0.125000 0.083333'

    (3G>FE z2 C2 D2| note ticks: expected '0+240 240+80 320+400 1200+480 1680+480'
                                 to equal  '0+240 240+80 320+160 960+480 1440+480'

    (3G<FE z2 C2 D2| note ticks: expected '0+80 80+240 720+480 1200+480'
                                 to equal  '0+80 80+240 320+160 960+480 1440+480'
                                 (6.7.0 emits four notes, not five)

    (3G>FE|: triplet is the wrong length: expected 720 to equal 480
    (3G>FE z2 C2 D2|: the note after the triplet moved: expected 1200 to equal 960
    the voices end at different times: expected [ 1.25, 1 ] to deeply equal [ 1, 1 ]

Ticks are MIDI file ticks, 480 to the quarter note.

## About the 20 pre-existing failures

They are visual suites that compare exact glyph geometry (`selection-*`, `font-box`,
`measure-numbers`, `transpose-*`, …) plus `tests/parse/voices-array`. They fail on this
machine with and without the fix, identically — `03-failure-diff-7f637619.txt` lists them.
They are almost certainly font-rendering differences between this machine and the
maintainer's, and have nothing to do with tuplet timing.

## What ships

    src/synth/abc_midi_sequencer.js     the fix
    tests/synth/tuplet-duration.test.js new
    tests/synth/tuplet-midi.test.js     new
    tests/all.html                      registers the two new files

No new dependencies, no new tooling, no build step.
