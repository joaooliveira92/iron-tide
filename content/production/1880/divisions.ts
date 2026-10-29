import { CampaignDivisionSchema, list } from "@bluewave/content-authoring";

export default list(CampaignDivisionSchema, [
  // Initial 1880 divisions (N-1 ticket 07, DESIGN-26, ADR-0213, ADR-0224).
  // Each nation that kept an organised division afloat at the January 1880 start
  // begins with one here, seeded from the ships already authored in fleets.yaml on
  // that station. The *direction* — which nations had an organised command and how
  // the squadrons were grouped by station — follows the era's naval organisation
  // (Conway's All the World's Fighting Ships 1860-1905; Parkes, British Battleships).
  // Every magnitude (which ships form a division, the role and formation) is an
  // admitted ADR-0213 balance_adjustment, recorded per record. shipOrder is
  // canonical: the first ship is the flagship. The United States and Qing are left
  // without an initial division: their 1880 squadrons were single ships still
  // working up (USS Amphitrite was fitting out; the Beiyang ironclads were not yet
  // operational), so no organised division is seeded.
  {
    id: "div_gbr_home",
    nationId: "uk",
    shipOrder: ["gbr_dreadnought", "gbr_alexandra"],
    commanderOfficerId: "off_uk_9",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Home Fleet battle squadron; the two operational ironclads form one CORE division. Composition and role are authored balance choices; the station is historical.",
    },
  },
  {
    id: "div_gbr_mediterranean",
    nationId: "uk",
    shipOrder: ["gbr_temeraire"],
    commanderOfficerId: "off_uk_6",
    divisionRole: "INDEPENDENT",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Mediterranean Fleet station, detached single ship. Role and formation are authored balance choices.",
    },
  },
  {
    id: "div_fra_med",
    nationId: "france",
    shipOrder: ["fra_redoutable"],
    commanderOfficerId: "off_france_8",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Escadre de la Méditerranée core; the operational barbette ironclad leads. Composition is an authored balance choice.",
    },
  },
  {
    id: "div_ger_home",
    nationId: "germany",
    shipOrder: ["ger_kaiser"],
    commanderOfficerId: "off_germany_7",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Deutsche Flotte core division around the operational turret ship. Composition is an authored balance choice.",
    },
  },
  {
    id: "div_rus_baltic",
    nationId: "russia",
    shipOrder: ["rus_petrveliky"],
    commanderOfficerId: "off_russia_7",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Baltic Fleet division around the operational ironclad. Composition and role are authored balance choices.",
    },
  },
  {
    id: "div_aut_adriatic",
    nationId: "austria_hungary",
    shipOrder: ["aut_custoza"],
    commanderOfficerId: "off_austria_hungary_5",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Adriatic station division around the operational casemate ironclad. Composition is an authored balance choice.",
    },
  },
  {
    id: "div_ita_home",
    nationId: "italy",
    shipOrder: ["ita_duilio"],
    commanderOfficerId: "off_italy_6",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Regia Marina core division around the operational Duilio. Composition is an authored balance choice.",
    },
  },
  {
    id: "div_jpn_home",
    nationId: "japan",
    shipOrder: ["jpn_fuso"],
    commanderOfficerId: "off_japan_6",
    divisionRole: "INDEPENDENT",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "The single operational ironclad holds the home station as an independent division. Role and formation are authored balance choices.",
    },
  },
  {
    id: "div_ott_home",
    nationId: "ottoman_empire",
    shipOrder: ["ott_mesudiye"],
    commanderOfficerId: "off_ottoman_empire_5",
    divisionRole: "INDEPENDENT",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Marmara station, single operational central-battery ship. Role and formation are authored balance choices.",
    },
  },
  {
    id: "div_esp_home",
    nationId: "spain",
    shipOrder: ["esp_numancia"],
    commanderOfficerId: "off_spain_5",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Armada Española core division around the operational ironclad. Composition is an authored balance choice.",
    },
  },
  {
    id: "div_nld_home",
    nationId: "netherlands",
    shipOrder: ["nld_schorpioen"],
    commanderOfficerId: "off_netherlands_4",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Koninklijke Marine home-station ram. Composition and role are authored balance choices.",
    },
  },
  {
    id: "div_nld_dei",
    nationId: "netherlands",
    shipOrder: ["nld_buffel"],
    commanderOfficerId: "off_netherlands_3",
    divisionRole: "PATROL",
    preferredFormation: "LINE_ABREAST",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "East Indies station ram on colonial patrol. Role and formation are authored balance choices.",
    },
  },
  {
    id: "div_por_home",
    nationId: "portugal",
    shipOrder: ["por_vasco_da_gama"],
    commanderOfficerId: "off_portugal_4",
    divisionRole: "INDEPENDENT",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Marinha Portuguesa home station, single operational ironclad. Role and formation are authored balance choices.",
    },
  },
  {
    id: "div_bra_home",
    nationId: "brazil",
    shipOrder: ["bra_brasil"],
    commanderOfficerId: "off_brazil_5",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Conway's All the World's Fighting Ships 1860-1905",
          author: "Robert Gardiner (ed.)",
          year: 1979,
        },
      ],
      note: "Armada Imperial core division around the operational ironclad. Composition is an authored balance choice.",
    },
  },
]);
