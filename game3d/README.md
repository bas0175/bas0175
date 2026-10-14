# Pilgrimage in 3D space

The full game (v31) with its world drawn in 3D behind the 2D characters.

## How it works
- `pilgrimage.html` is v31 with a few hooks. All of the game stays there: story, puzzles, dialogue, logging, sound, the map and the scene jumper.
- `src/` is the 3D view (`window.World3D`). v31 hands it its own level data when a world loads, and calls it every frame with its camera. The camera is placed so the plane z = 0 lines up pixel for pixel with v31's screen, so the 2D characters stand on 3D ground.
- When 3D is on, v31 skips drawing its scenery (background, rock, columns, shelves, lamps, light wells, waterfalls, crystals, the chamber, the painted rock of the descent and the shaft) and keeps everything else: characters, bells, doors, panels, the circle, creatures, the lizard, flora in the shaft, drips, cave darkness, captions and the interface.
- **G** switches to v31's own 2D drawing at any time. If WebGL is unavailable, the game runs in 2D.

## Files
- `src/core.js`: renderer, the matched camera, a pool of lights given each frame to the nearest lamps, light wells and glows, bloom.
- `src/horizontal.js`: the east road and the deep ways from v31's data: cave shell with chasms between floors, masonry back walls outside the caves, ledges, columns, shelves, rocks, stalagmites, low roofs, waystones, lamps, light wells (their brightness follows v31's `shaftI`), waterfalls, crystals, mist, and the outpost, gates, lintels and altar.
- `src/grove.js`: the chamber of living light, from v31's grove data; the bell's wave follows v31's `bell.t0`.
- `src/vertical.js`: the descent and the shaft.
- `src/materials.js`: procedural textures and shared materials.

## Build
```
npm install
npm run build        # dist/obsidian-cycle-iii-pilgrimage-3d.html, one self-contained file
node shot.mjs 0,4,19 s          # screenshots through v31's scene jumper (indices as in the J menu)
```
