# Lanes

A lane-based tactical RPG built as a modern **Angular PWA**, inspired by [Grand Kingdom](https://en.wikipedia.org/wiki/Grand_Kingdom) (PS4/PSVita).

## About

Lanes is a playable local prototype moving toward the [Project Valkyrie design](docs/project-valkyrie.md). It combines tactical positioning across three lanes with separate movement and action budgets. Players follow a story campaign, take contracts from the Guild Hall, build and train a roster of mercenaries, script a defending squad's opening turns, and practice against it. Everything runs offline in the browser.

### Key Features

- **3-Lane Combat**: Units occupy horizontal lanes and can shift between them. Front units screen allies in their lane.
- **Dual Gauges and Guard**: Horizontal movement and lane shifts spend Move Gauge (MG); abilities spend Action Gauge (AP). Agility and Vitality restore part of each gauge at the start of a unit's turn. Unspent AP becomes a Technique-powered Guard shield.
- **Tactical Triangle**: Melee beats Ranged, Ranged beats Magic, and Magic beats Melee for 25% bonus damage. Specialists are neutral.
- **6 Diverse Unit Classes**:
  - **Fighter**: Frontline heavy tank with high HP/DEF, Shield Bash, Provoke, and Bulwark.
  - **Cleric**: Divine support healer with Mend (cross-lane), Holy Smite, and party-wide Bless.
  - **Archer**: High-speed sniper with Quick Shot, Piercing Arrow (cross-lane), and Volley (lane AoE).
  - **Witch**: Glass-cannon elemental caster with Fire Bolt, Inferno (lane AoE), and Meteor (battlefield AoE with friendly-fire risk).
  - **Lancer**: Fast melee striker with long polearm reach, Thrust, Piercing Lunge (cross-lane), and Whirlwind.
  - **Gunner**: Explosive ranged powerhouse with Quick Fire, Snipe (cross-lane), and Explosive Shot (lane AoE with friendly-fire risk).
- **Interactive Execution**: As in Grand Kingdom, attacks reward timing. Ranged and magic skills fire from a cursor sweeping toward the target: dead centre is a critical (×1.3), the gold band a hit, its edge a graze (half damage), and anything else, including letting the cursor run out, misses while still spending the AP. Melee skills chain: after a strike lands, pressing a melee skill (or the target) again links a combo (×1.1), and pressing it on the white flash is a Just Cancel (×1.3). Enemy AI, defense orders and Auto-Battle always resolve at normal power, so they stay deterministic. The 🎯 Timing toggle turns timing off for players who prefer it; it is remembered on this device.
- **Campaign**: A story told in chapters of missions, played in order from the Campaign page. Each mission opens with a briefing scene and closes with an aftermath scene (portraits, speakers and lines; Enter or A reads on, Escape or B closes). Missions field fixed, named enemy bands with their own barricades and traps, pay like a Normal contract, and add a one-time first-win bonus of gold and scrolls. Won missions can be replayed. The prologue, "The Three Roads", doubles as the tutorial. The story is data in [campaign-story.ts](src/app/core/models/campaign-story.ts); adding a mission is adding an entry.
- **Guild Hall and Contracts**: The Guild Hall is the home screen: it shows the next story mission, resumes an unfinished battle, starts a practice skirmish, sells scrolls, and posts three contracts (Easy, Normal, Hard) against named bands of enemy mercenaries scaled to your squad's level, paying ×1.2, ×1.6 and ×2.2 rewards. Win one and a new contract takes its place; lose and it stays up for another try. Half of all Hard contracts also post a scroll as a bounty.
- **Scrolls and Grimoires**: The guild store sells Tactics Scrolls (300 gold: raise one stat's aptitude a grade, back-paying the better rate on points already invested) and Charm Scrolls (200 gold: refund every invested stat point to spend again). A mercenary who has learned a pattern skill can scribe it into a Grimoire (150 gold), which teaches that skill to another mercenary of the class in place of one of its pattern skills. Scrolls are used from each mercenary's card on the Roster; story missions and Hard contract bounties also award them.
- **Save Backup**: The Options page downloads every saved roster, item, contract and mission as one backup file, restores it on this or another device, or starts a new game (pressed twice).
- **Battlefield Objects**: Contract bands raise barricades and set traps (Easy: a trap; Normal: a barricade and a trap; Hard: a barricade and two traps). A barricade blocks its lane and takes direct attacks meant for the units behind it until it is broken or flanked through another lane; it never acts and does not count toward victory. Traps (spikes that poison, snares that stun) spring on the first enemy to walk over them or be knocked into them. Your side can set objects too: a Fighter who learns Raise Barricade plants one a short way ahead in its lane, and an Archer who learns Snare Trap hides a snare farther down it (blue on the stage, where the enemy's glow red). Each unit keeps one such object on the field at a time.
- **Assist Gauge**: Each side's three orbs (under its troop banner) fill as it deals damage and defeats enemies. On your turn, spend a full orb (Q or the Assist button) to have another squad member make a free pursuit attack with its basic skill, outside its turn. Enemies spend orbs only to finish a unit off.
- **Melee Reach and Knockback**: Position decides reach. Melee skills hit only enemies within reach along the lane (a Fighter's shield reaches about a fifth of the field, a Lancer's polearm twice that), so melee units must close in; the AI walks into reach too. Shield Bash, Shield Charge, Whirlwind and Explosive Shot knock enemies back, and one slammed into a lane-mate or the field's edge takes a quarter of the hit again.
- **Cross-Lane & AoE Mechanics**: Select abilities can reach across lanes or strike full lanes, while careless high-impact spells risk friendly fire.
- **Squad Formation Builder**: The War Room fields 1–4 of your roster's mercenaries (the rest wait as reserves) against 1–4 class-based opponent troops, and shows class dossiers. Four is the default; two units share one lane. The first battle of a visit uses the same squad.
- **Defense Orders**: Choose up to four roster mercenaries to defend and set each one's first four own turns with a skill or Guard and a target priority. The plan keeps a copy of each defender's stat sheet, as a defense sent to another player would. Invalid or unavailable orders use local AI fallback; after four turns, fallback takes over. Plans are saved in browser storage on this device. Practice pits your current squad against the plan; a mercenary on both sides is marked "(Def)" when defending. Practice is local; there are no accounts, server battles, matchmaking, or online PvP yet.
- **Mercenary Roster**: A persistent roster of named mercenaries with a nine-stat sheet (STR, MAG, TEC, VIT, STM, SPI, AGI, CON, SP) and randomized F–S aptitudes. Stats scale the combat numbers of the mercenary's class, and the roster page deploys a chosen squad into battle. Saved in browser storage on this device.
- **Skill Patterns and Support Skills**: Each class has three core skills every mercenary knows, plus three advanced skills (four for Fighters and Archers) that stun, poison, buff, debuff, reach further or set objects on the field. A mercenary's skill pattern, rolled when it is created, teaches two of the advanced skills at set levels. Recruits show their pattern, so it pays to hunt for the one you want. Statuses show as badges over units: buffs refresh rather than stack, and a stunned unit loses its turn. Support skills are passives equipped with SP on the Roster page: Iron Skin, Vigor, Fleet Foot, Second Wind and Might raise stats; Precision Fire slows the aim cursor and Rhythm widens the Just Cancel flash.
- **Progression and Hiring**: Every battle, won or lost, pays gold and EXP (more for a victory and for each enemy defeated; half EXP for a mercenary who fell; TEC raises EXP). Each level grants 5 stat points and 1 SP. You invest the points on the Roster page, and aptitude decides the bonus: an S stat earns an extra point for every 2 invested, an F stat for every 8. Gold hires recruits from a board of three, priced by their aptitudes. Calling a new board costs 20 gold. The roster holds up to 12, and Dismiss (pressed twice) makes room.
- **Controller Support**: Any standard controller plays the whole game. The D-pad or left stick moves focus, A presses, B cancels or closes, X is Guard and End, Y calls an assist, LB/RB cycle skills (and chain combos), holding LT/RT walks, the right stick steps or changes lane, View opens the combat log and Menu jumps to the battle toolbar. A turn starts with focus on the first skill, and the assist panel and the battle verdict take focus when they open. While a controller is connected, buttons show their controller glyphs.
- **Grand Kingdom–style Battle Stage**: A Three.js 2.5D side view: three lanes recede into depth in front of a painted backdrop, and rigged 3D mercenaries face off across them. Each class has its own outfit and a weapon held on its hand bone, and animations come from one shared clip library: stances, walks, sword swings, bow draws, pistol shots, spells, hits and deaths. A director camera frames every living unit. Each skill has its own choreography: arrows arc, bullets trace, fireballs and meteors explode, lancers lunge, holy light falls, and hits flash with knockback and screen shake. Damage numbers pop as the hit lands. The HUD follows Grand Kingdom's layout:
  - troop flags with remaining-unit pips at the top;
  - HP bars and LEADER tags above units;
  - the active unit's portrait and skills at the bottom-left, with the Move and Action gauges beside them;
  - a turn timeline with an hourglass marking the round's end.

  Unit buttons stay in the DOM over their sprites, so keyboard, controller and screen-reader play are unchanged. Without WebGL, or if the GPU context is lost, the battle falls back to DOM sprites and stays playable. Reduced motion turns off camera moves, shake and idle animation. Angular Service Worker and GitHub Pages hosting remain in place.

## Technical Stack

| Component          | Technology                                            |
| ------------------ | ----------------------------------------------------- |
| Framework          | Angular 22 (Standalone Components, Signals)           |
| Combat Engine      | Pure TypeScript (Zero external rule dependencies)     |
| Visuals & UI       | SCSS, SVG/DOM, Three.js arena, rigged glTF characters |
| PWA Infrastructure | Angular Service Worker (`@angular/service-worker`)    |
| Testing Stack      | Vitest (`npm test`) + Playwright (`npm run e2e`)      |
| Code Quality       | ESLint + Prettier                                     |
| Hosting            | GitHub Pages via GitHub Actions workflow              |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher; v24 recommended)
- `npm` (v10 or higher)

### Setup

```bash
# Install dependencies
npm install

# Run local development server
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

### Verification & Quality Gates

```bash
# Run Vitest unit test suite (engine, calculator, rules, components)
npm test -- --watch=false

# Check code formatting with Prettier
npm run format:check

# Run static linter
npm run lint

# Build production Angular PWA bundle
npm run build

# Run Playwright responsive multi-viewport smoke tests
npm run e2e

# The same, against a dev server on another port when 4200 is taken
E2E_PORT=4300 npm run e2e
```

## Project Structure

```
Lanes/
├── .github/workflows/       # GitHub Actions CI/CD for GitHub Pages
├── public/
│   ├── assets/
│   │   ├── background/      # Battlefield arena backdrops
│   │   └── units/           # Character portrait artwork (Fighter, Cleric, etc.)
│   ├── icons/               # PWA app icons
│   └── manifest.webmanifest # Web App Manifest
├── scripts/
│   └── prepare-pages.mjs    # GitHub Pages 404 SPA fallback script
├── src/
│   ├── app/
│   │   ├── battle/          # Battle HUD, Three.js stage (lazy chunk) and sprite art
│   │   ├── campaign/        # Campaign page and story scenes
│   │   ├── defense/         # Local four-turn defense editor
│   │   ├── core/
│   │   │   ├── engine/      # CombatExecutor, DamageCalculator, TurnManager, LaneSwitcher, execution timing
│   │   │   ├── models/      # Units, classes, mercenaries, contracts, campaign and story, items
│   │   │   └── services/    # BattleStateService (reactive signals)
│   │   ├── guild/           # Guild Hall (home): story, store, contract board
│   │   ├── options/         # Settings and save backup, restore and reset
│   │   ├── roster/          # Roster, stat sheets, scrolls and hiring
│   │   ├── squad/           # War Room squad builder and class dossier
│   │   ├── status/          # Runtime diagnostic screen
│   │   ├── app.routes.ts    # Application routes
│   │   └── app.ts           # Root application shell
│   ├── index.html
│   ├── main.ts
│   └── styles.scss          # Global theme and reset
└── e2e/                     # Playwright smoke test suite
```

## Controls

| Action             | Keyboard           | Touch / Click           |
| ------------------ | ------------------ | ----------------------- |
| Walk Left/Right    | `A`/`D` or arrows  | Retreat/Advance buttons |
| Shift Lane Up/Down | `W`/`S` or arrows  | Shift buttons           |
| Select Ability 1–5 | `1`–`5`            | Ability cards           |
| Confirm/Cancel     | `Enter` / `Escape` | Target / Cancel buttons |
| Fire the aim       | `Space` / `Enter`  | Aim track or target     |
| Chain a combo      | `1`–`5` or `Enter` | Ability card or target  |
| Call an assist     | `Q`, then `1`–`4`  | Assist button           |
| Guard and end      | `E`                | Guard & End button      |

Tap to step; hold a key or button to walk continuously while Move Gauge lasts. With a standard controller: D-pad or left stick moves focus, A presses the focused button, B cancels, X guards and ends the turn, Y calls an assist, LB/RB cycle skills, holding LT/RT walks, the right stick moves one step (or changes lane) per push, View toggles the log and Menu jumps to the battle toolbar. While aiming, the aim track holds focus, so A fires; during a combo, A on the target or LB/RB chains the next skill. Defense Orders, the Guild and the Roster are all usable by focus navigation.

## Character art

The battle characters are built by [tools/characters/build.py](tools/characters/build.py), a headless Blender 5.2 script. It assembles each class from CC0 packs by [Quaternius](https://quaternius.com): Universal Base Characters, Modular Character Outfits – Fantasy and Universal Animation Library. It adds modelled weapons and headgear and authors the bow draw. It writes meshopt-compressed GLBs to `public/assets/characters/`. The source packs are not in the repository. Download them from Quaternius, unzip them under `C:/Users/<you>/LanesArt/` (the `ART` path at the top of the script), then run:

```bash
blender -b --python tools/characters/build.py
```

Pass class ids after `--` to rebuild only some (`-- lancer witch`). The compression step runs `npx @gltf-transform/cli`.

## License

See [LICENSE](LICENSE) for details. The Quaternius character packs are CC0.
