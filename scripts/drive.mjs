// Temporary E2E driver: spawns the game and types commands with delays.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const child = spawn('node', ['dist/main.js'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, FORCE_COLOR: '3' },
});

let out = '';
child.stdout.on('data', (d) => { out += d.toString(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await sleep(4000); // let the boot cinematic finish
for (const line of ['1', 'n', 'e', 'attack', 'look', 'help', '', 'quit', '5']) {
  child.stdin.write(line + '\n');
  await sleep(350);
}
child.stdin.end();
await new Promise((r) => child.on('exit', r));

writeFileSync(process.argv[2] ?? 'drive-output.txt', out, 'utf8');
console.log('captured', out.length, 'chars');
