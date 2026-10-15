#!/usr/bin/env node
// Standalone terminal study. Does not install or change the focused-spec CLI.
import { setTimeout as sleep } from 'node:timers/promises';

const WIDTH = 19;
const HEIGHT = 18;
const STEM_LEFT = 8;
const STEM_RIGHT = 8;
const BAR_LEFT = 7;
const BAR_RIGHT = 9;
const cells = Array.from({ length: HEIGHT }, (_, y) =>
  Array.from({ length: WIDTH }, (_, x) => Number(
    (y === 5 && x >= STEM_LEFT && x <= 10) ||
    (y >= 6 && y <= 12 && x === STEM_LEFT) ||
    (y === 8 && x >= BAR_LEFT && x <= BAR_RIGHT),
  )),
);

// Fixed geometry: the horizontal bar must project past BOTH sides of the stem.
if (!(BAR_LEFT < STEM_LEFT && BAR_RIGHT > STEM_RIGHT)) throw new Error('Invalid f crossbar');

const args = process.argv.slice(2);
let duration = 2200;
let still = false;
let frames = false;
let noColor = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--duration' && /^\d+$/.test(args[i + 1] ?? '')) {
    duration = Number(args[++i]);
    if (!Number.isSafeInteger(duration) || duration < 100 || duration > 30000) {
      console.error('--duration must be between 100 and 30000 milliseconds');
      process.exit(2);
    }
  } else if (args[i] === '--still') still = true;
  else if (args[i] === '--frames') frames = true;
  else if (args[i] === '--no-color') noColor = true;
  else if (args[i] === '--help') {
    console.log('Usage: node scripts/preview-focus.mjs [--duration 2200] [--still | --frames] [--no-color]');
    process.exit(0);
  } else {
    console.error(`Unknown or incomplete option: ${args[i]}`);
    process.exit(2);
  }
}
if (still && frames) {
  console.error('Choose either --still or --frames');
  process.exit(2);
}

function blur(sigma) {
  if (sigma === 0) return cells.flat();
  const radius = Math.ceil(sigma * 3);
  const result = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let sum = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= HEIGHT) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= WIDTH || !cells[yy][xx]) continue;
          sum += Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        }
      }
      result.push(Math.min(1, sum / (2 * Math.PI * sigma * sigma)));
    }
  }
  return result;
}

const stages = [blur(3.2), blur(2.1), blur(1.15), blur(0.55), blur(0)];
const BG = [13, 15, 20];
const GOLD = [249, 197, 108];
const symbols = ['  ', '░░', '▒▒', '▓▓', '██'];

function render(progress, color) {
  const pos = Math.min(3.999999, Math.max(0, progress) * 4);
  const stage = Math.floor(pos);
  const fraction = pos - stage;
  let output = '';
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const index = y * WIDTH + x;
      const intensity = progress >= 1 ? stages[4][index] :
        (stages[stage][index] * (1 - fraction) + stages[stage + 1][index] * fraction);
      const bright = Math.min(1, intensity * 1.55);
      if (bright < 0.065) {
        output += '  ';
        continue;
      }
      const symbol = symbols[Math.min(4, Math.max(1, Math.ceil(bright * 4)))];
      if (color) {
        const wave = progress < 1 ? Math.max(0, 1 - Math.abs(x / WIDTH - progress) * 4) * 23 : 0;
        const rgb = BG.map((background, channel) => Math.round(
          background + (Math.min(255, GOLD[channel] + wave) - background) * bright,
        ));
        output += `\x1b[38;2;${rgb.join(';')}m${symbol}`;
      } else {
        output += symbol;
      }
    }
    output += color ? '\x1b[0m\n' : '\n';
  }
  return output;
}

if (frames) {
  for (const [label, progress] of [['blurred', 0], ['focusing', 0.5], ['sharp', 1]]) {
    process.stdout.write(`${label}:\n${render(progress, false)}\n`);
  }
} else if (still || !process.stdout.isTTY) {
  process.stdout.write(render(1, false));
} else {
  const color = !noColor && !process.env.NO_COLOR && process.env.TERM !== 'dumb';
  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    process.stdout.write('\x1b[0m\x1b[?25h\x1b[?1049l');
  };
  process.once('SIGINT', () => { cleanup(); process.exit(130); });
  process.once('SIGTERM', () => { cleanup(); process.exit(143); });
  process.stdout.write('\x1b[?1049h\x1b[?25l');
  const start = performance.now();
  try {
    while (active) {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / duration);
      const focus = 1 - (1 - progress) ** 3;
      const frame = render(focus, color).trimEnd();
      const lines = frame.split('\n');
      const left = ' '.repeat(Math.max(0, Math.floor(((process.stdout.columns || 80) - WIDTH * 2) / 2)));
      const top = '\n'.repeat(Math.max(0, Math.floor(((process.stdout.rows || 24) - HEIGHT) / 2)));
      process.stdout.write(`\x1b[H\x1b[2J${top}${lines.map((line) => left + line).join('\n')}\x1b[0m`);
      if (progress === 1) break;
      await sleep(Math.max(0, start + Math.ceil(elapsed / 33 + 1) * 33 - performance.now()));
    }
    await sleep(750);
  } finally {
    cleanup();
  }
}
