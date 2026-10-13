// Screenshot helper: node shot.mjs <x> <name> [flat] [ring]
import { chromium } from 'playwright-core';
const [,, xs='3420', name='shot', flat='', ring=''] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await p.goto('file://' + process.cwd() + '/dist/pilgrimage-25d-chamber.html');
await p.waitForTimeout(800);
await p.click('#go');
await p.evaluate(([x, flat]) => { const g = window.__game; g.placeAt(+x, -1); if (window.__capY) {} g.state.story.groveFound = 1; g.state.flat = !!flat; }, [xs, flat]);
await p.waitForTimeout(3500);
if (ring) { await p.evaluate(() => window.__game.ringBell('test')); await p.waitForTimeout(+ring); }
await p.screenshot({ path: `shots/${name}.png` });
console.log(errs.slice(0, 8).join('\n') || 'no errors');
await b.close();
