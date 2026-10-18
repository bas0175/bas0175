# VELTA model, working definitions

Decisions made in conversation, October 2026. Draft: everything here can still change.

## Purpose
- Encode any work (multimedia or intermedia, single or distributed authorship) as a multilayer network, using one protocol for every work.
- Hypothesis: intermedia is high coupling between layers, not a high number of layers. There may be a coupling level where a work becomes intermedia (after Higgins 1966).
- Fallback claim: even without a threshold, a continuum of coupling across works shows that reading works as networks is valuable.

## Definitions (draft)
- **Layers (L):** two aspects.
  - Medium, fixed in advance and the same for every work: sound, text/voice, image, movement/gesture, object, space.
  - Work, nested: the Survanic Assemblage contains the Obsidian Cycle, which contains its three pieces. A layer is a (work, medium) pair, such as (Pilgrimage, sound).
- **Vertices (V):** elements of the work. The same element can recur across pieces (Veyra, the Vorrakiel, the bells) and stays one vertex. An element is identifiable by a perceiver, persists or recurs, and belongs to a medium. One element may appear in several layers (a bell is an object and a sound).
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
- Cross-work sharing: the fraction of vertices present in more than one piece (transmedia coupling, as distinct from intermedia coupling within a piece).
- Severance: remove one layer and measure how much the rest fragments. Multimedia should survive; intermedia should fragment.
- Every score is compared against randomized networks of the same size and degree distribution.

## Validity guards
- Write the coding protocol before coding the corpus; pilot it on Children of the Moon.
- A second coder encodes a subset; report agreement.

## Corpus (rough)
- The Obsidian Cycle, analysed as three pieces (Children of the Moon, Relics of Shadow, Pilgrimage) and as a whole. Its network lives only in the work. The Cycle sits inside a larger collection, the Survanic Assemblage.
- The Rite of Spring (Stravinsky, Nijinsky, Roerich, 1913).
- A Wagner opera, undecided.
- A pansori performance.
- Journey (thatgamecompany, 2012).

## Open questions
- Which Wagner opera; which pansori madang, singer and recording; which Rite version.
- How to encode an interactive work (Journey): the designed graph, a canonical playthrough, or both.
- What else is in the Survanic Assemblage, and whether it is analysed or only the source of the world's vocabulary.
- Node granularity: recurrence rule and one-node-many-layers still to confirm.
