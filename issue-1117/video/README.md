# Videos, before and after

Each `.mp4` plays one example twice: first through stock abcjs 6.7.0, then through the
same build with the fix. Score, moving cursor and audio all come from the build named in
the badge at the top left.

These are meant for pasting into a GitHub comment — GitHub embeds `.mp4` inline, so the
whole before/after comparison plays in the thread.

## What the overlay shows

    5.6s   cursor ends 4.80s   audio ends 6.80s   notes sounded 26

* **cursor ends** — where the engraved timing says the phrase finishes. Correct in both
  builds; the visual path never had the bug.
* **audio ends** — where the synth actually stops. On 6.7.0 this overshoots.
* **notes sounded** — how many notes reach the audio stream. A tuplet written with `<`
  loses its last note on 6.7.0 (negative duration), so this drops.
* The red line *"cursor has finished — audio still playing"* appears during the gap.

## How they were made

Nothing is screen-recorded, so the timing is exact rather than best-effort:

1. `synth.prime()` renders the whole piece to an AudioBuffer offline — real abcjs audio
   with the real soundfont, no realtime playback — which is written out as WAV.
2. Frames are captured one at a time over the Chrome DevTools Protocol, with the cursor
   placed from `noteTimings` at exactly `frame / 20` seconds.
3. `ffmpeg` muxes frames + WAV per segment, then concatenates before + after.

The driver is `makevideo.js` (kept with the working files, not in the repo) and the page
it drives is `../_frame.html`. It needs only Chrome, ffmpeg and Node — no npm packages,
since Node's built-in `WebSocket` speaks CDP directly.

One workaround worth knowing: headless Chrome has no audio output device, so its
AudioContext stays `suspended` and `prime()` waits forever on a `resume()` that never
settles. `_frame.html` hands abcjs a context that reports `running`. `prime()` only uses
the context for `createBuffer()` and `sampleRate` — the mixing is arithmetic on
Float32Arrays — so the samples produced are unaffected.
