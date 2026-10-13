// Plays the chamber test at 60 fps with no rendering: run west, jump obstacles, reach the chamber, climb the tallest mushroom.
import { player, keys, input, movePlayer, placeAt } from '../src/player.js';
import { START_X, ROCKS, CHASM, GROVE, FRONT, PLATS, GROUND, BELL } from '../src/world.js';
const events = []; const fire = n => events.push(n); let t = 0; const dt = 1 / 60;
const step = (n = 1) => { for (let i = 0; i < n; i++) { t += dt; movePlayer(dt, t, fire, false); } };
const jump = () => { input.jumpQueued = true; keys.jump = true; };
placeAt(START_X, -1); keys.left = true; let fell = false;
while (player.x > GROVE.b - 100 && t < 60) {
  const ahead = player.x - 60;
  const obstacle = ROCKS.some(r => ahead < r.x + r.w && ahead > r.x - 10) || (ahead < CHASM.b + 10 && ahead > CHASM.a);
  if (obstacle && player.onGround) jump();
  if (!player.onGround && player.vy > 0) keys.jump = false;
  step(); if (player.y > GROUND + 300) { fell = true; break; }
}
console.log('reached chamber:', !fell && player.x <= GROVE.b - 100, 'x', player.x.toFixed(0), 't', t.toFixed(1), 's', 'jumps', events.filter(e => e === 'jump').length, 'steps', events.filter(e => e === 'step').length);
// climb: the front caps step up east to west (FH 100,150,200,...); hop onto each in turn
keys.left = false; step(30);
let onCaps = [];
{ const c = FRONT[0].plat; for (let k = 0; k < 600 && player.x + player.w / 2 > c.x + c.w / 2 + 70; k++) { keys.left = true; step(); } }
for (let i = 0; i < 3; i++) {
  const c = FRONT[i].plat;
  // from where she stands, run west and jump near the edge she is on (the ground or the previous cap)
  keys.left = true; const from = i ? FRONT[i - 1].plat : null;
  for (let k = 0; k < 300; k++) { step(); if (!from ? player.x + player.w / 2 < c.x + c.w + 40 : player.x < from.x + 14) break; }
  jump(); for (let k = 0; k < 90; k++) { step(); if (player.onGround && k > 5) break; if (player.x + player.w / 2 < c.x + c.w / 2) keys.left = false; } keys.left = false; keys.jump = false; step(20);
  onCaps.push(Math.abs(player.y + player.h - c.y) < 1);
}
console.log('landed on caps 1-3:', onCaps.join(','), 'cap heights', FRONT.slice(0, 3).map(c => c.h).join(','));
console.log('bell x', BELL.x.toFixed(0));
