# VELTA model, working definitions

Decisions made in conversation, October 2026. Draft: everything here can still change.

## Purpose
- Encode any work (multimedia or intermedia, single or distributed authorship) as a multilayer network, using one protocol for every work.
- Hypothesis: intermedia is high coupling between layers, not a high number of layers. There may be a coupling level where a work becomes intermedia (after Higgins 1966).
- Fallback claim: even without a threshold, a continuum of coupling across works shows that reading works as networks is valuable.

## Definitions (draft)
- **Layers (L):** media, fixed in advance and the same for every work: sound, text/voice, image, movement/gesture, object, space.
- **Vertices (V):** elements of the work. An element is identifiable by a perceiver, persists or recurs, and belongs to a medium. One element may appear in several layers (a bell is an object and a sound).
- **Edges (E):** a small fixed set of types:
  - temporal: precedes, co-occurs
  - derivational: varies, quotes
  - functional: triggers, controls
  - referential: represents
- **Temporal dynamics (T):** sections within a work; repeated performances where they exist (Children of the Moon is performed 2 to 3 times in succession). Occurrences of an element are events in time, not new vertices.
- **Attributes (A):** on vertices and edges: open or fixed (improvised or scored), maker (who authored it, where known), weight, plus medium-specific values (pitch, interval ratio, duration).

## Measures
- Inter-layer edge share: the fraction of all edges that cross from one layer to another.
- Node multiplexity: the fraction of vertices present in more than one layer.
- Severance: remove one layer and measure how much the rest fragments. Multimedia should survive; intermedia should fragment.
- Every score is compared against randomized networks of the same size and degree distribution.

## Validity guards
- Write the coding protocol before coding the corpus; pilot it on Children of the Moon.
- A second coder encodes a subset; report agreement.

## Corpus (rough)
- The Obsidian Cycle (Children of the Moon, Relics of Shadow, Pilgrimage). Its network lives only in the work.
- The Rite of Spring (Stravinsky, Nijinsky, Roerich, 1913).
- A Wagner opera, undecided.
- A pansori performance.
- Journey (thatgamecompany, 2012).

## Open questions
- Node granularity (the next decision).
- Which Wagner opera; which pansori madang, singer and recording; which Rite version.
- How to encode an interactive work (Journey): the designed graph, a canonical playthrough, or both.
- Whether the Obsidian Cycle is analysed as one work or as three pieces.
