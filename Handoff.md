# Project Valkyrie handoff

Updated: 2026-09-24. This file is the resume point between implementation steps and usage-limit interruptions.

## Latest checkpoint — resumed after usage limit, 2026-09-24 morning

The user asked to continue from current files: read handoff, inspect changes, test/build, launch, fix regressions, then continue unfinished work. All prior edits are still uncommitted on top of `0611899`; preserve them.

- Engine, four-member squads, Three.js terrain, controller service/shell, and battlefield integration are implemented. Controller support was an additional explicit user requirement. Critter Rancher (`C:\Users\chris\OneDrive\Documents\ChatGPT\Critter Rancher`) is the verified reference; the sibling `angular-pwa-starter` checkout's `src` did not contain a controller implementation.
- `npm ci` succeeded with escalation. Three.js `0.186.0` and types installed. Dependency versions are recorded in lockfile.
- Production build and lint passed on resume. Initial unit run: 111 passed, 2 stale six-unit assertions failed. Those were updated for eight combatants.
- Added service integration tests for resource independence, Guard/recovery, reactive timeline, stale timers, navigation pause, formation, and combat completion. AI now spends successive affordable skills and values shield depletion, fixing a Fighter mirror that previously stalled indefinitely. Full suite rerun pending after correcting two test fixtures.
- Browser launched at `http://127.0.0.1:4200/` (npm dev server, session 71733). Manual live browser proof: movement 100→98 MG leaves AP100; Quick Shot via Enter costs20 AP once, enemy100→57 HP; Guard converts remaining80 AP into84 shield and advances to Lancer.
- Pending: finish controller/browser regression tests, responsive screenshots, formatter/all gates. Do this before next feature.
- Next feature after gates: local four-turn defense scripting and practice battle. No network PvP claim.

## Request and reference

Bring Lanes closer to the supplied **Project Valkyrie: A Technical Architecture and MVP Specification for a Web-Based Tactical RPG**. User explicitly welcomes helpful libraries, including Three.js. Keep this handoff current.

Reference: `C:\Users\chris\.codex\attachments\fa375353-2eea-47af-9ae9-8708d97ce1c5\Pasted text.txt`.

Read `C:\Users\chris\OneDrive\Documents\GitHub\GEMINI.md` and repository `INSTRUCTIONS.md` before continuing. Preserve the Angular PWA, Pages deployment, accessibility, and dependency-free TypeScript combat rules. A rendering dependency is authorized by the user.

## Current milestone — in progress

1. Separate movement and action resources, with partial per-unit-turn recovery from AGI/VIT.
2. Convert remaining actions into Guard, show absorption and recovery in combat.
3. Add melee > ranged > magic > melee damage advantage; specialists neutral.
4. Support squads of 1–4 and safe four-member starting formations.
5. Correct initiative display, turn lifecycle, and AI scheduling while integrating mechanics.
6. Add a lightweight Three.js battlefield beneath the existing unit UI, retaining a non-WebGL fallback.
7. Run formatter, lint, unit tests, production build, multi-viewport end-to-end tests, and inspect the running game in a real browser.

## Work ownership / resume notes

- Root: service lifecycle, battlefield UI, tests, integration, verification, documentation.
- `combat_foundation`: engine/models plus corresponding tests. Incoming API: `moveGauge`, `guardPoints`, `moveRecovery`, `actionRecovery`, `guardPotential`, `startTurn()`, `enterGuard()`, `classDef.archetype`, `TargetEffect.guardAbsorbed`.
- `four_member_squads`: squad component and tests only. Defaults: Fighter/Archer/Cleric/Lancer vs Lancer/Gunner/Witch/Fighter.
- `spec_review`: review followed by standalone `app-arena-scene` Three.js component.
- Initial checkout clean at `0611899`. No commit or publication yet.
- Dependency installation initially hit sandbox/cache/network permissions; approved escalation succeeded.
- No relevant Lanes/Valkyrie prior memory entry found.

## Specification alignment and remaining roadmap

Already present: three horizontal lanes, six distinct classes and skills, cross-lane attacks, friendly-fire AoE, manual and automatic skirmishes, squad builder, installable PWA.

Next playable milestone: local four-turn defense scripting and a practice challenge against the configured detachment, with role-based fallback. Clearly label local practice; it is not asynchronous online PvP.

Then: persistent mercenary roster, nine-stat character sheet, randomized aptitudes and skill patterns, hiring currency, battle EXP and level-up rewards, guild hub, interactive targeting and melee timing, remaining classes and support skills.

Online milestone still requires an actual authoritative backend, identity/authentication, transactional player storage, defense snapshots, matchmaking, validated deterministic battles, rewards and battle history. No server, accounts, database, cloud deployment, or network PvP currently exists. The document's Phaser/microservices suggestions are architectural recommendations; use existing Angular/pure TypeScript foundations until concrete requirements justify changes. Avoid introducing several services solely to mirror the document.

Deferred by the document: equipment forging, war meta-game, battlefield objects, campaign quests, board-game traversal.

## Validation status

Current checkpoint above supersedes the original pending status. Full final gates and responsive verification still required. Do not treat source edits as playable or browser-verified proof.
