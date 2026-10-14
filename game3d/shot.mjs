// Screenshots of scenes through v31's own scene jumper: node shot.mjs <sceneIndex[,sceneIndex...]> [prefix] [extra js]
import { chromium } from 'playwright-core';
const [,, list = '0', prefix = 's', extra = ''] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto('file://' + process.cwd() + '/dist/obsidian-cycle-iii-pilgrimage-3d.html');
await p.waitForTimeout(1000);
await p.click('#startBtn'); await p.waitForTimeout(500);
for (const i of list.split(',').map(Number)) {
  await p.evaluate(i => { jumpTo(i); }, i);
  await p.waitForTimeout(800);
  await p.evaluate(() => { for (let k = 0; k < 12 && !document.getElementById('dialog').hidden; k++) advanceDialog(); });
  if (extra) await p.evaluate(extra);
  await p.waitForTimeout(3500);
  await p.locator('.stage').screenshot({ path: `shots/${prefix}${i}.png` });
}
const box = await p.evaluate(() => document.getElementById('errBox').textContent);
console.log(errs.slice(0, 6).join('\n') || 'no console errors', box ? '\nerrBox: ' + box.slice(0, 600) : '');
await b.close();
