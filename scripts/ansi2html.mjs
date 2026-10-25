// Temporary: converts captured ANSI frames to HTML for visual review.
import { readFileSync, writeFileSync } from 'node:fs';

const input = readFileSync(process.argv[2], 'utf8');
const wanted = ['TITLE', 'FLOOR 1 — The Shallows', 'GAME OVER', 'PERKS'];

const sections = {};
let current = null;
for (const line of input.split(/\r?\n/)) {
  const m = line.match(/^=+ (.+?) =+$/);
  if (m) {
    current = m[1];
    sections[current] = [];
    continue;
  }
  if (current) sections[current].push(line);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const classMap = new Map(); // style string -> class name
function classFor(style) {
  if (!classMap.has(style)) {
    classMap.set(style, 'c' + classMap.size.toString(36));
  }
  return classMap.get(style);
}

function ansiToHtml(text) {
  let fg = null;
  let bg = null;
  let bold = false;
  let dim = false;
  let html = '';
  let buf = '';
  let runStyle = '';

  const styleOf = () => {
    let s = '';
    if (fg) s += `color:rgb(${fg});`;
    if (bg) s += `background:rgb(${bg});`;
    if (bold) s += 'font-weight:700;';
    if (dim) s += 'opacity:.55;';
    return s;
  };

  const flush = () => {
    if (!buf) return;
    if (runStyle) html += `<span class="${classFor(runStyle)}">${escapeHtml(buf)}</span>`;
    else html += escapeHtml(buf);
    buf = '';
  };

  // Only consider a style change when there is visible text to emit, so
  // color resets between identical runs don't split spans.
  const append = (chunk) => {
    if (!chunk) return;
    const s = styleOf();
    if (s !== runStyle) {
      flush();
      runStyle = s;
    }
    buf += chunk;
  };

  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    append(text.slice(last, m.index));
    last = re.lastIndex;

    const codes = m[1].split(';').map(Number);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) { fg = bg = null; bold = dim = false; }
      else if (c === 1) bold = true;
      else if (c === 2) dim = true;
      else if (c === 22) { bold = false; dim = false; }
      else if (c === 39) fg = null;
      else if (c === 49) bg = null;
      else if (c === 38 && codes[i + 1] === 2) { fg = `${codes[i + 2]},${codes[i + 3]},${codes[i + 4]}`; i += 4; }
      else if (c === 48 && codes[i + 1] === 2) { bg = `${codes[i + 2]},${codes[i + 3]},${codes[i + 4]}`; i += 4; }
    }
  }
  append(text.slice(last));
  flush();
  return html;
}

let frames = '';
for (const name of wanted) {
  const lines = sections[name] ?? [];
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  frames += `<!-- ${name} -->\n<pre class="frame">` + lines.map(ansiToHtml).join('\n') + '</pre>\n';
}

let css = '';
for (const [style, cls] of classMap) {
  css += `.${cls}{${style}}`;
}
const out = `<style>${css}</style>\n${frames}`;

writeFileSync(process.argv[3], out, 'utf8');
console.log('wrote', out.length, 'chars,', classMap.size, 'styles');
