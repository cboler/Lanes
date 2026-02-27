# Lanes

A lane-based tactical RPG built with **Godot 4.6 Mono**, inspired by [Grand Kingdom](https://en.wikipedia.org/wiki/Grand_Kingdom) (PS4/PSVita).

## About

Lanes recreates the unique hybrid combat system of Grand Kingdom — combining tactical unit positioning across a 3-lane battlefield with real-time action combat during each unit's turn. Players build squads from diverse unit classes, each with distinct abilities, and battle through campaigns on an overworld map.

### Key Features (Planned)

- **3-Lane Combat**: Units move freely within horizontal lanes and shift between them — positioning is everything.
- **Action-Based Turns**: Each unit's turn plays out in real time with an action gauge that depletes as you move and attack.
- **Diverse Unit Classes**: Fighter, Hunter, Witch, Medic, and more — each with unique abilities and roles.
- **AoE and Cross-Lane Attacks**: Skills can hit across lanes, rewarding careful formation and positioning.
- **Squad Management**: Build and customize parties with class synergy and formation strategy.
- **Overworld Map**: Travel across a board-game-style map with branching paths, encounters, and resource nodes.

## Technical Stack

| Component | Technology |
|---|---|
| Engine | Godot 4.6 Mono |
| Gameplay Language | C# (.NET 8.0) |
| Tooling Languages | GDScript, PowerShell, Python |
| Physics | Jolt |
| Renderer | Forward Plus |
| Test Stack | `dotnet test` + gdUnit4 |

## Getting Started

### Prerequisites

- [Godot 4.6+ Mono](https://godotengine.org/download)
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- PowerShell (for tooling scripts)
- Python 3.x (for DevTools CLI)

### Setup

```powershell
# Restore NuGet packages
dotnet restore

# Build
dotnet build -warnaserror

# Initialize input actions
pwsh ./tools/godot.ps1 --headless --script res://tools/setup_input_actions_cli.gd

# Run tests
dotnet test
pwsh ./tools/test.ps1
```

### Running the Game

```powershell
pwsh ./tools/godot.ps1
```

## Project Structure

```
Lanes/
├── CLAUDE.md              # Claude Code project guidance
├── AGENTS.md              # Coding agent operational instructions
├── combat/                # Combat system (lanes, turns, units, abilities)
├── data/                  # Data resources ([GlobalClass] configs)
├── game/                  # Core systems (EventBus, GameManager, DevTools)
├── overworld/             # Overworld map and travel
├── scenes/                # Godot scene files (.tscn)
├── ui/                    # User interface
├── test/                  # Test suites (unit + integration)
│   ├── unit/              # Pure C# unit tests
│   └── sequences/         # DevTools input sequence files
└── tools/                 # Build, lint, and verification tooling
```

## Development Workflow

See [CLAUDE.md](CLAUDE.md) for comprehensive development guidance and [AGENTS.md](AGENTS.md) for automated agent operational procedures.

### Quick Commands

| Task | Command |
|---|---|
| Build | `dotnet build -warnaserror` |
| Unit tests | `dotnet test` |
| All tests | `pwsh ./tools/test.ps1` |
| Lint project | `pwsh ./tools/godot.ps1 --headless --script res://tools/lint_project.gd` |
| Run game | `pwsh ./tools/godot.ps1` |
| Screenshot | `python tools/devtools.py screenshot` (game running) |
| Validate scenes | `python tools/devtools.py validate-all` (game running) |

## License

See [LICENSE](LICENSE) for details.