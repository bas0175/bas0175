# Pilgrimage 2.5D test

A test of the great chamber from cycle 3 in 2.5D: the cave is 3D (Three.js), play is side-on as in v31.

## Rule
Gameplay stays 2D. `src/world.js` and `src/player.js` hold all geometry and movement in v31 coordinates (x right, y down, floor at 440); `src/scene.js` only draws that state. Depth is scenery, never gameplay, so the game can collapse back to 2D: press **C** to see the flat view.

## Files
- `src/world.js`: chamber layout, mushrooms (v31 seed 9091), bell, floors, chasm, respawn points.
- `src/player.js`: movement and animation frames, ported from v31 unchanged (run 237, jump 760, gravity 1800, coyote time, jump buffer, jump cut).
- `src/scene.js`: the 3D view: cave shell, rocks, light wells, mushrooms, fronds, spores, bell, Veyra as a lit sprite, bloom and grade.
- `src/audio.js`: sound events. Each plays a synthesized placeholder until a recording is loaded (Sounds panel, **B**). Recordings are remembered in the browser. A folder of files named after events (`grove.bell.wav`) loads in one go. Pitched events expect A3 (220 Hz).
- `assets/veyra-sheet.png|json`: her frames, extracted from v31.

## Build
```
npm install
npm run build      # writes dist/pilgrimage-25d-chamber.html, one self-contained file
```
`node shot.mjs <x> <name> [flat] [ringDelayMs]` takes a screenshot at a position; `node play.mjs` runs a scripted playthrough.

## The rigged Veyra (test)
`rig/build_veyra.py` builds a stand-in 3D Veyra in Blender (body, cloth-simulated poncho with the amber hem, bun), rigs and animates idle, run and jump at v31's timings, and renders each frame side-on twice: colour with soft occlusion and ink outlines, and camera-space normals so the game's lights shade her. `rig/pack.py` packs both into matching sheets (`assets/veyra-rig-*.png`, `veyra-rig.json`). In the game, **V** switches between the rig and the sprite sheet.
```
python3 -m venv bl && bl/bin/pip install bpy==5.2.2
bl/bin/python rig/build_veyra.py /tmp/veyra     # about 2 minutes on CPU
python3 rig/pack.py /tmp/veyra assets
```
A better model (for example one generated from the reference art) can replace the stand-in; the animation, render and packing steps stay the same.
