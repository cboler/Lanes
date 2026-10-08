# Project Valkyrie handoff

Updated: 2026-09-30. Resume here after an implementation step or usage-limit interruption. Continue the current repository state; do not recreate completed milestones.

## Current checkpoint

- Base commit: 38b5567 Add controller support and four-unit tactics (after 0611899). That committed milestone includes separate Move and Action gauges, Guard, four-unit squads, archetype advantage, Three.js terrain with a fallback, controller navigation, and a playable responsive battle.
- The next milestone is **local four-turn defense orders and practice**. Preserve it. New files are under src/app/defense/, src/app/core/models/defense-plan.model*, src/app/core/engine/defense-policy*, src/app/core/services/defense-plan.service*, and e2e/defense.spec.ts; battle integration, navigation, tests, and README are also updated.
- Defense plans save to localStorage (lanes.defense-plan.v1), contain one to four members and four orders each, and are validated on load and battle start. A member's own turn advances its order slot, including a stunned turn. A valid scripted skill or Guard runs once; an unavailable order uses role tactics; role tactics also take over after turn four. The practice battle uses the current player squad against the saved defenders. The UI clearly says this is local practice, with no other player or backend.
- The plan editor uses accessible buttons that work with the existing controller focus navigation. A class change resets incompatible skill orders. Target priority affects legal single-target skills, including heals; area skill target controls are disabled. Failed storage keeps a session copy and shows a warning.
- A previously observed repeated-fallback issue was fixed: an unavailable scripted action is attempted only once per defender turn, even if fallback AI performs multiple actions in that turn.

## Verified this run

- Started by reading the prior handoff, inspecting Git and commit 38b5567, and checking the current playable state. The initial 132 unit tests and production build passed. The in-app browser showed all eight units and both resource gauges.
- Ran the new defense browser tests in Chromium: 8/8 passed across four viewport projects. Also manually inspected the defense editor at desktop and 390×844 phone size. Save, reload, practice Guard, battle log, shield badge, and restart were seen live; browser error log was empty.
- After the targeting and repeated-fallback fixes: npm run format, npm run format:check, and npm run lint passed; npm test -- --watch=false passed (144 tests in 14 files); npm run build passed. Angular test/build compilation needs elevated sandbox access because the restricted shell cannot read some repository files/packages, despite those files existing.
- Full npm run e2e -- --workers=2 passed: 38 browser tests across phone portrait, phone landscape, tablet portrait, and desktop; six tests were intentionally skipped on non-desktop projects. npm run build:pages passed and generated dist/browser/404.html, with web manifest and Angular service worker configuration found. git diff --check is clean.
- The local dev server was started at http://127.0.0.1:4200 (session 62692); confirm whether it remains running before reuse. No blocking regression remains at this checkpoint.

## Roster and stat sheet (merged in PR #4, 2026-09-29)

- New: src/app/core/models/mercenary.model*, core/services/roster.service*, src/app/roster/, e2e/roster.spec.ts, route /roster and a nav link. UnitInstance takes optional stat overrides; BattleStateService.initSkirmish takes an optional 4th arg of roster mercenaries aligned with the player squad (kept through restart and defense practice, cleared by a class-only squad).
- Roster saves to localStorage (lanes.roster.v1), validated on load; a starter roster (one per class, random aptitudes) is generated on first run. Each stat scales the class's tuned value by 2% per point from a neutral 17 (mapping documented on deriveCombatStats). SP has no combat effect yet.
- Verified: 162 unit tests, lint, format, build, and full e2e (42 passed, 6 skipped) pass; roster page inspected on desktop.
- The Squad Builder and default battle are still class-based and do not use the roster; only Roster > Deploy squad does.

## Grand Kingdom–style battle stage (2026-09-30, uncommitted)

The user asked for "the three.js treatment" to get the presentation closer to the source before iterating on design. Reference used: NIS America's official Grand Kingdom UI/battle pages (nisamerica.com/grand-kingdom/system/system5.html, system11.html) and press screenshots. Their layout:

- a side view with three lanes at different depths and a painted backdrop;
- troop flags top-left and top-right, with assist orbs;
- small HP bars and LEADER tags above units;
- the active unit's portrait, name and assigned skills at the bottom-left;
- the Move and Action gauges at the bottom-centre;
- an action timeline along the bottom with an hourglass;
- a point-of-impact reticle that sweeps the ground for ranged and magic attacks;
- melee combos with a white-flash Just Cancel window.

- **Files:** src/app/battle/stage-scene.ts (all Three.js code, lazy chunk ~123 kB gz), battle-stage.component.ts (Angular host, WebGL detection and fallback, 8 s load timeout), sprite-art.ts (the class SVG art as strings, feeding both textures and the fallback <img>). Removed: arena-scene.component.ts, unit-sprite.component.ts. The battlefield template and SCSS were rewritten around the Grand Kingdom HUD. Every ID, class and ARIA hook the tests, keyboard and controller use is kept.
- **Stage:**
  - A perspective camera at 18° pitch and 11° FOV looks at three lanes: lane I at the back, z = (lane − 1) × 3.2.
  - arena.jpg is a screen-space background aligned so its skyline sits on the back wall line, with haze and rubble at the seam.
  - Sprites are rasterized SVG with an ink outline and lighting.
  - fitFrame() picks the camera distance and centre so every living unit fits inside CSS-configured safe areas (--stage-safe-top/bottom); it is unit-tested.
  - Unit buttons remain DOM over the canvas, placed each frame from projected sprite bounds; data-unit-id links each button to its sprite.
