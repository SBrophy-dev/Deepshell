import type { Tile, Position } from '../models/index.js';

/**
 * A* pathfinding on a tile grid. Returns the sequence of positions from `from`
 * to `to` (inclusive of `to`, exclusive of `from`). Returns an empty array if
 * no walkable path exists.
 */
export function findPath(
  grid: Tile[][],
  from: Position,
  to: Position,
): Position[] {
  const height = grid.length;
  if (height === 0) return [];
  const width = grid[0].length;

  // Quick bounds / walkability checks
  if (!inBounds(from, width, height) || !inBounds(to, width, height)) return [];
  if (!grid[to.y][to.x].walkable) return [];
  if (from.x === to.x && from.y === to.y) return [];

  const key = (p: Position) => `${p.x},${p.y}`;

  const openSet = new Map<string, Position>();
  const cameFrom = new Map<string, Position>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  const startKey = key(from);
  openSet.set(startKey, from);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(from, to));

  while (openSet.size > 0) {
    // Pick the node in openSet with the lowest fScore
    let current: Position | null = null;
    let currentKey = '';
    let bestF = Infinity;
    for (const [k, pos] of openSet) {
      const f = fScore.get(k) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = pos;
        currentKey = k;
      }
    }

    if (!current) break;

    if (current.x === to.x && current.y === to.y) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(currentKey);

    for (const neighbor of neighbors(current, width, height)) {
      if (!grid[neighbor.y][neighbor.x].walkable) continue;

      const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;
      const nKey = key(neighbor);

      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, current);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic(neighbor, to));
        if (!openSet.has(nKey)) {
          openSet.set(nKey, neighbor);
        }
      }
    }
  }

  return []; // No path found
}

/**
 * Bresenham's line algorithm for line-of-sight checks.
 * Returns true if every tile along the line from `from` to `to` is walkable.
 * The start position (`from`) is not checked; the end position (`to`) is not
 * required to be walkable (we only care about blocking tiles *between* them).
 */
export function hasLineOfSight(
  grid: Tile[][],
  from: Position,
  to: Position,
): boolean {
  const height = grid.length;
  if (height === 0) return false;
  const width = grid[0].length;

  if (!inBounds(from, width, height) || !inBounds(to, width, height)) {
    return false;
  }

  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    // Skip the starting position check
    if (!(x0 === from.x && y0 === from.y)) {
      // Skip the ending position check — we only block on intermediate tiles
      if (x0 === x1 && y0 === y1) break;
      if (!grid[y0][x0].walkable) return false;
    }

    if (x0 === x1 && y0 === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function inBounds(p: Position, width: number, height: number): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;
}

function neighbors(p: Position, width: number, height: number): Position[] {
  const dirs: Position[] = [
    { x: p.x, y: p.y - 1 },
    { x: p.x, y: p.y + 1 },
    { x: p.x - 1, y: p.y },
    { x: p.x + 1, y: p.y },
  ];
  return dirs.filter((d) => inBounds(d, width, height));
}

function reconstructPath(
  cameFrom: Map<string, Position>,
  current: Position,
): Position[] {
  const path: Position[] = [current];
  let key = `${current.x},${current.y}`;
  while (cameFrom.has(key)) {
    const prev = cameFrom.get(key)!;
    // Don't include the start position
    const prevKey = `${prev.x},${prev.y}`;
    if (!cameFrom.has(prevKey)) break;
    path.unshift(prev);
    key = prevKey;
  }
  return path;
}
