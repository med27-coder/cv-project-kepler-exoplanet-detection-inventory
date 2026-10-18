# Draft: sky events (the UFO, asteroids, comets, meteors)

**Status: built on the map** (18 October 2026, `web/src/05-sky-events.js`, v1.1.0): comets, asteroids and the UFO,
with SKY WATCH achievements. Still to build: meteors over the planets (METEOR CATCHER). Concept art in `pixel-art/concepts/`, made by
`scripts/starmap/draft_concepts.py`. Extends ACHIEVEMENTS_V2.md section 1D (sky events).

## The science behind the drawings

| | Asteroid | Comet | Meteor |
|---|---|---|---|
| What it is | Rock or metal left over from planet formation; most orbit in the belt between Mars and Jupiter | Ice and dust ("a dirty snowball") from the Kuiper Belt or the Oort Cloud | A small rock burning up in a planet's air, 80 to 120 km up |
| How it looks | Dark, lumpy, cratered, slowly tumbling, lit on one side by the Sun. **No glow, no tail** (nothing burns in empty space) | A small dark nucleus inside a glowing coma; a straight bluish **ion tail** and a broad, curved, whiter **dust tail** | A bright streak with a glowing head, only inside an atmosphere |
| The detail to get right | Some have moons (Ida and Dactyl) | **Both tails point away from the Sun**, not behind the comet: leaving the Sun, it travels tail-first | Pieces that reach the ground are meteorites |

The user's references (two meteor photos, a "fiery asteroid" illustration, an AI-drawn UFO) are inspiration only and
are not committed. The fiery-asteroid look is really a meteor's, so fire is drawn only for meteors over a planet.

## Drafts

| Draft | What it shows |
|---|---|
| `draft_aliens.gif` | The UFO after the user's reference, on a daytime sky |
| `draft_aliens_2.gif` | The same with no background (transparent) |
| `draft_ufo_space_a.gif` | The UFO travelling through space: a steady starfield drifting past, nothing flashing |
| `draft_ufo_space_b.gif` | The rare version: an asteroid tumbles past behind the saucer (achievement **WHAT WAS THAT?**) |
| `draft_asteroid_v2.gif` | An asteroid as it really looks, with a small moon |
| `draft_comet_v2.gif` | First comet try: coma, ion tail and curved dust tail, away from the Sun (superseded) |
| `draft_comet_v3.gif` | The comet after real photos (Comet Lovejoy from the space station, 2011): a tiny bright head, a long dithered dust plume, a faint thin ion tail |
| `draft_meteor_v2.gif` | First meteor try, from orbit over the horizon (superseded) |
| `draft_meteor_v3a.gif` | From orbit over the night side: city lights, the green airglow band, a thin streak burning through it (both 70 to 120 km up), a flare and a fading train |
| `draft_meteor_v3b.gif` | From the ground, after the 2021 Perseid photos: the Milky Way, a horizon glow, a tree line and the streak |

Meteor colours follow what burns: green-blue from magnesium and nickel at the head, yellow-orange from sodium,
red from the air itself, cooling along the trail.

## Decisions for the user

**Answered 18 October 2026:**
1. Yes: version a (space) is the normal UFO sighting, about once an hour of use.
2. The rare asteroid version shows up **2 in 5** UFO sightings (40%), since the scene is short.
3. Yes: a comet or asteroid every 3 to 6 minutes, meteors only over planets. **New:** passing comets, asteroids
   and meteors can be caught (clicked); catching enough earns **ASTEROID CATCHER** and **METEOR CATCHER**
   (suggested: 10 each; a COMET CATCHER can join them).

The questions as first asked:


1. The UFO: version a (space) as the normal sighting? Its rarity (plan: about once an hour of use)?
2. The rare asteroid version: how rare? Suggestion: 1 in 10 UFO sightings, so WHAT WAS THAT? is a real find.
3. Comets and asteroids as their own sky events (plan: one every 3 to 6 minutes), and meteors only over planets
   (the ISS and Earth views, the Solar System)?
