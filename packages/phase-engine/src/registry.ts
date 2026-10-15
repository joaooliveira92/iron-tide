export interface PhaseDefinition {
  id: string;
  name: string;
  order: number;
  readPermissions: string[];
  writePermissions: string[];
  rngAllowed: boolean;
}

export class PhaseRegistry {
  static readonly PHASES: PhaseDefinition[] = [
    {
      id: "opening_validation",
      name: "Opening Validation",
      order: 0,
      readPermissions: ["all"],
      writePermissions: [],
      rngAllowed: false,
    },
    {
      id: "weather_generation",
      name: "Strategic Weather Generation",
      // B-5/ADR-0022 + B-6/ADR-0025: monthly per-area StrategicWeatherState
      // generation (DESIGN-42 §1), ordered after opening_validation and before
      // command_collection. The pure generation engine lives in
      // @bluewave/combat (generateStrategicWeather, keyed stream
      // `campaign/weather/<areaId>/<month>`); MonthExecutor wires it
      // authoritatively into the campaign snapshot (default climate profile
      // `defaultClimateProfile_v1`; committed per-area states before
      // command_collection).
      order: 0.5,
      readPermissions: ["all"],
      // ADR-0036: weather_generation commits per-area StrategicWeatherState into
      // the snapshot (DESIGN-42 §1), so it writes the strategicWeather resource.
      writePermissions: ["strategicWeather"],
      rngAllowed: true,
    },
    {
      id: "monthly_revenue",
      name: "Monthly Revenue",
      order: 1,
      readPermissions: ["treasury"],
      writePermissions: ["treasury"],
      rngAllowed: false,
    },
    {
      id: "ai_planning",
      name: "AI Planning",
      order: 1.5,
      readPermissions: ["nations", "constructions", "research", "treasury"],
      // ADR-0036: the AI path applies SetResearchPriority and budget_project,
      // so it writes research/treasury/constructions.
      writePermissions: ["research", "treasury", "constructions"],
      rngAllowed: true,
    },
    {
      id: "ai_procurement",
      name: "AI Procurement",
      order: 1.6,
      // ADR-0091: plans and submits design studies and places construction orders for AI nations.
      readPermissions: ["nations", "constructions", "treasury", "research", "designs"],
      writePermissions: ["nations", "constructions", "designs"],
      rngAllowed: true,
    },
    {
      id: "command_collection",
      name: "Command Collection",
      order: 2,
      readPermissions: ["all"],
      // ADR-0036: command_collection authoritatively applies player commands,
      // mutating treasury/constructions/research/wars/politics/fleets.
      writePermissions: ["treasury", "constructions", "research", "wars", "politics", "fleets"],
      rngAllowed: false,
    },
    {
      id: "appropriation",
      name: "Appropriation",
      order: 3,
      // ADR-0036: appropriation reads and advances constructionProjects, so the
      // "budget" resource is expressed as constructions. INC-4/SB3-R9: it also
      // draws the keyed acceleration capacity-pressure delay decisions, so it is
      // an rngAllowed phase (no draw occurs without an accelerated project).
      // SB3-R17: it also resolves the private dock-expansion event, which reads/writes
      // nation dock-expansion state and adds an INFRASTRUCTURE project.
      readPermissions: ["treasury", "constructions", "nations"],
      writePermissions: ["treasury", "constructions", "nations"],
      rngAllowed: true,
    },
    {
      id: "maintenance",
      name: "Maintenance",
      order: 4,
      readPermissions: ["treasury", "fleets"],
      writePermissions: ["treasury"],
      rngAllowed: false,
    },
    {
      id: "obligation",
      name: "Obligation",
      order: 5,
      readPermissions: ["treasury"],
      writePermissions: ["treasury"],
      rngAllowed: false,
    },
    {
      id: "construction_processing",
      name: "Construction Processing",
      order: 6,
      // SB3-R16: it also advances dock-expansion elapsed months and raises the nation's dock limits on completion, so
      // it reads/writes the nations resource (the dock limits) as well as constructions/fleets.
      readPermissions: ["constructions", "fleets", "nations"],
      writePermissions: ["constructions", "fleets", "nations"],
      rngAllowed: false,
    },
    {
      id: "resolve_diplomacy",
      name: "Diplomacy Resolution",
      order: 6.5,
      readPermissions: ["wars", "politics", "fleets"],
      writePermissions: ["wars", "politics"],
      rngAllowed: false,
    },
    {
      id: "resolve_research",
      name: "Research Resolution",
      order: 7,
      // ADR-0036: resolve_research also spends the research budget from treasury,
      // so it reads/writes treasury in addition to research.
      readPermissions: ["research", "treasury"],
      writePermissions: ["research", "treasury"],
      rngAllowed: true,
    },
    {
      id: "resolve_aircraft_development",
      name: "Aircraft Development Resolution",
      // D-1: per-nation aircraft development pipeline (DESIGN-43 §§4-12),
      // ordered after resolve_research (order 7) and before battle_generation
      // (order 7.5). Strict no-op when no nation has aviation tech.
      order: 7.2,
      readPermissions: ["nations", "treasury", "research"],
      writePermissions: ["nations"],
      rngAllowed: true,
    },
    {
      id: "resolve_carrier_operations",
      name: "Carrier Operations Resolution",
      // D-2: per-nation carrier operations pipeline (DESIGN-44), ordered after
      // resolve_aircraft_development (order 7.2) and before battle_generation
      // (order 7.5). Strict no-op when no nation has carrier-capable ships.
      order: 7.3,
      readPermissions: ["nations"],
      writePermissions: ["nations"],
      rngAllowed: true,
    },
    {
      id: "battle_generation",
      name: "Battle Generation",
      order: 7.5,
      // ADR-0036: battle_generation reads the nations map (ship strength/
      // readiness) and writes wars (battles + manifests) plus nations (ship
      // inBattleId reservations).
      readPermissions: ["wars", "fleets", "politics", "nations"],
      writePermissions: ["wars", "nations"],
      rngAllowed: true,
    },
    {
      id: "battle_resolution",
      name: "Battle Resolution",
      order: 8,
      // ADR-0036: battle_resolution reads committed strategic weather + the
      // nations map and writes wars + fleets + nations (per-ship damage/loss
      // and reservation clearing).
      readPermissions: ["wars", "fleets", "nations", "strategicWeather"],
      writePermissions: ["wars", "fleets", "nations"],
      rngAllowed: true,
    },
    {
      id: "closing_validation",
      name: "Closing Validation",
      order: 9,
      readPermissions: ["all"],
      writePermissions: [],
      rngAllowed: false,
    },
  ];

  static getById(id: string): PhaseDefinition | undefined {
    return PhaseRegistry.PHASES.find((p) => p["id"] === id);
  }

  static getByOrder(order: number): PhaseDefinition | undefined {
    return PhaseRegistry.PHASES.find((p) => p["order"] === order);
  }

  static get all(): readonly PhaseDefinition[] {
    return PhaseRegistry.PHASES;
  }

  static hasAccess(
    phase: PhaseDefinition,
    resource: string,
    accessType: "read" | "write",
  ): boolean {
    const permissions =
      accessType === "read" ? phase["readPermissions"] : phase["writePermissions"];
    return permissions.includes("all") || permissions.includes(resource);
  }
}