- **Choreography:**
  - BattleStateService.lastAction is emitted after rules resolve. Rules still apply instantly; the stage replays the action with hits at IMPACT_DELAY_MS (300 ms × speed). DOM numbers and HP bars use the same delay through --impact-delay.
  - Each skill has a look (LOOKS in stage-scene.ts): melee lunge, arrow arc, volley rain, bullet/snipe tracer, fire bolt, inferno wave, meteor, light pillar, blessing, shout/spin shockwave, and a Bulwark buff.
  - Hits flash, knock back and burst; Guard shows a hex shield; deaths topple and fade; embers and flickering torches give ambient life.
- **Service additions:** lastAction, friendlyFireRisk (moved from the component), reachableSpan (used for the gold move-range strip), turnsLeftInRound (the timeline hourglass), plus shared movement constants.
- **Controls:** holding A/D, the arrow keys, or the Retreat/Advance buttons walks continuously at 0.3 field per second, spending MG by the same rules; a tap is still one step. Walking stops on release, when blocked, out of MG, or on window blur. The controller keeps its deliberate one-step-per-push design.
- **Fallback:** runs when WebGL2 is missing, the context is lost, or creation fails. Buttons then contain <img> sprites positioned by lane bands.
- **Bug fixes:**
  - The fallback backdrop used an absolute /assets URL that 404s under the /Lanes/ base href; it is now a relative inline style.
  - Unit buttons stay focusable while the stage loads (opacity rather than visibility).
- **Verified:** 170 unit tests; format, lint and production build (no budget warnings; 400 kB initial). Full e2e: 44 passed, 12 skipped desktop-only, twice. New e2e tests cover context-loss fallback and hold-to-walk. Checked by screenshots at all four viewports, with auto-battle contact sheets and reduced motion, plus six leave-and-return trips without errors. Played manually in the in-app browser.

## 3D characters (2026-10-01, in progress, uncommitted on branch feat/3d-characters)

The user chose 3D models built by Claude (no artist budget) with visible weapons. Blender 5.2 is now installed at C:Program FilesBlender FoundationBlender 5.2 but was not needed for this pass.

- **Done:** src/app/battle/stage-characters.ts builds each class in Three.js code: an 18-bone skeleton, one skinned mesh sculpted from primitives, weapons as attachments on hand bones, cel shading with an inverted-hull ink outline, and clips per weapon style (idle, walk, guard, attack, special, hit, death) played through AnimationMixer. Enemies are mirrored. Actions turn the body square to the enemy. stage-scene.ts uses these instead of billboard sprites; sprite-art.ts now only feeds the no-WebGL fallback. IMPACT_DELAY_MS is 420. Shaders are pre-compiled before the stage is shown.
- **Verified:** 176 unit tests (6 new in stage-characters.spec.ts), lint and format pass. The no-WebGL e2e run passes (43 passed, 13 skipped).
- **Open problem, do this first:** frame rate dropped. Yesterday the stage held 60 fps on desktop with no long tasks; with the characters the page delivers roughly 35 fps in battle on desktop and under 20 fps at the phone viewport in headless Chromium. JavaScript in the frame loop is cheap (about 3 ms per frame, render call 2.2 ms), so the cost is on the GPU or compositor side. Suspects, in order: the per-character toon material lit by three point lights, the outline pass doubling skinned draws, and 15k-vertex non-indexed meshes. This slowness is also what makes the controller e2e test flaky with WebGL on (a D-pad tap stretches into a held repeat).
- **Not done:** README update, a final visual pass at phone sizes, the full WebGL e2e run passing twice, shipping.

## Immediate next steps

1. Interactive execution from the source: a point-of-impact reticle for ranged and magic skills (a timed press decides hit or miss or the landing spot), and melee combos with a Just Cancel window. These change rules, so they need deterministic inputs for defense/AI and tests. The stage already has per-skill choreography and an impact timeline to hook into.
2. Art fidelity: the chibi SVGs are the weakest part of the presentation now. Grand Kingdom uses detailed, roughly 5-heads-tall paper-doll sprites. The next art step is splitting sprites into parts (head, torso, arms, weapon) for skeletal attack poses, plus more backdrops per battle.
3. Fold the roster into the Squad Builder and defense plan (choose mercenaries, not classes), so defenses are built from real characters. This is also what an async-PvP defense snapshot will need to contain.
4. Knockback/launch states, battlefield objects, the assist gauge (the troop-flag orbs), hiring currency, EXP and level-ups, and the guild hub. The online milestone needs real identity, authoritative storage, defense snapshots, matchmaking, deterministic validation, rewards and history; none exists now. Do not label local practice as network PvP.

## Request, references, and constraints

The user asked to make Lanes closer to **Project Valkyrie: A Technical Architecture and MVP Specification for a Web-Based Tactical RPG**, explicitly authorized helpful libraries such as Three.js, requested controller support, and asked that this handoff stay current. Specification: [docs/project-valkyrie.md](docs/project-valkyrie.md), converted to Markdown from the original paste at C:\Users\chris\.codex\attachments\fa375353-2eea-47af-9ae9-8708d97ce1c5\Pasted text.txt.

Read C:\Users\chris\OneDrive\Documents\GitHub\GEMINI.md and repository INSTRUCTIONS.md when resuming. Keep the Angular PWA and GitHub Pages behavior, responsive UI and accessibility, and pure TypeScript combat logic. Prefer necessary, focused additions over broad architecture changes. Run formatter, lint, unit tests, production build, Pages preparation, and relevant browser checks; launch and inspect the actual game, not just source or tests.

The supplied document's Phaser/microservices ideas are recommendations. Current Angular/TypeScript/Three.js foundation is functional. Equipment forging, war meta-game, battlefield objects, campaign quests, and board-game traversal remain deferred in the reference specification.
