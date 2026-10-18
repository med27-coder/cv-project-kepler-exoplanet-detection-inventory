# Loop backlog: work the unattended loop can pick up

Set up 18 October 2026, while the user is away ("fix bugs, update the code with cleaner ways to run it, set up new
drafts and ideas"). One item per loop turn; mark it done here with the version or commit. Rules:

- Ship only what is tested: the full suite, ruff, the web build check and `node --check` must pass, then CI.
- Each player-facing change is a release via `/release` (1.9.2, 1.9.3...; never 2.0), with "New:"/"Fixed:" notes.
- Anything needing the user's choice (a new egg's look, rarities, which draft) becomes a **draft** in
  `pixel-art/concepts/` and a question in the hand-off notes, not a shipped feature.
- Never commit secrets, film stills or ESA images; never tune Star Gazer on the test split; replaced art goes to
  `pixel-art/archive/` first.

## Queue (top first)

0. **Hubble Space Telescope** (user report: searching "hubble space telescope" or "hubble telescope" finds nothing).
   Add it as an easter egg like the ISS (an Earth-orbit exception): a pixel Earth with Hubble on its orbit, its
   sprite, Galleria card with NASA's photo, fun facts, search words (hubble, hst, hubble telescope, hubble space
   telescope). New egg id `hubble` (add to SHIPPED_IDS).
0b. **Haumea after NASA's Eyes on the Solar System** (user's screenshots, reference only, not committed): redraw
   Haumea's pixel globe as the stretched egg it is, grey-brown with the darker patch, and show its two moons on their
   tilted orbits (Hi'iaka, the larger and farther; Namaka, closer, on a strongly inclined orbit) in its close-up and
   Galleria card; check facts against NASA's Haumea page.
1. **Astronaut spin as one sprite rotating** (user idea, low priority): draw the astronaut once to a small offscreen
   canvas and rotate that image, instead of re-plotting pixels at each angle, so it spins smoothly and costs less.
   Draft both side by side first; ship if it looks better.
2. **Bug sweep:** look for other views that can be overwritten by a slow-loading star (the race fixed in
   `showUnknown` / `showHome`), and for listeners added more than once.
3. **Cleaner code:** share the duplicated Mars sky/ground helpers between `47d-martian.js` and `47e-rovers.js`;
   small, tested refactors only.
4. **Meteor drafts:** prepare the "both" option (v3a over Earth/ISS and the Solar System, v3b as the background's
   shooting star) as a draft for the user to approve.
5. **Zhurong** (China's Mars rover, 2021) as a draft scene, next on the rover roster (FLEET_CLOSEUPS.md 3A).
6. **Moon rover drafts:** Lunokhod 1 and Yutu-2 concept art.
7. **Performance check:** frame cost of the map with sky events and the backdrop on a phone-size viewport.

## Done

- 0. Hubble Space Telescope: v1.9.3.
