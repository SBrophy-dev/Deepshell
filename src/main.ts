import * as readline from 'node:readline';
import chalk from 'chalk';
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
  renderHighScores,
  checkTerminalSize,
} from './ui/renderer.js';
import { THEME, depthTheme } from './ui/colors.js';
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

const TITLE_PROMPT = THEME.screens.prompt('◆ ');
const CONTINUE_HINT = THEME.hud.dim('  ▸ press Enter to continue ');

function gamePrompt(state: GameState): string {
  return depthTheme(state.floorNumber).accent('◆ ');
}

// ─── Intro Cinematic ─────────────────────────────────────────────────────────

async function typeOut(text: string, colorFn: (s: string) => string, speed = 14): Promise<void> {
  for (const char of text) {
    process.stdout.write(colorFn(char));
    await sleep(speed);
  }
}

async function bootStep(label: string, padTo = 38): Promise<void> {
  process.stdout.write(THEME.hud.dim('  ▸ '));
  await typeOut(label, (s) => THEME.hud.value(s), 12);
  const dots = Math.max(2, padTo - label.length);
  for (let i = 0; i < dots; i++) {
    process.stdout.write(THEME.hud.dim('·'));
    await sleep(4);
  }
  process.stdout.write(' ' + chalk.hex('#2ed573')('[ok]') + '\n');
  await sleep(90);
}

async function introCinematic(): Promise<void> {
  clearScreen();
  process.stdout.write('\n');
  await bootStep('establishing neural link');
  await bootStep('mapping subterranean lattice');
  await bootStep('synchronizing with the DeepShell');
  process.stdout.write('\n  ');
  await typeOut('▼ commencing descent', (s) => THEME.screens.title(s), 28);
  process.stdout.write('\n');
  await sleep(450);
}

// ─── Title Screen ────────────────────────────────────────────────────────────

async function showTitleScreen(): Promise<void> {
  try {
    while (true) {
      clearScreen();
      process.stdout.write(renderTitleScreen() + '\n');

      const input = (await prompt(TITLE_PROMPT)).trim().toLowerCase();

      if (input === '1' || input === 'new') {
        await runGameLoop(initNewGame());
      } else if (input === '2' || input === 'seed') {
        const seed = (await prompt(THEME.hud.label('  seed ◆ '))).trim();
        if (seed.length > 0) {
          await runGameLoop(initNewGame(seed));
        } else {
          await runGameLoop(initNewGame());
        }
      } else if (input === '3' || input === 'scores') {
        clearScreen();
        process.stdout.write('\n' + renderHighScores(getHighScores(10)) + '\n\n');
        await prompt(CONTINUE_HINT);
      } else if (input === '4' || input === 'tutorial') {
        clearScreen();
        process.stdout.write(renderTutorial() + '\n');
        await prompt(CONTINUE_HINT);
      } else if (input === '5' || input === 'quit') {
        console.log('\n' + THEME.screens.prompt('◆ ') + THEME.hud.dim('Resurfacing. The DeepShell will be waiting.'));
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

    const input = await prompt(gamePrompt(state));
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
      await prompt(CONTINUE_HINT);
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
      process.stdout.write('\n' + renderGameOver(state.runStats, state.seed) + '\n\n');

      const record: RunRecord = {
        date: new Date().toISOString(),
        floorsCleared: state.runStats.floorsCleared,
        enemiesDefeated: state.runStats.enemiesDefeated,
        bossesDefeated: state.runStats.bossesDefeated,
        highestSkillLevels: { ...state.runStats.highestSkillLevels },
        seed: state.seed,
      };
      saveRunRecord(record);

      await prompt(CONTINUE_HINT);
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
    console.log('\n' + THEME.screens.prompt('◆ ') + THEME.hud.dim('Resurfacing. The DeepShell will be waiting.'));
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
