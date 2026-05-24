import * as readline from 'node:readline';
import { initNewGame, processCommand } from './systems/gameEngine.js';
import { parseCommand } from './systems/commandParser.js';
import { saveRunRecord, getHighScores } from './systems/persistence.js';
import {
  render,
  renderTitleScreen,
  renderGameOver,
  renderPerkSelection,
  renderHelp,
  renderTutorial,
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typewriter(text: string, speed = 20): Promise<void> {
  for (const char of text) {
    process.stdout.write(char);
    await sleep(speed);
  }
  process.stdout.write('\n');
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

// ─── High Scores Display ─────────────────────────────────────────────────────

function displayHighScores(): void {
  const scores = getHighScores(10);
  if (scores.length === 0) {
    console.log('\n  No run history available.\n');
    return;
  }
  console.log('\n  === HIGH SCORES ===\n');
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    const date = new Date(s.date).toLocaleDateString();
    console.log(
      `  ${padLeft(String(i + 1), 2)}.  Floors: ${padLeft(String(s.floorsCleared), 3)}  Enemies: ${padLeft(String(s.enemiesDefeated), 3)}  Bosses: ${padLeft(String(s.bossesDefeated), 2)}  Seed: ${s.seed}  ${date}`,
    );
  }
  console.log('');
}

// ─── Intro Cinematic ─────────────────────────────────────────────────────────

async function introCinematic(): Promise<void> {
  clearScreen();
  await typewriter('  Establishing neural link...', 25);
  await sleep(150);
  await typewriter('  Synchronizing with the DeepShell...', 25);
  await sleep(200);
  await typewriter('  Welcome, operative.', 35);
  await sleep(400);
}

// ─── Title Screen ────────────────────────────────────────────────────────────

async function showTitleScreen(): Promise<void> {
  try {
    while (true) {
      clearScreen();
      process.stdout.write(renderTitleScreen() + '\n');

      const input = (await prompt('◆ ')).trim().toLowerCase();

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
      } else if (input === '4' || input === 'tutorial') {
        clearScreen();
        process.stdout.write(renderTutorial() + '\n');
        await prompt('  Press Enter to continue...');
      } else if (input === '5' || input === 'quit') {
        console.log('\nGoodbye!');
        return;
      }
    }
  } catch (err) {
    // Gracefully handle stdin closing (e.g., piped input)
    const e = err as Error & { code?: string };
    if (e.code === 'ERR_USE_AFTER_CLOSE') {
      return;
    }
    throw err;
  }
}

// ─── Game Loop ───────────────────────────────────────────────────────────────

async function runGameLoop(initialState: GameState): Promise<void> {
  let state = initialState;

  while (true) {
    clearScreen();
    process.stdout.write(render(state) + '\n');

    if (state.gamePhase === 'perkSelection' && state.perkChoices) {
      process.stdout.write(renderPerkSelection(state.perkChoices) + '\n');
    }

    const input = await prompt('◆ ');
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
        messageScrollOffset: 0,
      };
      continue;
    }

    // Handle help as an overlay without cluttering the log
    if (parsed.action === 'help') {
      clearScreen();
      process.stdout.write(render(state) + '\n\n');
      process.stdout.write(renderHelp() + '\n');
      await prompt('  Press Enter to continue...');
      continue;
    }

    const scrollCommand = parsed.action === 'scroll';
    const prevLogLength = state.messageLog.length;

    const repeatCount = parsed.count ?? 1;
    for (let i = 0; i < repeatCount; i++) {
      state = processCommand(state, parsed);
      if (state.gamePhase !== 'playing') break;
    }

    if (!scrollCommand && state.messageLog.length > prevLogLength) {
      state = { ...state, messageScrollOffset: 0 };
    }

    if (state.gamePhase === 'gameOver') {
      clearScreen();
      await sleep(600);
      process.stdout.write(renderGameOver(state.runStats, state.seed) + '\n');

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

async function main(): Promise<void> {
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

  await introCinematic();

  try {
    await showTitleScreen();
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
