# Homebrew packaging

**Current install path: npm.** openlore is published to npm, so the supported
installs today are:

```sh
npm install -g openlore   # global CLI
npx openlore <command>    # one-off, no install
```

## Plan: homebrew-core (later), not a personal tap

We are **not** standing up a personal Homebrew tap. A tap is, by Homebrew's
design, its own `homebrew-*` repository, and maintaining a second repo just to
mirror what npm already ships isn't worth it for a CLI that installs cleanly with
`npm i -g openlore`.

Instead, the plan is to submit openlore to **homebrew-core** once it clears
Homebrew's [notability requirements](https://docs.brew.sh/Acceptable-Formulae)
(meaningful stars/forks/watchers and a stable release history). homebrew-core is
the cleanest end state: a plain `brew install openlore` with **no tap at all**,
and Homebrew's own bot handles version bumps after acceptance.

## What's staged here

[`openlore.rb`](./openlore.rb) is the ready-to-submit formula: it installs the
published npm tarball under a Homebrew-managed Node prefix (`depends_on node`,
`std_npm_args`), pins `url` + `sha256` to a release, and `brew test`s
`openlore --version`. When we open the homebrew-core PR, this is the artifact —
no extra wiring needed.

To refresh `url`/`sha256` to the current published version (e.g. just before
opening or updating the core PR):

```sh
npm run homebrew:formula            # uses package.json version, edits openlore.rb in place
# or: node scripts/update-homebrew-formula.mjs --version 2.0.17
```

The script fetches the registry tarball and computes its sha256 (what Homebrew
pins on). Validate locally before submitting:

```sh
brew install --build-from-source ./openlore.rb
brew test openlore
```

> No release-time automation is needed for homebrew-core: once the formula is
> accepted, Homebrew's autobump bot opens version-bump PRs itself. (That's also
> why there's no tap-push job in the release workflow — npm publish is the only
> deploy step.)
