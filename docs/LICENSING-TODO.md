# Licensing: decision needed

**Status: no license chosen.** There is no `LICENSE` file, and no workspace `package.json` has a `license` field (they are all `"private": true`). This is a deliberate open item, not an oversight — but it should be resolved before the project attracts contributors.

## What "no license" means right now

A public GitHub repo without a license is **all rights reserved** by default. People can read the source and fork it on GitHub (GitHub's terms allow that much), but they have **no legal right to use, modify, or redistribute the code**. Two practical consequences:

- The transparency argument is weakened. "Read the source and verify it's local-only" works, but nobody can legally build on it.
- Contributions are awkward. A PR against an unlicensed repo has unclear terms — careful contributors (and their employers) will stay away.

The website copy is already honest about this: it says **"Free to download"** and **"Free to use"**, and links **"View source"** — it never says "open source." Keep it that way until a license is chosen.

## Options, weighed for this product

ArNega is a free desktop app whose core value proposition is **trust** — "no cloud, no telemetry, verify it yourself." The license choice should serve that.

| License | What it does | For ArNega |
|---|---|---|
| **MIT** | Do anything, keep the copyright notice. | Maximum adoption and trust; simplest possible answer to "can I check the code and build it myself?" Allows closed commercial forks. |
| **Apache-2.0** | MIT-like, plus an explicit patent grant and a `NOTICE` mechanism. | Same trust story as MIT with slightly more formal protection; the NOTICE requirement makes silent rebranding a bit harder. A few lines more legal text. |
| **GPL-3.0** | Copyleft: derivatives must also be GPL-3.0 and ship source. | Prevents closed forks — anyone who ships a modified ArNega must publish their changes. May deter some contributors and any downstream who can't accept copyleft. |
| **Source-available** (custom / BUSL-style) | Source visible; commercial reuse restricted. | Keeps commercial control, but these are **not open source** and the community generally treats them with suspicion — a poor fit for a product selling trust. If chosen, the website must continue to avoid the phrase "open source." |

All of these keep the app free for users; the difference is what *others* may do with the code.

## Recommendation framing (not a decision)

- **If the goal is community trust for a privacy tool:** **MIT** or **Apache-2.0**. Anyone can audit, build, and verify the local-only claims with zero legal friction, and contributors face no barrier. Apache-2.0 if the patent grant and NOTICE mechanism feel worth the extra formality; MIT otherwise.
- **If the goal is preventing closed commercial forks:** **GPL-3.0**. Forks stay open, at the cost of some contributor and downstream friction.
- Source-available is the weakest fit: it trades the trust story for commercial control this free app is not currently monetizing.

## Checklist once a license is chosen

- [ ] Add `LICENSE` at the repo root (exact standard text; GitHub will auto-detect it).
- [ ] Add the `license` field (SPDX id, e.g. `"MIT"`) to every `package.json`: root, `apps/desktop`, `apps/website`, `packages/shared`, `packages/branding`. They can stay `"private": true` — that only prevents npm publishing.
- [ ] Add a Licensing section to the repo README (create the README first if it still does not exist).
- [ ] Website copy: only after choosing an OSI-approved license (MIT / Apache-2.0 / GPL-3.0) may the site say "open source" — candidates are the hero/footer copy in `apps/website/src/pages/index.astro` and `apps/website/src/components/Footer.astro` (currently "© ArNega. Free to download."). If source-available is chosen, change nothing.
- [ ] If Apache-2.0: add a `NOTICE` file. If GPL-3.0: sanity-check dependency license compatibility before tagging a release.
- [ ] Mention the license in the next release notes so early users know the terms changed from all-rights-reserved.

Until then: the repo stays public and readable, but treat it as all-rights-reserved in any external communication.
