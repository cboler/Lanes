# Project Valkyrie handoff

Updated: 2026-10-18. Resume here after an implementation step or usage-limit interruption. Continue the current repository state; do not recreate completed milestones.

## Current checkpoint

- Base commit: 38b5567 Add controller support and four-unit tactics (after 0611899). That committed milestone includes separate Move and Action gauges, Guard, four-unit squads, archetype advantage, Three.js terrain with a fallback, controller navigation, and a playable responsive battle.
- Defense orders and practice (below) are committed. The latest milestone is **interactive execution** (aim and combo timing); see its section. New files are under src/app/defense/, src/app/core/models/defense-plan.model*, src/app/core/engine/defense-policy*, src/app/core/services/defense-plan.service*, and e2e/defense.spec.ts; battle integration, navigation, tests, and README are also updated.
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
- Superseded on 2026-10-18: the Squad Builder, default battle and defense plans now use the roster (see "Roster-driven squads").

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

- **Files:** src/app/battle/stage-scene.ts (renderer, frame loop and teardown) plus the stage-* modules it composes (types, layout, assets, particles, effects, camera, environment, markers, units, looks, choreography, characters; one lazy chunk, ~150 kB gz), battle-stage.component.ts (Angular host, WebGL detection and fallback, 8 s load timeout), sprite-art.ts (the class SVG art as strings, feeding both textures and the fallback <img>). Removed: arena-scene.component.ts, unit-sprite.component.ts. The battlefield template and SCSS were rewritten around the Grand Kingdom HUD. Every ID, class and ARIA hook the tests, keyboard and controller use is kept.
- **Stage:**
  - A perspective camera at 18° pitch and 11° FOV looks at three lanes: lane I at the back, z = (lane − 1) × 3.2.
  - arena.jpg is a screen-space background aligned so its skyline sits on the back wall line, with haze and rubble at the seam.
  - Sprites are rasterized SVG with an ink outline and lighting.
  - fitFrame() picks the camera distance and centre so every living unit fits inside CSS-configured safe areas (--stage-safe-top/bottom); it is unit-tested.
  - Unit buttons remain DOM over the canvas, placed each frame from projected sprite bounds; data-unit-id links each button to its sprite.
- **Choreography:**
  - BattleStateService.lastAction is emitted after rules resolve. Rules still apply instantly; the stage replays the action with hits at IMPACT_DELAY_MS (300 ms × speed). DOM numbers and HP bars use the same delay through --impact-delay.
  - Each skill has a look (LOOKS in stage-looks.ts; each look names a data-driven recipe of timed steps that stage-choreography.ts interprets, so a new skill is one entry and a new delivery is a recipe, not code): melee lunge, arrow arc, volley rain, bullet/snipe tracer, fire bolt, inferno wave, meteor, light pillar, blessing, shout/spin shockwave, and a Bulwark buff.
  - Hits flash, knock back and burst; Guard shows a hex shield; deaths topple and fade; embers and flickering torches give ambient life.
- **Service additions:** lastAction, friendlyFireRisk (moved from the component), reachableSpan (used for the gold move-range strip), turnsLeftInRound (the timeline hourglass), plus shared movement constants.
- **Controls:** holding A/D, the arrow keys, or the Retreat/Advance buttons walks continuously at 0.3 field per second, spending MG by the same rules; a tap is still one step. Walking stops on release, when blocked, out of MG, or on window blur. The controller keeps its deliberate one-step-per-push design.
- **Fallback:** runs when WebGL2 is missing, the context is lost, or creation fails. Buttons then contain <img> sprites positioned by lane bands.
- **Bug fixes:**
  - The fallback backdrop used an absolute /assets URL that 404s under the /Lanes/ base href; it is now a relative inline style.
  - Unit buttons stay focusable while the stage loads (opacity rather than visibility).
- **Verified:** 170 unit tests; format, lint and production build (no budget warnings; 400 kB initial). Full e2e: 44 passed, 12 skipped desktop-only, twice. New e2e tests cover context-loss fallback and hold-to-walk. Checked by screenshots at all four viewports, with auto-battle contact sheets and reduced motion, plus six leave-and-return trips without errors. Played manually in the in-app browser.

## 3D characters (2026-10-07, branch feat/3d-characters)

The user has no artist budget and asked for real 3D characters and animations, built with Blender. They chose Quaternius's CC0 fantasy packs as the base and had Claude download them; the zips were fetched from itch.io into C:/Users/chris/LanesArt/ (outside the repo).

- **Pipeline:** tools/characters/build.py runs in headless Blender 5.2. Per class, it:
  - takes a Superhero base body (head only) and adds Ranger or Peasant outfit parts, retargeted onto the base rig, plus hair;
  - adds modelled extras: helm, circlet, halo, hats, robe, sash, quiver, and the weapons (sword, shield, lance, staff, orb, bow, pistol) parented to hand bones;
  - places a Muzzle empty and swaps alternate textures;
  - decimates the whole character to a 9k-triangle budget, strips unused attributes and simplifies materials;
  - exports a GLB, then meshopt-compresses it.

  It also exports animations.glb: the UAL clips the game uses, plus a hand-authored Bow_Shoot. Output is about 2.3 MB in total.

