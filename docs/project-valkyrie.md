# Project Valkyrie: A Technical Architecture and MVP Specification for a Web-Based Tactical RPG

> Design reference for Lanes. Written as a proposal: the Phaser client and microservice backend it recommends are suggestions; Lanes uses Angular, TypeScript and Three.js. See [Handoff.md](../Handoff.md) for what is built so far.

## Section 1: Deconstruction of Core Gameplay Systems

This section provides a formal deconstruction of the core gameplay mechanics of the tactical RPG Grand Kingdom. The objective is to establish a detailed design specification for a Minimum Viable Product (MVP) that captures the essence of the original's combat and asynchronous player-versus-player (PvP) experience. The analysis focuses on the foundational systems that define the strategic depth and long-term player engagement loops: the battle system, the unit architecture, and the asynchronous conflict model.

### 1.1 The Anatomy of a Battle: Core Combat Loop

The combat system is the heart of the game, a turn-based tactical experience defined by spatial positioning, resource management, and interactive execution. It is more than a simple menu-driven system; it demands active player participation and strategic foresight on multiple levels.

#### 1.1.1 The Three-Lane Battlefield

The fundamental structure of every battle is a 2D plane divided into three distinct horizontal lanes.1 This spatial constraint is the primary driver of tactical decision-making. The position of a unit, defined by its lane and its horizontal placement within that lane, dictates its attack range, its vulnerability to enemy attacks, and its ability to protect allies.

Unit movement and skill usage are heavily influenced by this lane system. Melee units, for instance, are generally restricted to attacking targets within their current lane, making them effective front-line brawlers but limited in their reach.3 Conversely, Ranged and Magic units often possess skills with a "Ranged" range type, allowing them to target enemies in any of the three lanes, regardless of their own position.3 This creates a natural strategic dichotomy: players must use their melee units to control the front lines and protect their high-damage, low-defense backline units from being engaged directly. The backend system must model unit positions with precision, tracking both their lane (lane_id) and their horizontal coordinate (x) to correctly calculate line of sight, skill range, and area-of-effect (AoE) coverage.

#### 1.1.2 The Turn-Based Timeline System

Combat unfolds in a turn-based manner, but the order of operations is not a simple alternating sequence. A timeline UI element, typically displayed at the bottom of the screen, visualizes the upcoming turn order for every unit on the battlefield.1 This order is determined by each unit's "ACT" statistic, a derived value likely influenced by Agility and other factors; units with a higher ACT value take their turns sooner.3

The backend must maintain a dynamic priority queue of all combatants, sorted by their current ACT value, to manage the flow of turns. This turn order is not static. The existence of support skills such as "Death March" (act sooner) and "My Own Pace" (act later) demonstrates that a unit's position on the timeline can be actively manipulated by buffs and debuffs.3 Therefore, the turn queue must be re-evaluated whenever such effects are applied, adding a layer of temporal strategy to the battle. Players can see several turns in advance, allowing them to prioritize targets that are about to act or set up defensive measures against an upcoming enemy onslaught.

#### 1.1.3 The Dual-Gauge Resource System

Each unit's actions within its turn are governed by a dual-resource system, consisting of a Move Gauge and an Action Gauge.1 Both gauges partially replenish at the start of a unit's turn, creating a finite pool of resources for the player to manage.

- **Move Gauge:** This resource is primarily consumed for physical movement across the battlefield. The amount of Move Gauge recovered each turn is directly influenced by the unit's Agility (AGI) stat, meaning higher AGI units can traverse more distance.6
- **Action Gauge:** This resource is consumed to execute skills, from basic attacks to powerful special moves and multi-hit combos. The amount of Action Gauge recovered each turn is governed by the Vitality (VIT) stat, allowing high VIT units to perform more or stronger actions.6

The strategic depth of this system emerges from the interplay between these two gauges. It is not a rigid system; certain skills allow for the conversion of one resource type into another's function. For example, a Fighter's "Slide Edge" or a Paladin's "Move Strike" are attack skills that also move the unit forward, effectively using the Action Gauge to achieve movement.3 Conversely, and perhaps more critically, any portion of the Action Gauge that remains unspent at the end of a turn can be converted into a "Guard" stance. The strength of this Guard—its ability to absorb damage—is directly proportional to the amount of Action Gauge committed to it.5

This mechanic creates a fundamental risk-reward decision loop on every single turn. A player must constantly evaluate the trade-off between maximizing offensive output by spending their entire Action Gauge, or forgoing a final attack to establish a strong defensive posture for the coming enemy turns. This constant, micro-level resource management is the central pillar of the game's tactical feel and must be a primary focus of the implementation.

#### 1.1.4 Interactive Combat Execution

Unlike many traditional turn-based RPGs, attack resolution in Grand Kingdom is not a passive, automated process. The system incorporates active, skill-based player inputs that directly influence the outcome of actions, rewarding precision and timing.

