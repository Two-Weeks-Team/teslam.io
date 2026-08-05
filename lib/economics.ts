import model from "@/data/model.json";

/**
 * Every figure on this site is derived here, from `data/model.json`, at build
 * time. Nothing is hardcoded into a component and nothing is fetched at
 * runtime, so the number a reader sees and the number the model holds cannot
 * drift apart.
 *
 * The order below is the argument the site makes, in sequence:
 *
 *   1. What one vehicle costs in Tesla Fleet API fees.        (small)
 *   2. What one vehicle earns in DRV.                         (large)
 *   3. How much of that reward is actually cash leaving.      (the real cost)
 *   4. What therefore has to come in per vehicle to survive.  (the whole business)
 *
 * The brief this was built from framed step 1 as the constraint. It is not.
 * `apiShareOfCashCost` below is the reason, and the site says so out loud
 * rather than quietly reporting a smaller number.
 */

const { given, assumed } = model;

/* ── 1. Telemetry and what Tesla charges for it ───────────────────────── */

/** Latitude, longitude, vehicle speed, odometer. */
export const signalCount = given.signals.length;

/** One sample per minute → 60 per driving hour. */
export const samplesPerHour = 3600 / given.samplingIntervalSeconds;

/** 4 signals × 60 samples × 1 driving hour = 240. */
export const signalsPerDay =
  signalCount * samplesPerHour * given.assumedDriveHoursPerDay;

export const apiUsdPerDay = signalsPerDay * given.pricePerSignalUsd;
export const apiUsdPerMonth = apiUsdPerDay * given.daysPerMonth;
export const apiKrwPerMonth = apiUsdPerMonth * assumed.fxKrwPerUsd;

/* ── 2. What the driver earns ─────────────────────────────────────────── */

/** The peg: 1,000 DRV is worth 500 KRW of real goods, so 1 DRV = 0.5 KRW. */
export const krwPerDrv = given.pegKrw / given.pegDrv;

/** The daily cap expressed as distance — the point a cherry-picker stops earning. */
export const cappedKmPerDay = given.dailyCapDrv / given.drvPerKm;

/** A driver who hits the cap every single day. The worst case for the treasury. */
export const capKrwPerDay = given.dailyCapDrv * krwPerDrv;
export const capKrwPerMonth = capKrwPerDay * given.daysPerMonth;

export const avgKmPerDay = assumed.avgKmPerMonth / given.daysPerMonth;

/** The cap binds before the average driver reaches it, which is the intent. */
export const earnedDrvPerDay = Math.min(
  avgKmPerDay * given.drvPerKm,
  given.dailyCapDrv,
);

/** Face value of DRV issued to one average vehicle per month. */
export const rewardKrwPerMonth =
  earnedDrvPerDay * krwPerDrv * given.daysPerMonth;

/* ── 3. Issued ≠ spent. Only one of these three costs money ───────────── */

const mix = assumed.redemptionMix;

/** Redeemed for chargers, gift cards, car washes. Real money leaves. */
export const cashRedeemedKrwPerMonth = rewardKrwPerMonth * mix.cashBacked;

/** Burned on badges and cosmetics. Costs nothing to serve — the free sink. */
export const burnedKrwPerMonth = rewardKrwPerMonth * mix.burnedInApp;

/** Locked up for TSLM. Not a cash cost this month; a liability for a later one. */
export const deferredKrwPerMonth = rewardKrwPerMonth * mix.stakedToTslm;

/** B2B commission the partner pays back when a driver redeems with them. */
export const commissionRecoveredKrwPerMonth =
  cashRedeemedKrwPerMonth * assumed.partnerCommissionRate;

export const netRewardKrwPerMonth =
  cashRedeemedKrwPerMonth - commissionRecoveredKrwPerMonth;

/* ── 4. The bottom line ───────────────────────────────────────────────── */

/** Everything that actually leaves the bank account for one vehicle, per month. */
export const cashCostPerVehicleMonth = apiKrwPerMonth + netRewardKrwPerMonth;

/**
 * The correction this site is built around. The API bill is roughly a third of
 * the true cost of carrying a vehicle; the reward is the rest. Optimising the
 * telemetry spec further cannot save a model whose reward curve is wrong.
 */
export const apiShareOfCashCost = apiKrwPerMonth / cashCostPerVehicleMonth;

/** Revenue per vehicle per month at which the fleet stops losing money. */
export const breakevenKrwPerVehicleMonth = cashCostPerVehicleMonth;

/* ── 5. Genesis 500, priced honestly ──────────────────────────────────── */

export const genesisSeats = given.genesisSeats;
export const genesisMultiplier = given.genesisRewardMultiplier;

/** The figure the brief quotes: 500 vehicles of API fees, and nothing else. */
export const genesisApiKrwPerMonth = apiKrwPerMonth * genesisSeats;

const genesisRewardKrwPerMonth = rewardKrwPerMonth * genesisMultiplier;
const genesisCashRedeemed = genesisRewardKrwPerMonth * mix.cashBacked;
const genesisNetReward =
  genesisCashRedeemed * (1 - assumed.partnerCommissionRate);

export const genesisPerVehicleKrwPerMonth = apiKrwPerMonth + genesisNetReward;

/** What Genesis 500 actually costs to run, reward included. */
export const genesisTotalKrwPerMonth =
  genesisPerVehicleKrwPerMonth * genesisSeats;

/* ── Token supply ─────────────────────────────────────────────────────── */

export const tslmTotalSupply = given.tslmTotalSupply;
export const drvPerKm = given.drvPerKm;
export const dailyCapDrv = given.dailyCapDrv;
export const pegDrv = given.pegDrv;
export const pegKrw = given.pegKrw;
export const samplingIntervalSeconds = given.samplingIntervalSeconds;
export const pricePerSignalUsd = given.pricePerSignalUsd;
export const fxKrwPerUsd = assumed.fxKrwPerUsd;
export const avgKmPerMonth = assumed.avgKmPerMonth;
export const partnerCommissionRate = assumed.partnerCommissionRate;
export const redemptionMix = mix;
export const capturedAt = model.capturedAt;
