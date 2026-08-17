import type { HomeContent } from "@/content/ko/home";

/**
 * English mirror of the community front page. Korean is the source of truth
 * for the shape — a missing or misspelled key here is a compile error, not a
 * silently untranslated string.
 */
export const home: HomeContent = {
  meta: {
    title: "teslam.io — where Korea's Tesla owners gather",
    description:
      "A Tesla owner community where distance driven accrues as you go. Efficiency league, build photos, software threads, and DRV for driving. Genesis 500 now forming.",
  },

  nav: {
    skip: "Skip to content",
    localeLabel: "KO",
    localeHref: "/",
    cta: "Genesis 500",
    model: "Operating model",
    online: "online",
    people: "",
  },

  preview: {
    tag: "Not open yet",
    body: "The service has not launched. Seats confirmed, the regional split and the number of people watching are real figures; the posts, rankings and wallet entries below are sample content showing what the board looks like populated.",
    demoTag: "Simulation",
    demoBody:
      "The seat count and regional split on screen are a simulation being played back. They are not real registrations. Stopping returns the real figures.",
    realLabel: "real figure",
    sampleLabel: "sample",
    countStale: "The count could not be loaded — the figures below are not current.",
  },

  hero: {
    badge: "Tesla owners, Korea",
    // "Where the owners are" was what the site called itself, not something a
    // visitor could check. There is exactly one claim here that is checkable:
    // the numbers on this page were made by a car, not by an app.
    h1: "Driving is",
    h1b: "the proof.",
    sub: "Link a Tesla account once and drive as you already do. While the car moves, the odometer reports every 60 seconds, proves your kilometres for you, and accrues them as DRV. No developer account, no API bill.",
    ctaPrimary: "Join Genesis 500",
    ctaPrimaryClosed: "What Genesis 500 is",
    ctaSecondary: "How does it accrue?",
  },

  genesis: {
    title: "Genesis 500 — first cohort",
    seatTaken: "taken",
    seatLeft: "left",
    yours: "your seat",
    seatGridLabel: "Seats filled out of 500",
    perks: [
      "1.5× base reward, permanently",
      "Genesis cohort profile mark",
      "A vote on tokenomics changes",
    ],
    cta: "Take a seat",
    ctaClosed: "What Genesis 500 is",
    empty: "All 500 seats are empty",
    emptyFirst: "the first is #001",
    note: "500 vehicles, first come. We keep an email, a car, the region you pick and a record of your consent. Pre-registration takes no coordinate and no VIN.",
  },

  demo: {
    play: "Watch it fill",
    stop: "Stop, back to real",
    flag: "Simulation running — these figures are not real registrations",
    hint: "You can play through the 500 seats filling. Stopping returns the real numbers.",
  },

  routes: {
    eyebrow: "Where it went",
    title: "The roads this car used today",
    sub: "Dozens of cars moving across the real road network at once. Zoom in and you can see the lane.",
    flag: "Illustrative drive — not a registrant's travel history",
    play: "Play the drive",
    pause: "Pause",
    running: "driving now",
    closeUp: "Zoom right in",
    distance: "Driven",
    earned: "Earned",
    worth: "Redeemable for",
    failed: "The map could not be loaded.",
    foot: "Routes are illustrative, taken from the OpenStreetMap road network. teslam.io does not collect coordinates, routes or trip history. The distance and the reward, though, are the real calculation — the same figures the operating model uses.",
  },

  quests: {
    eyebrow: "This week's quests",
    title: "What to do to earn",
    sub: "Distance verifies itself. Quests are the bonus that sits on top.",
  },

  badges: {
    eyebrow: "The case",
    title: "What you have taken so far",
    sub: "opened by driving, nothing else",
    earned: "earned",
    locked: "not yet",
  },

  shopcase: {
    eyebrow: "Redemption",
    title: "What this actually buys",
    sub: "Where accrued DRV turns into something you can hold.",
    canBuy: "affordable now",
    short: "short by",
    foot: "Redeeming burns the DRV, and the partner's commission is what pays the API bill. The won conversion uses the operating model's peg exactly.",
  },

  carCredit: "Vehicle 3D model",

  signals: {
    eyebrow: "What travels",
    title: "Two, and only while it moves.",
    sub: "A parked car sends nothing. While the wheels turn, two signals go up once a minute — and exactly one of them decides what is earned. Neither is a coordinate.",
    car: "Your car",
    moving: "only while moving",
    everySeconds: "s apart",
    pays: "sets the accrual",
    checks: "cross-check only",
    codes: {
      vehicleSpeed: "SPD",
      odometer: "ODO",
    },
    names: {
      vehicleSpeed: "Vehicle speed",
      odometer: "Odometer",
    },
    parked: {
      title: "Parked is zero signals",
      body: "Nothing leaves the car once it is switched off. What this site knows is that you drove, and how far — that is the whole of it.",
    },
    oneWay: {
      title: "An odometer only counts up",
      body: "It cannot be rewound, so the difference between two readings is the distance. Invent all the coordinates you like; this number will not move.",
    },
    foot: "{n} signals, 60 seconds apart. The cost per car, worked through, is in",
    footLink: "the operating model",
  },

  proof: {
    eyebrow: "Verification",
    title: "GPS can be faked. An odometer cannot.",
    sub: "A league only works if the record cannot be manufactured. That is why this site does not use GPS.",
    gps: {
      tag: "Scored on a GPS trace",
      claim: "The coordinates the app sent are the score",
      items: [
        "Mock-location apps can invent the coordinates",
        "Laps of a car park accumulate distance",
        "Hard to tell from a bicycle or a walk",
        "You have to trust the trace the app sent",
      ],
    },
    odo: {
      tag: "Scored on the odometer",
      claim: "The car reports its own dashboard number",
      items: [
        "It is the vehicle's own record; no app sits in between",
        "Only the difference between two readings counts, so it cannot be rewound",
        "It moves only if that car actually moved",
        "The odometer difference alone sets what is earned",
      ],
    },
    // It can now be written that coordinates are never collected — a sentence
    // that was unavailable for a long time, because while the operating model
    // read latitude and longitude once a minute it was simply false. Tesla
    // separated `vehicle_location` out of `vehicle_device_data` in late 2024
    // and the odometer sits in `Vehicle State`, so the site can decline
    // location outright and still earn. The sentence did not get stronger; the
    // system did, which is the only order in which that is honest.
    foot: "Two signals once a minute. No coordinate is requested and none is received — the odometer difference alone sets what is earned. The costs are worked through in",
    footLink: "the operating model",
  },

  onboard: {
    eyebrow: "Getting started",
    title: "Three steps onto the board",
    sub: "No developer account, no API bill, no hardware to fit.",
    steps: [
      { title: "Link a Tesla account", body: "One official sign-in. Your password never reaches us." },
      { title: "Pick the car", body: "Choose one of the cars on the account. You never type a VIN — it arrives with the sign-in." },
      { title: "Just drive", body: "While the car moves the odometer reports every 60 seconds. Up to {km}km a day, which is at most {drv} DRV." },
    ],
    cta: "What Genesis 500 is",
    note: "Only pre-registration is open. Linking begins when the closed beta does.",
  },

  nameplate: {
    eyebrow: "My garage",
    title: "What you drove becomes a nameplate",
    sub: "Not a profile — a record. Built to be shown to someone.",
    awaitingSeat: "NO GENESIS SEAT",
    odo: "Total distance",
    best: "Best efficiency",
    since: "Since",
    foot: "Every figure on the plate comes from odometer-verified segments only.",
  },

  streak: {
    eyebrow: "Streak",
    title: "Breaking it stings",
    sub: "The last 30 days. The gaps are the point of the picture.",
    current: "Current",
    best: "Best",
    dayUnit: "d",
  },

  ladder: {
    eyebrow: "Tiers",
    title: "Bronze to Teslam",
    sub: "Climbed on accrued DRV alone. No tier is for sale.",
    start: "start",
    at: "At",
    foot: "keep driving and the next one arrives.",
    // Tier names and perks are display strings, so they live per locale.
    // data/community.json keeps only the identifier and the threshold — Korean
    // left in there renders verbatim on /en.
    tiers: {
      bronze: { name: "Bronze", perk: "Base accrual" },
      silver: { name: "Silver", perk: "Double weekly quests" },
      gold: { name: "Gold", perk: "First call at the exchange" },
      teslam: { name: "Teslam", perk: "Hall of fame · governance vote" },
    },
  },

  stake: {
    eyebrow: "TSLM",
    title: "Lock it up and it becomes a vote",
    sub: "DRV is the money you spend. TSLM is the say in how this board is run.",
    flow: [
      { title: "Lock DRV for 30 days", body: "While it is locked it cannot be redeemed." },
      { title: "TSLM comes out", body: "Supply is fixed at 100 million. None is ever minted beyond it." },
      { title: "Use the vote", body: "On reward rates, caps and redemption partners. It also carries ad placement." },
    ],
    warn: "DRV and TSLM have not been issued. This section describes a design; it is not investment advice and not a guarantee of return.",
  },

  density: {
    title: "Who is near you",
    sub: "Confirmed seats by region. A province the registrant chose, never a coordinate.",
    empty: "No registrations in any region yet",
    emptySub: "The first one is the first light on this map.",
    note: "Real administrative boundaries, merged into the seven regions the form asks about. Registrants leave no coordinates, so the finest thing this map can honestly say is still how many people are in each region. A league needs faces you recognise and a redemption partner needs to be somewhere you already drive — which makes this distribution matter more than the national total.",
  },

  league: {
    eyebrow: "Efficiency league",
    title: "Where would you place this week?",
    sub: "Only odometer-verified runs make the table. GPS does not count.",
    weekLabel: "week",
    closesIn: "closes in",
    days: "d",
    cols: {
      pos: "POS",
      driver: "Driver",
      region: "Region",
      eff: "Efficiency",
      km: "Distance",
      drv: "DRV",
      streak: "Streak",
    },
    omitted: "more",
    yourRow: "Your seat — ??",
    yourRowNote: "Link a car and your name lands here",
    all: "Full table",
    replay: "Replay the week's moves",
    fromLastWeek: "vs last week",
    unit: "km/kWh",
    dayUnit: "d",
  },

  feed: {
    eyebrow: "The board",
    title: "Posted just now",
    tabs: { hot: "Hot", latest: "New", shots: "Photos", quest: "Quests" },
    pinned: "Pinned",
    staff: "Staff",
    newPosts: "new",
    lastHour: "past hour",
    more: "More posts",
    views: "views",
    comments: "comments",
    // The real board.
    pageTitle: "The board",
    pageDescription:
      "Written by Tesla owners, on top of driving records verified by the odometer.",
    shown: " shown",
    loading: "Loading…",
    empty: "No first post yet. The board is open.",
    vote: "Upvote",
    voteSignedOut: "Confirm a seat to vote",
    exampleTitle: "What it looks like once it fills up",
  },

  compose: {
    placeholder: "What is worth saying?",
    signedOut: "Writing is for confirmed Genesis seats.",
    signedOutCta: "About the seats",
    boardLabel: "Choose a board",
    titleLabel: "Title",
    titlePlaceholder: "Title",
    bodyPlaceholder: "Write your post.",
    bodyLabel: "Body",
    submit: "Post",
    sending: "Posting…",
    cancel: "Cancel",
    tooMany: "Try again shortly — that is more posts than an hour allows.",
    failed: "That did not post. Try again shortly.",
  },

  post: {
    backToBoard: "The board",
    vote: "Upvote",
    voteSignedOut: "Confirm a seat to vote",
    replies: "Replies",
    noReplies: "Be the first to reply.",
    reply: "Reply",
    replyLabel: "Your reply",
    replyPlaceholder: "Write a reply.",
    replySignedOut: "Replying is for confirmed Genesis seats.",
    replySignedOutCta: "About the seats",
    sending: "Posting…",
    tooMany: "Try again shortly.",
    failed: "That did not post. Try again shortly.",
  },

  side: {
    boards: "Boards",
    regions: "Regions",
    ranking: "Rankings",
    rankingItems: ["Weekly efficiency", "Weekly distance", "Hall of fame"],
  },

  wallet: {
    title: "My DRV wallet",
    balance: "Available balance",
    worth: "Redeemable for about",
    todayCap: "Earned today",
    capNote: "Capped at 50 km a day. The rest keeps for tomorrow.",
    ledgerTitle: "Activity",
    ledgerNote: "Only odometer-verified segments are recorded",
    shopTitle: "What it buys",
    shopNote:
      "Redeeming burns the DRV, and the partner's commission is what pays the API bill.",
    tslmTitle: "Lock DRV up",
    tslmNote:
      "Lock DRV for 30 days and it yields TSLM. Supply is fixed at 100 million, and it carries ad placement and a vote.",
    connect: "Link a Tesla account",
  },

  live: {
    title: "Live",
    auto: "auto-refresh",
    // Prose, so it lives per locale. Held in shared JSON it rendered in Korean
    // on /en, where nobody developing in Korean would ever have seen it.
    items: [
      { t: "V4 Supercharger check-in in Busan · 배터리아껴쓰기", v: "+500 DRV" },
      { t: "완충맨 hit today's 500 DRV ceiling in Ulsan", v: "MAX" },
      { t: "판교뉴비 verified 14km, Songpa to Pangyo", v: "+140 DRV" },
      { t: "흰색롱레인지's Model X LR review was picked", v: "+120 TSLM" },
      { t: "강남언니Y cleared the efficiency quest at 8.2km/kWh", v: "Quest" },
      { t: "판교뉴비 verified 25km on Jeju", v: "+250 DRV" },
    ],
  },

  footer: {
    line: "A Tesla owner community where distance driven accrues as you go.",
    contactLabel: "Contact",
    repoLabel: "Source of this site",
    modelLabel: "The operating model and its costs",
    snapshot: "Data as of",
    disclaimerTrademark:
      "teslam.io is an independent community project, not affiliated with or endorsed by Tesla, Inc. Tesla and Supercharger are trademarks of Tesla, Inc.",
    disclaimerFinancial:
      "DRV and TSLM have not been issued. Figures on this page are model output or illustrative samples; they are not investment advice and not a guarantee of return.",
    rights: "teslam.io",
  },
};
