import type {
  Enemy,
  GameState,
  EnemyAction,
  Position,
  Direction,
} from '../models/index.js';
import { findPath, hasLineOfSight } from '../utils/pathfinder.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Manhattan distance between two positions. */
function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Returns true when the enemy is exactly 1 tile away (4-directional). */
function isAdjacent(a: Position, b: Position): boolean {
  return manhattan(a, b) === 1;
}

/** Derive a cardinal Direction from `from` toward `to`. */
function directionTo(from: Position, to: Position): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'east' : 'west';
  }
  return dy > 0 ? 'south' : 'north';
}

/** The four cardinal neighbour offsets. */
const CARDINAL_OFFSETS: Position[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/** Return walkable cardinal neighbours of `pos` on the grid. */
function walkableNeighbours(pos: Position, state: GameState): Position[] {
  const { grid } = state.currentFloor;
  const height = grid.length;
  const width = height > 0 ? grid[0].length : 0;

  return CARDINAL_OFFSETS
    .map((d) => ({ x: pos.x + d.x, y: pos.y + d.y }))
    .filter(
      (p) =>
        p.x >= 0 &&
        p.y >= 0 &&
        p.x < width &&
        p.y < height &&
        grid[p.y][p.x].walkable,
    );
}

/** Pick a random adjacent walkable tile using the state's RNG, or null. */
function randomWalkableNeighbour(
  pos: Position,
  state: GameState,
): Position | null {
  const candidates = walkableNeighbours(pos, state);
  if (candidates.length === 0) return null;
  const idx = state.rng.nextInt(0, candidates.length - 1);
  return candidates[idx];
}


// ─── Behavior handlers ───────────────────────────────────────────────────────

function tickMelee(enemy: Enemy, state: GameState): EnemyAction {
  const playerPos = state.player.position;
  const grid = state.currentFloor.grid;
  const range = enemy.detectionRange ?? 5;

  // Adjacent → melee attack
  if (isAdjacent(enemy.position, playerPos)) {
    return { type: 'meleeAttack', target: playerPos };
  }

  // Within detection range AND line of sight → pathfind toward player
  if (
    manhattan(enemy.position, playerPos) <= range &&
    hasLineOfSight(grid, enemy.position, playerPos)
  ) {
    const path = findPath(grid, enemy.position, playerPos);
    if (path.length > 0) {
      return { type: 'move', position: path[0] };
    }
  }

  // Otherwise → wander or idle
  return wander(enemy, state);
}

function tickRanged(enemy: Enemy, state: GameState): EnemyAction {
  const playerPos = state.player.position;
  const grid = state.currentFloor.grid;
  const range = enemy.detectionRange ?? 5;
  const dist = manhattan(enemy.position, playerPos);

  // Adjacent → try to move away, otherwise melee
  if (isAdjacent(enemy.position, playerPos)) {
    const retreatPos = moveAway(enemy.position, playerPos, state);
    if (retreatPos) {
      return { type: 'move', position: retreatPos };
    }
    return { type: 'meleeAttack', target: playerPos };
  }

  // Within detection range AND line of sight
  if (
    dist <= range &&
    hasLineOfSight(grid, enemy.position, playerPos)
  ) {
    // Too close (< 2) → move away
    if (dist < 2) {
      const retreatPos = moveAway(enemy.position, playerPos, state);
      if (retreatPos) {
        return { type: 'move', position: retreatPos };
      }
    }

    // Good distance (2-3) → fire
    if (dist >= 2 && dist <= 3) {
      const dir = directionTo(enemy.position, playerPos);
      return { type: 'rangedAttack', direction: dir };
    }

    // Too far but still in range (4-5) → approach
    const path = findPath(grid, enemy.position, playerPos);
    if (path.length > 0) {
      return { type: 'move', position: path[0] };
    }
  }

  // Otherwise → wander or idle
  return wander(enemy, state);
}

function tickPatrol(enemy: Enemy, state: GameState): EnemyAction {
  const playerPos = state.player.position;
  const grid = state.currentFloor.grid;
  const range = enemy.detectionRange ?? 5;

  // Aggro and adjacent → melee attack
  if (enemy.isAggro && isAdjacent(enemy.position, playerPos)) {
    return { type: 'meleeAttack', target: playerPos };
  }

  // Check detection → become aggro
  if (
    manhattan(enemy.position, playerPos) <= range &&
    hasLineOfSight(grid, enemy.position, playerPos)
  ) {
    // Mark aggro (caller should persist this on the enemy)
    enemy.isAggro = true;

    // Adjacent after becoming aggro → attack
    if (isAdjacent(enemy.position, playerPos)) {
      return { type: 'meleeAttack', target: playerPos };
    }

    // Chase (same as melee chase)
    const path = findPath(grid, enemy.position, playerPos);
    if (path.length > 0) {
      return { type: 'move', position: path[0] };
    }
  }

  // Not aggro → follow patrol path or idle
  if (!enemy.isAggro && enemy.patrolPath && enemy.patrolPath.length > 0) {
    return followPatrolPath(enemy, state);
  }

  // Aggro but not adjacent and no path found → wander
  if (enemy.isAggro) {
    return wander(enemy, state);
  }

  return { type: 'idle' };
}

// ─── Shared utilities ────────────────────────────────────────────────────────

/** Wander: move to a random adjacent walkable tile, or idle. */
function wander(enemy: Enemy, state: GameState): EnemyAction {
  const pos = randomWalkableNeighbour(enemy.position, state);
  if (pos) {
    return { type: 'move', position: pos };
  }
  return { type: 'idle' };
}

/** Try to move to a walkable tile that increases distance from `target`. */
function moveAway(
  from: Position,
  target: Position,
  state: GameState,
): Position | null {
  const currentDist = manhattan(from, target);
  const candidates = walkableNeighbours(from, state).filter(
    (p) => manhattan(p, target) > currentDist,
  );
  if (candidates.length === 0) return null;
  const idx = state.rng.nextInt(0, candidates.length - 1);
  return candidates[idx];
}

/** Follow the patrol path — move to the next position in sequence. */
function followPatrolPath(enemy: Enemy, state: GameState): EnemyAction {
  const path = enemy.patrolPath!;
  // Find the current index in the patrol path (closest point)
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = manhattan(enemy.position, path[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  // Next waypoint is the one after the closest
  const nextIdx = (bestIdx + 1) % path.length;
  const target = path[nextIdx];

  // If already at the target, advance again
  if (target.x === enemy.position.x && target.y === enemy.position.y) {
    const afterIdx = (nextIdx + 1) % path.length;
    const afterTarget = path[afterIdx];
    const p = findPath(state.currentFloor.grid, enemy.position, afterTarget);
    if (p.length > 0) {
      return { type: 'move', position: p[0] };
    }
    return { type: 'idle' };
  }

  const p = findPath(state.currentFloor.grid, enemy.position, target);
  if (p.length > 0) {
    return { type: 'move', position: p[0] };
  }
  return { type: 'idle' };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate an enemy's behavior for the current turn and return the action
 * it should take.
 */
export function tick(enemy: Enemy, state: GameState): EnemyAction {
  switch (enemy.behavior) {
    case 'melee':
      return tickMelee(enemy, state);
    case 'ranged':
      return tickRanged(enemy, state);
    case 'patrol':
      return tickPatrol(enemy, state);
    default:
      return { type: 'idle' };
  }
}
