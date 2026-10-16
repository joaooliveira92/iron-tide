# 05: Mined areas can strike ships ending operational movement

**What to build:** A ship that ends operational movement in an area with
pressure faces a recorded draw using the engine's route risk. A strike damages the
ship, may be misreported as a torpedo attack, and creates an incident report.
Movement is never denied. A fixture drives a fleet into a heavily mined area with
known seeds and observes a strike.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Risk and draw are recorded with stream identity, entity key, input hash,
      draw, outcome and reason code.
- [ ] A strike changes hit points through the existing damage path; no strike
      leaves the ship unchanged.
- [ ] The same seed and state give the same outcome across processes.
- [ ] Incident reports are immutable and do not alter pressure records.
- [ ] A fleet is never prevented from moving by risk alone.
