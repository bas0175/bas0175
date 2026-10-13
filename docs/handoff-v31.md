# Obsidian Cycle III: Pilgrimage, handoff

Attach `obsidian-cycle-iii-pilgrimage-v31.html` with this note. It is the whole game in one file: code, sounds and sprites.

## What it is
The third work of my dissertation *The Obsidian Cycle*, set in the Survanic world. Everything takes place underground. It is a single-file HTML5 canvas platform game (960×540, Web Audio, no libraries).

The daughter of an outpost keeper makes a pilgrimage each cycle: she leaves, travels, checks in at the gate, takes part in the rite, gathers the light and journeys back. The sound puzzles are driven by a VELTA graph (a stand-in for now), and the game logs play for analysis.

## Structure
- **Cycles 1 to 3:**
  - Cycle 1: the water is fine and the stores are thinning. Torven promises what stores they can spare, but admits the Assembly's own stores are beginning to run low.
  - Cycle 2: her father has her hand-deliver a message to Torven. Torven will help but asks for her father's counsel: the whole community is struggling for food. She carries that home; her father: "Then it is not only us."
  - Cycle 3: as she enters the cave, a long rumble and falling stone are heard ahead (with a slight screen shake) before the rubble comes into view. The cave has collapsed. Her father gives her a map ("Then there is only the old road, west, through the deep ways. It is long, treacherous, and no one from here has walked it in years."), and she takes a long west route through the deep ways. Just before the shaft she crosses a great chamber full of living light (glowing mushrooms, hanging fronds, drifting spores) and says it might save the community. She arrives at the Assembly from the other side and tells Torven; he answers that she has saved them all, and that everyone will know her name. A party clears the cave, another goes to the chamber, and she returns home with stores.
- **Puzzles:**
  - Bells: the relations between bells come from the graph's edges. Bells not in this cycle's edges are dormant. On the way back the bells are reversed.
  - Gate check-in: call and response on keys 1 to 7, A minor pentatonic over an A drone.
  - Rite: hold E with the breath of the light well.
