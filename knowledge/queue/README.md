# The review queue

Suggestions waiting for a person: one file each, named `YYYY-MM-DD-<world>-<topic>.md`, from
[TEMPLATE.md](TEMPLATE.md). Anyone (a player, the owner, an agent's report) may add one; nothing here is shown on
the map.

A person reviewing a suggestion either:

- **accepts it:** finds a tier 1 or tier 2 source that says the same, writes the fact into the world's file in
  `../worlds/` with that source, and deletes the suggestion in the same pull request; or
- **declines it:** deletes the file, with the reason in the pull request.

A suggestion's own source never counts as the fact's source unless it is tier 1 or 2 (../README.md).
