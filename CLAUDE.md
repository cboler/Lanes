# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lanes** is a Godot 4.6 project using **C# for all gameplay logic** with GDScript reserved for editor tooling only. It recreates the lane-based tactical RPG combat of [Grand Kingdom](https://en.wikipedia.org/wiki/Grand_Kingdom) (PS4/PSVita). It uses Jolt Physics and Forward Plus rendering.

### Grand Kingdom Gameplay Reference

Grand Kingdom features a unique hybrid combat system combining tactical positioning with real-time action:

- **Lane-based battlefield**: Combat takes place on a field divided into **3 horizontal lanes**. Units move left and right within their lane and can shift between lanes.
- **Action-based combat within turns**: Each unit gets a turn with a limited action gauge. During their turn, the player directly controls the unit in real time — positioning, attacking, and dodging.
- **Unit classes**: Diverse classes with distinct roles — Fighter (melee tank), Hunter (ranged), Witch (magic AoE), Medic (healer), Noble (support), Dragon Mage, Challenger, Lancer, Gunner, Arcanist, Blacksmith, and more.
- **Area-of-effect attacks**: Skills can hit across lanes, making positioning critical.
- **Party composition**: Squads of up to 4 units on the field, with class synergy and formation strategy.
- **Overworld travel**: Troops move across a board-game-style map with branching paths, encounters, and resource nodes.
- **War system**: Online multiplayer where factions compete for territorial control.

### Target Systems (Priority Order)

1. Lane-based combat battlefield (3-lane grid, unit movement, turn system)
2. Action combat mechanics (attack timing, positioning, action gauge)
3. Unit class system (stats, abilities, class-specific behavior)
4. Party/squad management (formation, equipment, leveling)
5. Overworld map and travel
6. Campaign/story progression

## First-Time Setup

Before working on this project for the first time:

```powershell
# 1. Restore NuGet packages (required for C# compilation)
dotnet restore

# 2. Verify C# builds successfully
dotnet build -warnaserror

# 3. Initialize input actions (adds combat/movement inputs to project.godot)
pwsh ./tools/godot.ps1 --headless --script res://tools/setup_input_actions_cli.gd

# 4. Run tests to verify everything works
dotnet test
pwsh ./tools/test.ps1
```

If `dotnet build` fails with missing SDK errors, ensure you have .NET 8.0 SDK installed and Godot 4.6+ Mono.

## Core Tenets