- **Runtime:** src/app/battle/stage-characters.ts loads the GLBs with MeshoptDecoder and clones each with SkeletonUtils.
  - Team pieces use the "Team" material, recoloured blue or red, and hair is tinted per class.
  - Clips retarget by bone name, keeping rotations plus the pelvis position.
  - act() rescales a clip so its key frame lands on the choreography's beat. Enemies are mirrored, and the body turns square to the enemy while acting.
  - The old procedural sculptor and ink outline are gone, along with the frame-rate problem they caused.
  - stage-scene.ts adapts its render scale: from up to 1.75x device pixels down to 0.5x when frames stay over 40 ms, then back up when they drop under 20 ms. CI's software GL needed both this and the triangle budget, or the controller e2e test timed out at tablet and desktop sizes.
- **Verified:**
  - 178 unit tests; stage-characters.spec.ts uses a synthetic rig.
  - Lint, format and build pass.
  - Full e2e passes with one worker, as CI runs it. With parallel workers under SwiftShader some timing tests time out.
  - The no-WebGL run passes: 43 passed, 13 skipped.
  - Screenshots and an auto-battle to victory checked.
- **Next for art:**
  - Paid tiers of the outfit pack add Knight, Wizard and other outfits, which would replace some modelled extras.
  - Equipment can swap hand-bone attachments.
  - Toon shading or outlines could bring back the painted look.
  - Juggle and combo animations would need launch and air-hit clips.

## Interactive execution (2026-10-18, branch feat/interactive-execution)

The user picked interactive execution as the next Valkyrie milestone (spec 1.1.4).

- **Rules:** src/app/core/engine/execution.ts is pure and decides how a skill is executed and what a press is worth.
  - Ranged/magic/specialist damage skills are 'aim'; melee-archetype damage skills are 'combo'; heals and Bulwark are 'none'.
  - Grades and their damage multipliers, applied after defense: critical ×1.3, hit ×1, graze ×0.5, miss ×0, chain ×1.1, just ×1.3.
  - CombatExecutor.execute and DamageCalculator.calculateWithDefense take an optional grade (or power). A miss spends AP, but deals no damage, takes no Guard and causes no friendly fire. TargetEffect and BattleAction carry `missed`; BattleAction carries `grade`.
  - **No grade means normal power.** Enemy AI, defense orders and Auto-Battle never pass one, so they stay deterministic. This is what an async-PvP replay will need.
- **Aim:**
  - The track is the ground ahead of the attacker. The zone centre is aimZoneCenter, based on distance plus 0.08 per lane, clamped to 0.3–0.88.
  - Zone half-widths are 0.035 / 0.12 / 0.22. The sweep lasts 1500 − 10 × AP cost ms (Quick Shot 1300, Meteor 950).
  - Letting the cursor run off the end is a miss. Nothing else can be done while aiming, and the aim cannot be cancelled.
- **Combo:**
  - CHAIN_WINDOW at 1x: presses before 420 ms are swallowed (double-tap protection); a Just Cancel is 560–760 ms; the window closes at 1150 ms.
  - The window scales with the speed toggle to match the stage's melee beat.
  - Pressing a melee skill, or the target, chains it. Moving, switching lanes, selecting normally or ending the turn drops the combo.
- **Service:**
  - BattleStateService.commitSelectedAbility is the player's confirm: it starts the aim, or executes and then opens a combo. fireAim and chainAbility follow from there.
  - executeSelectedAbility(target, automated, grade) is unchanged for the AI.
  - Signals: aim, combo, timingEnabled. The timing preference is saved in localStorage as lanes.timing.v1 = on/off, and defaults to on.
  - The service clock is performance.now(); unit tests use Vitest fake timers, which fake it too.
