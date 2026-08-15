import type { ModelContent } from "@/content/ko/model";

/**
 * English mirror. Korean is the source of truth for the shape — a missing or
 * misspelled key here is a compile error, not a silently untranslated string.
 *
 * This is written for partners, advertisers and insurers reading the model,
 * not for drivers. The Korean page is the one that recruits.
 */
export const model: ModelContent = {
  meta: {
    title: "teslam.io — drive-to-earn for Tesla owners in Korea",
    description:
      "A drive-to-earn platform that verifies driving through the Tesla Fleet API and rewards it in DRV. No developer account, no API bill for the owner. Genesis 500 now forming.",
    ogAlt: "teslam.io — DRV accruing over a driving instrument cluster",
  },

  nav: {
    skip: "Skip to content",
    localeLabel: "KO",
    localeHref: "/",
    cta: "Genesis 500",
  },

  hero: {
    eyebrow: "teslam.io — Tesla owners, Korea",
    h1: "Distance driven, credited as it happens.",
    sub: "No developer account to create, no API bill to pay. One Tesla sign-in and driving is verified and credited in DRV. teslam.io carries the Fleet API cost in full.",
    stats: [
      { value: "4", label: "signals collected" },
      { value: "60s", label: "sampling interval" },
      { value: "500", label: "Genesis seats" },
    ],
    vizLegend:
      "Signals flow only while the car is moving. Two every minute — speed and odometer. No coordinate is requested. DRV accrues strictly against the odometer delta.",
    vizHint: "illustrative",
    live: "receiving",
    idle: "parked · no telemetry",
  },

  how: {
    eyebrow: "01 — How it works",
    h2: "Sign in once. After that, just drive.",
    lede: "From the moment a vehicle is linked, teslam.io pays Tesla directly for its telemetry. There is no step where an owner registers on a developer portal or attaches a payment method.",
    steps: [
      {
        k: "01",
        t: "Link the Tesla account",
        d: "Official OAuth. Credentials never pass through teslam.io, and access can be revoked at any time from the Tesla account itself.",
      },
      {
        k: "02",
        t: "Receive only while moving",
        d: "Fleet Telemetry pushes signals only while the vehicle is in motion. Parked, nothing is transmitted and nothing is billed.",
      },
      {
        k: "03",
        t: "Verify, then credit DRV",
        d: "Credited only when the odometer advances and agrees with speed and route. 10 DRV per km, capped at 500 DRV a day.",
      },
    ],
  },

  telemetry: {
    eyebrow: "02 — What is collected",
    h2: "Two signals. Nothing beyond them is requested.",
    lede: "Collection scope is a trust question before it is a cost question. The spec is the minimum that can prove a drive, and permissions outside that list are never requested at all.",
    signalsTitle: "Collected",
    signals: [
      { code: "SPD", t: "Vehicle speed", d: "physical-plausibility check" },
      { code: "ODO", t: "Odometer", d: "the sole basis for reward" },
    ],
    notTitle: "Not collected",
    not: [
      "Camera footage or Autopilot perception data",
      "Occupant identity or contacts",
      "Charging and payment methods",
      "Any vehicle control — doors, climate, drive",
      "Location while parked",
    ],
    costTitle: "Which puts the API cost per vehicle at",
    costFormula: "4 signals × once per minute × 1 driving hour per day",
    costNote:
      "This is why the spec samples per minute rather than streaming per second. It keeps the resolution a drive needs to be verified while cutting signal count by a factor of sixty.",
    perDay: "per day",
    perMonth: "per vehicle · month",
    signalsPerDayLabel: "signals/day",
    fxLabel: "Rate applied",
    fxLive: "European Central Bank reference · refreshed hourly",
    fxFallback: "Whitepaper assumption · used because the reference lookup failed",
    fxNote:
      "Won figures are converted at the rate above. The reference rate is published once each working day, so this page follows a new one within the hour.",
    creditNote:
      "Tesla grants a {credit} monthly credit per developer account, which is deliberately left out of the arithmetic above. A real invoice may therefore be lower than shown — the figure is kept conservative so that a change in credit policy cannot undermine the argument on this page.",
  },

  tokens: {
    eyebrow: "03 — Two tokens",
    h2: "What you earn and what you hold are separate.",
    lede: "A single reward token loses value as mining rises, until it becomes a point nobody wants. So the design splits a utility token issued daily from an asset token with a fixed supply.",
    drv: {
      tag: "utility · reward",
      name: "DRV",
      full: "Drive Utility Token",
      d: "Issued by driving alone. Supply is uncapped, but daily mining is throttled dynamically against distance and efficiency score.",
      rows: [
        { k: "Base reward", v: "10 DRV per km" },
        { k: "Daily cap", v: "500 DRV (about 50 km)" },
        { k: "Peg", v: "1,000 DRV = ₩500 in goods" },
        { k: "Total supply", v: "uncapped · governed by daily cap" },
      ],
    },
    tslm: {
      tag: "governance · asset",
      name: "TSLM",
      full: "teslam.io Governance Token",
      d: "Driving does not produce it. It is distributed for locking DRV up over a period, or for substantive technical writing in the community.",
      rows: [
        { k: "Total supply", v: "100,000,000 fixed" },
        { k: "Earned by", v: "lock-up · staking · contribution" },
        { k: "Grants", v: "ad placement · community vote" },
        { k: "Further issuance", v: "none" },
      ],
    },
    flowTitle: "How the token moves",
    flow: {
      source: "Driving",
      verify: "Verification",
      mint: "DRV minted",
      outs: [
        { t: "Redeemed", d: "gift cards · Supercharger credit" },
        { t: "Staked", d: "lock-up → TSLM distribution" },
        { t: "Burned", d: "badges · vehicle cosmetics" },
      ],
    },
  },

  sinks: {
    eyebrow: "04 — Where the token goes to die",
    h2: "A design with only withdrawals always collapses.",
    lede: "If every token earned leaves as cash, no reward model survives. DRV exits circulation three ways, and only one of them actually spends company money.",
    kinds: {
      cash: { t: "Cash leaves", d: "A partner has to be settled with. B2B commission is the only thing that offsets it." },
      burn: { t: "Costs nothing", d: "Digital goods have no cost of service. The only sink that scales for free." },
      defer: { t: "Deferred", d: "Not cash out this month, but a liability owed in a later one." },
    },
    items: {
      charging: { t: "Supercharger credit", d: "settled with a charging partner" },
      giftcard: { t: "Gift cards", d: "coffee, convenience, small denominations" },
      carwash: { t: "Car wash · tint coupons", d: "local partner outlets" },
      cosmetic: { t: "Vehicle cosmetics", d: "in-app digital goods" },
      badge: { t: "Digital badges", d: "driving tiers · limited marks" },
      staking: { t: "TSLM staking", d: "lock-up, then governance distribution" },
    },
    mixTitle: "Assumed redemption mix",
    mixNote:
      "These three shares are the most important and least validated numbers in the model. Every point that moves into cash redemption raises the break-even by the same amount.",
    burnLabel: "burned in-app",
    cashLabel: "redeemed for goods",
    stakeLabel: "staked",
  },

  economics: {
    eyebrow: "05 — What one vehicle costs",
    h2: "The API bill is a third of it.",
    lede: "The constraint on this business is not what Tesla charges. It is what the driver is paid. The two figures below come out of the same model; one of them is quoted often and the other is not.",
    ledgerTitle: "per vehicle · month",
    rows: {
      api: { k: "Tesla Fleet API", d: "120 signals/day × 30 days" },
      issued: { k: "DRV issued, at face value", d: "at average monthly distance" },
      burned: { k: "Burned in-app", d: "digital goods · no cost of service" },
      deferred: { k: "Staked, deferred", d: "not cash this month" },
      cash: { k: "Redeemed for goods", d: "requires real settlement" },
      commission: { k: "Partner commission recovered", d: "none contracted yet" },
      net: { k: "Net reward cost", d: "redeemed − commission" },
      total: { k: "Cash out, per vehicle · month", d: "API + net reward cost" },
    },
    shareNote: "API fees as a share of total cash out",
    breakevenTitle: "Break-even",
    breakevenNote:
      "Every vehicle has to generate at least this much revenue a month — data, advertising and partner commission combined. Clearing this line is the entire business.",
    genesisTitle: "What Genesis 500 actually costs",
    genesisQuoted: "the quoted figure · API only",
    genesisTrue: "actual outlay, reward included",
    genesisNote:
      "Genesis members earn 1.5× the base reward. Counting API fees alone gives about ₩500,000 a month; including the rewards paid out makes it four times that. The cohort is capped at 500 because of this number, not the API bill.",
    assumedTag: "assumed",
    givenTag: "specified",
  },

  revenue: {
    eyebrow: "06 — What covers it",
    h2: "Four revenue lines can clear the break-even.",
    lede: "None of them is contracted. This is not a record of results — it is the list of things that must be closed for the line above to be cleared.",
    notContracted: "not contracted",
    lines: {
      commission: {
        t: "Partner settlement commission",
        d: "B2B commission paid when an owner redeems DRV for charging credit or a gift card. Cash arrives at the moment the token burns, so outlay and revenue land in the same period.",
        stage: "months 3–5",
      },
      adverts: {
        t: "Local advertising",
        d: "Banner and token partnerships with car washes, tint shops and EV parts retailers. The product is verified owner traffic with confirmed purchasing power.",
        stage: "months 3–5",
      },
      dataset: {
        t: "Anonymised datasets",
        d: "Real-world efficiency, tyre-wear prediction, regional EV movement. Buyers are EV insurers and charging infrastructure operators. No personally identifying data is included.",
        stage: "month 6+",
      },
      usedcar: {
        t: "Certified used-vehicle data",
        d: "Used-car platform partnerships built on verified ownership and driving history.",
        stage: "month 6+",
      },
    },
  },

  roadmap: {
    eyebrow: "07 — Rollout",
    h2: "It does not open all at once.",
    lede: "When the operator carries every cost centrally, uncontrolled sign-ups make the growth curve and the loss curve the same curve. Seats are counted out.",
    phases: {
      genesis: {
        t: "Genesis 500",
        d: "A closed beta of the first 500 owners from the Tesla community. The goal is not growth — it is proving the verification algorithm and the settlement pipeline hold.",
        bullets: ["1.5× base reward", "Genesis cohort mark", "Vote on tokenomics changes"],
      },
      quests: {
        t: "Proof-of-ownership quests",
        d: "Quests that use what is specific to a Tesla rather than just distance. Drive cards share to the community in one click, so a screenshot becomes the acquisition path.",
        bullets: ["Beat 7.0 km/kWh efficiency", "Check in at a V4 Supercharger", "One-click share card"],
      },
      open: {
        t: "Open beta",
        d: "Sign-up limits come off, but only after a monthly total reward pool cap is in place. The spend ceiling is fixed as a number before the door opens.",
        bullets: ["Monthly reward pool cap", "Data business begins", "Used-car platform partnership"],
      },
    },
    statusNext: "next",
    statusPlanned: "planned",
    seatsLabel: "seats",
  },

  integrity: {
    eyebrow: "08 — How a drive is trusted",
    h2: "GPS can be spoofed. An odometer is harder.",
    lede: "That is why reward is based on the vehicle's own reported cumulative distance rather than position. Coordinates are used for cross-checking, never for calculating the reward.",
    checks: [
      {
        t: "Monotonic odometer",
        d: "Cumulative distance cannot decrease. If the value rewinds or jumps abnormally, the whole segment is discarded.",
      },
      {
        t: "Speed–distance agreement",
        d: "If the distance delta between two samples is not physically consistent with reported speed, nothing is credited.",
      },
      {
        t: "Route continuity",
        d: "If minute-spaced coordinates do not connect over the road network, the segment is held for human review.",
      },
      {
        t: "Daily ceiling",
        d: "500 DRV a day. Even a segment that passes verification is bounded in what it can take.",
      },
      {
        t: "One VIN, one account",
        d: "A vehicle binds to a single account. The same car cannot accrue on several accounts at once.",
      },
    ],
    privacyTitle: "Privacy",
    privacyNote:
      "Once a drive is verified, raw coordinates are replaced by a segment summary rather than retained. Datasets sold B2B contain no personally identifying data and no raw coordinates. Access can be revoked directly and immediately from the Tesla account.",
  },

  cta: {
    eyebrow: "Genesis 500",
    h2: "The first cohort is 500 owners.",
    body: "A closed beta. It carries 1.5× the base reward, the Genesis cohort mark, and a vote whenever the tokenomics change.",
    button: "Register interest",
    note: "500 vehicles, first come. Registration happens on an external form; this site stores no personal data.",
  },

  footer: {
    line: "Distance driven, credited as it happens.",
    contactLabel: "Contact",
    repoLabel: "Source of this site",
    snapshot: "Model as of",
    disclaimerTrademark:
      "teslam.io is an independent community project, not affiliated with or endorsed by Tesla, Inc. Tesla and Supercharger are trademarks of Tesla, Inc.",
    disclaimerFinancial:
      "Every figure on this page is the output of an operating model. It is not investment advice and not a guarantee of return. DRV and TSLM have not been issued, and the design may change.",
    rights: "teslam.io",
  },
};
