# Project Valkyrie handoff

Updated: 2026-10-22. Resume here after an implementation step or usage-limit interruption. Continue the current repository state; do not recreate completed milestones.

## Current work: overworld and game presentation (2026-10-21–22)

The user requested a game-like UI and Grand Kingdom-style board traversal, referencing the [RPG Site review screenshots](https://www.rpgsite.net/review/4922-grand-kingdom-review). This checkpoint builds on `bcc5056`, on `main`. The user authorized shipping once checks were green, then continuing toward the vision in a later session. The pre-existing untracked `.claude/` directory is unrelated. Use the Git log and `origin/main` for the delivery commit; do not restart this work.

- **Home and shell:** `/` opens the lazy-loaded Thornwatch March expedition; `/overworld` redirects there. The Guild Hall is at `/guild`. Existing guild back links and browser tests follow that route. The shared shell uses a restrained forest-green and brass game HUD; the overworld fills the window with its own objective, turn banner, portrait strip, and command deck. At the user's request, the decorative Online/Offline network indicator and its listeners/styles were removed; it did not represent any game or multiplayer connection. The existing battle, story, roster, defense, options, PWA and Pages infrastructure remain available.
- **Rules and confirmed design:** `src/app/core/models/overworld.model.ts` owns 28 waypoint coordinates, 36 undirected edges (nine independent loops), five fixed patrol circuits, save shape, validation, and the pure turn resolver. The user explicitly chose unlimited turns: navigation decisions depend on encounters and detours, without a deadline. Each legal adjacent hop or wait increments time once and moves every undefeated squad one edge. Circuits repeat every 4, 6, or 7 hops; no random movement is used. A shared destination or a swap along one edge intercepts the party. The grove-to-cache shortcut at turn 2 meets the Rangers at turn 4; the longer grove/logging/overlook/cache flank arrives safely at turn 6. Unit checks lock down both alternatives and cycle repetition.
- **State and rewards:** `OverworldService` saves position, elapsed turns, collected loot, defeated squad ids, a pending encounter, completion, and randomized squad snapshots under `lanes.overworld.v1`. The optional `squads` object extends old saves without resetting the journey; missing/invalid squads are generated individually. Gold caches pay 60/80/120; shrine/ruins pay Tactics/Charm Scrolls; watchtower pays 250 gold, once. An intercepted landing defers its loot until victory. Loss regroups at camp; won squads disappear. The old pre-battle withdrawal action was removed because contact now starts combat. Retry victories from a defeat verdict also clear that squad. `SAVE_KEYS` includes the key, so backup/restore/reset include progress and opponents. With blocked storage, the expedition stays playable in memory and shows a warning.
- **Combat and confirmed design:** each enemy piece represents one enemy squad. Free-exploration compositions are rolled once using the existing random contract generator, at the initial party level, then saved with id `overworld:<patrol id>`. Campaign classes/names remain scripted in mission data. Contact automatically deploys your squad against that saved enemy squad after the 500 ms hop. A pending encounter reopens on map reload; a direct battle refresh restarts against the same saved squad (combat turns themselves remain in memory). The battle verdict resolves expedition state and has a Return to the map action. An unfinished fight blocks further map movement. Map squads are separate from guild board contracts and do not increment guild contract completions.
- **Presentation:** `src/app/overworld/` draws paths with SVG, actual DOM buttons for waypoints, shaded chess pieces with synchronized 500 ms hops, and contextual route/encounter commands. Reduced motion suppresses animation. Map artwork is `public/assets/overworld/thornwatch.webp` (about 550 KiB); tool and full prompt are in the adjacent README. The background URL resolves against the document base for Pages deployments. No new dependency was added.
- **Scouting, reports and controls:** V or controller Y toggles arrows and next-landing markers for every enemy squad. Road choices and Wait warn of encounters using `advanceExpedition` itself. Clicking a red piece opens a native modal with that squad's actual mercenaries, classes, levels, current/next waypoint and circuit length. Inspecting consumes no turns. Reaching the goal opens a report once; it can be reopened without another payout. Dialogs support A/B, keyboard Tab wrapping, Escape, focus restoration and touch. Arrows/right stick select roads, M marches, X waits, D-pad/left stick focuses, A presses. The board pans to follow the company; players can also scroll manually. Shared scouting/dialog styles are in `overworld-tactics.scss`, keeping the existing component-style budgets.
- **Campaign and company flow (2026-10-22):** the overworld is now the main campaign. The player is a mercenary company traveling through war-torn lands looking for work. The header tab bar and site footer were removed. Company opens a native modal with roster, War Room, defense, guild, journal, options and diagnostics; C/controller Menu/touch opens it, B/Escape closes or returns to the map. Management uses a framed game screen over the landscape and preserves position/turns. Battle is contextual, with Resume battle shown only when a fight exists. The existing four missions now define fixed map circuits in campaign-story.ts. The next mission appears as a star-marked enemy piece alongside the five random patrols, using the same hop/collision resolver. Commissions and aftermath play in a native dialog over the map. Accepted briefings persist as an optional campaign-save field. Contact with a scripted token starts its exact named squad; victory clears the pending map encounter and advances the campaign, loss returns to camp. Battle refresh restores the same pending scripted encounter. The journal reads commissions/aftermaths and follows the current contract on the map instead of launching battles from cards. See docs/project-valkyrie.md for the confirmed direction.

**Final local verification 2026-10-22:** 323 unit tests in 36 files; full browser suite 109 passed, 51 intentional viewport skips (160 entries); lint, Prettier check, production build and Pages fallback pass, without style-budget warnings. Coverage includes all four scripted squad encounters and sequential unlocks, scripted defeat/regrouping, pending battle reload, commissions and aftermath on the map, company commands preserving position and time, keyboard focus trapping and restoration, controller Menu/A/B, fixed repeated circuits, guarded shortcuts versus safe detours, random composition across new games, identical squad sheets after reload, legacy/invalid snapshot recovery, automatic squad combat, one-time rewards, backup inclusion, report reopen, camera follow and 44-pixel targets. A scouting test now waits for the squad sheet to render before taking its snapshot; the final full suite passed after that synchronization fix. Non-story browser fixtures mark the campaign cleared to isolate free-exploration checks; campaign tests opt out and play the story flow. Desktop, phone portrait/landscape, and tablet screenshots were inspected, plus manual map, story, company-menu and roster checks in the in-app browser. Screenshots are under ignored `tmp/overworld-*.png`, `tmp/campaign-*.png` and `tmp/company-menu-*.png`. Controller checks use a simulated standard Gamepad API controller; physical hardware has not been verified in this run.

**Resume boundary:** one campaign region and the existing four-mission prologue are integrated. Additional regions and broader war stories remain future work. Stop after delivering this checkpoint; continue design and implementation when the user returns.

After removing the header network indicator, all 319 unit tests, the four-viewport overworld traversal checks, lint, format check and Pages production build passed again. Desktop and phone screenshots confirm the cleaned header.

Local development uses `http://localhost:4301/`. Starting the server and running unit/browser tests outside per-command isolation was required: separate sandbox commands could not reach each other's loopback server and Vitest temporary files failed to rename. The production build also requires access to the existing Google Fonts URL. Do not run a formatter while browser tests are exercising the development server, because live reload can interrupt them.

## Usability pass and battle sound (2026-10-23)

The user asked to keep working: "there's plenty to consider and do". A play-through at several sizes turned up these, all fixed and pushed:

- **Killing blows:** a unit's DOM button (which carries its floating numbers) vanished the moment its HP hit 0, so the killing blow's number never showed. getUnitsInLane now keeps a felled unit while it still has floating texts (`.unit-node.fallen`: disabled, aria-hidden, plate hidden).
- **Verdict:** every verdict leads home (#modal-map-btn "Overworld" for skirmishes and guild contracts, #modal-overworld-btn / #modal-story-btn for map battles). A won map or story battle drops Fight Again (`mapWon`). The command deck hides behind the verdict.
- **Targeting:** pressing a foe with nothing aimed at it selects the first affordable skill that reaches it; pressing it again attacks. While a skill is selected, targets show a forecast at normal power (`.preview-badge`: −HP after Guard, KO, or +heal); the aimed-at or hovered unit shows `.hp-num`.
- **Look:** shared `.tactical-btn` and component cards lost their navy literals for the green/brass palette; `a.tactical-btn` gets the button shape (journal and guild link buttons were bare text). Stale "◀ Guild Hall" back links on Roster, War Room, Defense and Options are gone (the header has Overworld and Company). Shorter intros; the Roster's deploy button reads "Practice skirmish".
- **Mid widths:** under 1180px the move arrows fold into a square and skill tag icons hide, so skills keep one row and full names.
- **Short landscape map:** the site header floats its Company button over the region bar (app.scss) instead of taking a row.
- **Preferences:** battle speed persists (`lanes.speed.v1`) like Timing; both, plus sound, are in Options and in SAVE_KEYS.
- **Sound:** SoundService (core/services/sound.service.ts) synthesizes cues with Web Audio: oscillators and band-passed noise with short envelopes, through a master gain (volume × LOUDNESS) and a compressor. The context is created on the first pointerdown/keydown; cues are only dropped once it is closed. BattlefieldComponent voices each `lastAction` once (by seq): release by archetype (swing/shot/spell, buff for pure buffs), then hit/crit/miss, guard and fall at IMPACT_DELAY_MS × speed; heals chime at impact; a Just Cancel pings; the player's turn start chimes; victory/defeat stings play with the verdict. `lanes.sound.v1` holds `{ on, volume }`. Measured offline (tmp/cues.mjs): single cues peak 0.05–0.4, five heavy cues together 0.6. Nobody has listened to them on real speakers yet.
- **Tests:** new e2e for the kill number and verdict link, foe-press targeting, remembered speed, and sound (counts oscillators, then silence after Options turns it off); unit tests for SoundService settings. The campaign test's hop helper accepts contact moving straight into battle (it was flaky).

## Battle HUD over a full-screen stage (2026-10-22)

The user called the battle screen and its on-screen controls "abysmal" and asked for the game itself to be the visual focus, with corner tooltips or contextual instructions for controls. Tester feedback: the timing bar needed the mouse on top of it, and the window "resized/refreshed" between enemy and ally turns.

- **Resize cause and fix:** the command deck sat below the stage in a flex column and changed height between turns (skills, move pad and Guard & End only on the player's turn), so the stage canvas resized and the camera reframed. Now `.arena-viewport` fills `.battlefield-container` absolutely and every control floats over it. The camera's safe margins come from fixed `--hud-top`/`--hud-bottom` per breakpoint (battlefield-layout.scss), never measured, so turn changes cannot reframe. A Playwright check saw one canvas size across 20+ turn changes.
- **Layout:** the site header and controller guide are hidden in battle (styles.scss). Top: troop banners in the corners (enemy's under the options), Round pill and turn timeline top-centre, contract/practice note under them. Top-right `.hud-system`: icon toggles for Auto (#auto-battle-btn), Timing, speed, log, and ☰ (#battle-menu-btn) opening `#battle-menu` with Restart (#restart-battle-btn), Overworld, Guild, War Room (#squad-builder-link) and Defense. Escape, B, or a click outside closes it; controller Menu opens it. Bottom `.command-deck` band: unit card (portrait, HP/MG/AP bars; #move-gauge and #action-gauge keep their ARIA), skills row, and `.turn-controls` (◀ ▲ ▼ ▶ icon buttons with the old ids, Guard & End). On an enemy turn the same band shows that unit's card and "… is acting". Contextual panels (targeting, aim, combo, assist) sit just above the band. Tablet portrait puts skills on their own row; phone portrait folds the arrows into a square and hides the Round pill; short landscape keeps one compact band.
- **Hints:** `hint` (computed) lists keys and labels for the current state (idle, targeting, aiming, combo, assist) in the player's input mode: keyboard/mouse, touch (last pointer was touch, or a coarse pointer at start) or controller (connected). Idle hints show as `.battle-hint` above the deck's right corner; when a panel is open its hint renders inside it (`.panel-keys`, shared `#hintKeys` template). The old `.combat-guide` line and the AI banner are gone.
- **Aim anywhere:** while aiming, a pointerdown anywhere except the options cluster or a dialog fires (pointerdown, for timing). During a combo, a pointerdown on open stage ground (not a button) chains the last skill. GamepadService.activate clicks a visible `[data-pad-confirm]` control (the aim's Fire) instead of the focused one.
- **Tests:** e2e updated for the menu (open ☰ before Restart or War Room), the hidden controller banner in battle, and the `on` toggle state; the aim test now also fires with a click on the stage. New unit tests: the pad-confirm claim and the battle menu. 324 unit tests, 109 browser tests pass. Screenshot helpers are in ignored `tmp/shots.mjs` and `tmp/enemy.mjs` (run with the dev server on 4300).

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

## Progression and hiring (2026-10-19)

Spec 1.2.1 and the MVP table's "Post-Battle EXP Gain & Leveling", "Post-Battle Currency Rewards" and "Mercenary Hiring (random aptitudes)".

- **Rules:** src/app/core/models/progression.model.ts is pure.
  - **Gold:** victory 100, defeat 20, plus 20 per enemy defeated.
  - **EXP:** victory 50, defeat 20, plus 15 per enemy defeated. A mercenary who fell gets half. TEC scales EXP by 2% per point from 17 (spec: TEC raises EXP).
  - **Levels:** the next level costs 60 + 40 × level EXP, and the cap is 50. Each level grants 5 statPoints and 1 SP. gainExp handles several level-ups at once.
  - **Investing:** investPoint adds 1 to the stat, plus a bonus point each time that stat's invested count reaches a multiple of APTITUDE_RATIO (S 2, A 3, B 4, C 5, D 6, E 7, F 8; spec: S needs 2, F needs 8).
  - **Hiring:** hireCost is 100 + 5 × the sum of grade indexes (F = 0, S = 6), roughly 200–250 for a typical recruit.
  - **Economy constants:** a board of 3 recruits, 20 gold to refresh it, a roster limit of 12 and 500 starting gold.
- **Mercenary:**
  - New fields: exp, statPoints and invested (points per stat). parseMercenary defaults missing values to 0, so old saves and v2 defense snapshots still load.
  - generateMercenary(classId, random, takenNames) avoids names already in the roster.
- **Roster save v2:** `{ version: 2, mercenaries, squadIds, gold, recruits }`, under the same key lanes.roster.v1. A v1 save is upgraded with 500 gold and a fresh board.
  - RosterService adds hire, refreshRecruits, dismiss (keeps at least one in the roster and the squad), invest and claimRewards(report).
  - claimRewards pays a report id once and caches the result, so revisiting the result screen shows the payout without paying again.
  - `random` is a public field so tests can replace it.
- **Battle:**
  - BattleStateService.battleReport is set when a battle ends, with the outcome, enemies defeated, and each roster mercenary's id and whether it survived. It is null while fighting.
  - BattlefieldComponent claims the report in an effect and shows the payout in the result dialog (#reward-gold, .reward-list, plus a Roster link after a level-up).
  - Restart calls refreshMercenaries(roster) first, so levelled sheets fight in the next battle.
  - Every battle pays the same way, including defense practice and Auto-Battle.
- **Roster page:**
  - A purse (#roster-gold), an EXP bar per mercenary, and "+" invest buttons per stat while points remain. The stat sheet goes to one column then, so it fits phones.
  - Dismiss asks twice ("Confirm?"), and the confirmation resets on blur.
  - A recruit board with Hire buttons (aria-label "Hire <name> for <n> gold") and #refresh-recruits-btn.
- **Tests:**
  - progression.model.spec.ts, plus roster economy cases, the battle report and the restart refresh: 236 unit tests pass.
  - e2e: the auto-battle test checks the payout and the purse on the Roster page; roster.spec checks hiring, refreshing and dismissing.
- **Not done:** skill patterns (classes have only three skills each), support skills that spend SP, scrolls or items, and a guild hub screen. Gold has no use besides hiring yet.

## Skill patterns and support skills (2026-10-19)

Spec 1.2.3 and the MVP table's "Mercenary Hiring (with random aptitudes & skill patterns)".

- **Skills:**
  - UnitClassDefinition.abilities stay the three core skills, known from level 1. advancedAbilities adds three per class (18 in all).
  - AbilityDefinition gains an optional `status` `{ type, duration, potency }` and the target 'self'.
  - Bulwark is now just `target: 'self'` with a defense-up status; its special cases in the executor are gone.
  - A powerMultiplier of 0 is a pure buff: no numbers, and the status lands on every target. It refuses when every target already has that status at least as strong ("X is already active.").
  - Damaging skills leave their status on every target still standing. A miss lands nothing.
  - UnitInstance.refreshStatusEffect replaces a status of the same type, so effects refresh rather than stack.
- **Patterns:** src/app/core/models/skills.model.ts.
  - rollPattern picks 2 of the 3 advanced skills, learned in levels 2–4 and 5–8.
  - knownAbilities(merc) = core skills + pattern skills at or below the mercenary's level.
  - Mercenary.pattern is rolled last in generateMercenary, so earlier rolls are unchanged. Saves without a pattern get a stable one seeded from the mercenary's id hash.
  - UnitInstance.abilities (constructor option) holds a mercenary's known skills; class troops keep the core three. Everything reads unit.abilities, not classDef.abilities: the executor's ownership check, AI, chains, hotkeys 1–5 and the skill list.
  - Defense orders validate against the defender's known skills. Swapping a defender resets only the orders the newcomer doesn't know.
- **Supports:**
  - SUPPORT_SKILLS: Iron Skin 4 SP, Vigor 4, Precision Fire 5 (from Lv 2), Rhythm 5 (Lv 2), Fleet Foot 5 (Lv 3), Second Wind 5 (Lv 3), Might 8 (Lv 5). Starting SP is 10, plus 1 per level.
  - Stat supports scale derived stats by +10% (applySupports inside deriveCombatStats).
  - Precision Fire makes aimSweepMs 25% longer. Rhythm widens justWindow by a quarter of its length on each side.
  - parseMercenary keeps only the supports that are known, unlocked and affordable.
  - RosterService.toggleSupport equips and unequips.
- **UI:**
  - Roster cards have a "Skills & supports" `<details>` with skill chips (locked ones show their level) and support buttons ("<Support> for <Name>: …", aria-pressed).
  - Recruit cards show "Learns X (Lv n), Y (Lv m)", and the War Room dossier lists the advanced pool.
  - Units show status badges (.status-badge, .harmful).
  - The result screen lists "Learned X"; MercenaryReward.learned holds the names.
  - Pure buffs glow on the stage instead of flinching (StageAction effect isBuff), and every new skill has a LOOKS entry reusing existing deliveries.
- **Tests:** skills.model.spec.ts, plus status, pattern, support and defense-order cases: 251 unit tests pass. New e2e tests cover equipping a support and a level-9 Brenna using Pinning Shot (STUN badge).
- **Not done:**
  - Grimoires and scrolls, plus Tactics and Charm scrolls (aptitude upgrades and respecs).
  - Status visuals on the 3D stage beyond badges.
  - AI use of pure buffs (the AI only picks damaging or healing skills).
  - With five skills, the desktop command deck grows about 50 px.

## Battle screen fits the window (2026-10-19)

The user wants the battle page never to scroll: "that doesn't make for a fun game".

- **Shell:**
  - BattlefieldComponent adds body.battle-screen while it is shown. Rules in src/styles.scss then size the shell to 100dvh: a one-row header whose nav scrolls sideways, no footer, and app-battlefield takes the rest.
  - Short landscape screens (max-height 500px) hide the site header; the battle toolbar still links to the War Room and Defense.
  - Menu pages keep the normal scrolling shell.
- **Battle:**
  - The container is a flex column; .arena-viewport flexes (min 150px) instead of a fixed clamp height, and the stage camera already fits whatever size it gets.
  - The toolbar stays one row and scrolls sideways when narrow. Skill buttons are 34px.
- **Layout file:** the responsive rules now live in src/app/battle/battlefield-layout.scss, the component's second styleUrl. This keeps both files under the 20 kB per-stylesheet budget.
  - Phone portrait: skills beside the gauges, a compact dossier, and a one-line Guard & End.
  - Short landscape: a grid with the deck beside the stage, scrolling inside the deck if needed.
  - The combat guide line hides under 900px.
- **Tests:**
  - A new e2e test checks scrollHeight ≤ innerHeight at all four viewports, even with five skills, and that the turn's controls are on screen.
  - The smoke test checks the full shell (footer, brand) on /status. The controller test starts its D-pad navigation on /status.
  - Menus (Roster, War Room) may still scroll.

## AI buffs and statuses on the stage (2026-10-19)

- **AI:** src/app/core/engine/ai-tactics.ts is pure.
  - statusValue(ability, target, damage) prices a skill's status in HP: stun 40, poison up to potency × duration, attack-down and defense-down their potency. It is 0 when the target already has it or the hit kills.
  - The role AI adds statusValue to its damage score, so a stun or debuff can beat a slightly bigger hit.
  - chooseBuff(unit, units) picks a pure buff when it reaches the caster (self buffs) or at least two allies who lack it, and leaves AP for the cheapest attack. The AI casts it, then attacks on the next pass.
  - Class troops' Fighters now raise Bulwark when they have AP to spare.
- **Stage:**
  - StageUnit.statuses replaces `buffed`.
  - A ground ring shows buffs: gold for Defense, red-gold once Attack is up. A purple ring shows debuffs.
  - Three glowing stars circle a stunned unit's head, below the DOM name plate (static under reduced motion).
  - Poisoned units shed green particles every 0.35–0.65 s (every 1.2 s under reduced motion). The frame loop stays awake while stars or poison show.
- **Tests:** ai-tactics.spec.ts; 253 unit tests and 67 e2e tests pass.

## Tall-stage camera (2026-10-19)

- stage-layout.ts stageView(aspect) returns { pitch, figureScale }.
  - Wide stages (aspect 1.3 or more) keep the 18° side view at scale 1.
  - A tall, narrow stage (aspect 0.9 or less, e.g. a phone held upright) looks down at 34° and draws figures at 1.5×. Between the two, it blends.
- placeCamera and fitFrame take a pitch. The camera director computes the view on resize, scales its framing points by figureScale, and exposes figureScale().
- stage-scene scales each view's group (figure, rings, shield, stars). The overlay places DOM buttons using the scaled head height, and chest() uses it too.
- stage-units divides the world-space offsets (lunges, knockback, lane hops) by the group scale, so a scaled figure still lands where the choreography aims it.
- Tests: stageView and a tall-pitch fitFrame case in stage-layout.spec.ts; 255 unit tests and 67 e2e tests pass.

## Assist gauge (2026-10-19)

Spec 1.1.5: "an Assist Gauge fills as a player deals damage and defeats enemy units… expending a portion… calls an Assist Attack from an allied unit… outside of their normal turn."

- **Rules:** src/app/core/engine/assist.ts is pure.
  - Each side's gauge runs 0–300, three orbs of 100.
  - assistGain adds half the damage dealt to enemies (no friendly fire, heals or misses) plus 25 per defeat.
  - pursuitFor(ally) uses the ally's first damaging skill, aimed at the preferred (targeted) unit if it can reach it, otherwise at the weakest it can reach; area skills hit everyone in reach. Stunned or dead allies can't answer.
  - assistCandidates lists every ally of the acting unit who has a pursuit.
- **Service:**
  - BattleStateService.assistGauge holds both gauges and is reset on every new battle. assistOptions is computed for the player's turn when an orb is ready (not while aiming).
  - callAssist(allyId) runs CombatExecutor.execute with spendAp = false, takes 100, logs "🤝 Assist!", floats "ASSIST" and plays the ally's choreography. A pursuit does not refill the gauge, and it ends any combo.
  - The tail shared by every resolved skill is now resolveAction(), which also fills the gauge.
- **AI:** tryLethalAssist runs at the start of each AI action and spends an orb only when a single-target pursuit would defeat its target. This covers enemies, Auto-Battle, and defense practice's fallback (not scripted orders).
- **UI:**
  - Three conic-filled .orb elements under each troop banner's pips, glowing when full.
  - #assist-btn ("🤝 Assist · n") under the player banner while an option exists.
  - Q or the button opens .assist-panel in the targeting slot. It lists "n · Ally: Skill → Target"; 1–4 call that ally, and Escape, Q or Cancel close it. Opening it cancels a skill selection.
- **Styles:** the aim and combo styles moved to battlefield-execution.scss, the third styleUrl, to stay within the 20 kB per-stylesheet budget.
- **Tests:** assist.spec.ts, plus service cases for the free pursuit, the gauge spend and the AI's lethal-only assist: 260 unit tests pass.
  - The e2e test grants an orb through the dev-mode `ng.getComponent(...).battle` handle; filling it through play takes several turns.

## Guild Hall and contracts (2026-10-19)

The spec's MVP "Basic Guild Hub". The user said the backend waits until the game is fun, so the work stays offline. The skirmish was always the same four base-stat troops and got easier as the squad levelled; contracts scale with the squad.

- **Model:** src/app/core/models/contract.model.ts.
  - veteran(classId, level) levels a generated mercenary and invests every point in CLASS_FOCUS (now exported) in turn.
  - Tiers (TIERS): Easy is 3 enemies at squad level − 1, rewards ×1.2. Normal is 4 at squad level, ×1.6. Hard is 4 at squad level + 2, ×2.2.
  - Every band leads with a frontliner (Fighter or Lancer). Enemy names come from their own ENEMY_NAMES pool, so they never clash with the roster.
  - A board has three different bands (from BANDS, each with a title). parseContract never trusts a saved reward multiplier; the tier sets it.
- **Rewards:** BattleReport has optional rewardMultiplier and contractId, and battleGold and battleExp scale by the multiplier.
- **Service:** GuildService (localStorage lanes.guild.v1) keeps the board, a won-contracts count and partyLevel (the squad's average level). complete(id) replaces a won contract with a new one of its tier at the current party level. refresh() posts a new board for free.
- **Battle:**
  - BattleStateService.deployContract(contract, squad) passes the contract as initSkirmish's fifth argument. The activeContract signal survives restarts and is cleared by any other deployment.
  - Contract enemies use their mercenary names, derived stats and known skills.
  - The battle shows a .contract-note line, and the enemy banner shows the band's name.
  - BattlefieldComponent completes the contract after a victory (a loss leaves it up). The result dialog then has #modal-guild-btn.
- **UI:**
  - The /guild page shows gold, squad level, contracts won, the squad strip, links to the War Room, Roster and Defense, and the contract cards (#take-contract-easy|normal|hard). "Post new contracts" is #refresh-contracts-btn.
  - The site nav has 🏰 Guild (#nav-link-guild) after Battlefield, and the battle toolbar has #guild-link.
- **Fix:** on short screens the result dialog was taller than the window, and the battle screen doesn't scroll, so its buttons were unreachable. The overlay now scrolls inside itself, and under 500px tall the dialog hides its icon and summary.
- **Tests:**
  - contract.model.spec.ts and guild.service.spec.ts, plus a contract battle case: 268 unit tests pass.
  - e2e/guild.spec.ts takes the Normal contract, checks the band and the no-scroll layout, restarts, wins (through the dev handle), and sees the board replace it.
  - The controller test now steps through Guild on its way to Squad Builder.

## Melee reach and knockback (2026-10-19)

Spec 1.1.1: a unit's position "dictates its attack range". Until now melee skills hit from anywhere, so movement barely mattered.

- **Field:** src/app/core/engine/field.ts holds the field geometry (FIELD_MIN_X/MAX_X, COLLISION_BUFFER, MOVE_COST_PER_FIELD, moved out of the service, which re-exports COLLISION_BUFFER). It also has meleeReach(unit) = 0.18 × stats.meleeRange (Fighter 0.18, Lancer 0.36), needsReach (melee archetype, enemy-targeted, not all-enemies), inReach, and slideRoom (the distance to the edge or a lane-mate).
- **Reach:** CombatExecutor.getValidTargets filters by reach after the target scope (inScope), so melee AoE (Provoke, Whirlwind, Skewer) also hits only enemies within reach. Starting formations put the Lancer exactly at reach of the enemy front line; a Fighter has to advance about 0.18 (9 MG).
- **Knockback:**
  - AbilityDefinition.knockback is a field fraction: Shield Bash 0.08, Shield Charge 0.14, Whirlwind 0.06, Explosive Shot 0.06.
  - After damage, enemies hit (never allies, misses or heals) are pushed directly away from the attacker, farthest first.
  - A push cut short by a lane-mate or the edge is a slam: it does a quarter of the hit again (included in amount).
  - TargetEffect has pushed and crash; text reads "PUSHED" or "SLAM -n", with matching log lines.
- **AI:** closeIn(unit) walks a melee unit toward the nearest enemy in its lane until it is in reach, as far as its MG allows (this replaces the old fixed 0.08 step). Scripted defense orders with a melee skill close in first too.
- **Stage:** BattleAction effects carry pushedFrom. The battle-stage component holds a pushed unit's x there (a `held` signal) until IMPACT_DELAY_MS × speed, so it slides back as the blow lands rather than before.
- **UI:** the targeting panel shows #reach-warning ("No enemy in reach: advance…") when a melee skill has no target in reach; Confirm is disabled then.
- **Tests:** field.spec.ts (reach, slide room, push, slam, blast pushing only enemies), an AI close-in case, and updated tests that had melee attacking from across the field: 274 unit tests pass. In e2e, the combo test fields Dara alone (front to front with the enemy Lancer), the assist test now expects Cassian's Holy Smite, and a new test steps Dara out of and back into reach.

## Blender pipeline: what it needs (2026-10-19)

The user asked what they need to provide. Nothing is needed to run it: Blender 5.2 is installed under C:/Program Files/Blender Foundation, the Quaternius packs (UBC, UAL, Outfits) are in C:/Users/chris/LanesArt, and tools/characters/build.py is in the repo. Only these need the user:

- buying Quaternius's paid tiers, for more outfits (Knight, Wizard) and animations (launch, juggle);
- approving each download, or supplying images, for new battle backdrops;
- art direction (for example toon outlines).

## Battlefield objects: barricades and traps (2026-10-19)

Spec 1.1.5 ("barricades to impede movement, traps to inflict damage or status"; siege weapons are not done).

- **Barricades:** object units of BARRICADE_CLASS (unit-class.model.ts, flagged `object: true`; not in ALL_CLASSES). UnitInstance.isObject means:
  - It takes no turns (TurnManager.setOrder skips it) and doesn't decide a battle (checkBattleStatus counts fighters only).
  - It isn't in enemyUnits() or the troop pips, the leader tag or the reward kill count.
  - It is never an ally target (no heals or buffs), takes no statuses and can't be knocked back.
  - It is a unit, so it blocks movement (collision) and, as the nearest enemy in its lane, takes direct same-lane attacks (Shield Bash, Quick Shot) aimed at the units behind it. Cross-lane, any-lane and area skills go past it. Its HP and defenses scale with the contract level (barricadeStats).
- **Traps:** src/app/core/models/field-object.model.ts.
  - FieldTrap { kind: spikes | snare, team, lane, x, damage, status }. Spikes do 20 + 4 per level and poison; a snare does 15 + 3 per level and stuns for a turn.
  - trapsCrossed finds the opposing side's traps in the lane within ±0.02 of the path; springTrap deals the damage (Guard absorbs) and applies the status.
  - BattleStateService.traps holds them. springTraps runs after moveActiveUnit, after a lane switch (at the landing spot) and after a knockback (along the push), so shoving a foe onto a trap springs it.
  - A trap is gone once sprung. A unit felled on its own turn ends that turn.
- **Contracts:** Contract.objects (FieldObjectSpec[]; older saves have none).
  - Easy sets 1 trap, Normal 1 barricade and 1 trap, Hard 1 barricade and 2 traps.
  - Barricades stand at x 0.6, just ahead of the band's front line, in a random lane. Traps sit at x 0.44–0.56, one per lane.
  - Objects come only from contracts (initSkirmish places them from activeContract).
- **AI:**
  - Lane choice, closing in and target sorting look at fighters, not objects.
  - Damage to a barricade scores at 0.4×, so the AI breaks one only when nothing better is in reach.
  - closeIn stops 0.04 short of an enemy trap ahead.
- **Stage:** stage-objects.ts.
  - createBarricade() is a procedural cheval-de-frise (log and crossed stakes) that answers the Character interface, used by stage-units for the 'barricade' class; a hit flashes it and death topples it.
  - createTrapField draws spike rings or a rope coil per trap. A trap that disappears with a unit standing on it bursts; one that disappears because the battle reset just goes.
  - StageState.traps comes from battle.traps().
- **Fallback:** sprite-art has a barricade SVG. .trap-marker spans (📍 spikes, 🪢 snare) are positioned by x in fallback mode and visually hidden but announced (role img, aria-label) on the 3D stage.
- **Tests:** field-object.model.spec.ts (crossing, springing, barricade blocking, no turns, no knockback, per-tier placement, parsing), plus a service case (barricade and snare from a contract, springing on walking, victory without breaking the barricade): 281 unit tests pass.
  - e2e: a Hard contract shows the barricade (not counted in pips or turns) and two trap markers; the Normal-contract test excludes its barricade from the band.

## Full controller support (2026-10-20)

The user asked for full controller support, with their other repos as examples. tower-defense's GamepadService uses the same layout (A confirm, B cancel, X/Y main actions, LB/RB cycle, View/Menu utility).

- **GamepadService:** new actions end-turn (X, button 2), assist (Y, 3), walk-left and walk-right (LT/RT, 6/7, on press) with walk-stop on release (sent even under a dialog), toggle-log (View, 8) and menu (Menu, 9).
  - The battle commands are ignored while a modal dialog is open; A and B still work there.
  - focus(element) moves focus with the .gamepad-focused highlight.
- **Battle:** the subscription in BattlefieldComponent handles every action.
  - View and Menu work on any turn; the rest only on the player's turn.
  - B closes the assist panel before it cancels a selection. X is endCurrentTurn, and Y is toggleAssist.
  - LT/RT take a step, then startWalk while held, as holding A or D does.
- **Focus:** focusFor(selector) uses the controller highlight when a controller is connected, plain focus otherwise.
  - The battle verdict focuses #modal-restart-btn.
  - With a controller connected, each new player turn focuses the first enabled skill.
  - Opening the assist panel focuses its first ally.
- **UI:** .pad-glyph badges (View on Log, Y on Assist, X on Guard & End) show while a controller is connected, and the header's controller guide lists the full map.
- **Tests:** gamepad.service.spec.ts covers the new buttons, triggers and dialog behaviour and the focus helper (284 unit tests). A new e2e test drives a whole turn with the virtual controller: focus on the first skill, an RT walk, View, Y then B, X, and A on the verdict.

## Single-player foundation (2026-10-20)

The user asked to finish everything that doesn't need a backend: "a solid single player game that we can add a campaign and story to". Async multiplayer comes later.

- **Routes:** the Guild Hall is home (`/`); the battle moved to `/battle`, and `/guild` redirects home. Every page but the Guild Hall is lazy-loaded (initial bundle ~350 kB, down from ~496 kB, which was at the 500 kB warning). The nav is Guild Hall, Campaign, Battle, War Room, Roster, Defense Orders, Options; Diagnostics moved to the footer and the Options page. Menu pages' back links say "◀ Guild Hall".
- **Guild Hall:** a campaign card (#guild-campaign-link, "Begin/Continue the story"), a "Battle under way" card with #resume-battle-btn while a battle is unfinished, #skirmish-btn (class troops at base pay), the guild store, and the contract board.
- **Campaign:** src/app/core/models/campaign.model.ts (types, order and unlock rules, missionContract), campaign-story.ts (the story data; its header explains how to add missions), CampaignService (lanes.campaign.v1, `cleared` ids), src/app/campaign/ (page and scene dialog).
  - A mission is a Contract with `missionId`, enemies rolled as veterans from a seed of the mission id (same band every time), tier 'normal' pay (×1.6). BattleReport carries `missionId` instead of `contractId` for these.
  - Missions unlock in order. CampaignService.complete(missionId, reportId) pays the first-win reward (gold and items) once and caches by report id, like claimRewards.
  - Scenes: briefing before the battle, aftermath after. `{leader}` is the first squad member's name; a line's portrait is a class id or 'leader'. The scene dialog is role=dialog aria-modal, so a controller's B sends Escape (closes). "Skip to battle" deploys.
  - The result dialog shows #reward-story and #modal-story-btn ("Continue the story" → /campaign?debrief=id, focused by the verdict effect); a story defeat links back to the campaign.
  - The prologue "The Three Roads" (4 missions, levels 1–4) teaches movement, reach, traps, barricades and assists, and ends on a hook (crated swords under a seal). It is a first draft for the user to rewrite.
- **Items:** src/app/core/models/item.model.ts. Tactics Scroll (300 g) raises an aptitude one grade and back-pays the better rate on points already invested, which keeps stats = base + invested + floor(invested / ratio) true; Charm Scroll (200 g) refunds invested points by that formula. A Grimoire (`grimoire:<skill id>`) is scribed for 150 g from a mercenary who has learned the pattern skill and teaches it to another of the class in place of a pattern step (same level), so a mercenary still knows at most five skills.
  - RosterService: `items` (saved in the roster save as `items`; older saves have none), buy, useTactics, useCharm, scribe, useGrimoire, grant(gold, items).
  - The guild store (#buy-tactics, #buy-charm, #owned-*) and a "Scrolls & grimoires" panel (.items-panel) on each roster card.
  - Half of Hard contracts carry `bounty` (a scroll), shown on the card and the result (#reward-bounty); GuildService.complete now returns the won contract so the bounty is paid once.
  - Defense orders for a skill of the defender's class it no longer knows (a grimoire replaced it, or not learned yet) now become auto instead of rejecting the plan.
- **Options:** src/app/options/options.component.ts (inline template). Timing toggle; save backup (createSaveFile/parseSaveFile in save-file.model.ts, keys in SAVE_KEYS), restore from a file (replaces every key, then reloads to home) and "Start a new game" (pressed twice).
- **Tests:** E2E_PORT lets Playwright serve and test another port (`E2E_PORT=4300 npx playwright test`). New e2e: campaign.spec.ts, options.spec.ts, and a scroll test in roster.spec.ts; e2e that visited `/` for a battle now visit `/battle`. Do not run Prettier while an e2e run uses the dev server: its live reload aborts tests mid-run.

## Player-placed barricades and traps (2026-10-20)

- **Skills:** AbilityDefinition.place ('barricade' | 'spikes' | 'snare') with target 'self' and power 0. Fighter's advanced pool gains Raise Barricade (50 AP), Archer's gains Snare Trap (30 AP); their pools are now four, and patterns still pick two. Saved patterns are unchanged; only new rolls (and pre-pattern legacy saves) see the larger pool.
- **Rule:** placementSpot(unit, kind, units, traps) in field-object.model.ts: a barricade 0.1 ahead (toward the enemy) if nobody is in the way or within COLLISION_BUFFER of the spot, a trap 0.2 ahead if inside the field and not within 0.04 of another trap in the lane.
- **Service:** executeSelectedAbility routes place skills to placeObject (not CombatExecutor). It spends the AP, adds a barricade unit (team = the user's, stats barricadeStats(user level)) or a trap (makeTrap with the user's team and level), logs, floats text, and publishes a self-targeted buff lastAction so the stage glows. levelOf holds each mercenary unit's level. One at a time: hasPlaced(unit) is true while the user's last barricade stands or its trap is unsprung (placedBy map). `placement` is the computed spot for the selected skill; the targeting panel shows #placement-warning and disables Confirm when it is null.
- **AI:** choosePlacement(unit, units, traps, placedAlready) in ai-tactics.ts runs after healing and before buffs in triggerAiTurn (enemies and Auto-Battle). A barricade goes up while no foe in the lane is in reach yet and a non-melee ally stands behind the spot; a trap goes down when a melee foe in the lane is beyond the spot (it must walk across) and AP is left for the cheapest attack. Scripted defense orders can place too (chooseDefenseTarget returns the user for 'self'). Since closeIn stops short of enemy traps, an AI melee unit facing a snare halts in front of it rather than walking in.
- **Stage:** new barricade units appear through the normal view sync; traps carry their team, and the player's glow blue (the enemy's red). DOM trap markers say "Your snare in lane N" / "Enemy spike trap in lane N" and have .own for the player's.
- **Tests:** placementSpot cases, a service test (snare and barricade placement, blocking, one-at-a-time, springing), an e2e test placing a snare through the UI.
- **Unit-test storage leaks:** service specs replace `window.localStorage` with a fake Map-backed object, and in CI (fewer workers) that fake and its contents carry into later spec files. A component spec that depends on the roster must clear `lanes.roster.v1` first (squad-select.component.spec.ts does, with `window.localStorage?.removeItem`, since a fresh local worker has no localStorage at all).

## Immediate next steps

1. Story: write the real campaign (chapter 1 onward) in campaign-story.ts; consider per-mission backdrops, special victory conditions (protect a unit, survive N rounds) and story-only enemy names on the stage.
2. Art: more backdrops per battle, visible equipment through hand-bone attachments, and launch, juggle and combo clips for the timing-based combat.
3. Objects in saved defense plans (pre-placed, as contracts have). Launch and juggle states need new clips. The online milestone needs real identity, authoritative storage, defense snapshots, matchmaking, deterministic validation, rewards and history; none exists now. Do not label local practice as network PvP.

## Request, references, and constraints

The user asked to make Lanes closer to **Project Valkyrie: A Technical Architecture and MVP Specification for a Web-Based Tactical RPG**, explicitly authorized helpful libraries such as Three.js, requested controller support, and asked that this handoff stay current. Specification: [docs/project-valkyrie.md](docs/project-valkyrie.md), converted to Markdown from the original paste at C:\Users\chris\.codex\attachments\fa375353-2eea-47af-9ae9-8708d97ce1c5\Pasted text.txt.

Read C:\Users\chris\OneDrive\Documents\GitHub\GEMINI.md and repository INSTRUCTIONS.md when resuming. Keep the Angular PWA and GitHub Pages behavior, responsive UI and accessibility, and pure TypeScript combat logic. Prefer necessary, focused additions over broad architecture changes. Run formatter, lint, unit tests, production build, Pages preparation, and relevant browser checks; launch and inspect the actual game, not just source or tests.

The supplied document's Phaser/microservices ideas are recommendations. Current Angular/TypeScript/Three.js foundation is functional. Campaign missions, battlefield objects, and a first board-game expedition are now implemented. Equipment forging and the online war meta-game remain deferred.
