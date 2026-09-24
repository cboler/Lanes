# Lanes

A lane-based tactical RPG built as a modern **Angular PWA**, inspired by [Grand Kingdom](https://en.wikipedia.org/wiki/Grand_Kingdom) (PS4/PSVita).

## About

Lanes is a playable local prototype moving toward the Project Valkyrie design. It combines tactical positioning across three lanes with separate movement and action budgets. Players can build squads, script a defending squad's opening turns, and practice against it.

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
- **Cross-Lane & AoE Mechanics**: Select abilities can reach across lanes or strike full lanes, while careless high-impact spells risk friendly fire.
- **Squad Formation Builder**: Inspect class dossiers and assemble 1–4 members per side. Four is the default; two units share one lane.
- **Defense Orders**: Configure each defender's first four own turns with a skill or Guard and a target priority. Invalid or unavailable orders use local AI fallback; after four turns, fallback takes over. Plans are saved in browser storage on this device. Practice is local; there are no accounts, server battles, matchmaking, or online PvP yet.
- **Controller Support**: Standard Gamepad API navigation, confirm/cancel, ability cycling, and one-step movement alongside keyboard and touch controls.
- **3D Arena and PWA**: Three.js renders a restrained three-lane board behind DOM units, with a CSS fallback when WebGL is unavailable. Angular Service Worker and GitHub Pages hosting remain in place.

## Technical Stack

| Component          | Technology                                               |
| ------------------ | -------------------------------------------------------- |
| Framework          | Angular 22 (Standalone Components, Signals)              |
| Combat Engine      | Pure TypeScript (Zero external rule dependencies)        |
| Visuals & UI       | SCSS, SVG/DOM, Three.js arena, handcrafted character art |
| PWA Infrastructure | Angular Service Worker (`@angular/service-worker`)       |
| Testing Stack      | Vitest (`npm test`) + Playwright (`npm run e2e`)         |
| Code Quality       | ESLint + Prettier                                        |
| Hosting            | GitHub Pages via GitHub Actions workflow                 |

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
│   │   ├── battle/          # 3-Lane tactical arena component
│   │   ├── defense/         # Local four-turn defense editor
│   │   ├── core/
│   │   │   ├── engine/      # CombatExecutor, DamageCalculator, TurnManager, LaneSwitcher
│   │   │   ├── models/      # UnitInstance, UnitClassDefinition, Ability, Stats
│   │   │   └── services/    # BattleStateService (reactive signals)
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
| Step Left/Right    | `A`/`D` or arrows  | Retreat/Advance buttons |
| Shift Lane Up/Down | `W`/`S` or arrows  | Shift buttons           |
| Select Ability 1–3 | `1`, `2`, `3`      | Ability cards           |
| Confirm/Cancel     | `Enter` / `Escape` | Target / Cancel buttons |
| Guard and end      | `E`                | Guard & End button      |

With a standard controller, D-pad or left stick moves focus, A activates the focused button, B cancels, LB/RB cycles abilities, and the right stick moves one step after each release. Defense Orders can also be edited using these focused buttons.

## License

See [LICENSE](LICENSE) for details.
