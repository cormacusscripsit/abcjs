# MIDI files, before and after

One `.mid` per example on the demo page, generated from both builds via
`abcjs.synth.getMidiFile(abc, {midiOutputType: "binary"})`. The numbers match the
numbering on the page. Play the `--before` and `--after` pair of any example in any
MIDI player to hear the difference without needing the page or a browser.

Examples 2 and 3 are the controls, and they produce **byte-identical** files — that is
the fix leaving alone what already worked:

    DIFFERS     01-a-broken-rhythm-inside-a-triplet  (345b / 345b)
    IDENTICAL   02-the-same-phrase-even-triplets
    IDENTICAL   03-the-same-phrase-broken-on-notes-2-and-3
    DIFFERS     04-the-same-phrase-with-instead-of  (339b / 345b)
    DIFFERS     05-no-broken-rhythm-at-all-just-a-longer-first-no  (252b / 252b)
    DIFFERS     06-the-reporter-s-second-example-over-a-drone  (259b / 259b)
    DIFFERS     07-exactly-as-reported-in-issue-1117  (370b / 370b)

Check it yourself:

    for f in *--before.mid; do a="${f%--before.mid}--after.mid"
      cmp -s "$f" "$a" && echo "IDENTICAL $f" || echo "DIFFERS   $f"; done

Example 4 is six bytes shorter on 6.7.0 because the last note of each triplet gets a
negative duration and never makes it into the file — you hear two notes per triplet
instead of three.
