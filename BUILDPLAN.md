# Wacky Golf — Build Plan

**Version:** 0.1
**Last updated:** 2026-05-07
**Companion to:** [GDD.md](./GDD.md)

How we go from empty folder → playable mobile prototype, with hosting wired up so you can test on your phone after every push.

---

## Core principles

1. **Always-deployable.** Every phase ends with a build that runs on your phone. No "it'll work after the next milestone" promises.
2. **Build the loop before the content.** Boring single hole, working shop, working stroke-limit bust → THEN add items, biomes, polish.
3. **Mobile-first from day 1.** No "we'll fix the touch controls later." First swing happens on a phone.
4. **Cut as we go.** If a feature is fighting us, cut it from MVP and put it in the post-1.0 list. Velocity > completeness.

---

## Tech stack (locked-in)

| Layer | Choice | Why |
|---|---|---|
| Build tool | **Vite** | Fast dev server, hot reload, ES modules out of the box, easy GitHub Pages output |
| Language | **Vanilla JavaScript** (ES2022) | No TS overhead for solo prototype; can convert later |
| Renderer | **Three.js** (latest stable, r170+) | The pillar |
| Physics | **Custom** (no engine) | One ball, simple needs, full engine = perf + bundle bloat |
| Touch | **Pointer Events API** | One code path that works in iOS Safari, Chrome Android, and desktop |
| State | **Plain objects + tiny event bus** | Save snapshots to `localStorage` |
| Hosting | **GitHub Pages** | Free, lives on the repo, auto-deploy via GitHub Actions |
| Source control | **Git + GitHub** | Standard |
| Target browsers | **iOS Safari 16+** and **Chrome Android** (both must work) | The only browsers we test on |

**Bundle target:** < 5 MB initial download (gzipped). Three.js core is ~600 KB gzipped — plenty of headroom.

---

## Hosting & dev workflow

### GitHub Pages setup

1. Create a public GitHub repo named `wackygolf` (public is required for the free Pages tier).
2. Add a `vite.config.js` with the correct base path so URLs resolve under `/wackygolf/`:
   ```js
   export default { base: '/wackygolf/' }
   ```
3. Add a GitHub Actions workflow (`.github/workflows/deploy.yml`) that runs on push to `main`:
   ```yaml
   name: Deploy
   on:
     push: { branches: [main] }
   permissions: { contents: read, pages: write, id-token: write }
   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: '20' }
         - run: npm ci
         - run: npm run build
         - uses: actions/upload-pages-artifact@v3
           with: { path: ./dist }
         - uses: actions/deploy-pages@v4
   ```
4. In repo Settings → Pages, set source to "GitHub Actions".
5. Every `git push` to `main` rebuilds and republishes to `https://<your-username>.github.io/wackygolf/`.

### Local dev (faster than waiting for a deploy)

While developing on your laptop, run:

```
npm run dev -- --host
```

Vite's `--host` flag exposes the dev server on your local network. From your phone (on the same Wi-Fi), open `http://<your-laptop-ip>:5173/`. You get hot module reload — save a file, the phone updates in under a second. Much faster than the GitHub Actions cycle (~30–60 sec).

For testing off-network, `npx ngrok http 5173` gives you a public tunnel URL.

### Cross-browser testing protocol

We're committing to **iOS Safari + Chrome Android** as supported browsers. Practical testing rules:

- **Every phase ends with a smoke test on both browsers.** Open the deployed URL on iPhone Safari and Android Chrome. If it doesn't work on both, that phase isn't done.
- **iOS Safari has gotchas to watch:**
  - Audio cannot autoplay — first sound must be triggered by a user gesture (a tap)
  - `100vh` ≠ actual viewport (URL bar). Use `100dvh` (dynamic viewport) or set canvas size in JS
  - PWA manifest works but `apple-touch-icon` is required for nice home-screen install
  - WebGL is fine but some experimental features lag behind Chrome
