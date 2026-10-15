// Builds one self-contained HTML file: the game (pilgrimage.html, v31 plus 3D hooks) with the 3D view inlined.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const out = await build({ entryPoints: ['src/index.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none', loader: { '.png': 'dataurl' } });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('pilgrimage.html', 'utf8');
if (!html.includes('<!--WORLD3D-->')) throw new Error('marker <!--WORLD3D--> missing in pilgrimage.html');
// recorded sounds, built in as data URLs (sounds/game/<event>-<n>.mp3)
import { readdirSync } from 'node:fs';
const snd = {}; for (const f of readdirSync('sounds/game').sort()) { const m = /^([a-z.]+)-\d+\.mp3$/.exec(f); if (m) (snd[m[1]] ||= []).push('data:audio/mpeg;base64,' + readFileSync('sounds/game/' + f).toString('base64')); }
const res = html.replace('<!--WORLD3D-->', () => `<script>window.EMBEDDED_SOUNDS=${JSON.stringify(snd)};</script>\n<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
const name = 'dist/obsidian-cycle-iii-pilgrimage-3d.html'; writeFileSync(name, res);
console.log(`${name}  ${(res.length / 1024 / 1024).toFixed(2)} MB`);