- **Melee Combos & "Just Cancel":** Melee attacks are not single actions but can be chained into combos. This involves timed button presses to link different skills together. A "Just Cancel" mechanic rewards players who initiate the next skill at the precise moment the previous one ends, often indicated by a visual flash, with a significant damage bonus.1 This transforms melee combat from a simple menu selection into a rhythm-based execution challenge.
- **Ranged & Magic Targeting:** Ranged and Magic attacks frequently employ a mini-game-like targeting interface. A common implementation is a sliding cursor that moves across a designated target area. The player must press a button when the cursor is over an enemy to score a hit; failure to do so before the cursor reaches the end of its path results in a miss.3 The speed of this cursor can vary by skill, and certain support skills, like "Precision Fire," can slow it down, indicating that unit abilities can directly modify these interactive UI elements.3
- **Friendly Fire:** A critical and unforgiving element of the combat system is that AoE skills and some line-based attacks can damage allied units if they are within the target radius.1 This is not an accidental feature but a core strategic constraint. It forces players to be acutely aware of their own units' positioning relative to the enemy, preventing them from simply clustering their forces and spamming large AoE attacks. The damage calculation engine must be designed to apply effects to any unit within an attack's defined area, regardless of its factional alignment.

#### 1.1.5 Battlefield Objects and Assists

The battlefield is a dynamic environment that can be manipulated by both sides. It can contain deployable objects such as barricades to impede movement, traps to inflict damage or status effects, and powerful siege weapons that can bombard the enemy party.1 Certain classes, like the Blacksmith, specialize in destroying these objects, adding a layer of environmental control to the strategy.11

Furthermore, an "Assist Gauge" fills as a player deals damage and defeats enemy units. By expending a portion of this gauge, a player can call in an "Assist Attack" from an allied unit, allowing them to perform a designated pursuit skill outside of their normal turn.3 This functions as a tactical resource that can be used to finish off a weakened enemy or add crucial extra damage during a key turn.4

### 1.2 The Mercenary Unit Blueprint: Character Architecture

The long-term engagement of the game is built upon the extensive system of recruiting, customizing, and optimizing a roster of mercenary units. This system is defined by a multi-layered architecture of stats, classes, and a uniquely randomized skill acquisition process that drives player retention.

#### 1.2.1 The Nine-Stat Attribute System

Every unit in the game is defined by a set of nine core statistics that form the foundation of its combat potential: Strength (STR), Magic (MAG), Technique (TEC), Vitality (VIT), Stamina (STM), Spirit (SPI), Agility (AGI), Constitution (CON), and Support Points (SP).6 These stats directly influence derived combat values; for example, STR and MAG determine physical and magical attack power, while CON determines maximum HP.7

A crucial layer of complexity is the "Aptitude" system. Each of the primary eight stats is assigned a letter grade from F to S upon a unit's creation. This grade determines the efficiency of point investment upon level-up; an S-rank stat might grant a bonus point for every 2 points invested, while an F-rank stat might require 8 points for the same bonus.6 Since these aptitudes are randomly generated when a unit appears in the hiring roster, it introduces a significant element of "gacha"-like hunting, where players will repeatedly check the roster in search of a unit with S-rank aptitudes in its key stats.

| Stat Name           | Description                                               | Primary Effect                                                             | Secondary Effects                                                       | Governing Aptitude Item |
| ------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| STR (Strength)      | Governs physical power.                                   | Increases damage of Melee (Red) and Ranged (Green) type skills.            | Directly contributes to the physical ATK value on the character sheet.  | Power Scroll            |
| MAG (Magic)         | Governs magical power.                                    | Increases damage of Magic (Purple) type skills.                            | Directly contributes to the magical ATK value on the character sheet.   | Magic Scroll            |
| TEC (Technique)     | Represents a unit's technical skill and learning ability. | Increases the amount of Experience (EXP) gained from battles.              | Strengthens the damage absorption of the "Guard" skill.                 | Technique Scroll        |
| VIT (Vitality)      | Governs a unit's stamina and ability to act.              | Increases the amount of Action Gauge recovered at the start of a turn.     | Allows for longer combos and stronger Guards.                           | Vitality Scroll         |
| STM (Stamina)       | Represents physical resilience.                           | Provides a percentage-based reduction to incoming Melee and Ranged damage. | Contributes to the physical DEF value on the character sheet.           | Fitness Scroll          |
| SPI (Spirit)        | Represents mental and magical fortitude.                  | Provides a percentage-based reduction to incoming Magic damage.            | Contributes to the magical DEF value on the character sheet.            | Divine Scroll           |
| AGI (Agility)       | Governs speed and mobility.                               | Increases the amount of Move Gauge recovered at the start of a turn.       | Influences the "ACT" stat, which determines turn order on the timeline. | Agility Scroll          |
| CON (Constitution)  | Represents a unit's health and physical toughness.        | Increases the unit's maximum Hit Points (HP).                              | Directly contributes to the HP value on the character sheet.            | Life Scroll             |
| SP (Support Points) | Determines a unit's capacity for passive abilities.       | Increases the maximum available points for equipping Support Skills.       | Allows for greater customization of a unit's passive build.             | SP Scroll               |

_Table 1.2.1: Core Unit Statistics and Their In-Game Impact. Data compiled from.6_

#### 1.2.2 Class Archetypes and Tactical Triangle

The game features over 17 distinct character classes, which are categorized into four main archetypes: Melee, Ranged, Magic, and Specialist.11 The three primary archetypes operate on a "rock-paper-scissors" tactical triangle that forms a core component of the damage calculation system.

Melee units are strong against Ranged units.

Ranged units are strong against Magic units.

Magic units are strong against Melee units.

This system must be implemented as a fundamental damage modifier. When a unit from an advantaged archetype attacks a unit from a disadvantaged one, it should deal bonus damage, and potentially receive reduced damage in return. This encourages players to build balanced teams and to prioritize targets based on these matchups.

Specialist classes, such as the Medic (healer), Challenger (trapper/AoE damage), and Dragon Mage (hybrid), are explicitly exempt from this triangle.4 They fill unique utility roles and provide tactical options that exist outside the primary damage-dealing framework.

