# Stitch exports — Venture Route

Source: Stitch project **Venture Route Design System**, `projects/14240170250148839149`
(https://stitch.withgoogle.com/projects/14240170250148839149). Owner: the Operator.
Generated 2026-09-22 from the prompt pack in `docs/design/stitch-prompts.md`; pulled into this repo
through the Stitch MCP (`list_screens` → `htmlCode.downloadUrl` / `screenshot.downloadUrl`).

Every folder holds the Stitch HTML/Tailwind export as `index.html` and the Stitch render as
`screenshot.jpg` or `screenshot.png` (whichever format Stitch served; 1280 px wide, captured at 2× so
the raw file is 2560 px). The Builder converts
`index.html` into React 19 components per the Return prompt at the end of the prompt pack; the
screenshot is the visual reference when the export and the prompt disagree (the Stitch export wins, D-36).

The project design system in Stitch carries the DESIGN.md block from the prompt pack verbatim.
Stitch mapped the display font to **Newsreader** in its theme, but the exported HTML still loads
**Fraunces** from Google Fonts alongside it. The token source of truth stays Fraunces (PRD §4.2).

| Pack § | Screen | Folder | Stitch screen ID | Status |
|---|---|---|---|---|
| 1.1 | Founder intake | `batch-1/founder-intake/` | `57c78ca921cd41b395feeb1fef3725ec` | HTML + screenshot |
| 1.2 | Brief review | `batch-1/brief-review/` | `0928f313f2734aa6bcfb1e7c5cddfcc5` | HTML + screenshot |
| 1.3 | Route result, feasible | `batch-1/route-result-feasible/` | `b6721998510844c0aee861d50bc9a0e5` | HTML + screenshot |
| 1.4 | Route result, partial with gaps | `batch-1/route-result-partial/` | `48617f21000441b28168fa5239b1ab13` | HTML + screenshot |
| 1.5 | Why this route? drawer | `batch-1/why-this-route-drawer/` | `5e25772f09dd4735b73b946d1dc2a22b` | HTML + screenshot |
| 2.1 | Landing page | `batch-2/landing-page/` | `b09d239976f24de28d39ccc10e82f921` | HTML + screenshot |
| 2.2 | Venture handoff | `batch-2/venture-handoff/` | `0d51d0f460bd4127897e84003a8cf09d` | HTML + screenshot. Regenerated through the MCP on 2026-09-22 because the first screen (`2b6ab20cfdaf44f29bf6b2e0c0b77c02`, still in the project) stores its HTML behind a Google sign-in. Stitch added a "Ledger Attestation" card with fake hashes, a "Validation Details" card and a "BASIX EDITION" nav badge that are not in the prompt; drop them in the React conversion. |
| 2.3 | Sign in | `batch-2/sign-in/` | `b10636b802e142c9a011ac5c6b636a54` | HTML + screenshot |
| 3.1 | Builder profile | `batch-3/builder-profile/` | `ad7278eaa8c74df9839e7ec2045e9fd0` | HTML + screenshot |
| 3.2 | Add project | `batch-3/add-project/` | `cd92423ff8df46899ff0f1740e0bb18e` | HTML + screenshot |
| 3.3 | Candidate profile, founder view | `batch-3/candidate-profile/` | `d8cada2f6ad9414f8aed63b81f2aee1f` | HTML + screenshot. Generated through the MCP on 2026-09-22 from pack prompt 3.3 (structure only; tokens came from the project design system). |
| 3.4 | Admin queue | `batch-3/admin-queue/` | `a9ab4428a17b4d169aaf9367cf000cff` | HTML + screenshot |
| 4.1 | Requests board | `batch-4/requests-board/` | `5c6059cb91f8463e8e834a1389274bda` | HTML + screenshot |
| 4.2 | Founder dashboard | `batch-4/founder-dashboard/` | `9ff2a5631c114650989a9cc2ba45cb1a` | HTML + screenshot |
| 4.3 | Interview booking | `batch-4/interview-booking/` | `9508082a093841d8b858b5b48caf8223` | HTML + screenshot |

The Stitch project also holds one uploaded reference image (`screens/2472352381923753264`, `image.png`)
that is not a screen and is not exported here.

## Refreshing an export

After editing a screen in Stitch, re-pull it with the MCP: `get_screen` on the screen name above
returns fresh `downloadUrl`s; save the HTML as `index.html` and the render as `screenshot.*` in the
same folder, then commit. Do not hand-edit `index.html`; changes belong in Stitch or in the React
conversion under `apps/web`.

## Generating through the MCP from Claude Code

`generate_screen_from_text` takes 70–90 s and the Claude Code MCP client times out before that, which
also cancels the generation server-side. The workaround that produced screens 2.2 and 3.3: POST the
same JSON-RPC `tools/call` body to `https://stitch.googleapis.com/mcp` with `curl -m 600` and the
`X-Goog-Api-Key` header, run in the background, then read `outputComponents[].design.screens[]`
from the response for the new screen ID and download URLs. Pass `designSystem:
assets/c102ed52c80241d6851526acd2cf764b` so the tokens come from the project, and keep colours and
font names out of the prompt text.
