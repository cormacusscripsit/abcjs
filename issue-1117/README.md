# issue #1117 — tuplet duration A/B demo

`index.html` plays each example twice: once through stock abcjs 6.7.0 and once through the
same build with the fix in `src/synth/abc_midi_sequencer.js`. Both panels render, play and
drive their own cursor with their own bundle, so what you hear and what you see both come
from the build named on the panel.

## Run it

    npx http-server -p 8181 -c-1
    open http://127.0.0.1:8181/issue-1117/index.html

Audio needs network access — abcjs fetches its soundfont from `paulrosen.github.io`.

## What to listen for

Each example is a two-voice phrase: a melody in thirds and fifths on the treble staff over a
root-and-fifth bass line on the bass staff that keeps steady time. On the left the melody
drifts off that bass and never recovers; on the right the two stay locked. The red cursor on
the left also finishes the phrase while the audio is still sounding.

The two examples marked **Control** are the same melody written without the broken rhythm.
They must sound identical on both sides — that is the fix not touching what already worked.

## Videos

`video/` holds before/after `.mp4` files for the most useful examples, rendered from this
page with real abcjs audio and an exact cursor. GitHub embeds mp4 inline, so they can be
pasted straight into an issue comment. See `video/README.md`.

## MIDI files

`midi/` holds a `.mid` per example from both builds, numbered to match the page. The two
control examples produce byte-identical files. See `midi/README.md`.

## Rebuilding the bundles

`abcjs-before.js` and `abcjs-after.js` are checked-in build artifacts. To regenerate:

    # after (with the fix in the working tree)
    npm run build:basic && cp dist/abcjs-basic.js issue-1117/abcjs-after.js

    # before (stock)
    git stash push src/synth/abc_midi_sequencer.js
    npm run build:basic && cp dist/abcjs-basic.js issue-1117/abcjs-before.js
    git stash pop
    git checkout dist/            # the build overwrites the committed dist files

## Evidence

`evidence/` holds captured runs of `tests/all.html` in a real browser, against unmodified
upstream source (the new tests fail) and with the fix applied (they pass), plus a
before/after comparison of every failing test name in the whole suite. See
`evidence/README.md`.

To run the new tests yourself, open `tests/all.html` the usual way — they need no
special setup:

    npx http-server
    open http://127.0.0.1:8080/tests/all.html