#### 1.2.3 The Skill System: Acquisition and Customization

The skill system is a cornerstone of the game's depth and long-term progression. It is deliberately designed with a layer of controlled randomness to drive player engagement.

- **Skill Types:** Units have access to several categories of skills. For the MVP, the focus will be on Attack Skills (actions used in combat) and Support Skills (passive abilities that cost SP to equip).6 Other types, like Field Skills, are outside the MVP scope.14
- **Skill Patterns:** This is the most critical component of the unit progression system. A unit's potential learnable skills are not fixed. When a new mercenary is hired, the game randomly assigns them one of several predefined "skill patterns" specific to their class.13 This pattern dictates which subset of the class's total skill pool they will learn, and at which levels they will learn them. A single pattern may only contain about half of the total skills available to that class.13
- **Implications for Retention:** This design choice is a powerful retention mechanic. It prevents a player from easily acquiring a "perfect" unit. To obtain a specific, powerful skill (e.g., a Paladin with "Over Spin"), a player may need to hire and level up multiple Paladins until they are assigned the correct skill pattern. This creates a compelling and long-lasting "hunt" for the ideal mercenary, driving repeated engagement with the core gameplay loop (earning currency) and the hiring system (spending currency). The MVP must replicate this system faithfully to capture the essence of the original's long-term appeal.
- **Grimoires and Scrolls:** To mitigate the pure randomness of the skill pattern system, the game provides consumable items. Grimoires can be created from a unit that has mastered a skill, allowing that skill to be taught to another unit.16 Tactics Scrolls can be used to improve a unit's stat aptitudes, and Charm Scrolls allow for a full respec of a unit's allocated stat points.14 These items are rare and valuable, forming the high-end reward structure for completing difficult quests or participating in wars.

### 1.3 The Asynchronous Conflict Engine: PvP Loop

The core of the user's request revolves around recreating the asynchronous PvP system, where players battle against AI-controlled versions of other players' teams. This system provides a competitive outlet without the complexities and infrastructure demands of real-time multiplayer.

#### 1.3.1 Core Loop Definition

The asynchronous PvP loop is straightforward:

1. A player (the Defender) assembles a "detachment" or "defense" team from their roster of mercenaries.
2. The Defender configures a set of AI instructions for this team.
3. The defense team is uploaded to the server and enters the matchmaking pool.
4. Another player (the Attacker) initiates a PvP battle. The matchmaking service selects the Defender's team as an opponent.
5. A battle commences where the Attacker has full manual control over their team, while the Defender's team is controlled by the server, executing its pre-configured AI script.2
6. The result of the battle is recorded, and both players are notified and receive rewards or ranking adjustments accordingly.

The original game's online servers were shut down between 2019 and 2022, highlighting the necessity of building a new, robust backend to manage this entire process from scratch.1

#### 1.3.2 Defense Team Configuration

A critical element that reduces the complexity of the MVP is the nature of the "AI" configuration. The system does not require the development of a complex, dynamic, decision-making artificial intelligence. Instead, it provides players with a simple scripting interface.

Players can access a "Set Member Actions" menu where they can dictate the exact sequence of actions their defense units will take for the first four turns of battle.19 This includes specifying which skill to use and potentially a basic targeting parameter. For example, a player could script their Witch to use "Lightning" on Turn 1, targeting the middle row. Beyond these first four scripted turns, the AI likely reverts to a very basic, hard-coded logic.20 Players can also set high-level "marching orders," which may act as a general guideline for the AI's behavior after the scripted turns are complete.19

This design is highly advantageous for an MVP. The challenge is not one of AI engineering but of user interface design and data management. The development team must build an intuitive UI for creating these simple scripts and a backend service capable of parsing and executing them deterministically during a battle simulation.

#### 1.3.3 Battle Resolution

When an Attacker challenges a Defender's team, the battle is resolved entirely on the server. The Attacker's client sends their chosen actions each turn to the server. The server validates these actions and simulates the turn, which includes executing the pre-programmed script for the defending AI unit whose turn it is. The server then calculates all outcomes (damage, status effects, etc.), updates the battle state, and sends the new state back to the Attacker's client for rendering. At the conclusion of the battle, the server determines the winner, calculates rewards, updates player rankings in the database, and stores the result for the Defender to view later.

## Section 2: Backend and Infrastructure Architecture

This section outlines the proposed server-side architecture for Project Valkyrie. The design prioritizes scalability, maintainability, and reliability, with a specific focus on supporting the asynchronous, turn-based nature of the game and accommodating future client expansion as requested.

### 2.1 System Architecture Overview: A Microservices Approach

To ensure long-term viability and flexibility, a decoupled microservices architecture is strongly recommended. In this model, the backend is not a single, monolithic application but a collection of small, independent services, each responsible for a specific domain of game logic.

Clients (the initial web client and any future Qt/QML clients) will not connect directly to these services. Instead, all communication will be routed through a single API Gateway. This gateway serves as a unified entry point, handling tasks like request routing, authentication, and rate limiting. It then forwards requests to the appropriate downstream microservice.

This architectural pattern offers several key advantages:

