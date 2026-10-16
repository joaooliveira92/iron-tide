# 02: Campaign state holds per-area mine pressure

**What to build:** The compiled campaign snapshot carries an area-ordered
collection of mine-pressure records, empty for 1880, that survives save and load
and is part of the authoritative hash. A test seeds a record in a fixture and
observes it in the snapshot, in a save round trip and in the projection source.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The compiled 1880 snapshot has an empty, canonically ordered collection.
- [ ] A fixture record round-trips through save and load byte-identically with its
      record hash valid.
- [ ] Records with invalid pressure, duplicate areas or unknown areas are rejected
      at the boundary with stable diagnostics.
- [ ] The compatibility version is bumped (or joins the pending bump) and a save
      from the prior version is refused before decode.
- [ ] Golden re-pin cause recorded per the repinning doc.
