import type { SeededRNG, Floor, Room, Tile, TileType, Position, Enemy, EnemyBehavior, ItemPlacement, Item, Weapon, Armor, Consumable } from '../models/index.js';
import { ASCII_CHARS } from '../models/index.js';

// ─── Tile Helpers ────────────────────────────────────────────────────────────

function makeTile(type: TileType): Tile {
  const charMap: Record<TileType, string> = {
    wall: ASCII_CHARS.wall,
    floor: ASCII_CHARS.floor,
    corridor: ASCII_CHARS.corridor,
    door: ASCII_CHARS.door,
    stairsUp: ASCII_CHARS.stairsUp,
    stairsDown: ASCII_CHARS.stairsDown,
  };
  const walkable = type !== 'wall';
  return { type, char: charMap[type], walkable, entity: null, item: null };
}

// ─── Grid Helpers ────────────────────────────────────────────────────────────

function createGrid(width: number, height: number): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      row.push(makeTile('wall'));
    }
    grid.push(row);
  }
  return grid;
}

function carveRoom(grid: Tile[][], room: Room): void {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      grid[y][x] = makeTile('floor');
    }
  }
}

function roomCenter(room: Room): Position {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

function roomsOverlap(a: Room, b: Room, padding: number = 1): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

// ─── Corridor Carving ────────────────────────────────────────────────────────

function carveHCorridor(grid: Tile[][], x1: number, x2: number, y: number): void {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (let x = minX; x <= maxX; x++) {
    if (grid[y][x].type === 'wall') {
      grid[y][x] = makeTile('corridor');
    }
  }
}

function carveVCorridor(grid: Tile[][], y1: number, y2: number, x: number): void {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y++) {
    if (grid[y][x].type === 'wall') {
      grid[y][x] = makeTile('corridor');
    }
  }
}

function connectRooms(grid: Tile[][], rng: SeededRNG, a: Room, b: Room): void {
  const ca = roomCenter(a);
  const cb = roomCenter(b);
  // L-shaped corridor: randomly choose horizontal-first or vertical-first
  if (rng.next() < 0.5) {
    carveHCorridor(grid, ca.x, cb.x, ca.y);
    carveVCorridor(grid, ca.y, cb.y, cb.x);
  } else {
    carveVCorridor(grid, ca.y, cb.y, ca.x);
    carveHCorridor(grid, ca.x, cb.x, cb.y);
  }
}

// ─── Door Placement ──────────────────────────────────────────────────────────

function isInsideRoom(x: number, y: number, rooms: Room[]): boolean {
  return rooms.some(
    r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
  );
}

function placeDoors(grid: Tile[][], rooms: Room[]): void {
  const height = grid.length;
  const width = grid[0].length;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tile = grid[y][x];
      if (tile.type !== 'corridor' && tile.type !== 'floor') continue;
      // A door candidate is a walkable tile at the boundary between a room and a corridor
      const isRoomTile = isInsideRoom(x, y, rooms);
      if (!isRoomTile) continue;
      // Check if this room-edge tile is adjacent to a corridor tile
      const neighbors = [
        { nx: x, ny: y - 1 },
        { nx: x, ny: y + 1 },
        { nx: x - 1, ny: y },
        { nx: x + 1, ny: y },
      ];
      for (const { nx, ny } of neighbors) {
        if (grid[ny][nx].type === 'corridor' && !isInsideRoom(nx, ny, rooms)) {
          grid[y][x] = makeTile('door');
          break;
        }
      }
    }
  }
}

// ─── BFS Connectivity Check ──────────────────────────────────────────────────