- **Touch via `Pointer Events`** (`pointerdown` / `pointermove` / `pointerup`) means one code path for both browsers and desktop.
- **`localStorage` is fully supported in both** but Safari purges it after 7 days of inactivity in private browsing — fine for our use case.

### Branching

`main` = always deployable production. Feature work in branches; merge to `main` triggers redeploy. No preview URLs (Pages doesn't do those), but local dev + ngrok covers the WIP testing case.

---

## Phase plan

Each phase ends with a deployable, testable build. Estimated timing assumes a couple hours of focused dev per day.

### Phase 0 — Project setup *(½ day)*

- [ ] Vite project scaffolded in `WackyGolf/` folder, `vite.config.js` with `base: '/wackygolf/'`
- [ ] Three.js installed, basic scene with a colored cube proves rendering works
- [ ] Git repo initialized, pushed to public GitHub repo `wackygolf`
- [ ] `.github/workflows/deploy.yml` added, first auto-deploy succeeds
- [ ] PWA manifest + `apple-touch-icon` for clean home-screen install on iOS Safari
- [ ] Smoke-test the URL on iPhone Safari **and** Android Chrome
- [ ] **Milestone:** colored cube rotating, working on both browsers via `https://<user>.github.io/wackygolf/`

### Phase 1 — Hello hole *(2–3 days)*

- [ ] Flat green plane with a cup (cylindrical hole + flag)
- [ ] Spawn a ball at a tee position
- [ ] Touch input: drag-back-and-release on the ball launches it
- [ ] Custom ball physics: gravity, air drag, surface friction; ball stops on green
- [ ] Detect ball-in-cup, trigger a "hole complete" log
- [ ] Camera follows the ball during flight, auto-frames on rest
- [ ] No clubs, no UI, no scoring — just the feel of a swing
- [ ] **Milestone:** you can hit the ball into the cup on your phone, and the ball physics feels approximately like golf

### Phase 2 — Swing refinement & minimap *(3–4 days)*

- [ ] All 4 clubs (Driver, 5-Iron, Wedge, Putter) — fixed bag
- [ ] Club selector at bottom of screen, tap to cycle
- [ ] Power bar UI during pull-back phase (no tempo bar yet)
- [ ] Minimap in top-right: top-down view, ball + pin + green outline + landing-zone dot that updates with aim/club
- [ ] Tap minimap to expand fullscreen, tap again to collapse
- [ ] Wind direction + strength rolled per hole, affects ball flight
- [ ] Sand and water hazards on the test hole — water = stroke penalty + ball replaced at last fairway position
- [ ] **Milestone:** the swing feels like a small game on its own. Friend can pick up phone and figure out how to play.

### Phase 3 — Round structure & Round Preview *(3–4 days)*

- [ ] Hole counter, par, strokes, cash in HUD
- [ ] Cash payout calculation on hole complete (Eagle/Birdie/Par/Bogey table)
- [ ] Stroke limit per hole, enforced — bust = run-end screen
- [ ] **Round Preview screen** — shows all 3 holes for the upcoming round, side-by-side cards, boss handicap visible
- [ ] Round = 3 holes; 3rd is "The Windmill" boss with rotating-blade obstacles + random handicap (start with just "No Driver")
- [ ] Boss handicap implementation: disable specified club for that hole, with clear UI indicator
- [ ] "Round" button in HUD to revisit Round Preview during play
- [ ] Run-end screen: holes played, total cash, [Play Again] button
- [ ] Save mid-run state to `localStorage` after every shot/shop/preview decision
- [ ] **Milestone:** full run loop with planning phase. Win or bust, restart, play again.

### Phase 4 — Pro Shop, Items & Club Upgrades *(4–5 days)*

- [ ] Shop screen between holes (and once at run start, free)
- [ ] **Items tab:** 3 random item cards with rarity-colored borders, sell button on owned persistents
- [ ] Reroll button with $3 → $5 → $8 → $12 cost curve
- [ ] Starter item pool: 6 items, 2 consumables + 4 persistent, common+uncommon
- [ ] **Clubs tab:** 4 clubs listed, each with a level (1) and an Upgrade button ($15 to level 2 for MVP)
- [ ] **Stats tab:** Power upgradable (only stat for v0.1)
- [ ] Item effects actually applied during gameplay (passive triggers + consumable activations from item tray)
- [ ] Club upgrades modify the club's effective power/accuracy
- [ ] **Milestone:** you can spend cash on items, club upgrades, and stats, and they meaningfully change the next hole.

### Phase 5 — Skip & Tags *(1–2 days)*

- [ ] Round Preview = the hole picker. Per-hole Play/Skip buttons on holes 1 and 2; boss has no Skip button at all
- [ ] Skip Tag draw: 2 tag types (Cash $12, Item), shown on a card-flip animation
- [ ] Skip flow: no shop, immediately advance to next hole
- [ ] Run start drops player straight into Round 1 Preview (no starter shop)
- [ ] **Milestone:** Balatro-style risk-reward decision shows up in the loop. Players can chain skips for tags, but lose shop access.

### Phase 5.5 — Title Screen *(planned, not yet implemented)*

A proper game-start screen instead of dropping straight into a hole.

- Full-screen view, no HUD chrome
- Background: live 3D scene of one of our holes, camera **slowly orbits the ball/cup** for a relaxed showcase
- Cycle hole every ~5–7 seconds (fade transition between holes — same `loadCurrentHole` machinery, just paused gameplay)
- Centered logo / "WACKY GOLF" text
- Two big buttons:
  - **Play** — starts a fresh run (calls `run.resetRun(...)` + `loadCurrentHole`)
  - **Resume** — only shown when there's a saved mid-run; restores from `localStorage`
- A **Collection** button on the title screen too so you can browse holes/items without starting a run
- All swing/UI input gated off until Play/Resume is hit (`swing.setEnabled(false)`)

### Phase 5.6 — Collection / Library page *(implemented in 3.6, expand as content grows)*

Already wired:
- HUD button (📋) opens a modal grid of all hole templates
- Locked holes show a "?" thumbnail; played holes show a top-down preview + name + par
- Discovery persists across runs in `localStorage` (key: `wackygolf_discovered_holes_v1`)
- Click a discovered hole → larger preview + feature summary

To expand later:
- **Items tab** — once items exist, the same modal grows a second tab. Each unlocked item card shows name, rarity, effect, and is greyed/silhouetted until first encountered
- **Stats tab** — career-stats overlay (best run, total cash, holes played, splash count, hole-in-ones)

This doubles as a dev tool: easy way to scroll through every hole and visually check that layouts read right after edits.

### Phase 6 — Content & polish *(rolling, post-MVP)*

These are the chunks that come after v0.1 and define v0.2 → v1.0. Each is its own ~few-day milestone:

- 6.1 — 3 more hole templates → variety
- 6.2 — All 4 stats wired in (Accuracy, Putting, Luck)
- 6.3 — Full club upgrade range (1 → 4 levels, with $15 / $30 / $50 cost curve)
- 6.4 — Item pool expanded to 20+ including all tradeoff/lock-out items
- 6.5 — Full Skip Tag pool (5 tag types) and bonus ($12 cash, etc.)
- 6.6 — Tempo bar (Perfect/Good/OK/Sloppy zones, accuracy implications)
- 6.7 — 3 more boss courses (Lava Cup, Pinball Plaza, Sky Bridge) + full handicap pool
- 6.8 — 2 more biomes (Desert, Tundra), reskin pipeline
- 6.9 — Audio pass (sfx + music)
- 6.10 — Visual juice: particles, screen shake, big-text feedback
- 6.11 — Settings menu, color-blind mode, audio sliders

---

## Folder structure (where things live)

```
WackyGolf/
├── GDD.md
├── BUILDPLAN.md
├── package.json
├── vite.config.js
├── index.html
├── /public
│   ├── manifest.json
│   └── icons/
└── /src
    ├── main.js
    ├── /core           Game, Run, Save, Events
    ├── /scene          Three.js setup, camera, lighting, hole geometry
    ├── /physics        BallPhysics
    ├── /input          TouchInput, SwingController
    ├── /gameplay       Club, Item, Stats, Score, SkipTag
    ├── /content        items.js, clubs.js, tags.js, /holes JSONs
    ├── /ui             HUD, Minimap, Shop, Bag, ResultsScreen, SkipPrompt
    └── /audio          Audio.js (post-MVP)
```

This layout maps 1:1 to the data shapes and module list in GDD § 19.

---

## Testing & quality

- **No automated tests in MVP.** Eyes-on-the-phone is the test loop. We're optimizing for vibes.
- **Manual checklist** kept in repo as `TESTING.md`: list of "do these N things on phone before shipping a major build" (swing on each club, finish a hole, bust a stroke limit, buy item, sell item, reroll, skip a hole, get tag).
- **Perf telemetry** added in Phase 4: a debug HUD showing FPS, draw calls, tris. Toggle with a 4-finger tap. Catch performance regressions early.

---

## Risks I'm watching

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Custom ball physics edge cases** | Ball clipping into terrain, infinite roll on slopes, weird bounces off bunker rims will tank the feel | Build a physics-only test scene early in Phase 1 with debug visualizations (velocity vector, contact normals). Tune parameters before adding hazards. |
| **Mobile touch precision on swing pull-back** | Small phone screens + finger occlusion = imprecise swings, frustrating | Make the touch hit-zone for "ball" much larger than the visible ball. Show the drag preview *next to* the finger, not under it. |
| **Camera + aim + minimap fighting for finger attention** | Three things want gestures: orbit camera, aim arrow, minimap pan/zoom. They must not collide. | Strict gesture rules: drag on world = orbit camera; drag on ball = swing; drag on minimap = pan. No overlap. |
| **Three.js bundle size on slow connections** | 600 KB-ish + game code → slow first-load on cellular | Vite code-splitting; load only main scene on first paint; lazy-load shop/menu UI |
| **iOS Safari quirks** | Audio autoplay, viewport sizing, touch events all have iOS-specific gotchas | Test on iPhone every phase, not just Android |
| **`localStorage` save corruption** | Schema change between versions = unloadable saves | Save schema includes a version number; on mismatch, nuke save with a friendly message |
| **Reroll exploit** | Player rerolls forever to find an OP rare item | Cost curve already escalates to $12; cap is hit by reroll #4. If still abusable, add a per-shop reroll cap of 5. |
| **Hole monotony** | One template repeated 100s of times feels stale fast | Phase 6.1 is "more templates" specifically because of this. We'll know after a few playtests if it's urgent. |
| **Scope creep on items** | "One more cool item" forever | Hard cap: 20 items at v0.3, 30 at v1.0. Cut older underperformers as new ones come in. |

---

## Locked-in decisions

| Decision | Choice |
|---|---|
| Hosting | **GitHub Pages** with GitHub Actions auto-deploy on push to `main` |
| Browsers | **iOS Safari + Chrome Android** — both must work, smoke-tested every phase |
| Touch | **Pointer Events API** — single code path for both browsers and desktop |
| Difficulty target | **Medium** — most runs end round 6–8, good builds reach 10+; ~15–20 min runs |
| Player avatar | **Just the ball** — no character on the tee |
| Mid-run save | **Yes** — snapshot to `localStorage` after every shot and shop action |
| Putting mechanic | **Unified with regular swing** — no separate mode; same drag-back for every shot |
| Run start | Round 1 Preview (the hole picker) → first hole. No starter shop. |

---

*End of build plan v0.2. Will iterate as we ship phases.*