- **C# for gameplay**, GDScript only for editor tooling or tiny glue
- **NEVER write GDScript** for gameplay unless absolutely necessary
- **Composition over inheritance** for Nodes
- **Typed EventBus** for cross-system communication
- **Data-driven configs** using Godot Resource assets (`[GlobalClass]` C# classes)
- **Fail-fast validation**: Misconfigured objects are disabled and logged via `GD.PushError()`
- **Deterministic state machines** with explicit state transitions
- **Test-driven debugging**: Create a failing test first, verify it fails, fix the code, verify the test passes

## Language Usage

- **C#** for all gameplay logic, systems, and tests
- **GDScript** ONLY for editor tools and scene glue scripts
- Never use GDScript for gameplay logic

### Namespace Convention

```
Lanes.*                  # All gameplay code
Lanes.Combat.*           # Combat system (lanes, turns, action gauge)
Lanes.Combat.Units.*     # Unit classes, stats, abilities
Lanes.Overworld.*        # Map travel, encounters
Lanes.Systems.*          # Core systems (EventBus, state machines)
Lanes.UI.*               # HUD, menus, combat UI
Lanes.Data.*             # Data resources, configs
```

## EventBus Pattern

The EventBus provides **typed, decoupled communication** between systems. Use it when:
- Systems need to communicate without direct references
- Multiple listeners need to respond to the same event
- You want to avoid tight coupling between game systems

### When to Use EventBus vs Godot Signals

| Use EventBus | Use Godot Signals |
|---|---|
| Cross-system communication (UI ↔ Combat) | Parent-child node communication |
| Global events (turn changes, unit death, war updates) | Local component events (animation finished) |
| Multiple unrelated listeners | Single known listener |
| Events that need to survive scene changes | Scene-local events |

### Key Game Events

```csharp
// Combat events
event Action<Unit> TurnStarted;
event Action<Unit> TurnEnded;
event Action<Unit, int, int> UnitLaneChanged;  // unit, fromLane, toLane
event Action<Unit, Unit, int> DamageDealt;     // attacker, target, damage
event Action<Unit> UnitDefeated;
event Action<bool> BattleEnded;                // playerWon

// Action gauge events
event Action<Unit, float> ActionGaugeChanged;  // unit, remaining
event Action<Unit> ActionGaugeExhausted;

// Overworld events
event Action<MapNode> NodeEntered;
event Action<Encounter> EncounterTriggered;
```

## Architecture Overview

### Core Systems

```
game/
├── EventBus.cs              # Typed event bus (AutoLoad)
├── GameManager.cs           # Global game state (AutoLoad)
├── DevTools.cs              # Runtime command server (AutoLoad)
└── WindowSetup.cs           # Window placement (AutoLoad)

combat/
├── BattleField.cs           # 3-lane combat arena manager
├── Lane.cs                  # Single lane logic (positions, bounds)
├── TurnManager.cs           # Turn order, phase transitions
├── ActionGauge.cs           # Per-unit action point system
├── CombatCamera.cs          # Camera that follows active unit
└── units/
    ├── Unit.cs              # Base unit (stats, position, lane)
    ├── UnitClass.cs         # Class definition resource
    ├── UnitStats.cs         # HP, ATK, DEF, SPD, etc.
    ├── Ability.cs           # Base ability with range/area/cost
    └── classes/
        ├── Fighter.cs       # Melee tank
        ├── Hunter.cs        # Ranged attacker
        ├── Witch.cs         # Magic AoE
        ├── Medic.cs         # Healer
        └── ...

overworld/
├── OverworldMap.cs          # Map board with nodes and paths
├── MapNode.cs               # Individual location on the map
├── TroopMovement.cs         # Squad movement on map
└── Encounter.cs             # Battle/event trigger

data/
├── UnitClassData.cs         # [GlobalClass] resource for class definitions
├── AbilityData.cs           # [GlobalClass] resource for ability definitions
└── FormationData.cs         # [GlobalClass] resource for party formations

ui/
├── CombatHUD.cs             # In-battle HUD (HP bars, action gauge, turn order)
├── UnitInfoPanel.cs         # Selected unit details
├── AbilityMenu.cs           # Ability selection during combat
├── PartyScreen.cs           # Squad management
└── OverworldUI.cs           # Map navigation UI
```

### Scene Structure

```
scenes/
├── main_menu.tscn
├── combat/
│   ├── battlefield.tscn     # 3-lane combat arena
│   ├── lane.tscn            # Single lane template
│   └── unit.tscn            # Unit instance template
├── overworld/
│   ├── overworld_map.tscn
│   └── map_node.tscn
└── ui/
    ├── combat_hud.tscn
    ├── party_screen.tscn
    └── ability_menu.tscn
```

## Combat System Design

### Lane System

- 3 lanes stacked vertically (top, middle, bottom)
- Each lane is a horizontal strip where units move left/right freely
- Units occupy positions within their lane (continuous x-position)
- Lane switching costs action points and has a brief animation

### Turn Flow

1. **Turn Order**: Determined by unit SPD stat
2. **Action Phase**: Active unit gets an action gauge (depletes with movement and attacks)
3. **Movement**: Direct control — move left/right in lane, switch lanes (costs gauge)
4. **Attack**: Execute abilities when in range (costs gauge based on ability)
5. **End Turn**: When gauge is empty or player ends turn manually

### Collision and Range

- Melee attacks: require close proximity in same lane
- Ranged attacks: can target across lanes within range
- AoE attacks: affect an area that can span multiple lanes
- Friendly fire: some attacks can hit allies if poorly aimed

## C# Safety and Godot-Specific Patterns

- Put physics logic in `_PhysicsProcess(double delta)`.
- Validate required setup in `_Ready()`.
- Fail fast on misconfiguration (`GD.PushError()` or assertions).
- For non-null fields initialized in `_Ready()`, use `= null!` to satisfy nullable warnings.
- Add node to tree before setting `GlobalPosition`.

### Hand-Written Scene Rules

- For hand-written `.tscn` files, do not rely on typed node export deserialization from `NodePath`.
- Use `[Export] NodePath ...Path` fields, then resolve with `GetNodeOrNull<T>()` in `_Ready()`.
- Prefer editor-generated scenes when possible; hand-write only when necessary.

## Testing Strategy

### Which runner to use

- `dotnet test`: pure C# logic tests (combat math, turn order, stat calculations).
- `pwsh ./tools/test.ps1`: Godot runtime, GDScript tests, and engine-aware integration tests.

### What to test

| System | Test approach |
|---|---|
| Damage calculation | Pure C# unit test |
| Turn order resolution | Pure C# unit test |
| Action gauge depletion | Pure C# unit test |
| Lane switching logic | Pure C# unit test |
| Ability range/area checks | Pure C# unit test |
| Unit stat modifiers | Pure C# unit test |
| Combat scene integration | Godot runtime test (gdUnit4) |
| UI state transitions | Godot runtime test (gdUnit4) |
| Input handling | DevTools input simulation + screenshot |

### Node-derived class caveat

Classes inheriting from Godot `Node` typically throw runtime-level failures (often `AccessViolationException`) when instantiated under plain `dotnet test` without Godot runtime support. Keep core logic testable in pure C# helpers when possible.

### Anti-patterns to avoid in async/runtime tests

- Waiting for `"ready"` after `AddChild` with `ToSignal` (can hang).
- Infinite loops without deterministic exit.
- Async tests requiring runtime but missing runtime requirement markers.

## Runtime Verification and Screenshots

For any gameplay-visible change, do all of the following automatically:

1. Ensure game is running: `pwsh ./tools/godot.ps1` (if not already running).
2. Verify DevTools: `python tools/devtools.py ping`.
3. Simulate relevant actions using `python tools/devtools.py input ...` or a sequence file.
4. Capture at least one screenshot:
   - `python tools/devtools.py screenshot --filename "<feature>_<state>.png"`
5. Run runtime validation:
   - `python tools/devtools.py validate-all`
   - `python tools/devtools.py performance`
6. Clear inputs:
   - `python tools/devtools.py input clear`

If DevTools is unreachable, continue all non-runtime checks and report the runtime blocker explicitly.

## Input Actions

Combat-specific input actions for the project:

| Action | Default Key | Purpose |
|---|---|---|
| `move_left` | A / Left Arrow | Move unit left in lane |
| `move_right` | D / Right Arrow | Move unit right in lane |
| `lane_up` | W / Up Arrow | Switch to lane above |
| `lane_down` | S / Down Arrow | Switch to lane below |
| `attack` | J / Space | Execute basic attack |
| `ability_1` | U | Use ability slot 1 |
| `ability_2` | I | Use ability slot 2 |
| `ability_3` | O | Use ability slot 3 |
| `end_turn` | E / Enter | End current turn |
| `cancel` | Escape | Cancel / back |
| `pause` | P | Pause game |

## Quick Reference: The Right Tool for Each Task

| I want to... | Command |
|---|---|
| Build C# | `dotnet build -warnaserror` |
| Run all tests | `pwsh ./tools/test.ps1` |
| Run C# unit tests only | `dotnet test` |
| Validate scene UIDs | `pwsh ./tools/godot.ps1 --headless --script res://tools/lint_project.gd` |
| Validate runtime assets | `python tools/devtools.py validate-all` (game must be running) |
| Take a screenshot | `python tools/devtools.py screenshot` (game must be running) |
| Check performance | `python tools/devtools.py performance` (game must be running) |
| Simulate player input | `python tools/devtools.py input tap attack` (game must be running) |
| Run input sequence | `python tools/devtools.py input sequence file.json` (game must be running) |
| List input actions | `python tools/devtools.py input list` (game must be running) |
| Lint GDScript | `gdlint path/to/file.gd` |
| Lint shaders | `pwsh ./tools/godot.ps1 --headless --script res://tools/lint_shaders.gd` |
| Lint test files | `pwsh ./tools/lint_tests.ps1` |
| Run the game | `pwsh ./tools/godot.ps1` |
| Setup input actions | `pwsh ./tools/godot.ps1 --headless --script res://tools/setup_input_actions_cli.gd` |