- **UI:**
  - The aim panel (#aim-fire-btn, focused so Enter/Space/A fire) and the combo meter take the targeting panel's slot.
  - A .just-flash overlay shows the window; under reduced motion it is an inset outline.
  - Aimed units get a dashed .aim-target reticle, chainable skills get .chainable, and grades float in gold (FloatingText.isGrade).
  - The 🎯 Timing toggle is #timing-toggle-btn. CSS animations start from the service clock with a negative delay; each aim or combo is rendered in a one-item @for keyed on its start time, so the animation restarts.
- **Stage:** A missed shot flies past and kicks up dirt behind the target, with no flinch. Chained melee approaches start from the attacker's current offset, and an older retreat yields to a newer approach (the `movers` map in stage-choreography.ts).
- **Tests:** execution.spec.ts, plus grade, miss, aim, combo and AI-has-no-grade cases in the executor and service specs (217 unit tests). Verified: format, lint, build:pages, and the full e2e suite with one worker (51 passed, 21 desktop-only skips).
  - e2e tests that check gauges, focus or controller repeat now opt out with timingOff(page).
  - New e2e tests cover aim run-out (miss) and Space fire, the combo, controller A fire, and the persisted toggle.
  - The combo e2e runs on Playwright's paused clock with the WebGL stage disabled. Advancing the clock runs every queued frame, and in real time SwiftShader can stall key events past the window. Under a paused clock, step at least 16 ms after each press so Angular renders.
- **Local note:** port 4200 on this machine was serving another project ("Singularity Seed"), and Playwright's reuseExistingServer silently tested it. Check what is on 4200 before trusting a local e2e run, or serve Lanes on another port.
- **Not done:** the landing spot does not move hits to other units (a miss simply misses), there are no launch/juggle states or per-skill cursor modifiers (Precision Fire), and the defense editor does not mention timing.

## Roster-driven squads (2026-10-18)

The player's side and defense plans are now built from roster mercenaries, not classes.

- **Player squad:**
  - RosterService.squadIds is the one source of truth, shared by Roster and the War Room.
  - The War Room lists the squad with ✕ to remove, plus Reserves buttons ("Add <name> to the squad"); the roster keeps the squad between one and four.
  - The class library is for inspecting classes and adding opponents. #add-to-player-squad-btn is gone.
  - The opponent side stays class-based ("Enemy Fighter").
  - BattleStateService.deployMercenaries(squad, enemyClasses?) is the entry point. BattlefieldComponent uses it on a visit's first battle, and so do the Roster and War Room deploy buttons.
- **Defense plan v2:** `{ version: 2, members: { mercenary, orders }[] }`.
  - The mercenary is a full snapshot, so a plan is self-contained, as an async-PvP defense must be.
  - parseDefensePlan(value, roster):
    - It refreshes a snapshot from the roster when that mercenary is still in it, and otherwise keeps the snapshot.
    - It upgrades a stored v1 plan (class only) by giving each member an unused roster mercenary of that class, and rejects the plan if there is none.
    - It rejects the same mercenary defending twice.
  - The storage key is still lanes.defense-plan.v1; the data carries its own version.
  - The default plan prefers the classes lancer, gunner, witch and fighter from the roster, then fills up with anyone else.
- **Defense editor:**
  - "Change mercenary for member N" cycles to the next roster mercenary not already defending. A different class resets that member's orders to auto.
  - Add member takes the next unused mercenary, and is disabled at four members or when the whole roster is already defending.
- **Practice:**
  - initDefensePractice(plan, squad?) takes the roster squad from the editor. Without it, a fresh load fell back to the old class squad.
  - Defenders use their mercenary's name and derived stats. A name that matches a player unit gets " (Def)", since practice may pit a mercenary against itself.
- **Tests:**
  - e2e/fixtures.ts extends Playwright's `test`. It seeds a fixed roster with neutral stats (all 17, so combat numbers equal the class baselines): Aldric fighter, Brenna archer, Cassian cleric, Dara lancer, Edric witch, Fiora gunner, with the first four as the squad. It seeds only when storage is empty.
  - Every spec imports `test`/`expect` from ./fixtures. roster.spec.ts sets `test.use({ seedRoster: false })` to test the random starter roster.
  - 222 unit tests pass.

## Immediate next steps

1. Art: more backdrops per battle, visible equipment through hand-bone attachments, and launch, juggle and combo clips for the timing-based combat.
2. The progression loop: post-battle EXP and level-ups (Mercenary.level exists but never changes), currency rewards, and hiring new mercenaries with that currency (the roster is fixed at the starter six). Defense snapshots already refresh from the roster, so levelled mercenaries carry into saved defenses.
3. Knockback/launch states, battlefield objects, the assist gauge (the troop-flag orbs), and the guild hub. The online milestone needs real identity, authoritative storage, defense snapshots, matchmaking, deterministic validation, rewards and history; none exists now. Do not label local practice as network PvP.

## Request, references, and constraints

The user asked to make Lanes closer to **Project Valkyrie: A Technical Architecture and MVP Specification for a Web-Based Tactical RPG**, explicitly authorized helpful libraries such as Three.js, requested controller support, and asked that this handoff stay current. Specification: [docs/project-valkyrie.md](docs/project-valkyrie.md), converted to Markdown from the original paste at C:\Users\chris\.codex\attachments\fa375353-2eea-47af-9ae9-8708d97ce1c5\Pasted text.txt.

Read C:\Users\chris\OneDrive\Documents\GitHub\GEMINI.md and repository INSTRUCTIONS.md when resuming. Keep the Angular PWA and GitHub Pages behavior, responsive UI and accessibility, and pure TypeScript combat logic. Prefer necessary, focused additions over broad architecture changes. Run formatter, lint, unit tests, production build, Pages preparation, and relevant browser checks; launch and inspect the actual game, not just source or tests.

The supplied document's Phaser/microservices ideas are recommendations. Current Angular/TypeScript/Three.js foundation is functional. Equipment forging, war meta-game, battlefield objects, campaign quests, and board-game traversal remain deferred in the reference specification.
