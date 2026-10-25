# Lanes

A lane-based tactical RPG built as a modern **Angular PWA**, inspired by [Grand Kingdom](https://en.wikipedia.org/wiki/Grand_Kingdom) (PS4/PSVita).

## About

Lanes is a playable local prototype moving toward the [Project Valkyrie design](docs/project-valkyrie.md). A painted overworld expedition leads into tactical battles across three lanes with separate movement and action budgets. Players explore branching roads, avoid or fight visible patrols, collect treasure, follow a story campaign, and build a company of mercenaries. Everything runs locally in the browser.

### Key Features

- **Overworld Expedition**: Home opens the Thornwatch March: 28 connected waypoints, nine route loops, and five roaming enemy squads plus the current scripted story squad on an original painted landscape. Select a connected stop and March: every piece hops simultaneously, once per turn. Turns are unlimited; decisions come from guarded shortcuts, longer detours, treasure, and patrol timing. Free-roaming enemy circuits are fixed and repeat every four, six, or seven hops; each story mission defines its own fixed circuit. For example, the direct grove road to the pay chest can meet the Birchwood Rangers, while the longer route through Birchwood Track and Poacher’s Overlook avoids that contact at the same starting turn. Side roads hold three gold caches (60, 80, 120) and Tactics and Charm Scrolls, collected once. Reaching the watchtower pays 250 gold and opens an expedition report; the report can be reopened and exploration can continue. Saved progress and enemy squads are included in backup, restore, and new-game reset. This is the first campaign region; the existing four-mission prologue now unfolds on this board.
- **Enemy Squads and Scouting**: Each red piece is an entire enemy squad. Free-exploration compositions are randomized once per journey, then saved with the piece, so inspecting it, meeting it, and reloading all use the same mercenaries and field objects. Campaign battles retain their scripted classes and names. Meeting on a waypoint or swapping along a road automatically starts squad combat after the hop lands. Victory removes that piece; defeat regroups at camp. Scout (V or controller Y) reveals next hops; select a red piece to inspect its actual lineup and repeating circuit. Road and Wait warnings use the same turn resolver as the encounter. Scouting spends no turns. Battle refresh restarts the saved encounter against the same enemy squad; individual combat turns are still held in memory.
- **Game Presentation**: The overworld is the main game screen, with a painted map, brass and forest-green HUD, turn pennant, company portraits and contextual route commands. Company (C, controller Menu, or touch) opens roster, War Room, defense orders, Guild Hall, journal and options. Management screens have a Return to the overworld action; closing them preserves position and patrol timing. There is no persistent destination tab bar or webpage footer. The board pans inside its frame on small screens. Keyboard, controller, touch and reduced motion are supported. Original map art and its prompt are documented in [overworld art notes](public/assets/overworld/README.md).
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
- **Campaign**: You lead a mercenary company through war-torn lands looking for work. The story runs across three regions: the four-mission prologue in the Thornwatch March, Chapter One in the Saltmere Coast (House Corvane's smuggled swords, a wrecker's lighthouse and the assault on Saltmere Fort), and Chapter Two in the Vellmark Heights (the siege of Vellmark and Lady Iselde Corvane). Winning a chapter opens the next region; the map's Travel button moves between opened regions, each keeping its own position, treasure and beaten patrols. Chapter battles bring siege engines to both sides. Read a commission, track its star-marked enemy squad along a fixed circuit, and meet it to enter battle. Briefing and aftermath scenes play over the map, with portraits, speakers, keyboard and controller focus. Enemy names, classes, barricades and traps are scripted in [campaign-story.ts](src/app/core/models/campaign-story.ts), alongside their map circuits. First wins pay a bonus once and reveal the next contract. Victory returns you to the same waypoint; defeat regroups at camp. The Campaign journal records progress and lets you reread scenes; it does not launch battles from a mission list.
- **Guild Hall and Contracts**: The Guild Hall (`/guild`) shows the next story mission, resumes an unfinished battle, starts a practice skirmish, sells scrolls, and posts three contracts (Easy, Normal, Hard) against named bands of enemy mercenaries scaled to your squad's level, paying ×1.2, ×1.6 and ×2.2 rewards. Win one and a new contract takes its place; lose and it stays up for another try. Half of all Hard contracts also post a scroll as a bounty.
- **Scrolls and Grimoires**: The guild store sells Tactics Scrolls (300 gold: raise one stat's aptitude a grade, back-paying the better rate on points already invested) and Charm Scrolls (200 gold: refund every invested stat point to spend again). A mercenary who has learned a pattern skill can scribe it into a Grimoire (150 gold), which teaches that skill to another mercenary of the class in place of one of its pattern skills. Scrolls are used from each mercenary's card on the Roster; story missions and Hard contract bounties also award them.
- **Sound**: Battles are voiced with effects synthesized in the browser (no audio files): swings, shots and spells as they are released, hits, criticals, misses, Guard, heals and falls as the blows land, a Just Cancel ping, a chime when your turn starts, and victory and defeat stings. Options turns sound on or off and sets the volume; battle speed and Timing are there too, and all three are remembered on this device.
- **Squad Bonds**: Every two mercenaries share a bond that grows as they fight together, answer each other's assist calls and tend each other's wounds. Comrades (20) deal +10% damage while sharing a lane, Trusted (60) assists between them hit 30% harder, and Sworn (120) avenge each other with +25 Attack when one falls. Each roster card shows its bonds; the victory screen names new ranks.
- **Siege Engines**: Story battles field ballistae (a bolt through every foe in a lane), catapults (a stone onto any lane) and sparkcoils (lightning that stuns foes nearby), for either side. A unit beside its side's engine spends its own AP to fire it, and the AI crews its engines. Engines block their lane and can be smashed; defense plans cannot build them.
- **Equipment and the Forge**: Each mercenary has a weapon, armour and accessory slot. The Guild Hall's armoury sells iron, steel and mythril pieces as the squad's level opens each tier (weapons by family and armour by weight suit particular classes; accessories suit anyone). The forge reforges any piece up to +5, each step adding a fifth of its bonuses for rising gold, and unworn pieces sell back for 40% of what was spent on them. Won contracts, map patrols and story missions can leave spoils (20% plus 5% per foe felled, up to 60%) of the armoury's best open tier, now and then the tier above; Saltmere and Vellmark hide gear caches on side roads, and story finales hand over accessories.
- **Guild Facilities**: Build up the company's wing of the guild hall with gold, three levels each: the Barracks (+2 roster places a level), Training Yard (+10% battle EXP), Infirmary (faster mending on the road, cheaper camp rest) and Smithy (10% cheaper reforging).
- **Wounds and Camp Rest**: Map battles leave their wounds. Each mercenary starts the next map battle with the HP they ended the last on (a fallen one at a quarter), every step on the road mends 5% (more with the Infirmary), and resting at a region's camp heals the whole company for a fee and passes a turn. Guild contracts, skirmishes and practice start everyone whole.
- **Levelling**: Points from level-ups can be spent one at a time, or with Auto (per mercenary) and Auto-invest all, which follow each class's strengths. Waiting points show as +N badges on the map.
- **Save Backup**: The Options page downloads every saved roster, item, contract and mission as one backup file, restores it on this or another device, or starts a new game (pressed twice).
- **Battlefield Objects**: Contract bands raise barricades and set traps (Easy: a trap; Normal: a barricade and a trap; Hard: a barricade and two traps). A barricade blocks its lane and takes direct attacks meant for the units behind it until it is broken or flanked through another lane; it never acts and does not count toward victory. Traps (spikes that poison, snares that stun) spring on the first enemy to walk over them or be knocked into them. Your side can set objects too: a Fighter who learns Raise Barricade plants one a short way ahead in its lane, and an Archer who learns Snare Trap hides a snare farther down it (blue on the stage, where the enemy's glow red). Each unit keeps one such object on the field at a time. Enemies who know these skills use them too: a Fighter walls off a lane to shield an archer or caster behind it before your melee arrives, and an Archer hides a snare in the path of a melee unit walking in.
- **Assist Gauge**: Each side's three orbs (under its troop banner) fill as it deals damage and defeats enemies. On your turn, spend a full orb (Q or the Assist button) to have another squad member make a free pursuit attack with its basic skill, outside its turn. Enemies spend orbs only to finish a unit off.
- **Melee Reach and Knockback**: Position decides reach. Melee skills hit only enemies within reach along the lane (a Fighter's shield reaches about a fifth of the field, a Lancer's polearm twice that), so melee units must close in; the AI walks into reach too. Shield Bash, Shield Charge, Whirlwind and Explosive Shot knock enemies back, and one slammed into a lane-mate or the field's edge takes a quarter of the hit again.
- **Cross-Lane & AoE Mechanics**: Select abilities can reach across lanes or strike full lanes, while careless high-impact spells risk friendly fire.
- **Squad Formation Builder**: The War Room fields 1–4 of your roster's mercenaries (the rest wait as reserves) against 1–4 class-based opponent troops, and shows class dossiers. Four is the default; two units share one lane. The first battle of a visit uses the same squad.
- **Defense Orders**: Choose up to four roster mercenaries to defend and set each one's first four own turns with a skill or Guard and a target priority. The plan keeps a copy of each defender's stat sheet, as a defense sent to another player would. Invalid or unavailable orders use local AI fallback; after four turns, fallback takes over. Plans are saved in browser storage on this device. Practice pits your current squad against the plan; a mercenary on both sides is marked "(Def)" when defending. Practice is local; there are no accounts, server battles, matchmaking, or online PvP yet.
- **Mercenary Roster**: A persistent roster of named mercenaries with a nine-stat sheet (STR, MAG, TEC, VIT, STM, SPI, AGI, CON, SP) and randomized F–S aptitudes. Stats scale the combat numbers of the mercenary's class, and the roster page deploys a chosen squad into battle. Saved in browser storage on this device.
- **Skill Patterns and Support Skills**: Each class has three core skills every mercenary knows, plus three advanced skills (four for Fighters and Archers) that stun, poison, buff, debuff, reach further or set objects on the field. A mercenary's skill pattern, rolled when it is created, teaches two of the advanced skills at set levels. Recruits show their pattern, so it pays to hunt for the one you want. Statuses show as badges over units: buffs refresh rather than stack, and a stunned unit loses its turn. Support skills are passives equipped with SP on the Roster page: Iron Skin, Vigor, Fleet Foot, Second Wind and Might raise stats; Precision Fire slows the aim cursor and Rhythm widens the Just Cancel flash.
- **Progression and Hiring**: Every battle, won or lost, pays gold and EXP (more for a victory and for each enemy defeated; half EXP for a mercenary who fell; TEC raises EXP). Each level grants 5 stat points and 1 SP. You invest the points on the Roster page, and aptitude decides the bonus: an S stat earns an extra point for every 2 invested, an F stat for every 8. Gold hires recruits from a board of three, priced by their aptitudes. Calling a new board costs 20 gold. The roster holds up to 12, and Dismiss (pressed twice) makes room.
- **Controller Support**: Any standard controller plays the whole game. The D-pad or left stick moves focus, A presses, B cancels or closes, X is Guard and End, Y calls an assist, LB/RB cycle skills (and chain combos), holding LT/RT walks, the right stick steps or changes lane, View opens the combat log and Menu opens Company while traveling and jumps to the battle toolbar during combat. A turn starts with focus on the first skill, and the assist panel and the battle verdict take focus when they open. While a controller is connected, buttons show their controller glyphs.
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
│   │   ├── campaign/        # Campaign journal (story scenes live on the overworld)
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

On the overworld, select a connected waypoint or route button, then **March**. Arrow keys cycle connected roads, **M** marches, and **V** toggles Scout; **Wait a turn** advances the patrols once. With a controller, D-pad/left stick moves focus, A confirms, right stick cycles roads, X waits, and Y scouts. Select an enemy piece to inspect its squad. A confirms a dialog choice and B closes it; Tab stays within an open dialog and Escape closes it. The **?** button opens the field guide.

| Action             | Keyboard           | Touch / Click               |
| ------------------ | ------------------ | --------------------------- |
| Walk Left/Right    | `A`/`D` or arrows  | ◀ / ▶ (hold to walk)        |
| Shift Lane Up/Down | `W`/`S` or arrows  | ▲ / ▼                       |
| Select Ability 1–5 | `1`–`5`            | Skill buttons               |
| Confirm/Cancel     | `Enter` / `Escape` | A target, then Confirm      |
| Fire the aim       | `Space` / `Enter`  | Click or tap anywhere       |
| Chain a combo      | `1`–`5` or `Enter` | The skill, target or ground |
| Call an assist     | `Q`, then `1`–`4`  | Assist button               |
| Guard and end      | `E`                | Guard & End button          |

The battle fills the screen: banners and the turn order sit along the top, the active unit, its skills, the move arrows and Guard & End along the bottom, and a small hint in the corner shows what the keys, taps or controller buttons do right now. Auto-Battle, Timing, speed and the log are icons in the top-right corner; ☰ holds Restart and the way back to the overworld, Guild, War Room and Defense Orders. Tap to step; hold a key or button to walk continuously while Move Gauge lasts. With a standard controller: D-pad or left stick moves focus, A presses the focused button, B cancels, X guards and ends the turn, Y calls an assist, LB/RB cycle skills, holding LT/RT walks, the right stick moves one step (or changes lane) per push, View toggles the log and Menu opens Company while traveling and the battle menu during combat. While aiming, A fires wherever focus is; during a combo, A on the target or LB/RB chains the next skill. Defense Orders, the Guild and the Roster are all usable by focus navigation.

## Character art

The battle characters are built by [tools/characters/build.py](tools/characters/build.py), a headless Blender 5.2 script. It assembles each class from CC0 packs by [Quaternius](https://quaternius.com): Universal Base Characters, Modular Character Outfits – Fantasy and Universal Animation Library. It adds modelled weapons and headgear and authors the bow draw. It writes meshopt-compressed GLBs to `public/assets/characters/`. The source packs are not in the repository. Download them from Quaternius, unzip them under `C:/Users/<you>/LanesArt/` (the `ART` path at the top of the script), then run:

```bash
blender -b --python tools/characters/build.py
```

Pass class ids after `--` to rebuild only some (`-- lancer witch`). The compression step runs `npx @gltf-transform/cli`.

## License

See [LICENSE](LICENSE) for details. The Quaternius character packs are CC0.