- **Setbacks:** falling or touching a creature costs a life (a creature's touch first plays her hit/reaction frames and a fade into motes) and sends her to the start of the current section. Losing all three lives sends her back to the most recent extremity: the start when going out, the altar when coming back. In the deep ways past the descent, that is the foot of the descent.
- **Movement:** physics matched to Rootless (run 237, jump 760, gravity 1800), with coyote time, a jump buffer and jump cut. She always runs; there is no walk for now. A full jump rises about 160 px and carries about 200 px.
- **Worlds:** `loadWorld('east'|'west')`. The west route is generated from seed 4242.
- **The descent:** the deep ways now begin by going down. Leaving the outpost west in cycle 3 enters a separate vertical scene (`DESCENT`, seed 7373): a switchback chasm about 3,800 px tall, 17 levels of ledges hanging alternately from each wall, each step down about 190 to 225 px (292 px onto a split ledge, so a full jump there clears the ledge overhead). She walks to the open end of each ledge and steps down. Entry is a lit arch with a lamp at the top right (walking back out returns to the outpost); light thins and the stone darkens with depth; water drips from ledge undersides. The way out is at the bottom left, onto the start of the deep ways (logged `descent.exit`, `descent.ledge`, `descent.fall`). About 50 s at a run.
  - **Split ledges (levels 2, 6, 10, 14):** a near ledge (195 px, where she lands from above) and a far ledge (95 px) with a 230 px gap (`DESCENT_GAP`). The gap is too wide to land across: a jump from the last 40 px or so of the near ledge always catches the far lip, and she pulls herself up with the climb mantle. Jumping earlier, a short hop, or walking off drops her through the gap, which always costs a life (the level below is cut short so the fall reads as two levels). In the descent she can only catch the far side of a gap on the level she just left; she cannot catch lips above or below, so it stays one way. Any other drop over 350 px also costs a life.
  - **Lizard:** a glowing orange lizard paces level 8, halfway down, same as the shaft's. Its touch costs a life.
  - **Setbacks:** a life lost respawns her at the start of the current half (top of the descent, or level 7). Losing all three restarts the descent from the outpost door with full lives.
  - The father's map shows it as a zigzag at the outpost door ("First, a long way down.", `MAP_NOTES.descent`). The shaft and the descent share movement, grab, lizard and camera code through `VS` (the vertical scene in play).
- **Mushrooms and the bell:** the seven brighter front mushrooms in the chamber are one-way platforms (land on them from above; `mush:true` in PLATS, not drawn as stone). East to west they step up to the third and tallest, then down again (heights in `FH`). The eight dimmer back mushrooms are scenery. The great bell stands on the chamber floor between the fourth and fifth front mushrooms: the same standing bell-stone as the bells on the road, in the same slate colouring with white pitch marks, about 2.6 times larger and aged: mottled weathering, lichen near the top and base, a chipped corner, worn marks (the middle one broken, the lowest faded) and a branching crack. Strike it with E when beside it. It warms to amber with expanding amber rings and light leaks through its cracks; its voice is a long low bell on A with close partials beating against each other and a short rattle (`grove.bell`). A wave of light spreads outward from it at about 520 px/s: each mushroom, frond and spore brightens and stirs as the wave reaches it, then fades over a few seconds, and each front mushroom chimes as it is reached. Logged `grove.bell` with how it was rung.
- **The chamber restores lives:** entering the glowing chamber with fewer than three lives sets them back to three, with a soft chime (logged `lives.restore`). After the first visit it also captions "The living light restores you."
- **The shaft:** about halfway along the deep ways (x about 14460) a wall closes the route. Walking into its east face enters a separate vertical scene: a shaft about 2,800 px tall with 14 alternating ledges, each just out of jump reach. Jumping toward a ledge's lip grabs it and plays the 9-frame mantle from sheet 3. Missing drops her to a lower ledge. Ledges are rugged, hung with fern fronds and leafy drapes after the Cerebrus Fern in Rootless; about half the fronds glow, and a signal of light runs down them the moment she grabs their ledge (and now and then on their own). One ledge has a glowing orange lizard pacing it; its touch is the only way to lose a life in the shaft and sends her to the bottom. The way out at the top is a lit stone arch with a lamp. Walking out at the top left returns her west of the wall. The wall reads as solid from both sides: nothing beyond it is drawn (`drawWallMass`), so the chamber can't be seen from the west and the road beyond can't be seen from the chamber. Setbacks west of the wall respawn her west of it.

- **The father's map (M):** available in cycle 3 once he gives it, until she reaches the Assembly. A parchment sketch of the deep ways, outpost door on the right, Assembly on the left: his dotted route, both forks, hatched dark reaches, falling water, the wall and shaft, and his notes (editable in MAP_NOTES). West of the wall the whole route is drawn about 80 px higher, at the top of the shaft, with the shaft's note to the right of the wall. His note at the second fork ("keep high") is out of date: the high way has closed. The road she has walked fills in in darker ink. Opening it pauses play and is logged (map.open with position, map.close with seconds). Mute moved to N.
- **Life spilling from the chamber:** on the road just east of the chamber (about 1,900 px, met before it when walking west) there are tiny glowing mushroom tufts, short glowing fronds from the roof and a few spores, sparse at first and thickening toward the chamber (`G.hint` in placeGrove). In the shaft the growth pours up from the bottom: a bed of glowing mushrooms and a teal wash on the floor, spores rising and fading, ledges lush near the bottom (more fronds, drapes, mushroom caps) and thinning to bare stone by about ledge 11 of 14 (`life` per ledge).
- **Waterfalls:** two on the normal road and five in the deep ways, each falling into a chasm.
- **The glowing chamber:** a 1,400 px stretch just east of the wall, with solid floor, 15 large glowing mushrooms (7 climbable in front, 8 behind), small ones along the floor, fronds hanging from the roof and drifting spores, in teal and violet. A soft chord plays when she first speaks there, and faint chimes sound while she is inside.
- **Testing:** press J (or use the button on the title or pause screen) to jump straight to any of 27 scenes across the three cycles, the deep ways and the shaft. The game sets up the story state for each one.

## Character art (current state)
- The daughter now uses frames cut from my AI model sheets:
  - Standing still and walking come from sheet 2, recoloured to match sheet 3.
  - The older 8-frame run (8 HD singles; frames 1 to 4 one step, 5 to 8 the next, footsteps on frames 1 and 5) is still in the file; F switches to it.
  - Running now defaults to a 4-frame cycle from four new HD singles (played as recoil, knee drive, stride, stride, i.e. the sent order rotated by one so footsteps land on the recoil (frame 1) and the first stride (frame 3); packed into the sheet as `SHEET_META.run4`, scaled to match the 8-frame set). Two frames per footstep, footsteps on frames 1 and 3. `STEP_T` (time per footstep) is 0.18 s, so each frame shows for 0.09 s and she takes about 5.5 steps a second; the footstep sound has no timer of its own and stays locked to the frames. F toggles to the 8-frame run (`RUN4`).
  - Jumping (12 frames) comes from sheet 3.
  - Climbing uses frames 3 to 11 of sheet 3's climb/vault row, with the stone blocks removed and each frame anchored to the ledge top.
- Torven uses his own sheet (idle 8, walk 8), re-cut from the updated transparent-background version with soft ground shadows. When the gate is open and Veyra comes within about 320 px, he walks up to 130 px toward her, then holds an idle pose facing her.
- Kreven, who leads the rite for now (before Veyra's assertion), stands just right of the circle. At rest he shifts among poses 01, 02, 03, 09 and 10 every 3 to 4 s; during the rite only, he lifts the staff (06 before it begins, 07 on each inhale) and reaches toward the circle (08 on each exhale).
- Her father is the elder man (13) from the background sheet. The other extras (outpost folk, the two gatekeepers as guard 04 and herald 10, the Assembly around the circle) are single static frames from that sheet, cut from the transparent-background version so edges and soft ground shadows are kept.
- She always runs (no walk for now; the walk frames are unused while moving). The T figure swap has been removed; the old painted cutout is only a fallback if the sheet image fails to load.
- The palette is blue slate with cold cyan light wells. Amber appears only on lamps, struck stones and the light.

## Open items
- The sheet 2 frames are soft because the source is small (about 115 px). A higher-resolution sheet would help.
- Idle holds one random pose and eases to a neighbouring one about every 5 seconds (Kreven every 3 to 4).
- Jump: the first half follows the rise and holds the peak frame while the jump key is held; the second half starts on release, or just before landing.
- Dialogue boxes sit at the top of the stage; a jump in progress finishes while a dialogue is open. Speaker label is "Father".
- Next HD singles: standing and walking first (they are the softest), then hit/death; jump and climb can wait.
- I now have video of her running. Frames for a new run cycle can be pulled from it with ffmpeg (a side view, steady camera and plain or green background make the cut-out clean).
- Not yet used: cast (possibly for the rite), hit, and the pixel-pack recolour.
- A "Script error." was reported once in my browser and never reproduced. The on-page error box will show details if it recurs.
- Dialogue is placeholder text for me to edit.

## Working preferences
- Deliver files as downloads, because artifacts don't open in my browser.
- Minimal preamble.
- No em dashes.
