# VELTA model, working definitions

Decisions made in conversation, October 2026. Draft: everything here can still change.

## Purpose
- Encode any work (multimedia or intermedia, single or distributed authorship) as a multilayer network, using one protocol for every work.
- Hypothesis: intermedia is high coupling between layers, not a high number of layers. There may be a coupling level where a work becomes intermedia (after Higgins 1966).
- Fallback claim: even without a threshold, a continuum of coupling across works shows that reading works as networks is valuable.

## Definitions (draft)
- **Layers (L):** two aspects.
  - Medium, sorted by craft (what is made, and traditionally by whom), after Higgins's art forms. The list is fixed and applied to every work; a layer a work does not use stays empty.

    | Layer | Contains |
    |---|---|
    | Sound | music, sound design, non-verbal voice |
    | Text | libretto, narration, spoken or written words |
    | Movement | choreography, gesture, blocking |
    | Costume | what bodies wear and carry |
    | Scenography | set, props, ritual objects, architecture |
    | Light | lighting as a designed element |
    | Visual media | projected or screen images (assumed; to confirm) |
    | Interaction | designed affordances by which someone outside the fixed score or design acts on the work |

  - Work: the Obsidian Cycle contains its three pieces. A layer is a (work, medium) pair, such as (Pilgrimage, sound).
- **Vertices (V):** recurring, nameable elements (a leitmotif, a jangdan, a gesture vocabulary, a prop, a character, a place), not moments in time.
  - An element becomes a vertex only if it appears at least twice or relates to at least two other elements. (Proposed, to confirm.)
  - An element present in two media is one vertex in two layers (the bell is object and sound). (Proposed, to confirm.)
  - The same element recurring across pieces (Veyra, the Vorrakiel, the bells) stays one vertex.
- **Edges (E):** two classes. (Proposed, to confirm.)
  - Temporal (baseline): precedes, co-occurs. Derived by rule from a coded event timeline, never by hand. Co-occurrence across media is juxtaposition (multimedia) and does not count as coupling.
  - Structural (coupling), hand-coded with a short justification each:
    - varies (A to B): B is a recognizable transformation of A, in the same or another medium.
    - quotes (A to B): B reproduces A recognizably in another piece or context.
    - triggers (A to B): an occurrence of A cues an occurrence of B.
    - controls (A to B): A continuously shapes a parameter of B.
    - represents (A to B): A stands for B.
- **Temporal dynamics (T):** sections within a work; repeated performances where they exist (Children of the Moon is performed 2 to 3 times in succession). Occurrences of an element are events in time, not new vertices.
- **Attributes (A):** on vertices and edges: open or fixed (improvised or scored), maker (who authored it, where known), weight, plus medium-specific values (pitch, interval ratio, duration).
  - On interaction vertices also: actor (performer, audience, visitor, player); agency (scripted, bounded, open); timescale (discrete, continuous); reach (surface: changes what sounds or shows; structure: changes what happens next).

## Interaction
- Performers responding to each other inside the score are triggers edges between other layers, not interaction.
- Interaction vertices connect outward through controls and triggers; which layers they reach is a result.
- The three pieces share one network and differ in interaction, which makes them a near-controlled comparison:
  - Children of the Moon: the audience responds to sound.
  - Relics of Shadow: visitors interact with the artifacts at set points.
  - Pilgrimage: embodiment through gameplay; the player enacts the rite.
- Pansori has a conventional audience interaction (chuimsae), so the interaction layer is not only a property of games.

## Measures
- Inter-layer edge share: the fraction of structural edges that cross from one layer to another, compared with the temporal baseline.
- Node multiplexity: the fraction of vertices present in more than one layer.
- Cross-work sharing: the fraction of vertices present in more than one piece (transmedia coupling, as distinct from intermedia coupling within a piece).
- Severance: remove one layer and measure how much the rest fragments. Multimedia should survive; intermedia should fragment.
- Every score is compared against randomized networks of the same size and degree distribution.

## Validity guards
- Write the coding protocol before coding the corpus; pilot it on Children of the Moon.
- A second coder encodes a subset; report agreement.

## Corpus (rough)
- The Obsidian Cycle, analysed as three pieces (Children of the Moon, Relics of Shadow, Pilgrimage) and as a whole. Its network lives only in the work. The Cycle sits inside a larger cosmos of works, the Survanic Assemblage, which is out of scope: referenced in the text and mapped in an appendix, not encoded.
- The Rite of Spring (Stravinsky, Nijinsky, Roerich, 1913).
- A Wagner opera, undecided.
- A pansori performance.
- Journey (thatgamecompany, 2012).

## Open questions
- Which Wagner opera; which pansori madang, singer and recording; which Rite version.
- How to encode an interactive work (Journey): the designed graph, a canonical playthrough, or both.
- Confirm: the vertex rules, the two edge classes, and what visual media covers.
- Children of the Moon: does the audience's response feed back into the performance?
