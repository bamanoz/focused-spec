#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Reuse the original final frame instead of redrawing its f.
const original = execFileSync(process.execPath, [
  fileURLToPath(new URL('./preview-focus.mjs', import.meta.url)),
  '--still', '--no-color',
], { encoding: 'utf8' }).split('\n').filter(line => line.trim());
const margin = Math.min(...original.map(line => line.search(/\S/)));
const initial = original.map(line => line.slice(margin).trimEnd());
const suffixLeft = Math.max(...initial.slice(3).map(line => line.length)) + 1;

const letters = {
  o: ['███', '█ █', '█ █', '█ █', '███'],
  c: ['███', '█  ', '█  ', '█  ', '███'],
  u: ['█ █', '█ █', '█ █', '█ █', '███'],
  s: ['███', '█  ', '███', '  █', '███'],
  e: ['███', '█ █', '███', '█  ', '███'],
  d: ['  █', '  █', '███', '█ █', '███'],
  '-': ['   ', '   ', '███', '   ', '   '],
  p: ['███', '█ █', '███', '█  ', '█  '],
};
const color = process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb';
const lines = initial.map((line, row) => {
  const suffix = row < 3 ? '' : [...'ocused-spec']
    .map(letter => letters[letter][row - 3].replace(/./g, '$&$&'))
    .join(' ');
  return (line.padEnd(suffixLeft) + suffix).trimEnd();
});
const text = lines.join('\n');
process.stdout.write(color ? `\x1b[38;2;249;197;108m${text}\x1b[0m\n` : `${text}\n`);