function isConnected(grid: Tile[][], from: Position, to: Position): boolean {
  const height = grid.length;
  const width = grid[0].length;
  const visited = new Set<string>();
  const queue: Position[] = [from];
  visited.add(`${from.x},${from.y}`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === to.x && current.y === to.y) return true;

    const dirs = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];
    for (const next of dirs) {
      if (next.x < 0 || next.x >= width || next.y < 0 || next.y >= height) continue;
      const key = `${next.x},${next.y}`;
      if (visited.has(key)) continue;
      if (!grid[next.y][next.x].walkable) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

// ─── Room Generation ─────────────────────────────────────────────────────────

function generateRooms(
  rng: SeededRNG,
  width: number,
  height: number,
  roomCount: number,
): Room[] {
  const rooms: Room[] = [];
  const maxAttempts = roomCount * 20;

  for (let attempt = 0; attempt < maxAttempts && rooms.length < roomCount; attempt++) {
    const rw = rng.nextInt(4, 9);
    const rh = rng.nextInt(4, 7);
    const rx = rng.nextInt(1, width - rw - 1);
    const ry = rng.nextInt(1, height - rh - 1);
    const candidate: Room = { x: rx, y: ry, width: rw, height: rh };

    if (!rooms.some(existing => roomsOverlap(existing, candidate, 2))) {
      rooms.push(candidate);
    }
  }
  return rooms;
}

// ─── Floor Scaling ───────────────────────────────────────────────────────────

function getFloorParams(floorNumber: number) {
  // Scale floor dimensions and room count with floor number
  const baseWidth = 40;
  const baseHeight = 20;
  const baseRooms = 4;

  const width = Math.min(baseWidth + floorNumber * 3, 80);
  const height = Math.min(baseHeight + floorNumber * 2, 50);
  const roomCount = Math.min(baseRooms + Math.floor(floorNumber * 0.8), 15);

  return { width, height, roomCount };
}

// ─── Enemy Generation ────────────────────────────────────────────────────────

function generateEnemies(rng: SeededRNG, floorNumber: number, rooms: Room[], grid: Tile[][]): Enemy[] {
  const enemies: Enemy[] = [];
  const enemyCount = Math.max(1, Math.floor(1 + floorNumber * 0.8));

  // Available behaviors scale with floor number
  const behaviors: EnemyBehavior[] = ['melee'];
  if (floorNumber >= 3) behaviors.push('ranged');
  if (floorNumber >= 5) behaviors.push('patrol');

  const behaviorChars: Record<EnemyBehavior, string> = {
    melee: ASCII_CHARS.meleeEnemy,
    ranged: ASCII_CHARS.rangedEnemy,
    patrol: ASCII_CHARS.patrolEnemy,
  };

  for (let i = 0; i < enemyCount; i++) {
    // Pick a random room (skip first room which has entry)
    const roomIdx = rooms.length > 1 ? rng.nextInt(1, rooms.length - 1) : 0;
    const room = rooms[roomIdx];

    // Pick a random position inside the room
    const ex = rng.nextInt(room.x + 1, room.x + room.width - 2);
    const ey = rng.nextInt(room.y + 1, room.y + room.height - 2);

    // Skip if tile is not walkable floor or already occupied
    if (!grid[ey][ex].walkable || grid[ey][ex].type === 'stairsUp' || grid[ey][ex].type === 'stairsDown') continue;

    const behavior = behaviors[rng.nextInt(0, behaviors.length - 1)];
    const baseHealth = 10 + floorNumber * 5;
    const baseDamage = 2 + floorNumber * 2;

    const enemy: Enemy = {
      id: `enemy-${floorNumber}-${i}`,
      name: `${behavior} creature`,
      position: { x: ex, y: ey },
      health: baseHealth + rng.nextInt(0, floorNumber * 2),
      maxHealth: baseHealth + floorNumber * 2,
      damage: baseDamage + rng.nextInt(0, floorNumber),
      defense: Math.floor(floorNumber * 0.5),
      behavior,
      detectionRange: 5,
      patrolPath: null,
      isAggro: false,
      isBoss: false,
      specialAttacks: null,
      dropRate: 0.3,
    };

    enemies.push(enemy);
  }

  // Guarantee at least one enemy
  if (enemies.length === 0 && rooms.length > 0) {
    const room = rooms.length > 1 ? rooms[1] : rooms[0];
    const ex = room.x + Math.floor(room.width / 2);
    const ey = room.y + Math.floor(room.height / 2);
    enemies.push({
      id: `enemy-${floorNumber}-fallback`,
      name: 'melee creature',
      position: { x: ex, y: ey },
      health: 10 + floorNumber * 5,
      maxHealth: 10 + floorNumber * 5,
      damage: 2 + floorNumber * 2,
      defense: Math.floor(floorNumber * 0.5),
      behavior: 'melee',
      detectionRange: 5,
      patrolPath: null,
      isAggro: false,
      isBoss: false,
      specialAttacks: null,
      dropRate: 0.3,
    });
  }

  return enemies;
}

// ─── Item Generation ─────────────────────────────────────────────────────────

function generateFloorItems(rng: SeededRNG, floorNumber: number, rooms: Room[], grid: Tile[][]): ItemPlacement[] {
  const placements: ItemPlacement[] = [];
  const itemCount = Math.max(1, Math.floor(1 + floorNumber * 0.5));

  for (let i = 0; i < itemCount; i++) {
    const roomIdx = rng.nextInt(0, rooms.length - 1);
    const room = rooms[roomIdx];
    const ix = rng.nextInt(room.x + 1, room.x + room.width - 2);
    const iy = rng.nextInt(room.y + 1, room.y + room.height - 2);

    if (!grid[iy][ix].walkable) continue;

    const roll = rng.next();
    let item: Item;

    if (roll < 0.3) {
      // Weapon
      const weapon: Weapon = {
        id: `item-${floorNumber}-${i}`,
        name: `Floor ${floorNumber} Sword`,
        description: 'A sturdy blade.',
        category: 'weapon',
        floorLevel: floorNumber,
        damage: 3 + floorNumber * 2,
        range: 1,
      };
      item = weapon;
    } else if (roll < 0.5) {
      // Armor
      const armor: Armor = {
        id: `item-${floorNumber}-${i}`,
        name: `Floor ${floorNumber} Shield`,
        description: 'Protective gear.',
        category: 'armor',
        floorLevel: floorNumber,
        defense: 2 + floorNumber,
      };
      item = armor;
    } else {
      // Consumable (health potion)
      const consumable: Consumable = {
        id: `item-${floorNumber}-${i}`,
        name: 'Health Potion',
        description: 'Restores health.',
        category: 'consumable',
        floorLevel: floorNumber,
        effect: { type: 'heal', amount: 10 + floorNumber * 3 },
      };
      item = consumable;
    }

    placements.push({ item, position: { x: ix, y: iy } });
  }

  return placements;
}

// ─── Fallback Layout ─────────────────────────────────────────────────────────

function generateFallbackFloor(width: number, height: number, floorNumber: number, rng: SeededRNG): Floor {
  const grid = createGrid(width, height);

  // Simple two-room layout guaranteed to be connected
  const room1: Room = { x: 2, y: 2, width: 6, height: 5 };
  const room2: Room = { x: width - 10, y: height - 8, width: 6, height: 5 };
  const rooms = [room1, room2];

  carveRoom(grid, room1);
  carveRoom(grid, room2);
  connectRooms(grid, rng, room1, room2);
  placeDoors(grid, rooms);

  const entry = { x: room1.x + 1, y: room1.y + 1 };
  const exit = { x: room2.x + 1, y: room2.y + 1 };
  grid[entry.y][entry.x] = makeTile('stairsUp');
  grid[exit.y][exit.x] = makeTile('stairsDown');

  const enemies = generateEnemies(rng, floorNumber, rooms, grid);
  const items = generateFloorItems(rng, floorNumber, rooms, grid);

  return { width, height, grid, rooms, entry, exit, enemies, items, isBossFloor: false };
}

// ─── Main Generation ─────────────────────────────────────────────────────────

function attemptGenerateFloor(rng: SeededRNG, floorNumber: number, width: number, height: number, roomCount: number): Floor | null {
  const grid = createGrid(width, height);
  const rooms = generateRooms(rng, width, height, roomCount);

  if (rooms.length < 2) return null;

  // Carve rooms
  for (const room of rooms) {
    carveRoom(grid, room);
  }

  // Connect rooms in sequence (minimum spanning chain) plus a few random extra connections
  for (let i = 1; i < rooms.length; i++) {
    connectRooms(grid, rng, rooms[i - 1], rooms[i]);
  }
  // Add 1-2 extra connections for loops
  const extraConnections = rng.nextInt(1, Math.min(2, rooms.length - 1));
  for (let i = 0; i < extraConnections; i++) {
    const a = rng.nextInt(0, rooms.length - 1);
    let b = rng.nextInt(0, rooms.length - 1);
    if (b === a) b = (b + 1) % rooms.length;
    connectRooms(grid, rng, rooms[a], rooms[b]);
  }

  // Place doors at room-corridor junctions
  placeDoors(grid, rooms);

  // Place entry and exit in different rooms
  const entryRoom = rooms[0];
  const exitRoom = rooms[rooms.length - 1];
  const entry: Position = { x: entryRoom.x + 1, y: entryRoom.y + 1 };
  const exit: Position = { x: exitRoom.x + exitRoom.width - 2, y: exitRoom.y + exitRoom.height - 2 };

  grid[entry.y][entry.x] = makeTile('stairsUp');
  grid[exit.y][exit.x] = makeTile('stairsDown');

  // Validate connectivity
  if (!isConnected(grid, entry, exit)) return null;

  // Generate enemies and items
  const enemies = generateEnemies(rng, floorNumber, rooms, grid);
  const items = generateFloorItems(rng, floorNumber, rooms, grid);

  return { width, height, grid, rooms, entry, exit, enemies, items, isBossFloor: false };
}

/**
 * Generate a dungeon floor for the given floor number.
 * Uses seeded RNG for deterministic generation.
 * Retries up to 3 times on connectivity failure, then falls back to a simple layout.
 */
export function generateFloor(rng: SeededRNG, floorNumber: number): Floor {
  const { width, height, roomCount } = getFloorParams(floorNumber);

  for (let attempt = 0; attempt < 3; attempt++) {
    const subRng = rng.fork();
    const floor = attemptGenerateFloor(subRng, floorNumber, width, height, roomCount);
    if (floor) return floor;
  }

  // Fallback: guaranteed-connected simple layout
  return generateFallbackFloor(width, height, floorNumber, rng.fork());
}

/**
 * Generate a boss floor (every 5th floor).
 * Contains a single boss enemy with enhanced stats and isBossFloor = true.
 */
export function generateBossFloor(rng: SeededRNG, floorNumber: number): Floor {
  const floor = generateFloor(rng, floorNumber);
  floor.isBossFloor = true;

  // Remove all regular enemies
  floor.enemies = [];

  // Place a boss in the exit room (last room)
  const bossRoom = floor.rooms[floor.rooms.length - 1];
  const bossPos: Position = {
    x: Math.floor(bossRoom.x + bossRoom.width / 2),
    y: Math.floor(bossRoom.y + bossRoom.height / 2),
  };

  const bossHealth = 50 + floorNumber * 15;
  const bossDamage = 8 + floorNumber * 4;

  const boss: Enemy = {
    id: `boss-${floorNumber}`,
    name: `Floor ${floorNumber} Guardian`,
    position: bossPos,
    health: bossHealth,
    maxHealth: bossHealth,
    damage: bossDamage,
    defense: Math.floor(floorNumber * 1.5),
    behavior: 'melee',
    detectionRange: 8,
    patrolPath: null,
    isAggro: false,
    isBoss: true,
    specialAttacks: [
      {
        name: 'Crushing Blow',
        damage: bossDamage + Math.floor(floorNumber * 2),
        cooldown: 3,
        currentCooldown: 0,
      },
    ],
    dropRate: 1.0,
  };

  floor.enemies = [boss];
  return floor;
}
