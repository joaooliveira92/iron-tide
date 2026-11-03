import { CampaignDiplomacySchema, list } from "@bluewave/content-authoring";

export default list(CampaignDiplomacySchema, [
  // 1880 opening diplomatic posture (N-1 ticket 05).
  // Only the pairs that were materially aligned or rivals in January 1880 are
  // authored; every other pair is left to the canonical default (neutral,
  // tension 5). The *direction* of each relation follows the cited diplomatic
  // history; the 0..10 tension magnitude is an authored balance choice and is
  // marked as such in each record's provenance (kind: balance_adjustment,
  // sourceStatus: BALANCE_TARGET).
  {
    nationA: "austria_hungary",
    nationB: "germany",
    relation: "allied",
    tension: 1,
    nap: true,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "HIGH",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Dual Alliance of 1879; direction historical, tension 1/10 is an authored balance choice.",
    },
  },
  {
    nationA: "austria_hungary",
    nationB: "italy",
    frictionBp: 60,
    relation: "neutral",
    tension: 6,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Italian irredentism in the Adriatic; the Triple Alliance is not yet formed in 1880. Tension 6/10 is an authored balance choice.",
    },
  },
  {
    nationA: "austria_hungary",
    nationB: "ottoman_empire",
    frictionBp: 30,
    relation: "neutral",
    tension: 4,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Austro-Ottoman Balkan competition; tension 4/10 is an authored balance choice.",
    },
  },
  {
    nationA: "austria_hungary",
    nationB: "russia",
    frictionBp: 60,
    relation: "neutral",
    tension: 7,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Austro-Russian rivalry over the Balkans after the Congress of Berlin; tension 7/10 is an authored balance choice.",
    },
  },
  {
    nationA: "brazil",
    nationB: "usa",
    frictionBp: 10,
    relation: "neutral",
    tension: 2,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Two American republics with no 1880 quarrel; tension 2/10 is an authored balance choice.",
    },
  },
  {
    nationA: "france",
    nationB: "germany",
    frictionBp: 80,
    relation: "neutral",
    tension: 9,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "HIGH",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Revanchism after the Franco-Prussian War and the loss of Alsace-Lorraine; tension 9/10 is an authored balance choice.",
    },
  },
  {
    nationA: "france",
    nationB: "italy",
    frictionBp: 60,
    relation: "neutral",
    tension: 6,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Franco-Italian rivalry over Tunisia; tension 6/10 is an authored balance choice.",
    },
  },
  {
    nationA: "france",
    nationB: "qing",
    frictionBp: 30,
    relation: "neutral",
    tension: 5,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "French colonial pressure in Tonkin; tension 5/10 is an authored balance choice.",
    },
  },
  {
    nationA: "france",
    nationB: "uk",
    frictionBp: 60,
    relation: "neutral",
    tension: 6,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Anglo-French colonial rivalry (Africa and the Mediterranean); tension 6/10 is an authored balance choice.",
    },
  },
  {
    nationA: "germany",
    nationB: "russia",
    frictionBp: 10,
    relation: "neutral",
    tension: 3,
    nap: true,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "League of the Three Emperors still nominally in force in 1880; tension 3/10 is an authored balance choice.",
    },
  },
  {
    nationA: "italy",
    nationB: "ottoman_empire",
    frictionBp: 30,
    relation: "neutral",
    tension: 5,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Italian ambitions in the Mediterranean and North Africa; tension 5/10 is an authored balance choice.",
    },
  },
  {
    nationA: "japan",
    nationB: "qing",
    frictionBp: 60,
    relation: "neutral",
    tension: 6,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Japanese claims over the Ryukyus and Korea against Qing suzerainty; tension 6/10 is an authored balance choice.",
    },
  },
  {
    nationA: "japan",
    nationB: "russia",
    frictionBp: 30,
    relation: "neutral",
    tension: 4,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Emerging Russo-Japanese competition in Northeast Asia; tension 4/10 is an authored balance choice.",
    },
  },
  {
    nationA: "netherlands",
    nationB: "uk",
    frictionBp: 30,
    relation: "neutral",
    tension: 4,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Friction over Sumatra and colonial spheres in the East Indies; tension 4/10 is an authored balance choice.",
    },
  },
  {
    nationA: "ottoman_empire",
    nationB: "russia",
    frictionBp: 80,
    relation: "neutral",
    tension: 8,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "HIGH",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Aftermath of the Russo-Turkish War of 1877-78 and the Congress of Berlin; tension 8/10 is an authored balance choice.",
    },
  },
  {
    nationA: "ottoman_empire",
    nationB: "uk",
    frictionBp: 10,
    relation: "neutral",
    tension: 3,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Britain's traditional backing of the Porte against Russia; tension 3/10 is an authored balance choice.",
    },
  },
  {
    nationA: "russia",
    nationB: "uk",
    frictionBp: 60,
    relation: "neutral",
    tension: 7,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "The Great Game in Central Asia and the Eastern Question; tension 7/10 is an authored balance choice.",
    },
  },
  {
    nationA: "portugal",
    nationB: "uk",
    relation: "allied",
    tension: 1,
    nap: true,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "HIGH",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "The long-standing Anglo-Portuguese Alliance; tension 1/10 is an authored balance choice.",
    },
  },
  {
    nationA: "qing",
    nationB: "russia",
    frictionBp: 30,
    relation: "neutral",
    tension: 5,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Russian encroachment in Central Asia and Manchuria; tension 5/10 is an authored balance choice.",
    },
  },
  {
    nationA: "qing",
    nationB: "uk",
    frictionBp: 60,
    relation: "neutral",
    tension: 6,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Legacy of the Opium Wars and treaty-port pressure; tension 6/10 is an authored balance choice.",
    },
  },
  {
    nationA: "spain",
    nationB: "portugal",
    frictionBp: 10,
    relation: "neutral",
    tension: 2,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Iberian neighbours at peace; tension 2/10 is an authored balance choice.",
    },
  },
  {
    nationA: "spain",
    nationB: "usa",
    frictionBp: 10,
    relation: "neutral",
    tension: 3,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Latent tension over Cuba is not yet acute in 1880; tension 3/10 is an authored balance choice.",
    },
  },
  {
    nationA: "uk",
    nationB: "usa",
    frictionBp: 30,
    relation: "neutral",
    tension: 4,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "The Struggle for Mastery in Europe 1848-1918",
          author: "A. J. P. Taylor",
          year: 1954,
        },
      ],
      note: "Residual Anglo-American friction after the Civil War era; tension 4/10 is an authored balance choice.",
    },
  },
]);
