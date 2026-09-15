# About this fork

This is a fork of [paulrosen/abcjs](https://github.com/paulrosen/abcjs). It exists to carry
one patch until that patch is upstream. It is **not** a long-lived divergence and should be
deleted once the pull request lands.

## The patch

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
| `deploy/6.7.0-tuplet` | upstream `main` (the 6.7.0 release) | What our own projects install. Upstream's release, the one fix, and the removal of a dead submodule that breaks npm git installs. |
| `gh-pages-1117` | orphan | The demo page published to GitHub Pages. Not mergeable anywhere; exists only to be served. |
| `main` | upstream `main` + this file | Fork landing page. Deliberately one commit ahead of upstream so this note is visible. |

## Consuming the deploy branch

Pin a **tag**, never the branch — a branch reference means a later `npm install` silently
picks up whatever has been pushed since.

```json
"abcjs": "https://github.com/cormacusscripsit/abcjs/archive/refs/tags/v6.7.0-tuplet.2.tar.gz"
```

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
