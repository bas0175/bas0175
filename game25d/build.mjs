// Bundles the game into one self-contained HTML file (code, three.js and the sprite sheet inlined),
// so it opens from disk with no server and no network.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const out = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020',
  loader: { '.png': 'dataurl', '.json': 'json' }, legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('index.html', 'utf8').replace('<script>/*__BUNDLE__*/</script>', () => `<script>${js}</script>`);
mkdirSync('dist', { recursive: true });
const name = 'dist/pilgrimage-25d-chamber.html';
writeFileSync(name, html);
console.log(`${name}  ${(html.length / 1024 / 1024).toFixed(2)} MB`);
