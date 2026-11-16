# Homepage demo versions

Every version stays in the repository, so any of them can be restored or shown again.

| Version | Where | Link (GitHub Pages, once on `main`) | Notes |
|---|---|---|---|
| v3.4 | `index.html`, `home.html`, `home-en.html` (root) | `/` and `/home-en.html` | Earlier demo the client already saw. Unchanged. |
| **v4** | `v4/index.html` (AR), `v4/en/index.html` (EN) | `/v4/` and `/v4/en/` | New design: "from blueprint to building". Own CSS/JS in `v4/assets/`, shares the images in `images/`. |

## v4 design history (design canvas)

The design was reviewed on a Claude design canvas: https://claude.ai/artifact/7VeMMW4BN4j9yz5eJEDkxJ
(each round is also a version in that canvas's own history). A copy of the canvas files after each round
is committed in `design/v4-canvas/`; use `git log -- design/v4-canvas` to list them.

| Round | Commit message | What changed |
|---|---|---|
| 1 | Save homepage v4 design canvas snapshot (review round 2) | Real-photo hero, Alexandria/Inter only, bento services, dark project gallery, founder card, 3D books, sector panels, animated ASCO footer |
| 2 | Design canvas snapshot: review round 3 | Sticky top bar, short stats (+30 team), filter animation, photo overlays, step animation, vertical team carousel, animated CTA, longer form |
| 3 | Design canvas snapshot: review round 4 | Simpler CTA and form, sector autoplay (3 s), floating "30" team card, softer capabilities card |
| 4 | Design canvas snapshot: review round 5 | Smaller hero title, glass team badge, blueprint CTA background |
| 5 | Design canvas: softer CTA wireframe and scan line, move team badge | Lighter wireframe and scan line, badge moved |
| 6 (live demo) | v4 demo: scroll motion, 3-column team, photo CTA, tag fix | Fixed service tags and team columns; CTA uses a real project photo; scroll reveals, headline words, counters, scroll progress, parallax, card spotlight |
| 7 (live demo) | v4 demo: light interactive CTA, smaller founder photo, full team badge | CTA becomes a light section with an interactive blueprint dot grid (cursor glow + idle wave) and a white form card; founder photo ~15% smaller; team badge no longer clipped; heading accent colours fixed |

The plan and decisions are in `REDESIGN-PLAN.md`.
