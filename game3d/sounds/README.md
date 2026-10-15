# Sounds

- `src/`: original recordings as supplied. Cave drips: freesound.org pack 177958 by sclolex, "water dripping in cave" 01, 02, 03, 04, 06. Check the licence on freesound.org and credit as it requires.
- `game/`: what the build uses, made from `src/`: trimmed to 5 s with a 1.5 s fade, matched to -6 dB peak, MP3 160 kbps. Named `<event>-<n>.mp3`; the build embeds every file it finds there, grouped by event.

The recordings carry their own cave tail, so the game sends drips only lightly to its reverb. A random drip plays each time (never the same one twice running), with slight pitch and level variation, panned to where it falls. A file loaded for "drip" in the Sounds panel replaces all five.