- **Scalability:** Each service can be scaled independently. If the Battle Simulation Service experiences high load, more instances of only that service can be deployed without affecting the Player Service or others.
- **Maintainability:** Services can be developed, tested, and deployed independently by smaller, focused teams. This accelerates the development cycle and reduces the risk of a change in one part of the system breaking another.
- **Technology Flexibility:** While a consistent technology stack is recommended for the MVP, a microservices architecture allows for different technologies to be used for different services in the future if a specific need arises.
- **Future-Proofing:** As established in the project goals, the ability to add new clients is a key requirement. This architecture ensures that any new client, whether built in Qt, Unity, or another technology, only needs to conform to the API contract exposed by the gateway. The underlying backend logic remains unchanged, dramatically simplifying cross-platform development.21

### 2.2 Backend Services and Technology Stack

The selection of a backend technology stack is a critical decision that impacts performance, development speed, and scalability. The choice must be tailored to the specific workload profile of a turn-based tactical RPG.

#### 2.2.1 Technology Stack Recommendation: Node.js with TypeScript

After a comparative analysis of leading backend technologies, the primary recommendation is Node.js with the TypeScript language.

| Technology           | Performance Profile                                                    | Concurrency Model                                                                             | Ecosystem Maturity                                                                          | Best Use Case for Project Valkyrie                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js / TypeScript | Excellent for I/O-bound tasks. Slower than Go for raw CPU computation. | Single-threaded, non-blocking, event-driven. Handles many concurrent connections efficiently. | Extremely mature and vast (NPM). Large number of libraries for common tasks.                | Recommended. The game's workload (many concurrent users, frequent database calls) is I/O-bound, which is Node.js's primary strength. The shared language with the frontend accelerates MVP development.          |
| Go (Golang)          | Highest raw performance, especially for CPU-bound tasks. Low-latency.  | Built-in, lightweight goroutines for high concurrency.                                        | Mature and growing, but smaller than Node.js. Excellent for infrastructure tooling.         | A strong alternative, but potentially overkill for this genre. The performance benefits for CPU tasks are less relevant than Node.js's I/O handling.                                                             |
| Python / Django      | Slower than Go and Node.js for raw performance.                        | Traditionally synchronous, though asynchronous support exists. GIL can be a bottleneck.       | Very mature, especially in data science and web frameworks. Django is "batteries-included." | Viable, but Node.js's native asynchronous model is a better fit for real-time notifications and managing many connections. Django's monolithic nature is less suited to the proposed microservices architecture. |

_Table 2.2.1: Backend Technology Stack Comparison. Data compiled from.[23, 24, 25, 26, 27, 28]_

The rationale for this recommendation is rooted in the specific nature of the game. Grand Kingdom is not a real-time action game requiring constant physics calculations (a CPU-bound task). It is a turn-based game where the server's primary job is to manage state for thousands of concurrent players and handle frequent, small database operations (I/O-bound tasks). Node.js's event-driven, non-blocking architecture is purpose-built for this exact workload, allowing it to handle a large number of simultaneous connections with minimal resource overhead.23 The use of TypeScript adds the benefits of static typing, which is invaluable for code quality, refactoring, and maintainability in a large-scale project.

#### 2.2.2 Core Microservices for MVP

The MVP will be supported by a suite of four essential microservices:

