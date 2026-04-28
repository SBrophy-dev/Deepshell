# Deepshell

A CLI roguelike dungeon crawler built in TypeScript. Explore procedurally generated dungeons, battle enemies, collect loot, and see how deep you can go.

## Features

- **Procedural Dungeon Generation**: Every floor is uniquely generated with rooms, corridors, and secrets
- **Turn-Based Combat**: Strategic melee and ranged combat with skill progression
- **Skill System**: Level up 5 different skills - Melee, Ranged, Defense, Stealth, and Perception
- **Perk System**: Choose powerful perks after clearing each floor
- **Boss Battles**: Face challenging bosses every 5 floors
- **Seeded Runs**: Share seeds with friends for the same dungeon layout
- **High Scores**: Track your best runs

## Screenshots

### Title Screen
```
  ____  _____ _____ ____  ____  _   _ _____ _     _     
 |  _ \| ____| ____|  _ \/ ___|| | | | ____| |   | |    
 | | | |  _| |  _| | |_) \___ \| |_| |  _| | |   | |    
 | |_| | |___| |___|  __/ ___) |  _  | |___| |___| |___ 
 |____/|_____|_____|_|   |____/|_| |_|_____|_____|_____|

  1. New Game
  2. New Game with Seed
  3. View High Scores
  4. Quit
```

### Dungeon Exploration
```
####################################################
####################################################
##############################################....##
##############################################.<..##
####.......#########################........##.@..##
####....m..#########################........##....##
####...!..+m........................+......+..+...##
####.......########+++++++##########........##....##
####...+...########.......##########........##....##
#######.###########.......##########+++++...########
#######.####.......+.....+...............###########
#######.#...++++###.......#############..###########
#######.#.......###.......#############..###########
#######.#.......#######################..###########
#######.#......+...............########..###########
#######.#.......##############.########..###########
#######.#.......##############.########..###########
#######.#.......##############.########..###########
#######.######################.########..###########
#######.######################.########..###########
#######.######################.#####...++.##########
#######.###################...+..###......##########
#######....................+.).r+...+.....##########
###########################...!>.###......##########
###########################...r..###################
####################################################
####################################################
####################################################

HP: 100/100  Lvl: 1  XP: 0  Weapon: Rusty Dagger  Armor: none  Floor: 1
```

### Boss Floor
```
#######################################################
#######################################################
#############.........#################################
#############.........#################################
#############.........#################################
####.........+.......+................#################
####.########.........#############.#.#################
####.########.........#############.#.#################
####.##############################.#.#################
####.##############################.#.########......###
####.##############################.#.########......###
####.##############################.#.########......###
####.############################..+.+...#####......###
####.#####........###############........#####...+..###
####.#####........###############........########.#####
####.#####.......+...............+......+.........#####
####.#####........###############........########.#####
##..+..###....+...###############........########.#####
##.....#######.##################..+.....########.#####
##..)..#######.####################.#############.#####
##..+..#######.####################.#############.#####
####.#########.####################.#############.#####
####.#########.#.....##########....+....#########.#####
####.#########.#...!.##########.@.......########.+....#
####.#########.#..)..##########.........########......#
####............+.B.+..........+.......+........+.....#
################...>.##########.........########......#
################.....##########.........###############
#######################################################

HP: 85/100  Lvl: 3  XP: 150  Weapon: Floor 3 Sword  Armor: Floor 2 Shield  Floor: 5  [BOSS FLOOR]
```

### Perk Selection
```
Floor 4 completed!
Choose a perk:
  1. Ranged Training — Increase your Ranged skill level by 1.
  2. Power Surge — Increase your base damage by 4.
  3. Found: Perk Shield — Receive a Perk Shield.
```

### Game Over Screen
```
  === GAME OVER ===

  Floors Cleared: 7
  Enemies Defeated: 42
  Bosses Defeated: 1

  Highest Skill Levels:
    Melee: 4
    Ranged: 2
    Defense: 3
    Stealth: 2
    Perception: 3

  Seed: 1714396800000
```

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/deepshell.git
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
| `help` | `?` | Show help message |
| `quit` | `q` | End the game |

## ASCII Legend

| Symbol | Meaning |
|--------|---------|
| `@` | Player |
| `#` | Wall |
| `.` | Floor/Corridor |
| `+` | Door |
| `<` | Stairs up (entry) |
| `>` | Stairs down (exit) |
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

- **TypeScript** - Type-safe JavaScript
- **Node.js** - Runtime environment
- **Vitest** - Testing framework with property-based testing support

## License

MIT
