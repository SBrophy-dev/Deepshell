// Temporary visual smoke-test: renders every screen to stdout.
import { initNewGame } from '../dist/systems/gameEngine.js';
import { generateFloor } from '../dist/systems/dungeonGenerator.js';
import {
  render,
  renderTitleScreen,
  renderGameOver,
  renderPerkSelection,
  renderHelp,
  renderTutorial,
  renderHighScores,
} from '../dist/ui/renderer.js';

Object.defineProperty(process.stdout, 'columns', { value: 130 });

const divider = (label) => console.log(`\n\n========== ${label} ==========\n`);

divider('TITLE');
console.log(renderTitleScreen('kraken-42'));

divider('FLOOR 1 — The Shallows');
const state = initNewGame('preview-seed');
console.log(render(state));

divider('FLOOR 7 — The Fathoms');
const f7 = generateFloor(state.rng, 7);
console.log(render({
  ...state,
  floorNumber: 7,
  currentFloor: f7,
  player: { ...state.player, position: f7.entry, health: 42 },
  messageLog: [
    'You descend to floor 7.',
    'You picked up Iron Sword!',
    'Goblin hits you for 6 damage.',
    'You attack the Goblin for 9 damage.',
    'Goblin defeated! +25 XP',
  ],
}));

divider('FLOOR 21 — The Abyss (boss floor sim)');
const f21 = generateFloor(state.rng, 21);
f21.isBossFloor = true;
if (f21.enemies.length > 0) f21.enemies[0].isBoss = true;
console.log(render({
  ...state,
  floorNumber: 25,
  currentFloor: f21,
  player: { ...state.player, position: f21.entry, health: 12 },
  messageLog: ['The boss blocks your descent!'],
}));

divider('GAME OVER');
console.log(renderGameOver({
  floorsCleared: 12,
  enemiesDefeated: 48,
  bossesDefeated: 2,
  highestSkillLevels: { melee: 6, ranged: 2, defense: 4, stealth: 3, perception: 5 },
}, 'preview-seed'));

divider('PERKS');
console.log(renderPerkSelection([
  { type: 'increasedDamage', name: 'Power Surge', description: 'Deal +3 damage.', effect: {} },
  { type: 'increasedHealth', name: 'Vitality', description: 'Gain +10 max health.', effect: {} },
  { type: 'skillBonus', name: 'Training', description: 'Melee skill +1.', effect: {} },
]));

divider('HELP');
console.log(renderHelp());

divider('TUTORIAL');
console.log(renderTutorial());

divider('HIGH SCORES');
console.log(renderHighScores([
  { date: '2026-06-01T10:00:00Z', floorsCleared: 14, enemiesDefeated: 60, bossesDefeated: 2, highestSkillLevels: {}, seed: 'kraken-42' },
  { date: '2026-05-20T10:00:00Z', floorsCleared: 9, enemiesDefeated: 33, bossesDefeated: 1, highestSkillLevels: {}, seed: 'abyss-7' },
  { date: '2026-05-12T10:00:00Z', floorsCleared: 5, enemiesDefeated: 21, bossesDefeated: 1, highestSkillLevels: {}, seed: 'first-dive' },
  { date: '2026-05-02T10:00:00Z', floorsCleared: 2, enemiesDefeated: 4, bossesDefeated: 0, highestSkillLevels: {}, seed: 'hello' },
]));

divider('HIGH SCORES — EMPTY');
console.log(renderHighScores([]));