- **Authentication Service:** This service will be responsible for all aspects of user identity. It will handle player registration, secure password hashing, login validation, and the issuance of session tokens (e.g., JSON Web Tokens - JWT). It will be the gatekeeper for all authenticated API endpoints.
- **Player Service:** This service is the canonical source of truth for all persistent player data. It will manage a player's mercenary roster, their inventory of items and currency, their PvP rank, and their guild information. It will expose a CRUD (Create, Read, Update, Delete) API for all player-related entities and will be the only service that communicates directly with the primary player database for these concerns.
- **Matchmaking Service:** This service manages the asynchronous PvP queue. When a player initiates a search for an opponent, this service will query the database for a suitable match based on a ranking algorithm (e.g., ELO). It will then retrieve the opponent's defense team data (including their 4-turn AI script) and pass this information to the Battle Simulation Service to initialize the combat instance.
- **Battle Simulation Service:** This is the most computationally significant service. It must be designed as a deterministic and stateless engine. It will receive the initial state of a battle (the two teams, their stats, skills, and the defender's AI script) as input. For each turn, it will receive the attacker's action, execute the game's ruleset, determine the outcome, and return the new, updated battle state. Its stateless nature is critical; the service retains no memory of a battle between API calls. This allows any incoming battle-related request to be handled by any available instance of the service, making it trivial to scale horizontally by simply adding more server instances.

### 2.3 Data Persistence Strategy: A Hybrid SQL/NoSQL Approach

No single database technology is optimal for all types of game data. A modern, scalable game backend often employs a hybrid strategy, using different database types for the tasks they are best suited for.

#### 2.3.1 Database Technology Recommendation

A hybrid model leveraging both a relational (SQL) and an in-memory key-value (NoSQL) database is proposed.

- **Primary Database (SQL):** PostgreSQL. The core game data—player accounts, unit definitions, inventories, skill lists—is highly structured and relational. The relationships between players, their units, and their items are well-defined. Furthermore, operations involving currency and valuable items demand the strict transactional integrity (Atomicity, Consistency, Isolation, Durability - ACID) that SQL databases provide.29 PostgreSQL is a mature, open-source, and highly reliable choice for this role. Its support for advanced data types like JSONB is also beneficial for storing semi-structured data like a unit's assigned stats.
- **Caching & Session Store (In-Memory NoSQL):** Redis. For ephemeral or frequently accessed data where speed is the absolute priority, an in-memory database is essential. Redis will be used for several key functions: storing active player session tokens for fast authentication, managing the real-time matchmaking queue (using its sorted set data structure), and caching frequently requested player profiles or defense team data to reduce the load on the primary PostgreSQL database.29

#### 2.3.2 High-Level Data Models

The following provides a conceptual overview of the core database schemas for the MVP.

**PostgreSQL Schema:**

- `players`
  - player_id (Primary Key)
  - username (Unique)
  - hashed_password
  - email (Unique)
  - pvp_rank, pvp_points
  - currency_gold
- `units`
  - unit_id (Primary Key)
  - owner_player_id (Foreign Key to players)
  - class_id (Foreign Key to a static classes table)
  - level, experience
  - stat_aptitudes (JSONB, e.g., {"str": "A", "vit": "S",...})
  - assigned_stats (JSONB, e.g., {"str": 50, "vit": 45,...})
  - skill_pattern_id
  - equipped_skills (Array of skill IDs)
- `defense_squads`
  - player_id (Primary Key, Foreign Key to players)
  - unit_slot_1 (Foreign Key to units), unit_slot_2, etc.
- `defense_actions`
  - defense_action_id (Primary Key)
  - player_id (Foreign Key to players)
  - unit_slot (e.g., 1-4)
  - turn_number (1-4)
  - skill_id
  - target_priority (e.g., 'NEAREST', 'LOWEST_HP')

**Redis Data Structures:**

- session:{token} (Key-Value): Stores player_id for active sessions.
- matchmaking_queue (Sorted Set): Stores player_ids with their pvp_rank as the score for efficient range queries.

## Section 3: Client Implementation and Technology

This section details the technical specifications for the user-facing client application. It begins with a comprehensive analysis and recommendation for the web-based MVP platform and concludes with a strategic outline for future cross-platform expansion, directly addressing a key requirement of the user query.

### 3.1 The Web Client: Primary MVP Platform

The initial and primary platform for Project Valkyrie will be a modern web browser. The choice of the underlying JavaScript engine is a foundational decision that will dictate the development workflow, performance capabilities, and overall architecture of the client application.

#### 3.1.1 Game Engine and Rendering Library Analysis

The JavaScript ecosystem offers several mature and powerful options for 2D game development. The analysis focuses on the three most relevant candidates for a 2D sprite-based tactical RPG.

Pixi.js: This is a highly optimized, low-level 2D rendering library that leverages WebGL for maximum performance, with a fallback to the Canvas API.30 Its core competency is rendering sprites, shapes, and text to the screen with extreme efficiency. It is often cited as the fastest 2D renderer available.32 However, Pixi.js is explicitly not a game engine.31 It does not provide built-in systems for scene management, game loops, physics, audio management, or advanced input handling. A team choosing Pixi.js is committing to building these foundational game architecture components from scratch.

Babylon.js: This is a powerful, full-featured 3D game engine.33 While it includes robust support for 2D elements, such as sprites and a GUI system, its entire API and design philosophy are 3D-first.35 Using Babylon.js for a purely 2D game would involve working within an orthographic camera view and utilizing a subset of its features. While performant, this approach introduces unnecessary complexity and a steeper learning curve for a project that has no 3D requirements.37

- **Phaser:** This is a comprehensive, "batteries-included" 2D game framework.33 Unlike Pixi.js, Phaser provides a complete solution for building games, including a scene-based architecture, multiple physics engine options, a robust animation system, asset loaders, and input managers.32 It is designed specifically and exclusively for 2D game development and has a massive community, extensive documentation, and a wealth of tutorials.33

#### 3.1.2 Recommendation: Phaser Framework

The definitive recommendation for the Project Valkyrie web client is the Phaser framework.

| Engine     | Type              | Primary Use Case                        | Key Strengths for Project Valkyrie                                                                                                                                                                                                | Key Weaknesses for Project Valkyrie                                                                                                                                             |
| ---------- | ----------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phaser     | Game Framework    | All-around 2D game development.         | Rapid Development: Comprehensive, "batteries-included" feature set allows the team to focus on gameplay logic, not engine architecture. Strong Community: Reduces development risk through extensive documentation and tutorials. | Slightly lower raw rendering performance than a pure renderer like Pixi.js, but more than sufficient for a turn-based RPG.                                                      |
| Pixi.js    | Rendering Library | High-performance 2D graphics rendering. | Maximum Performance: The fastest available 2D WebGL renderer, capable of handling tens of thousands of sprites.                                                                                                                   | High Development Overhead: Requires the team to build their own game loop, scene manager, and other core systems, significantly increasing MVP development time and complexity. |
| Babylon.js | 3D Game Engine    | Complex 3D games and applications.      | Powerful and performant engine with 2D capabilities.                                                                                                                                                                              | Overly Complex: API and architecture are 3D-first, making it non-idiomatic and unnecessarily complicated for a purely 2D sprite-based game.                                     |

_Table 3.1.1: JavaScript Game Engine Analysis. Data compiled from.[30, 31, 32, 33, 38]_

This recommendation is based on a strategic assessment of the project's goals. For an MVP, the primary objective is to build and validate the core gameplay loop as quickly and efficiently as possible. The fundamental distinction between a game framework and a rendering library is paramount here. While Pixi.js offers superior raw rendering performance, the development time required to build the necessary game systems around it would be substantial. This would introduce significant risk and delay to the MVP timeline.

Phaser provides all the necessary foundational systems out of the box. Its scene management system is a perfect fit for the game's structure (e.g., transitioning from a GuildHubScene to a BattleScene). Its animation and asset loading systems will streamline the process of implementing the game's 17+ character classes and their skills. By choosing Phaser, the development team can begin implementing the specific mechanics of Grand Kingdom on day one, dramatically accelerating the path to a playable product.

#### 3.1.3 Client Architecture

The Phaser client application will be built using modern JavaScript (ES6+) or TypeScript for improved code structure and maintainability. It will be organized into a series of distinct scenes, each managing a specific part of the user experience:

- **LoginScene:** Handles user input for login and registration, communicating with the backend Authentication Service.
- **GuildHubScene:** The main menu or hub area, providing UI elements to navigate to squad management, matchmaking, etc.
- **SquadManagementScene:** Allows players to view their roster of mercenaries, form squads, view stats, and equip skills.
- **DefenseSetupScene:** A dedicated interface for assigning a squad to defense and configuring the 4-turn AI script for each unit.
- **BattleScene:** The most complex scene. It will be responsible for:

Rendering the 3-lane battlefield, unit sprites, and any battlefield objects.

Displaying all UI elements, including the turn timeline, health bars, and the Move/Action gauges.

Handling all player input, including unit movement, skill selection, and the interactive mini-games for targeting and combos.

Communicating with the backend Battle Simulation Service, sending player actions and receiving updated game states to render.

The client will be architected to be a "dumb" client. It will contain no core game logic or rules. Its sole responsibility is to render the game state provided by the server and transmit user inputs back to the server. This clean separation of concerns is essential for preventing cheating and ensuring a consistent experience across all current and future platforms.

### 3.2 Future-Proofing for Cross-Platform Expansion (Qt/QML)

The user query specified a desire to potentially create additional clients, specifically mentioning Qt and QML for cross-platform desktop compatibility. The recommended microservices architecture is inherently designed to support this expansion with minimal friction.

Because the entire game state and all rule enforcement are handled by the backend services, any new client is simply another "view" of that centralized data. A future Qt/QML client would be a completely separate software project. It would not share any code with the Phaser web client. Instead, it would communicate with the very same API Gateway.

The development process for a Qt client would involve:

Implementing network code to make HTTP requests to the existing backend API endpoints.

Using Qt and QML to build a native user interface that replicates the functionality of the web client's scenes (Login, Guild Hub, etc.).

Creating a rendering canvas (likely using QOpenGLWidget or a similar Qt graphics view) to implement its own version of the BattleScene. This scene would parse the game state JSON received from the server and draw the units and effects using Qt's rendering capabilities.

Crucially, no changes would be required on the backend. The server is agnostic to the technology of the client making the request. This architectural choice provides maximum flexibility for future growth, allowing the team to develop clients for desktop, mobile, or even consoles by simply having them adhere to the established API contract.

## Section 4: MVP Definition and Phased Roadmap

This final section translates the preceding technical and design analysis into an actionable plan. It provides a clear and unambiguous definition of the Minimum Viable Product's scope and outlines a high-level development roadmap structured into logical epics. This serves as a foundational document for project planning, sprint organization, and stakeholder communication.

### 4.1 Minimum Viable Product: Feature Set Definition

To ensure a focused and timely delivery of the core experience, the scope of the MVP must be strictly defined. The following table delineates which features are considered essential for the initial release and which are deferred for future iterations.

| Feature Area    | Specific Feature                                          | MVP Status | Rationale / Notes                                                                                |
| --------------- | --------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| Accounts        | User Registration & Login                                 | IN         | Essential for player data persistence and identity.                                              |
| UI & Navigation | Basic Guild Hub / Main Menu                               | IN         | Required for players to access core game loops.                                                  |
| Unit Management | Mercenary Hiring (with random aptitudes & skill patterns) | IN         | Core to the long-term retention loop and team building.6                                         |
| Unit Management | Squad Formation (Party of up to 4)                        | IN         | A prerequisite for entering battle.                                                              |
| Unit Management | Unit Stat & Skill Viewing                                 | IN         | Essential for players to make strategic decisions.                                               |
| Unit Management | Equipment Forging/Upgrading                               | OUT        | A secondary progression system; MVP focuses on unit-level progression.                           |
| PvP             | Asynchronous Matchmaking                                  | IN         | The central feature requested by the user.                                                       |
| PvP             | Defense Team Setup (4-turn AI scripting)                  | IN         | The core mechanic of asynchronous defense.19                                                     |
| PvP             | The "War" Meta-Game (Forts, Objectives, etc.)             | OUT        | A complex meta-layer built on top of the core battle system. Deferred to a post-MVP release.[10] |
| Combat          | 3-Lane Turn-Based Battle System                           | IN         | The absolute core of the gameplay experience.1                                                   |
| Combat          | Dual-Gauge Resource System (Move/Action)                  | IN         | Fundamental to the turn-by-turn tactical decisions.5                                             |
| Combat          | All 17 Character Classes & Tactical Triangle              | IN         | The variety of classes and their interactions are key to strategic depth.11                      |
| Combat          | Interactive Targeting & Combo Mini-Games                  | IN         | A defining feature that differentiates the combat from passive systems.3                         |
| Combat          | Battlefield Objects (Traps, Barricades)                   | OUT        | Adds complexity to battle simulation; can be added in a future update.                           |
| Progression     | Post-Battle EXP Gain & Leveling                           | IN         | The primary character progression mechanic.                                                      |
| Progression     | Post-Battle Currency Rewards                              | IN         | Required to fuel the mercenary hiring loop.                                                      |
| Story & World   | Single-Player Campaign & Quests                           | OUT        | A significant content creation effort, separate from the core PvP loop.[1, 39]                   |
| Story & World   | Board Game Map Traversal                                  | OUT        | A distinct gameplay system not required for the PvP battle MVP.1                                 |

_Table 4.1.1: MVP Feature and Scope Definition_

### 4.2 AI Logic for Asynchronous Combat

The AI for the defending team in asynchronous PvP will be implemented using a two-tiered approach that is simple to develop for the MVP while providing players with sufficient strategic control.

- **The "Four-Turn Script" System:** The primary AI logic will be the direct execution of a player-defined script. The "Defense Setup" UI will allow a player to configure the actions for each of their four defending units for each of the first four turns of combat. For each turn/unit slot, the player will be able to select:

An action/skill from that unit's available list.

A targeting priority from a predefined list (e.g., "Target Leader," "Target Lowest HP," "Target Closest," "Target Front Row").

The backend's Battle Simulation Service will parse this script and execute these actions deterministically when it is the defending unit's turn.

- **Default Fallback Logic:** In the event a player does not set up a script, or after the fourth turn of combat has passed, all defending units will revert to a simple, hard-coded, role-based AI logic. This provides a baseline of functionality and prevents units from becoming inactive.
- **Melee AI:** Will prioritize moving towards the closest enemy unit and using its highest-damage single-target skill.
- **Ranged AI:** Will prioritize attacking the enemy unit with the lowest current HP percentage.
- **Magic AI:** Will prioritize using its largest AoE attack that can hit the maximum number of enemies.
- **Specialist (Medic) AI:** Will prioritize healing the allied unit with the lowest current HP percentage.

This approach delivers the core promise of player-configured defenses without requiring investment in complex machine learning or dynamic decision-tree AI, making it ideal for the MVP.

### 4.3 Recommended Development Epics (High-Level Roadmap)

The development of the MVP can be structured into four major epics. This sequence is designed to build foundational systems first and progressively integrate features, allowing for continuous testing and validation at each stage.

#### Epic 1: Foundational Backend & Database Setup

- **Objective:** Establish the complete server-side infrastructure and core player data services.

**Key Tasks:**

- Provision cloud infrastructure and set up deployment pipelines (CI/CD).
- Implement the API Gateway.
- Develop the Authentication Service, including registration and login endpoints.
- Develop the Player Service with endpoints for managing currency and the unit roster.
- Define and migrate the initial PostgreSQL schemas for players and units.
- Set up the Redis instance for session management.

- **Deliverable:** A secure, running backend capable of creating and managing player accounts and data.

#### Epic 2: Core Battle Logic Implementation

- **Objective:** Develop the server-side engine that enforces all game rules.

**Key Tasks:**

- Develop the stateless Battle Simulation Service.
- Implement the turn order system based on the ACT stat.
- Implement the 3-lane positioning and movement rules.
- Code the damage calculation formulas, including the Melee > Ranged > Magic > Melee tactical triangle.
- Implement the dual-gauge (Move/Action) resource system.
- Seed the database with all 17 classes and their respective skills and skill patterns.

- **Deliverable:** A backend API that can simulate a complete battle from start to finish based on a sequence of input actions.

#### Epic 3: Web Client & Battle Scene

- **Objective:** Create a playable, visible representation of the battle.

**Key Tasks:**

- Initialize the Phaser project and structure the client architecture with scenes.
- Develop the BattleScene to render the game state received from the backend (lanes, sprites, UI).
- Implement all battle UI elements: timeline, health bars, gauges, skill buttons.
- Implement the client-side interactive mini-games for targeting and combos.
- Establish the network layer to communicate with the backend, allowing a user to play a full battle against a hard-coded AI opponent.

- **Deliverable:** A playable web-based battle client that demonstrates all core combat mechanics.

#### Epic 4: Asynchronous PvP Loop Integration

- **Objective:** Connect all systems to deliver the complete end-to-end MVP experience.

**Key Tasks:**

- Develop the client-side UIs for the Guild Hub, Squad Management, and the Defense Team AI scripting.
- Implement the Matchmaking Service on the backend.
- Integrate the full gameplay loop: Player logs in, hires units, forms a squad, sets their defense script, enters the matchmaking queue, is matched with an opponent, plays a full battle, and receives results.

- **Deliverable:** The complete Minimum Viable Product as defined in Section 4.1.

## Works cited

1. Grand Kingdom - Wikipedia, accessed October 24, 2025, https://en.wikipedia.org/wiki/Grand_Kingdom
2. Grand Kingdom (PS4) Review - STG Play, accessed October 24, 2025, https://www.shanethegamer.com/playstation/playstation-vita/playstation-vita-reviews/grand-kingdom-ps4-review/
3. Combat Mechanics - Grand Kingdom Guide - IGN, accessed October 24, 2025, https://www.ign.com/wikis/grand-kingdom/Combat_Mechanics
4. Grand Kingdom Review – Grand Tactics - The Gaming Gamma, accessed October 24, 2025, https://gaminggamma.com/2016/07/11/grand-kingdom-review-gran-tactics/
5. Game Review: Grand Kingdom - Pop Culture Beast, accessed October 24, 2025, https://www.popculturebeast.com/grand-kingdom-review/
6. Unit Stats - Grand Kingdom Guide - IGN, accessed October 24, 2025, https://www.ign.com/wikis/grand-kingdom/Unit_Stats
7. Grand Kingdom [Game Discussion Thread] : r/vita - Reddit, accessed October 24, 2025, https://www.reddit.com/r/vita/comments/4q4v3s/grand_kingdom_game_discussion_thread/
8. Hints and Tips - Grand Kingdom - GameFAQs, accessed October 24, 2025, https://gamefaqs.gamespot.com/boards/169575-grand-kingdom/73927784
9. Combat System - Grand Kingdom - GameFAQs, accessed October 24, 2025, https://gamefaqs.gamespot.com/boards/169575-grand-kingdom/73912688
10. War Guide - Grand Kingdom - GameFAQs - GameSpot, accessed October 24, 2025, https://gamefaqs.gamespot.com/boards/169575-grand-kingdom/74009964
11. Class | Grand Kingdom Official Website - NIS America, accessed October 24, 2025, https://nisamerica.com/grand-kingdom/class/
12. Meet the Various Classes of Tactical Japanese RPG, Grand Kingdom - Niche Gamer, accessed October 24, 2025, https://nichegamer.com/meet-the-various-classes-of-tactical-japanese-rpg-grand-kingdom/
13. Skill Completionist Trophy • Grand Kingdom • PSNProfiles.com, accessed October 24, 2025, https://psnprofiles.com/trophy/4978-grand-kingdom/19-skill-completionist
14. Newbie Guide - Grand Kingdom - GameFAQs, accessed October 24, 2025, https://gamefaqs.gamespot.com/boards/169575-grand-kingdom/73955159
15. Learning skills - Grand Kingdom - GameFAQs, accessed October 24, 2025, https://gamefaqs.gamespot.com/boards/169575-grand-kingdom/73908017
16. Just picked up Grand Kingdom Tips please! : r/GrandKingdom - Reddit, accessed October 24, 2025, https://www.reddit.com/r/GrandKingdom/comments/5v15ag/just_picked_up_grand_kingdom_tips_please/
17. Grand Kingdom Trophy Guide • PSNProfiles.com, accessed October 24, 2025, https://psnprofiles.com/guide/5209-grand-kingdom-trophy-guide
18. It's Easy To Be Productive In Grand Kingdom - Siliconera, accessed October 24, 2025, https://www.siliconera.com/easy-productive-grand-kingdom/
19. Online | Grand Kingdom Official Website - NIS America, accessed October 24, 2025, https://nisamerica.com/grand-kingdom/online/
20. Setting direct actions for troop detachment. - Grand Kingdom, accessed October 24, 2025, https://gamefaqs.gamespot.com/boards/169575-grand-kingdom/73917561
21. What Backend Architecture Supports Scalable Multiplayer Games - Galaxy4Games, accessed October 24, 2025, https://galaxy4games.com/en/knowledgebase/blog/what-backend-architecture-supports-scalable-multiplayer-games
22. Architecture for authoritative multiplayer backend ? : r/gamedev - Reddit, accessed October 24, 2025, https://www.reddit.com/r/gamedev/comments/19cao5r/architecture_for_authoritative_multiplayer_backend/
23. Node JS vs Django for Backend Development: Which Is Better? - planeks, accessed October 24, 2025, https://www.planeks.net/node-js-vs-django-for-backend/
24. Matchups: Node.js vs. Python (Django/Flask) | Backend Framework Comparison, accessed October 24, 2025, https://www.swiftorial.com/matchups/backend_framework/nodejs-vs-python-django-flask
25. SQL vs NoSQL Databases: Key Differences and Practical Insights - DataCamp, accessed October 24, 2025, https://www.datacamp.com/blog/sql-vs-nosql-databases
26. pixi.js vs matter-js vs phaser vs aframe vs babylonjs vs playcanvas vs planck vs melonjs vs whs - NPM Compare, accessed October 24, 2025, https://npm-compare.com/aframe,babylonjs,matter-js,melonjs,phaser,pixi.js,planck,playcanvas,whs
27. What PixiJS Is Not, accessed October 24, 2025, https://pixijs.com/7.x/guides/basics/what-pixijs-is-not
28. JavaScript 2D Game Development A Comprehensive Framework Comparison | Yuan's Blog, accessed October 24, 2025, https://yuan.fyi/blog/game/javascript-2d-game-development-a-comprehensive-framework-comparison
29. Best JavaScript Game Engines - Codersera, accessed October 24, 2025, https://codersera.com/blog/best-javascript-game-engines
30. Collection: JavaScript Game Engines - GitHub, accessed October 24, 2025, https://github.com/collections/javascript-game-engines
31. Babylon 2D - For easy 2D canvas interaction - Feature requests, accessed October 24, 2025, https://forum.babylonjs.com/t/babylon-2d-for-easy-2d-canvas-interaction/31817
32. Is it possible to optimize BabylonJS to use as 2D game engine like PIXI and Phaser?, accessed October 24, 2025, https://forum.babylonjs.com/t/is-it-possible-to-optimize-babylonjs-to-use-as-2d-game-engine-like-pixi-and-phaser/42031
33. Shirajuki/js-game-rendering-benchmark: Performance comparison of Javascript rendering/game engines: Three.js, Pixi.js, Phaser, Babylon.js, Two.js, Hilo, melonJS, Kaboom, Kaplay, Kontra, Excalibur, Litecanvas, LittleJS, Canvas API and DOM. - GitHub, accessed October 24, 2025, https://github.com/Shirajuki/js-game-rendering-benchmark
34. Phaser - A fast, fun and free open source HTML5 game framework, accessed October 24, 2025, https://phaser.io/
