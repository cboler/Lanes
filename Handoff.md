# Project Valkyrie handoff

Updated: 2026-09-24. Resume here after an implementation step or usage-limit interruption. Continue the current repository state; do not recreate completed milestones.

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

## Immediate next steps

1. The next specification feature is a **persistent mercenary roster and nine-stat character sheet**, including randomized aptitudes/skill patterns. The document names STR, MAG, TEC, VIT, STM, SPI, AGI, CON, and SP; its eight primary stats have F–S aptitudes. Start with a small, playable vertical slice and tests for persistence and combat stat use before adding hiring currency, EXP, and a guild hub. The existing combat model has derived values, so map new attributes deliberately without replacing working rules all at once.
2. Later: interactive targeting and melee timing, remaining classes/support skills, hiring currency, battle EXP and level-up rewards, and guild hub. The online milestone needs real identity, authoritative storage, defense snapshots, matchmaking, deterministic validation, rewards, and history; none exists now. Do not label local practice as network PvP.

## Request, references, and constraints

The user asked to make Lanes closer to **Project Valkyrie: A Technical Architecture and MVP Specification for a Web-Based Tactical RPG**, explicitly authorized helpful libraries such as Three.js, requested controller support, and asked that this handoff stay current. Specification: C:\Users\chris\.codex\attachments\fa375353-2eea-47af-9ae9-8708d97ce1c5\Pasted text.txt.

Read C:\Users\chris\OneDrive\Documents\GitHub\GEMINI.md and repository INSTRUCTIONS.md when resuming. Keep the Angular PWA and GitHub Pages behavior, responsive UI and accessibility, and pure TypeScript combat logic. Prefer necessary, focused additions over broad architecture changes. Run formatter, lint, unit tests, production build, Pages preparation, and relevant browser checks; launch and inspect the actual game, not just source or tests.

The supplied document's Phaser/microservices ideas are recommendations. Current Angular/TypeScript/Three.js foundation is functional. Equipment forging, war meta-game, battlefield objects, campaign quests, and board-game traversal remain deferred in the reference specification.
