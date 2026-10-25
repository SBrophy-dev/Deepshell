# DeepShell

A polished CLI roguelike dungeon crawler built in TypeScript. Explore procedurally generated dungeons, battle enemies, collect loot, and see how deep you can go — all from the comfort of your terminal.

![Title Screen](src/screenshots/Deepshell_homepage.png)

## Features

- **Procedural Dungeon Generation**: Every floor is uniquely generated with rooms, corridors, and secrets
- **Turn-Based Combat**: Strategic melee and ranged combat with skill progression
- **Skill System**: Level up 5 different skills — Melee, Ranged, Defense, Stealth, and Perception
- **Perk System**: Choose powerful perks after clearing each floor
- **Boss Battles**: Face challenging bosses every 5 floors
- **Seeded Runs**: Share seeds with friends for the same dungeon layout
- **High Scores**: Track your best runs

## UI Features

- **Depth-Themed Interface**: The whole UI shifts hue as you descend through five named strata — The Shallows, The Fathoms, The Veins, The Furnace, and The Abyss — one per boss cycle
- **Dynamic Map Lighting**: A light radius glows around your character; walls bordering open space catch the light while solid rock fades into darkness
- **Responsive Panel Layout**: Wide terminals show the map, status, and messages side-by-side; narrow terminals fall back to a clean stacked view
- **Smooth Status Bars**: HP and XP bars with sub-character resolution and a continuous red → amber → green health gradient
- **Depth Gauge**: Status pips track your progress through each 5-floor boss cycle, with a warning banner on boss floors
- **Box-Drawn Panels**: Rounded frames for play, double-line frames for dramatic moments (level-ups, game over, the Hall of the Deep)
- **Fading Message Log**: Contextual icons and colors for combat, loot, and level-ups; older messages sink into the dark
- **Help Overlay**: `help` opens a categorized command reference without cluttering your message log
- **Built-in Tutorial**: A guided tutorial with a color-coded map legend, straight from the title screen
- **Cinematic Boot Sequence**: A typewriter boot log syncs your neural link before the descent begins

## Screenshots

### Title Screen & Tutorial

| Title Screen | How to Play |
|:------------:|:-----------:|
| ![Title](src/screenshots/Deepshell_homepage.png) | ![Tutorial](src/screenshots/Deepshell_HowToPlay.png) |

### Dungeon Exploration & Combat

| Floor 1 — Exploration | Combat Messages |
|:---------------------:|:---------------:|
| ![Floor 1](src/screenshots/Deepshell_lvl1.png) | ![Combat](src/screenshots/Deepshell_Attack.png) |

### Items & Progression

| Inventory & Pickups | Perk Selection |
|:--------------------:|:--------------:|
| ![Inventory](src/screenshots/Deepshell_InventoryPickup.png) | ![Perks](src/screenshots/Deepshell_NextLevelPerk.png) |

## Installation

```bash
# Clone the repository
git clone https://github.com/SBrophy-dev/deepshell.git
cd deepshell

# Install dependencies
npm install

# Build the project
npm run build
```

## Playing

```bash
npm start
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `north` | `n` | Move north |
| `south` | `s` | Move south |
| `east` | `e` | Move east |
| `west` | `w` | Move west |
| `attack` | `a` | Attack adjacent enemy |
| `shoot [direction]` | | Fire ranged weapon |
| `inventory` | `i` | List your items |
| `equip [item]` | | Equip a weapon or armor |
| `unequip [weapon/armor]` | | Unequip from a slot |
| `use [item]` | | Use a consumable item |
| `drop [item]` | | Drop an item on the floor |
| `pickup` | | Pick up item at your position |
| `look` | `l` | Describe surroundings |
| `inspect [target]` | | Inspect enemy or item |
| `skills` | | Show skill levels |
| `help` | `?` | Show help overlay |
| `quit` | `q` | End the game |

## Map Legend

| Symbol | Meaning |
|--------|---------|
| `@` | Player |
| `█` | Wall (lit by your presence; unbroken rock stays dark) |
| `·` | Floor/Corridor |
| `+` | Door |
| `▲` | Stairs up (entry) |
| `▼` | Stairs down (exit) |
| `m` | Melee enemy |
| `r` | Ranged enemy |
| `p` | Patrol enemy |
| `B` | Boss |
| `)` | Weapon |
| `[` | Armor |
| `!` | Item |

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Tech Stack

- **TypeScript** — Type-safe JavaScript
- **Node.js** — Runtime environment
- **Chalk** — Terminal styling and colors
- **Vitest** — Testing framework with property-based testing support

## License

MIT
