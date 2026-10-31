import { RulesetManifestSchema, list } from "@bluewave/content-authoring";

export default list(RulesetManifestSchema, [
  // The 1880 core ruleset. The prestige value set (S-2, ADR-0239) is authored here, not defaulted in
  // code. Grounded rules (a sacking threshold of 16 or below, proportional loss, final prestige as the
  // career score) follow RTW3 (manual pp.12, 62). Every magnitude the sources do not give is an admitted
  // Bluewave balance choice recorded by ADR-0239 (kind: balance_adjustment, sourceStatus: BALANCE_TARGET).
  {
    id: "core",
    name: "Bluewave Core Ruleset",
    version: "1.0",
    prestige: {
      lowerBound: 0,
      upperBound: 1000,
      sackingThreshold: 16,
      sackingProbabilityBp: 1000,
      rules: {
        UNPAID_FUNDS: {
          kind: "PROPORTIONAL_LOSS",
          basisPoints: 300,
        },
        BATTLE_LOST: {
          kind: "PROPORTIONAL_LOSS",
          basisPoints: 500,
        },
        BATTLE_WON: {
          kind: "FIXED_GAIN",
          amount: 1,
        },
      },
    },
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Rule the Waves 3 manual",
          author: "Naval War Simulations / Matrix Games",
          year: 2023,
          page: "12, 62",
          section: "Prestige; sacking threshold of 16 or below; final prestige as the career score",
        },
      ],
      note: "ADR-0239. The threshold of 16 and the proportional-loss shape are documented RTW3; the bounds, the loss and gain rates and the monthly sacking probability are Bluewave balance targets.",
    },
    // The tension-drift section (S-4 slice 2, decision #425). Every value is a PROVISIONAL Bluewave balance target: the
    // manual (pp.60-61) says tension rises slowly over years but gives no number. Removing this section returns tension to
    // the dormant behaviour of changing only through war, peace and fleet exercises.
    tensionDrift: {
      sectionVersion: 1,
      maxRiseProbabilityBp: 100,
      navalRatio: { thresholdBp: 30_000, pressureBp: 15, tensionCeiling: 5 },
      damping: { alliedBp: 40, tradeAgreementBp: 15 },
      cooling: { alliedBp: 8, tradeAgreementBp: 4 },
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "60-61",
            section:
              "Tension rises slowly over years; allies and trade partners are less likely to fall out",
          },
        ],
        note: "PROVISIONAL. With the authored pair frictions the monthly probabilities give one tension step about every nine years for the most hostile pairs and about every eighty for the quietest; they await a sourcing pass and the balance report.",
      },
    },
    // The battle-offer section (T-1, spec #109). Every value is a Bluewave balance decision recorded by ADR-0254 (decision
    // requests 0028-0034, Option C): the manual (p.67) says each quantity exists but supplies no number. Retuning is a
    // ruleset version change with a golden re-pin. Removing this section returns the pack to the dormant behaviour.
    battleOffers: {
      sectionVersion: 1,
      // G1 (ADR-0254): a perturbed strength-only estimate, symmetric error of 2000 bp of the true strength.
      estimateModel: {
        kind: "PERTURBED",
        errorBoundBp: 2000,
        rounding: "HALF_UP",
        showComposition: false,
      },
      // G2, G3 (ADR-0254): war-score points per mission, no distance modifier, the enemy is not credited. The rounding is
      // required by the section shape and is inert here: it only rounds a fractional opponent credit, and there is none.
      declineVictoryPoints: {
        pointsByMission: {
          FLEET_BATTLE: 5,
          CRUISER_BATTLE: 2,
        },
        distanceModifier: {
          kind: "NONE",
        },
        rounding: "HALF_UP",
        opponentCredit: {
          kind: "NONE",
        },
      },
      // G4 (ADR-0254): "several" is three declines within a war, cleared when the war ends.
      declineCounter: {
        threshold: 3,
        scope: "WAR",
        reset: {
          kind: "ON_WAR_END",
        },
      },
      // G6 (ADR-0254): the enemy declines half the time when it is outmatched two to one or worse; no cost to the enemy.
      enemyDecline: {
        comparison: "LESS_THAN",
        thresholdBp: 5000,
        probabilityBp: 5000,
      },
      // G7 (ADR-0254): one battle in five has a support force, at the full existing allied cap, from allies only.
      supportForce: {
        presenceChanceBp: 2000,
        shareOfCapBp: 5000,
        source: "ALLIED_ONLY",
      },
      // G5 (ADR-0254, ADR-0262): 3 percent of current prestige on each decline at or after the threshold.
      declinedBattlePrestige: {
        rule: {
          kind: "PROPORTIONAL_LOSS",
          basisPoints: 300,
        },
        repeat: "EACH_FURTHER_DECLINE",
      },
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "62, 67, 99",
            section:
              "Battle offers: force estimate, declining costs victory points and may cost prestige after several declines, the enemy may decline, a friendly support force sometimes joins",
          },
        ],
        note: "ADR-0254. The manual states that each quantity exists and supplies no number, model or rule; every value is a Bluewave balance target adopted by the owner's delegation (docs/research/t-1-battle-offer-values.md, decisions 0028-0034).",
      },
    },
    // The fleet-management section (spec #265). Every value is a Bluewave balance decision recorded by ADR-0283 under the
    // owner's standing delegation on map #193; only the twelve-month proficiency, the limit of two subjects, the training
    // maintenance percentages and the doubled exercise maintenance (manual p.53) are sourced. Retuning is a ruleset version
    // change with replay re-approval. Removing this section returns the pack to the dormant behaviour.
    fleetManagement: {
      sectionVersion: 1,
      divisionCohesion: {
        monthlyGrowth: 2,
        cap: 90,
      },
      divisionExperience: {
        perBattle: 3,
        perExercise: 5,
      },
      reorganisationPenalty: {
        roleChange: {
          cohesion: 10,
          experience: 0,
        },
        formationChange: {
          cohesion: 5,
          experience: 0,
        },
      },
      training: {
        proficiencyMonths: 12,
        maxSubjects: 2,
        nationCostMultiplierBp: {
          japan: 8000,
        },
        subjects: {
          GUNNERY: {
            maintenanceAdderBp: 3000,
            effectBp: 1000,
          },
          NIGHT_FIGHTING: {
            maintenanceAdderBp: 2000,
            effectBp: 1000,
          },
          TORPEDO_TACTICS: {
            maintenanceAdderBp: 2000,
            effectBp: 1000,
          },
          DAMAGE_CONTROL: {
            maintenanceAdderBp: 2000,
            effectBp: 1000,
          },
        },
      },
      exercise: {
        maintenanceMultiple: 2,
        maxPerCalendarYear: 1,
      },
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "51, 53, 55",
            section:
              "Special training takes twelve months, at most two subjects, with maintenance surcharges; an annual fleet exercise costs twice the active maintenance; division experience has a slight impact on crew quality in battle",
          },
        ],
        note: "ADR-0283. The manual gives the twelve-month proficiency, the limit of two subjects, the training maintenance percentages and the doubled exercise cost; the cohesion and experience rates, the reorganisation penalties and the effect sizes of the unsourced subjects are Bluewave balance targets adopted by the owner's delegation (docs/research/fleet-management-values.md). ADR-0303: the manual (p.53) says Japan pays less for training and gives no figure; nationCostMultiplierBp is generic nation-keyed data, bounded to 5000-10000, and the japan entry of 8000 (a fifth off the added maintenance only) is a conservative balance target with LOW confidence.",
      },
    },
    // The gunnery radar section (#292). The manual (pp.121, 127) grounds fire-control radar, blind fire from level 3, and the
    // diminishing returns of radar-directed medium AA, but gives no accuracy figure. The level tables are Bluewave balance
    // targets recorded by ADR-0311. Retuning is a ruleset version change with replay re-approval.
    gunnery: {
      sectionVersion: 1,
      radar: {
        accuracyBpByFireControlLevel: [10500, 11000, 12000],
        blindFireMinLevel: 3,
        airDefenseSaturationBpBySearchLevel: [10000, 11000, 12000],
      },
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "121, 127",
            section:
              "Fire control from level 3 allows blind fire; more than 4 radar-directed medium AA has diminishing returns and more than 8 is redundant",
          },
        ],
        note: "ADR-0311. The manual grounds the mechanic and supplies no accuracy multiplier; the three-level tables are balance targets chosen so a level-3 director is a material but not dominant gunnery advantage.",
      },
    },
    // The surface-to-surface missile section (#293). The manual (pp.121-123) names Light, Medium and Heavy ASM/SSM
    // families and gives no range, hit rate or warhead figure. Every value is a Bluewave balance target recorded
    // by ADR-0312, following the date and cost policy of ADR-0283 D2/D5. Retuning is a ruleset version change
    // with replay re-approval.
    missiles: {
      sectionVersion: 1,
      classes: {
        light_ssm: {
          rangeM: 30000,
          flightTimeSeconds: 90,
          salvoSize: 2,
          baseHitBp: 3500,
          structuralDamage: 1800,
          flotationDamage: 900,
          defenceInterceptBp: 2500,
          maxSalvosPerBattle: 4,
        },
        medium_ssm: {
          rangeM: 55000,
          flightTimeSeconds: 120,
          salvoSize: 4,
          baseHitBp: 4000,
          structuralDamage: 2600,
          flotationDamage: 1400,
          defenceInterceptBp: 3000,
          maxSalvosPerBattle: 4,
        },
        heavy_ssm: {
          rangeM: 90000,
          flightTimeSeconds: 180,
          salvoSize: 8,
          baseHitBp: 4500,
          structuralDamage: 3800,
          flotationDamage: 2200,
          defenceInterceptBp: 3500,
          maxSalvosPerBattle: 3,
        },
      },
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "121-123",
            section:
              "Light, Medium and Heavy surface-to-surface and air-to-surface missile families",
          },
        ],
        note: "ADR-0312. The manual names the missile families and the ship/submarine carriage and supplies no range, flight time, salvo size, hit probability, warhead effect or interception figure. Every magnitude is a Bluewave balance target; the class progression follows ADR-0283 D2/D5.",
      },
    },
    // The foreign-station and presence section (S-5, spec #73). Every value is a Bluewave balance decision recorded by
    // ADR-0266 (decision requests 0016-0023 and 0026, Option C); only the 1.5x colonial-service multiplier (manual p.46) is
    // sourced and it lives in code. The manual (pp.42, 45, 46) says each quantity exists and supplies no number. Retuning is a
    // ruleset version change with a golden re-pin. Removing this section returns the pack to the dormant behaviour.
    presence: {
      colonialServiceDisplacementBp: 1500,
      requiredTonsPerPossessionWeight: 150,
      noPortValueWeight: 2,
      crampedOrShortRangeCountBp: 5000,
      penaltyRequests: true,
      baseLimits: {
        limitByBaseLevel: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
        noBaseLimit: 2,
        occupyingStates: ["ACTIVE", "RESERVE", "WORKING_UP", "REPAIR"],
        maintenanceAdderBp: 2500,
        crewQualityReduction: 2,
      },
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "42, 45, 46",
            section:
              "Colonial service takes a proportion of displacement; base limits by base value; tonnage required per area; cramped and short-range ships count for less",
          },
        ],
        note: "ADR-0266. The manual states that each quantity exists and supplies no number, model or rule; every value is a Bluewave balance target adopted by the owner's delegation (docs/research/s-5-presence-and-base-limits.md, decisions 0016-0023, 0026).",
      },
    },
  },
]);
