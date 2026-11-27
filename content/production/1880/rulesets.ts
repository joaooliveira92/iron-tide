import { RulesetManifestSchema, list } from "@bluewave/content-authoring";

const manualGrowthBandProvenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [
    {
      title: "Rule the Waves 3 manual",
      author: "Naval War Simulations / Matrix Games",
      year: 2023,
      page: "12",
      section: "The Budget: base resources increase steadily at about 3-5% a year",
    },
  ],
  derivation: {
    sourceValue: "about 3-5%",
    sourceUnit: "percent a year",
    conversion: "midpoint of the manual's band, applied uniformly",
    gameValue: "400 bp",
  },
  note: "PROVISIONAL (#1115, Discussion 1118). The manual states one band for every nation. Maddison Project 2023 real GDP 1880-1913 falls inside 3-5% robustly only for the USA (3.5%, every window); Germany is borderline (3.1% in 1880-1913, 2.5% in 1880-1914) and the other twelve measure 0.9-2.3%, so reaching the band would need a rescale or a per-nation window choice that would be invented. The midpoint is a uniform Bluewave balance choice inside the manual band, not a nation-specific measurement.",
} as const;

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
    baseGrowth: {
      sectionVersion: 1,
      nations: {
        uk: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        germany: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        usa: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        japan: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        france: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        italy: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        russia: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        austria_hungary: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        spain: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        qing: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        ottoman_empire: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        netherlands: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        portugal: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
        brazil: { annualGrowthBp: 400, provenance: manualGrowthBandProvenance },
      },
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
    // The trade-protection section (W-1 slice 1, #997, Discussion #1010). The manual (pp.70-72) fixes the structure: a
    // required number of ships on protection duty, raiders that are not short range, an 8-knot floor for armed merchant
    // cruisers only, and no raiding effect from a nation that blockades the victim. It gives no numbers, so every value
    // is a PROVISIONAL Bluewave balance target. Removing this section returns the game to no trade warfare.
    tradeProtection: {
      sectionVersion: 1,
      fleetShareBp: 1000,
      resourcesPerRequiredShip: 2000,
      contributingHullTypes: [
        "destroyer",
        "corvette",
        "light_cruiser",
        "protected_cruiser",
        "heavy_cruiser",
        "armoured_cruiser",
        "armed_merchant_cruiser",
      ],
      raiderHullTypes: [
        "light_cruiser",
        "protected_cruiser",
        "heavy_cruiser",
        "armoured_cruiser",
        "armed_merchant_cruiser",
      ],
      amcHullType: "armed_merchant_cruiser",
      amcMinSpeedUms: 4_115_552,
      raiderHitBp: 1500,
      shortfallAmplifyBp: 5000,
      lossPerHitBp: 150,
      pressureChanceBp: 1500,
      pressureLossBp: 100,
      recoveryBpPerMonth: 50,
      revenueSensitivityBp: 5000,
      unrestThresholdBp: 1500,
      unrestCadenceMonths: 3,
      unrestStep: 1,
      raiderInterception: {
        interceptBaseBp: 500,
        interceptPatrolBp: 3000,
        breakoutInterceptBp: 4000,
        raiderSunkBp: 1500,
        maxEngagementDamageBp: 6000,
        scuttleThresholdBp: 3000,
        scuttleShareBp: 5000,
        fuelInternBp: 200,
        breakdownInternBp: 100,
        maxInterceptors: 4,
        amcSurprise: {
          chanceBp: 1500,
          startRangeM: 1200,
        },
      },
      submarineThreat: {
        hullType: "submarine",
        quotaPerBoatBp: 2500,
        attackBp: 800,
        lossPerHitBp: 120,
        blockadeReductionBp: 8000,
        aswEscortReductionBp: 2000,
        qShipReductionBp: 1000,
        unrestricted: {
          chanceMultiplierBp: 20000,
          incidentBp: 2000,
          neutralEntryBp: 10000,
        },
        fleetSupport: {
          chanceMultiplierBp: 0,
        },
        warshipAttack: {
          attackBp: 250,
          policyMultiplierBp: {
            FLEET_SUPPORT: 16_000,
            PRIZE_RULES: 10_000,
            UNRESTRICTED: 5000,
          },
          screenReductionBp: 7000,
          sunkBp: 1000,
          maxDamageBp: 4000,
          heavyHullTypes: ["dreadnought", "pre_dreadnought", "armoured_cruiser", "heavy_cruiser"],
          screenHullTypes: ["destroyer"],
        },
      },
      shortfallPrestige: {
        thresholdBp: 2500,
        lossBp: 100,
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
            page: "70-72",
            section:
              "Trade protection duty proportional to fleet and economy; raiders are not short range; AMC raiders need 8 knots; no raiding effect while blockading the enemy",
          },
        ],
        note: "PROVISIONAL. The shares, hit chances, losses, recovery, revenue sensitivity and unrest values are Bluewave balance targets awaiting the balance report; the submarineThreat and shortfallPrestige blocks (#1014) are balance targets too. The manual (p.70, p.36, p.71) fixes only that enemy submarines modify the requirement, that a blockading attacker sharply reduces the submarine effect and that a shortfall may cost prestige, so the per-boat quota share, the attack chance, the loss per hit, the blockade reduction, the shortfall threshold and the prestige loss (a share of current prestige each month in shortfall) are PROVISIONAL; aswEscortReductionBp (#1070) cuts the submarine attack chance by that share for each active trade-protection escort of a contributing hull type fitted with an anti-submarine attack capability, compounding per escort, and is a Bluewave balance target with no manual figure; qShipReductionBp (#1071) cuts the submarine attack chance by that share for each active armed merchant cruiser on trade protection duty, compounding per ship, and unrestricted (#1071) doubles the attack chance of a nation that has set the unrestricted policy (chanceMultiplierBp, applied before the 100 percent cap) and gives that nation a monthly chance (incidentBp) of one tension with each neutral or trade-agreement partner while it has an active submarine; all three are Bluewave balance targets with no manual figure; neutralEntryBp (#1100) is the monthly chance that a neutral or trade-agreement partner at tension 10 declares war on an active unrestricted raider; it is 10000, certain entry, following the authority-resolved owner decision on issue #413 that reaching tension 10 triggers an immediate war entry against the aggressor (manual p.36: unrestricted warfare angers neutral nations and risks bringing in additional enemies, the risk being incidents that raise tension to 10); a lower value makes entry a chance, see Discussion #1132; the draw replaces the shortfall-pressure stand-in; fleetSupport (#1099) multiplies the merchant attack chance of a nation that has set the fleet support policy by chanceMultiplierBp, applied in the same slot as the unrestricted multiplier: it is 0 (#1149), following the authority-resolved owner decision on issue #413 that fleet support hunts warships only, so a fleet support boat still draws against merchant shipping and always misses; the documented one-value alternative is 2500, a quarter of the prize rules chance, from manual p.35 (fleet support boats primarily operate against enemy warships and attack merchant shipping only in very clear cut cases), see Discussion #1136; quotaMultiplierBp is not authored, so the quota counts a fleet support boat in full as it does every other policy while its merchant chance is 0, which keeps the requirement independent of the enemy's choice of posture (PROVISIONAL, #1097); warshipAttack (#1159, consumer #1158, Discussion #1156) is the warship half of the submarine policies and is PROVISIONAL throughout: the manual (p.35, p.36, p.73) fixes only that fleet support boats primarily operate against enemy warships, that prize rules balance warships and merchants, that unrestricted warfare is at the expense of fleet support, and that the proportion of destroyers not on trade protection against heavier ships modifies submarine attacks on warships; it gives no figure for any magnitude, and the policy ratios 1.6 : 1 : 0.5 come from the combat table warship target weights 8000 : 5000 : 2500 (a parity test keeps them equal). attackBp 250 is the monthly hit chance per boat at prize rules with no destroyer screen, about a third of the 800 merchant chance, alternative one value 125 or 500; policyMultiplierBp FLEET_SUPPORT 16000, PRIZE_RULES 10000 and UNRESTRICTED 5000, alternative one value FLEET_SUPPORT 0 and UNRESTRICTED 0 to restrict the warship attack to prize rules; screenReductionBp 7000 is the largest cut from a full destroyer screen, alternative 5000 or 9000; sunkBp 1000 is the share of hits that sink the ship outright, alternative 500 or 2000; maxDamageBp 4000 is the largest hit point loss of a surviving hit as a share of maximum hit points, alternative 2500 or 6000; heavyHullTypes and screenHullTypes name the eligible targets and the screen, and the start fleet hull types battleship, battlecruiser, super_dreadnought, central_battery_ship and ironclad_turret_ship are not listed, alternative one value to add them; the unweighted quota and the 2500 alternative are Bluewave balance targets with no manual figure. Submarines are dormant by decision until W-2 (#410) makes the type buildable. The raiderInterception block (#1013) gives the monthly interception chance (base plus patrol coverage, or the breakout chance for a blockaded raider), the engagement sunk share and maximum damage, the scuttle threshold and share, and the monthly fuel and breakdown internment chances; the manual (pp.71-72) fixes only that patrols and blockades can intercept, that fuel exhaustion or breakdown can intern a raider and that a damaged raider may scuttle, so every magnitude is PROVISIONAL and the engagement stands in for the deferred tactical battle. amcSurprise (#1110) is an engineering value with no manual figure: the manual (p.72) says only that an armed merchant cruiser may deceive and surprise an intercepting ship so the battle starts at short range, so the 15 percent chance per intercepted AMC encounter, drawn once the tactical battle is queued, and the 1200 m starting separation are PROVISIONAL, taken from the Kormoran and HMAS Sydney 1941 close and the AMC contacts that failed to hold their disguise (Discussion #1126), with no time hold; the 4000 m and 120 s of #408 are not used. maxInterceptors is the interceptor force cap that was a code constant (4) and changes no behaviour. The 8-knot floor is 8 x 514444 um/s. resourcesPerRequiredShip is 2000 (#1042): at 400 the 1880 United Kingdom quota was 16 to 17 against 7 contributing hulls, and France and Russia also exceeded theirs; at 2000 every playable nation starts at no more than 75 percent of its contributing hulls and the quota still scales with the economy.",
      },
    },
    fleetMorale: {
      sectionVersion: 1,
      unpaidFundsLoss: 10,
      blockadeCrampedLoss: 3,
      longWarMonths: 12,
      recoveryPerMonth: 2,
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "13",
            section:
              "Running out of funds lowers prestige and affects fleet morale, as unpaid sailors tend to get surly",
          },
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "42",
            section:
              "Cramped accommodation: in a long war it can affect fleet morale if your nation is blockaded",
          },
        ],
        note: "PROVISIONAL. The manual names the two movers but gives no scale, magnitude, threshold for a long war or recovery rate. The meter runs 0 to 100 and starts full; all four values are Bluewave balance targets awaiting a sourcing pass. The meter has no downstream effect yet (#884).",
      },
    },
    // The unrest consequences section (#996, ADR-0240). Every value is a Bluewave balance target: manual p.62 names the
    // drivers and brakes, strikes and revolution but gives no scale or thresholds. Removing this section leaves unrest inert.
    unrest: {
      sectionVersion: 1,
      referenceRateBp: 2_000,
      spendingStepBp: 500,
      spendingMaxRise: 2,
      spendingMaxCut: 1,
      warOutbreakRelief: 1,
      warDurationMonths: 12,
      warDurationRise: 1,
      blockadeRise: 1,
      defeatRise: 1,
      victoryRelief: 1,
      crampedWarRise: 1,
      crampedBlockadeRise: 1,
      strikeThreshold: 7,
      strikeRateStepBp: 250,
      revolutionThreshold: 9,
      revolutionProbabilityBp: 1_500,
      liberalDemocracyDampingBp: 4_000,
      aftermathUnrest: 5,
      governmentAfterRevolution: {
        liberal_democracy: "communist",
        limited_democracy: "fascist",
        autocratic: "communist",
        fascist: "limited_democracy",
        communist: "autocratic",
        eastern: "limited_democracy",
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
            page: "60, 62",
            section:
              "Unrest drivers and brakes; strikes demand lower military budgets; revolution is less likely in liberal democracies; the government type can change, mostly through revolutions",
          },
        ],
        note: "BALANCE_TARGET under ADR-0240 decision 0010. The scale is 0 to 10 as stored; every threshold, magnitude and the revolution chance are tunable balance values, not sourced. A single month can raise unrest by at most a few points, so strikes need sustained pressure. The government table (#1018) is PROVISIONAL: the manual (p.60) says only that the government type can change, mostly through revolutions, and names no successor, so each AI revolution moves the nation to the listed type; omitting the table keeps the government.",
      },
    },
    researchReturns: {
      sectionVersion: 1,
      fullReturnShareBp: 1_000,
      aboveMarginalBp: 5_000,
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "16",
            section:
              "Research funding is limited by a share of revenue and the manual implies returns taper as the budget grows",
          },
          {
            title: "Bluewave design decision S-3 D7",
            section: "Diminishing research returns above a share of revenue (#1105)",
          },
          {
            title: "Bluewave research Discussion 1119",
            archiveOrUrl: "https://github.com/joaooliveira92/iron-tide/discussions/1119",
            section: "No published source fixes the size of the curve; the midpoint is chosen",
          },
        ],
        note: "BALANCE_TARGET, LOW confidence. Paid research spend up to 10 percent of revenue returns in full; each unit above it returns 50 percent. The 50 percent marginal rate is the midpoint of a plausible range and is not sourced; the alternative considered was 2500 (25 percent). The 12 percent funding cap stays a code constant. To reverse, remove this section: research is then linear again.",
      },
    },
    // The peace-behaviour section (#777, decisions 0054 and 0055). Every value is a PROVISIONAL Bluewave balance target:
    // the manual (p.66) describes peace but gives no acceptance rule or frequency. The margin is the 0055 placeholder
    // carried over from #554; the per-area cession costs are authored in areas.ts (#816). Removing this section returns AI
    // nations to never proposing peace and the player's peace terms to always succeeding.
    peaceBehaviour: {
      sectionVersion: 1,
      acceptanceScoreMargin: 20,
      proposalChanceBp: 3_000,
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "66",
            section: "Peace and possession choice",
          },
          {
            title: "Owner approval: peace placeholder values and per-area cession costs (#816)",
            archiveOrUrl: "https://github.com/joaooliveira92/iron-tide/issues/816",
          },
        ],
        note: "PROVISIONAL. The margin of 20 war-score points (decision 0055) and the monthly proposal chance of 30 percent once a side leads by the margin are Bluewave balance targets with no historical source (research: Discussion 815). Approved as BALANCE_TARGET / LOW placeholders by the coordinator on the owner's behalf under #816 (#708); a human should confirm.",
      },
    },
    // The AI war-declaration section (#995, SPRINT-PLAN A-1). The manual gives no rule for when an AI nation starts a war,
    // so both values are PROVISIONAL Bluewave balance targets: an AI at peace declares on the player once their tension
    // reaches 8 of 10 and the AI's naval budget is at least half the player's. Removing this section returns AI nations to
    // never declaring war.
    warDeclaration: {
      sectionVersion: 1,
      tensionThreshold: 8,
      minimumNavalStrengthRatioBp: 5_000,
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [
          {
            title: "Rule the Waves 3 manual",
            author: "Naval War Simulations / Matrix Games",
            year: 2023,
            page: "66",
            section: "Diplomacy and war",
          },
          {
            title: "Roadmap: what blocks a full playable game (A-1 slice 1)",
            archiveOrUrl: "https://github.com/joaooliveira92/iron-tide/issues/995",
          },
        ],
        note: "PROVISIONAL. Neither the tension threshold nor the strength ratio has a historical or manual source; both are Bluewave balance targets awaiting a playtest pass.",
      },
    },
    // The battle-offer section (T-1, spec #109). Every value is a Bluewave balance decision recorded by ADR-0254 (decision
    // requests 0028-0034, Option C): the manual (p.67) says each quantity exists but supplies no number. Retuning is a
    // ruleset version change with a golden re-pin. Removing this section returns the pack to the dormant behaviour.
    battleOffers: {
      sectionVersion: 1,
      // PROVISIONAL (#422): the smallest summed firepower per side in one area at which a fleet or cruiser battle can be
      // generated. The engine defaults (300 and 150) are unreachable in 1880, where a ship carries 12 to 34 firepower and no
      // nation holds more than 34 in one area. 15 is the largest value at which the weakest great-power home squadron
      // (Austria-Hungary, 15) can still be engaged; the cruiser value keeps the engine's 2 to 1 ratio, rounded up.
      engagementMinimumStrength: {
        fleetBattle: 15,
        cruiserBattle: 8,
      },
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
        note: "ADR-0254. The manual states that each quantity exists and supplies no number, model or rule; every value is a Bluewave balance target adopted by the owner's delegation (Research discussion #451, decisions 0028-0034).",
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
        service: {
          monthlyGrowth: 1,
          cap: 40,
        },
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
        // PROVISIONAL Bluewave balance target (see the section provenance note): the manual (p.53) says large fleet
        // exercises can raise tensions and (p.60) puts peacetime tension on a low scale, but gives no numbers. Four or
        // more exercising ships count as large; each neutral rival's tension rises one step, capped at the drift ceiling.
        tension: {
          minShips: 4,
          increase: 1,
          ceiling: 5,
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
            page: "51, 53, 55, 60",
            section:
              "Special training takes twelve months, at most two subjects, with maintenance surcharges; an annual fleet exercise costs twice the active maintenance (p.53) and large exercises can raise tensions (pp.53, 60); division experience has a slight impact on crew quality in battle",
          },
        ],
        note: "ADR-0283. The manual gives the twelve-month proficiency, the limit of two subjects, the training maintenance percentages and the doubled exercise cost; the cohesion and experience rates, the reorganisation penalties and the effect sizes of the unsourced subjects are Bluewave balance targets adopted by the owner's delegation (Research discussion #442). Service experience (#583): the manual (p.55) says experience generally goes up over time and gives no rate, so monthlyGrowth 1 and cap 40 are PROVISIONAL Bluewave balance targets with LOW confidence; the cap only stops this passive growth, never an exercise or battle gain, and removing divisionExperience.service restores the exercise-and-battle-only behaviour. ADR-0303: the manual (p.53) says Japan pays less for training and gives no figure; nationCostMultiplierBp is generic nation-keyed data, bounded to 5000-10000, and the japan entry of 8000 (a fifth off the added maintenance only) is a conservative balance target with LOW confidence. Exercise tension (#586): the manual says only that large exercises can raise tensions (pp.53, 60) with no threshold or size, so minShips 4, increase 1 and ceiling 5 (the tension-drift ceiling) are PROVISIONAL Bluewave balance targets with LOW confidence.",
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
      // #576, #838 (PROVISIONAL): a short nation loses prestige in proportion to the shortfall (manual p.62), but only for
      // areas a surplus ship could cover: an ACTIVE, unposted ship that is not needed to hold the area it sits in and is big
      // enough for the gap. Nothing is charged for the first 12 months (#860), nor to a nation held by an AI slot, which cannot post ships.
      shortfallPrestige: {
        lossBpPerWholeShortfall: 200,
        maxLossBp: 500,
        openingGraceMonths: 12,
        surplusShipsOnly: true,
      },
      // #826 (PROVISIONAL): each month that charges the shortfall above also raises the national unrest meter (0-10), under the same grace, surplus-ship and blockade gates. Manual p.46 says a shortfall "might even lead to revolts"; no magnitude is sourced.
      shortfallUnrest: { unrestPerShortMonth: 1 },
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
        note: "ADR-0266. The manual states that each quantity exists and supplies no number, model or rule; every value is a Bluewave balance target adopted by the owner's delegation (Research discussion #450, decisions 0016-0023, 0026).",
      },
    },
    terrain: {
      sectionVersion: 1,
      exclusionRadiusM: 600,
      maxVerticesPerPolygon: 16,
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [],
        note: "PROVISIONAL: the base exclusion radius and the vertex cap are Bluewave tuning placeholders for the first coastal set (#935). No source gives these values; set them once battle placement and movement consume terrain.",
      },
    },
    eventResolution: {
      sectionVersion: 1,
      defaultAnswerAfterMonths: 3,
      aiStanceWeightsBp: {
        liberal_democracy: { hawkBp: 2_500, doveBp: 5_500, neutralBp: 2_000 },
        limited_democracy: { hawkBp: 4_000, doveBp: 4_000, neutralBp: 2_000 },
        autocratic: { hawkBp: 5_000, doveBp: 3_000, neutralBp: 2_000 },
        eastern: { hawkBp: 4_500, doveBp: 3_500, neutralBp: 2_000 },
        fascist: { hawkBp: 6_000, doveBp: 2_000, neutralBp: 2_000 },
        communist: { hawkBp: 5_000, doveBp: 3_000, neutralBp: 2_000 },
      },
      traitShifts: [
        { trait: "cautious", stance: "hawk", deltaBp: -1_500 },
        { trait: "cautious", stance: "dove", deltaBp: 1_500 },
        { trait: "kamikaze", stance: "hawk", deltaBp: 2_000 },
        { trait: "kamikaze", stance: "dove", deltaBp: -2_000 },
      ],
      answerEffects: {
        budgetDecayMonths: 12,
        budgetStackCapBp: 1_500,
        tensionJumpCap: 3,
        traitEffects: [
          { trait: "cautious", stance: "hawk", reasonCode: "CAUTIOUS_HAWK_RESTRAINT", tension: -1 },
          { trait: "kamikaze", stance: "hawk", reasonCode: "KAMIKAZE_HAWK_ZEAL", prestige: 1 },
          {
            trait: "inconsistent_naval_policy",
            stance: "dove",
            reasonCode: "POLICY_DRIFT_DOVE",
            unrest: 1,
          },
        ],
      },
      provenance: {
        sourceStatus: "BALANCE_TARGET",
        confidence: "LOW",
        kind: "balance_adjustment",
        sources: [],
        note: "PROVISIONAL: default-answer delay, AI stance weights, trait shifts and answer-effect caps are Bluewave tuning placeholders for the first 1880 event catalogue (#436). No source gives these values; set from the generated balance report once the catalogue is tuned. The fascist and communist rows are required by the schema and unused in the 1880 pack.",
      },
    },
  },
]);
