import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

const required = ['calculateLoss', 'generateShareCard', 'submitCalculation', 'downloadEvidencePack'];
for (const symbol of required) {
  if (!main.includes(symbol)) throw new Error(`Missing required feature: ${symbol}`);
}
if (!css.includes('@media')) throw new Error('Responsive styles are missing');
console.log('WageLeak static checks passed.');
