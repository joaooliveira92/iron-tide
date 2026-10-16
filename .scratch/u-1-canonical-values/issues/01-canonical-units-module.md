# 01: The canonical units module

**What to build:** One dependency-free canonical units module, owned by the
contracts package, that declares the canonical unit per quantity, the branded
safe-integer type that carries it, the canonical constants, and the checked
helpers — added **beside** the existing ship-design and campaign definitions so
nothing breaks (the *expand* step of an expand→migrate→contract sequence). No
stored value changes.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The module declares the canonical unit table: mass = kg, length/calibre/
      armour/diameter = µm, speed = µm/s, volume = L, power = kW, ratio = bp,
      time = integer month/year, money = integer treasury unit (map D2/D3).
- [ ] A branded safe-integer type exists per table row; canonical constants
      (`UM_PER_INCH`, `MM_TO_UM`, `KNOTS_TO_UMS`, `BP_ONE`) live here once.
- [ ] Constructors reject non-integer, out-of-range and unsafe-integer input with
      a `_tag`-discriminated error; they never return `NaN`/`Infinity`.
- [ ] The module is runtime-free and locale/clock-free: no Node, filesystem,
      `Intl`, `Date`, `Math.random`, or float arithmetic.
- [ ] Existing ship-design and campaign definitions still compile unchanged
      (*expand*); the cross-process child run is byte-identical before and after
      (still no `golden/hashes.json`, so record the child-run hash manually).
