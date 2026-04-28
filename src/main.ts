import * as readline from 'node:readline';
import { initNewGame, processCommand } from './systems/gameEngine.js';
import { parseCommand } from './systems/commandParser.js';
import { saveRunRecord, getHighScores } from './systems/persistence.js';
import {
  render,
  renderTitleScreen,
  renderGameOver,
  renderPerkSelection,
  checkTerminalSize,
} from './ui/renderer.js';
import type { GameState, ParsedCommand, RunRecord } from './models/index.js';

// ─── Readline Setup ──────────────────────────────────────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => resolve(answer));
  });
}

function clearScreen(): void {
  process.stdout.write('\x1Bc');
}

// ─── High Scores Display ────────────────────────────────────────────────────

function displayHighScores(): void {
  const scores = getHighScores(10);
  if (scores.length === 0) {
    console.log('\n  No run history available.\n');
    return;
  }
  console.log('\n  === HIGH SCORES ===\n');
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    console.log(`  ${i + 1}. Floors: ${s.floorsCleared}  Enemies: ${s.enemiesDefeated}  Bosses: ${s.bossesDefeated}  Seed: ${s.seed}  Date: ${s.date}`);
  }
  console.log('');
}

// ─── Title Screen ────────────────────────────────────────────────────────────

async function showTitleScreen(): Promise<void> {
  while (true) {
    clearScreen();
    process.stdout.write(renderTitleScreen());

    const input = (await prompt('> ')).trim().toLowerCase();

    if (input === '1' || input === 'new') {
      await runGameLoop(initNewGame());
    } else if (input === '2' || input === 'seed') {
      const seed = (await prompt('  Enter seed: ')).trim();
      if (seed.length > 0) {
        await runGameLoop(initNewGame(seed));
      } else {
        await runGameLoop(initNewGame());
      }
    } else if (input === '3' || input === 'scores') {
      clearScreen();
      displayHighScores();
      await prompt('  Press Enter to continue...');
    } else if (input === '4' || input === 'quit') {
      rl.close();
      process.exit(0);
    }
  }
}

// ─── Game Loop ───────────────────────────────────────────────────────────────

async function runGameLoop(initialState: GameState): Promise<void> {
  let state = initialState;

  while (true) {
    clearScreen();
    process.stdout.write(render(state) + '\n');

    if (state.gamePhase === 'perkSelection' && state.perkChoices) {
      process.stdout.write(renderPerkSelection(state.perkChoices));
    }

    const input = await prompt('> ');
    const trimmed = input.trim();

    if (trimmed.length === 0) continue;

    // Handle perk selection phase specially
    if (state.gamePhase === 'perkSelection') {
      const command: ParsedCommand = { action: trimmed, target: null, raw: input };
      state = processCommand(state, command);
      continue;
    }

    const parsed = parseCommand(trimmed);

    if ('error' in parsed) {
      state = {
        ...state,
        messageLog: [...state.messageLog, parsed.error].slice(-50),
      };
      continue;
    }

    state = processCommand(state, parsed);

    if (state.gamePhase === 'gameOver') {
      clearScreen();
      process.stdout.write(renderGameOver(state.runStats, state.seed));

      const record: RunRecord = {
        date: new Date().toISOString(),
        floorsCleared: state.runStats.floorsCleared,
        enemiesDefeated: state.runStats.enemiesDefeated,
        bossesDefeated: state.runStats.bossesDefeated,
        highestSkillLevels: { ...state.runStats.highestSkillLevels },
        seed: state.seed,
      };
      saveRunRecord(record);

      await prompt('  Press Enter to continue...');
      return;
    }
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

function main(): void {
  // Check terminal size
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const sizeWarning = checkTerminalSize(cols, rows);
  if (sizeWarning) {
    console.log(sizeWarning);
  }

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\nGoodbye!');
    rl.close();
    process.exit(0);
  });

  showTitleScreen().catch((err) => {
    console.error('Fatal error:', err);
    rl.close();
    process.exit(1);
  });
}

main();
