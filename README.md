# Lanes

A lane-based tactical RPG built as a modern **Angular PWA**, inspired by [Grand Kingdom](https://en.wikipedia.org/wiki/Grand_Kingdom) (PS4/PSVita).

## About

Lanes recreates the unique hybrid combat system of Grand Kingdom — combining tactical unit positioning across a 3-lane battlefield with action-point turn budgeting during each unit's turn. Players build squads from diverse unit classes, manage lane depth and cross-lane abilities, and battle against enemy forces.

### Key Features

- **3-Lane Combat**: Units occupy horizontal lanes and can shift vertically between them — positioning and line-of-sight are critical.
- **Action-Based Turn Budgeting**: Each unit's turn allocates an Action Gauge (AP) that depletes as you reposition horizontally, shift lanes, and execute abilities.
- **6 Diverse Unit Classes**:
  - **Fighter**: Frontline heavy tank with high HP/DEF, Shield Bash, Provoke, and Bulwark.
  - **Cleric**: Divine support healer with Mend (cross-lane), Holy Smite, and party-wide Bless.
  - **Archer**: High-speed sniper with Quick Shot, Piercing Arrow (cross-lane), and Volley (lane AoE).
  - **Witch**: Glass-cannon elemental caster with Fire Bolt, Inferno (lane AoE), and Meteor (battlefield AoE with friendly-fire risk).
  - **Lancer**: Fast melee striker with long polearm reach, Thrust, Piercing Lunge (cross-lane), and Whirlwind.
  - **Gunner**: Explosive ranged powerhouse with Quick Fire, Snipe (cross-lane), and Explosive Shot (lane AoE with friendly-fire risk).
- **Cross-Lane & AoE Mechanics**: Select abilities can reach across lanes or strike full lanes, while careless high-impact spells risk friendly fire.
- **Squad Formation Builder**: Inspect class dossiers, stats, and abilities in the War Room, and customize 3-hero squads for combat.
- **PWA & Offline Ready**: Installable Progressive Web App with Angular Service Worker caching, offline support, and zero external runtime game engine dependencies.

## Technical Stack

| Component          | Technology                                                  |
| ------------------ | ----------------------------------------------------------- |
| Framework          | Angular 22 (Standalone Components, Signals)                 |
| Combat Engine      | Pure TypeScript (Zero external engine dependencies)         |
| Visuals & UI       | SCSS, Responsive SVG/DOM, Handcrafted Fantasy Character Art |
| PWA Infrastructure | Angular Service Worker (`@angular/service-worker`)          |
| Testing Stack      | Vitest (`npm test`) + Playwright (`npm run e2e`)            |
| Code Quality       | ESLint + Prettier                                           |
| Hosting            | GitHub Pages via GitHub Actions workflow                    |

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

| Action               | Keyboard             | Touch / Click             |
| -------------------- | -------------------- | ------------------------- |
| Step Left            | `A` or `Left Arrow`  | Tap `◀ Left` button       |
| Step Right           | `D` or `Right Arrow` | Tap `Right ▶` button      |
| Shift Lane Up        | `W` or `Up Arrow`    | Tap `▲ Shift Up` button   |
| Shift Lane Down      | `S` or `Down Arrow`  | Tap `▼ Shift Down` button |
| Select Ability 1/2/3 | `1`, `2`, `3`        | Tap ability card          |
| Execute / Confirm    | `Space` or `Enter`   | Click/tap target unit     |
| End Turn             | `E`                  | Tap `🛑 End Turn` button  |

## License

See [LICENSE](LICENSE) for details.
