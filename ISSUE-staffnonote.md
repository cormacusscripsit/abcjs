# Upstream issue text — paulrosen/abcjs

Ready to paste into <https://github.com/paulrosen/abcjs/issues/new>. Everything
below the line is the issue body; the title is above it. **Not filed** — that is
the owner's call.

The fix applies cleanly to upstream `dev` (`2e399a65`, *Prepare 6.7.2 release*):
branch `fix/staffnonote-audio-dev` in `~/git/abcjs` (local, not pushed), and the
same commit as `0001-staffnonote-audio-dev.patch` beside this file. On `dev`, the
new tests fail 14 of 29 without it and pass with it; the rest of
`tests/all.html` is unchanged (the same 20 failures with and without, all
pre-existing in this headless environment).

**Title:** `%%staffnonote 0`: a hidden staff's voice is dropped from the audio and the timing, so voices swap tracks and the cursor jumps

---

**Version:** 6.7.0. Also present on `dev` at 6.7.2 (checked 2026-10-21).

### Summary

`%%staffnonote 0` hides a staff on any line where it has no notes. The notation
is right. The audio and the timing are not: on every line after the first
hidden staff, voices are assigned to the wrong tracks, a voice that was hidden
loses the time of the lines it was hidden on, and the cursor (`TimingCallbacks`
/ `noteTimings`) jumps between lines.

### Minimal reproduction

```abc
X:1
M:4/4
L:1/4
%%score Solo [(S A) (T B)]
%%staffnonote 0
V:Solo clef=treble name="Solo"
V:S clef=treble name="Soprano" snm="S"
V:A clef=treble name="Alto" snm="A"
V:T clef=bass name="Tenor" snm="T"
V:B clef=bass name="Bass" snm="B"
K:C
[V:Solo] c2d2 | g4 |
[V:S] X | X |
[V:A] X | X |
[V:T] X | X |
[V:B] X | X |
[V:Solo] X | X |]
[V:S] e2d2 | c4 |]
[V:A] cBAG | G4 |]
[V:T] G2F2 | E4 |]
[V:B] C,E,F,G, | C,4 |]
```

A solo, then a four-part answer. With `%%staffnonote 0` the first line draws
only the solo's staff and the second only the two choir staffs, as intended.

| | without `%%staffnonote` | with `%%staffnonote 0` |
|---|---|---|
| `setUpAudio().tracks` | 5 tracks: Solo 0–1, S, A, T, B each 2–3 | **4 tracks**: Solo's track also holds the soprano (0–3); alto, tenor, bass start at **0**, under the solo |
| `setTiming()` events (ms@line, ♩=60) | `0@0 2000@0 4000@0 8000@1 9000@1 10000@1 11000@1 12000@1` | `0@0 1000@1 2000@0 3000@1 4000@0 8000@1 10000@1 12000@1` — the cursor jumps between the lines |

A staff empty on a *middle* line only (present before and after) gives the
same kind of fault: its later notes come in early by the hidden line's length.

### Cause

`src/parse/tune-builder.js`, `cleanUp`: `%%staffnonote` is implemented by
**deleting** the empty staffs from `tune.lines[n].staff`. Two readers then
follow a voice through the tune by its position on each line:

- **the sequencer**, `src/synth/abc_midi_sequencer.js`: `voiceNumber` counts
  the voices of `line.staff` from 0 on every line. On the second line above,
  the soprano is voice 0 — the solo's track — and the alto is voice 1, the
  track the soprano should have, which has had no time added for the first
  line;
- **the timing layer**, `makeVoicesArray` in `src/data/abc_tune.js`: the
  same, over `engraver.staffgroups[].voices`.

What counts as "no notes" is `containsNotesStrict`: anything but rests, so a
staff of visible `z` rests is hidden too, not only `X`/`x`.

### Fix

Keep the hidden staff out of `line.staff`, so nothing that draws changes, but
keep it in `line.hiddenStaffs` with its position. A small helper
(`src/data/all-staffs.js`) puts it back in order for the two readers:

- the sequencer plays the hidden staff's rests, so every voice keeps its own
  track and its own time — the same notes as without the directive;
- `makeVoicesArray` matches each drawn voice to its tune voice by its position
  among all the staffs, and gives a hidden voice its rests, bars and tempo
  marks as elements that take their time but make no event — nothing is drawn
  there for the cursor to point at.

Without any hidden staff both run exactly the code they run today. The SVG is
byte-identical to before for every case in the tests.

Considered and rejected: keeping hidden staffs in `line.staff` with a flag for
the engraver to skip. Every consumer of `tune.lines` would then see staffs that
are not drawn, and the timing reads the engraved groups rather than
`line.staff`, so it would need this mapping anyway.

Tests: `tests/synth/staffnonote.test.js` — alternating voices, shared staffs,
a gap on a middle line, `z` rests, triplet rests, a tempo change and repeats on
a hidden staff, `%%maxstaves`; and no change with no directive, with
`%%staffnonote 1`, and with every staff in use. Each asserts the staffs drawn
per line, the tracks, and the timing events, against the same tune without the
directive.

### Not fixed, same shape

These also identify a voice by its position on the line, so they go wrong the
same way when `%%staffnonote` removes a staff. Each is notation-side or a
separate API, and none is touched by the fix:

- the engraver's cross-line state (`AbstractEngraver.getCurrentVoiceId`,
  `"s" + s + "v" + v`): ties, slurs, endings, `%%voicescale` and voice colour
  carried into the next line attach to whichever voice is now at that position;
- the parser's `cleanUpSlursInLine(voice, staffNum, voiceNum, …)`;
- the tablature instrument for each staff (`tablature: [...]` is applied by
  staff position, so a hidden staff shifts every later staff's tablature);
- `tune.deline()`, which merges lines staff by staff.

Separately, a line on which **every** staff is hidden crashes the renderer
(`addStaffPadding`, *Cannot read properties of undefined (reading 'top')*),
before and after the fix.
