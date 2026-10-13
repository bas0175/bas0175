import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs=[]; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/pilgrimage-25d-chamber.html');
await p.waitForTimeout(500); await p.keyboard.press('Enter');
const st = () => p.evaluate(() => { const g = window.__game; return { x: Math.round(g.player.x), y: Math.round(g.player.y), mode: g.state.mode, lives: g.state.lives, grove: !!g.state.story.groveFound, near: !!g.state.nearBell }; });
const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
console.log('fps', fps);
await p.keyboard.down('ArrowLeft'); let jumped = false, t0 = Date.now(), s;
while (Date.now() - t0 < 90000) {
  s = await st();
  if (s.mode === 'dialog') { await p.keyboard.up('ArrowLeft'); console.log('dialog at', s.x); await p.keyboard.press('KeyE'); await p.waitForTimeout(150); await p.keyboard.press('KeyE'); await p.waitForTimeout(150); console.log('after dialog', JSON.stringify(await st())); break; }
  if (!jumped && s.x < 2640 && s.x > 2560) { await p.keyboard.down('Space'); await p.waitForTimeout(400); await p.keyboard.up('Space'); jumped = true; console.log('jumped at', s.x); }
  await p.waitForTimeout(30);
}
console.log('state', JSON.stringify(await st()));
// walk to the bell, ring it
const bx = await p.evaluate(() => window.__game.BELL.x);
await p.keyboard.down('ArrowLeft'); t0 = Date.now();
while (Date.now() - t0 < 30000) { s = await st(); if (s.near) break; await p.waitForTimeout(20); }
await p.keyboard.up('ArrowLeft'); await p.waitForTimeout(300); s = await st(); console.log('at bell', JSON.stringify(s), 'bell x', Math.round(bx));
await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
console.log('bell rung', await p.evaluate(() => window.__game.log.filter(e => e.event === 'grove.bell').length));
// climb a mushroom: jump while running left from the bell
await p.keyboard.down('ArrowLeft'); await p.keyboard.down('Space'); await p.waitForTimeout(700); await p.keyboard.up('Space'); await p.waitForTimeout(500); await p.keyboard.up('ArrowLeft'); await p.waitForTimeout(800);
console.log('after jump', JSON.stringify(await st()));
await p.screenshot({ path: 'shots/play.png' });
console.log(errs.join('\n') || 'no page errors');
console.log(JSON.stringify((await p.evaluate(() => window.__game.log.map(e => e.event))).filter(e => e !== 'step').slice(0, 30)));
await b.close();
