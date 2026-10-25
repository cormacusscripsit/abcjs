# About this fork

This is a fork of [paulrosen/abcjs](https://github.com/paulrosen/abcjs). It exists to carry
a few patches until they are upstream. It is **not** a long-lived divergence and should be
deleted once the pull requests land.

## The patches

What `v6.7.0-tuplet.10` carries on top of upstream's 6.7.0 release, oldest first:

1. The tuplet duration fix, below — upstream PR #1188.
2. Dropping the dead `docs/.vuepress/dist` submodule, so the fork installs at all.
3. The grace-note rule: graces take a choice of duration (`ebecc5af`), capped by fraction as
   well as by milliseconds (`9c675905`).
4. The tempo-mark glyph name `flags.u16nd` → `flags.u16th` (`d469cce7`).
5. `%%staffnonote 0` audio and timing (`fix/staffnonote-audio`): a staff hidden because it has
   no notes on a line is still played, and still takes that line's time. Upstream issue text
   in `ISSUE-staffnonote.md`, not yet filed.
6. Tie state at endings kept per voice (`fix/ending-ties`): each voice's `:|[2` put back every
   voice's tie state as it was at the last `[1` any voice reached, so a tie an upper voice had
   opened in its second ending was lost: the note across the line break had no end, and the
   tie was drawn edge to edge across that line.
7. Whole-bar rests and meter changes (`fix/inline-meter-rest`): a rest written as a whole
   note fills its bar, but the bar length came from the last `M:` line, never an inline `[M:]`,
   so `[M:4/4] … | z8 |` in a 5/8 tune gave a 5/8 rest and "Duration not representable". A bar
   rest `Z` was worse: its length came from the tune's *first* meter, whatever followed. Both
   now use the voice's inline meter, else the last `M:` line. And `Z` in a 5/8 or 7/8 bar is
   no longer warned "not representable": a bar rest is one sign whatever its length.
8. D.S., D.C. and Fine in playback (`fix/ds-fine-playback`): `!D.S.!`, `!D.C.!` and their `alfine`
   forms were drawn but never played. Now the audio and the cursor go back to `!segno!` (or the
   start) at the end of the bar that carries the jump, and stop at the end of the bar that carries
   the first `!fine!` after that point. A mark in one voice takes every voice back; on the way back
   repeats are not taken and only the last ending of a set is played. The `alcoda` forms and
   `!coda!` are still played as written. Upstream issue
   [paulrosen/abcjs#782](https://github.com/paulrosen/abcjs/issues/782) (open since 2022; the
   maintainer: "on my list of improvements").

### The tuplet duration fix

A tuplet's total duration was extrapolated from its first note, which is only correct when
every note in the tuplet is written the same length. `(3G>FE`, `(3G<FE` and `(3G2FE` all
came out wrong, and the error landed on the last note of the tuplet, pushing everything
after it late. Audio and MIDI only — notation and the cursor were always correct.

* Issue: [paulrosen/abcjs#1117](https://github.com/paulrosen/abcjs/issues/1117)
* Pull request: [paulrosen/abcjs#1188](https://github.com/paulrosen/abcjs/pull/1188)
* Before/after demo: <https://cormacusscripsit.github.io/abcjs/issue-1117/>

## Branches

| branch | base | purpose |
|---|---|---|
| `fix/1117-tuplet-duration` | upstream `dev` | The pull request. One commit. **Never rewrite this** — it is what the maintainer reviews, and it is the source of the cherry-pick below. |
| `deploy/6.7.0-tuplet` | upstream `main` (the 6.7.0 release) | Upstream's release, the tuplet fix, and the removal of a dead submodule that breaks npm git installs. Tag `v6.7.0-tuplet.2`. **No longer what our projects install** — it stops at `.2`. |
| `tuplet-3` | `deploy/6.7.0-tuplet` | An earlier line of the grace rule. Tags `.3` and `.4`. Superseded by `grace-rule`; kept because the tags are published. |
| `grace-rule` | `deploy/6.7.0-tuplet` | The grace rule, the tempo glyph fix, this file. Tags `.5` and `.6`. |
| `fix/staffnonote-audio` | tag `v6.7.0-tuplet.6` | `.6` plus the `%%staffnonote` fix. Tag `v6.7.0-tuplet.7`. |
| `fix/ending-ties` | tag `v6.7.0-tuplet.7` | `.7` plus the per-voice tie state at endings. Tag `v6.7.0-tuplet.8`. |
| `fix/inline-meter-rest` | tag `v6.7.0-tuplet.8` | `.8` plus the whole-bar rest after an inline meter. Tag `v6.7.0-tuplet.9`. |
| `fix/ds-fine-playback` | tag `v6.7.0-tuplet.9` | `.9` plus D.S., D.C. and Fine in playback. Tag `v6.7.0-tuplet.10`. |
| `gh-pages-1117` | orphan | The demo page published to GitHub Pages. Not mergeable anywhere; exists only to be served. |
| `main` | upstream `main` + this file | Fork landing page. Deliberately one commit ahead of upstream so this note is visible. |

## Consuming the deploy branch

Pin a **tag**, never the branch — a branch reference means a later `npm install` silently
picks up whatever has been pushed since.

```json
"abcjs": "https://github.com/cormacusscripsit/abcjs/archive/refs/tags/v6.7.0-tuplet.10.tar.gz"
```

The tags are not all on one branch (see the table above): find the newest with
`git tag -l 'v6.7.0-tuplet.*'` and `git branch -a --contains <tag>`, not by reading one branch.
**Never delete or move a published tag** — make a new one. `v6.7.0-tuplet.1` was replaced once,
and every clean install of the projects pinning it answered 404 for weeks.

A tarball URL is preferred over `github:cormacusscripsit/abcjs#v6.7.0-tuplet.2`: it needs no
git and no credentials, so it works the same in CI and in Docker, and npm records an
integrity hash for it in the lockfile. Both forms work from `v6.7.0-tuplet.2` onward.

> **`v6.7.0-tuplet.1` is broken for `github:` installs** and should not be used. Upstream
> carries a submodule `docs/.vuepress/dist` whose commit (`3ec1b3ab`) is no longer reachable
> in `paulrosen/abcjs`. npm clones submodules recursively, so a git install fails with
> `upload-pack: not our ref 3ec1b3ab`. `v6.7.0-tuplet.2` drops that submodule.

No build step is needed. `package.json` `main` points at `index.js` (ES5 source), so a
bundler compiles it directly; the committed `dist/` bundles are not used by that path.
There is no `prepare` script, so npm does not build on install either.

## Refreshing onto a new upstream release

Rebuild the branch rather than merging into it — that keeps it a clean one-commit delta
instead of accumulating merge history.

```bash
git fetch origin                          # origin = paulrosen/abcjs
git checkout deploy/6.7.0-tuplet
git reset --hard origin/main              # or a release tag
git cherry-pick fix/1117-tuplet-duration  # re-apply the fix

# drop the dead submodule again, or "github:" installs of the fork will fail
git rm -q --cached docs/.vuepress/dist && git rm -q .gitmodules
rmdir docs/.vuepress/dist 2>/dev/null
git commit -q -m "Drop the dead docs/.vuepress/dist submodule"
npx mocha ...                             # or open tests/all.html and check the tuplet suites
git push --force-with-lease fork deploy/6.7.0-tuplet
git tag v6.7.1-tuplet.1 && git push fork v6.7.1-tuplet.1
# then verify: npm i https://github.com/cormacusscripsit/abcjs/archive/refs/tags/v6.7.1-tuplet.1.tar.gz
```

Then bump the pin in the consuming project to the new tag.

If the cherry-pick conflicts, upstream has touched the same code — check whether the fix is
still needed before resolving it.

## When the PR is merged

1. Wait for a release containing it.
2. In each consuming project, replace the git pin with the normal npm range.
3. Delete `deploy/*`, the `v*-tuplet.*` tags and `gh-pages-1117`, and disable GitHub Pages.
4. Delete this fork, or reset `main` to upstream.

A pinned fork is easy to forget about for years. The point of this file is that whoever
finds it can tell whether it is still needed.
