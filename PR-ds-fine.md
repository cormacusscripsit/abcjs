# Upstream pull request: D.S., D.C. and Fine in playback — not yet raised

The fix in this fork's `v6.7.0-tuplet.10` (patch 8 in `FORK.md`) answers
[paulrosen/abcjs#782](https://github.com/paulrosen/abcjs/issues/782), "segno/fine don't repeat the
measures", open since May 2022. The maintainer replied there: "I'd like to! It is on my list of
improvements. But no, not at the moment." **The pull request has not been raised.** This is how.

## Before raising it

- **#1188 is still unanswered.** Our first pull request,
  [paulrosen/abcjs#1188](https://github.com/paulrosen/abcjs/pull/1188) (the tuplet duration fix),
  was opened 2026-09-15 and has had no comment or review as of 2026-10-24. A second one from the
  same fork may get the same silence, or may be a reason to look at both. It is a judgement call
  whether to wait; there is no technical reason to.
- Check #782 for anything new (a comment, a linked pull request, a fix on `dev`):
  `https://api.github.com/repos/paulrosen/abcjs/issues/782/comments` needs no login.
- Check that upstream `dev` has not moved under the change: `git fetch origin`, then rebase
  the branch below onto `origin/dev` and run the tests again (below).

## The branch

`fix/ds-fine-playback-dev` (commit `3c10a625`, local in `~/git/abcjs`, **not pushed**): the same
change as `fix/ds-fine-playback`, made on upstream `dev` (`2e399a65`, "Prepare 6.7.2 release"), with
only the `require` lines and the test list cut down to what `dev` has (it does not have the fork's
other patches). Checked on `dev`: the 26 new tests pass, and `tests/all.html` has the same 20
failures in headless Chromium as clean `dev` (236 passing before, 262 after).

## Steps

```sh
cd ~/git/abcjs
git fetch origin
git switch fix/ds-fine-playback-dev        # or its worktree, .worktrees/ds-fine-dev
git rebase origin/dev                      # if dev has moved; resolve, re-run the tests
git push fork fix/ds-fine-playback-dev
```

Then open the pull request on GitHub: base `paulrosen/abcjs` **`dev`** (as #1188 is), head
`cormacusscripsit/abcjs` `fix/ds-fine-playback-dev`. Title and body below. After it is open,
add its number to `FORK.md` patch 8, the way patch 1 names #1188.

To run the tests: `tests/all.html` served from the repository root, with `node_modules` in place
(`npm ci`, or a link to a checkout that has it), opened in a browser, or headless as described in
the commit message of `989d30c5`.

## Title

Play D.S., D.C. and Fine: back to the segno or the start, on to the Fine

## Body

Fixes #782.

`!D.S.!`, `!D.C.!` (and `!D.S.alfine!`, `!D.C.alfine!`) are drawn but not played: the audio and the
cursor go straight through to the end, so a piece whose refrain returns after each verse plays the
refrain once.

With this change both the audio (`setUpAudio`, and so the synth and MIDI) and the timing
(`setTiming`, and so `TimingCallbacks` and the cursor):

- go back, at the end of the bar that carries the D.S. or D.C., to `!segno!` (or the start);
- stop at the end of the bar that carries the first `!fine!` after that point, or play to the end;
- take every voice back, though the marks are usually written in one voice: the marks are found
  by time across all the voices (`src/data/navigation.js`, shared by the two layers);
- on the way back, do not take repeats again, and play only the last of a set of endings;
- bring back the key or meter in force at the segno.

Not handled, and still played as written: the "al coda" forms and `!coda!`, a D.S. with no segno,
and a Fine with no D.S. or D.C. I'd be glad to add coda handling in the same shape if you want it.

Tests: `tests/synth/navigation.test.js`, 26 cases, each stating every track's notes in order and the
cursor's events; 15 fail without the change. The rest of `tests/all.html` is unchanged.

(Our earlier pull request, #1188, is still open — the tuplet duration fix — in case it's useful to
look at the two together.)
