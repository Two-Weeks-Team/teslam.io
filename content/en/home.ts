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
    realLabel: "real figure",
    sampleLabel: "sample",
  },

  hero: {
    badge: "Tesla owners, Korea",
    h1: "This is where the owners are.",
    h1b: "Distance driven does not lie.",
    sub: "Link a Tesla account once and you are done. While the car moves, the odometer reports every 60 seconds, proves your kilometres for you, and accrues them as DRV. No developer account, no API bill.",
    ctaPrimary: "Join Genesis 500",
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
    note: "500 vehicles, first come. We ask for an email and a car; never a location or a VIN.",
  },

  density: {
    title: "Who is near you",
    sub: "Confirmed seats by region. A province the registrant chose, never a coordinate.",
    note: "A schematic, not a projection. Registrants leave no coordinates, so the only thing this drawing can honestly say is how many people are in each region. A league needs faces you recognise and a redemption partner needs to be somewhere you already drive — which makes this distribution matter more than the national total.",
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

  live: { title: "Live", auto: "auto-refresh" },

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
