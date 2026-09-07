import { SPL_TOKEN_PROGRAM, type TokenStats } from "./jupiter.js";

/**
 * The Flock Meme Index rulebook, as code.
 *
 * `METHODOLOGY.md` is the human version and the two are meant to be read together. Every threshold
 * is a named constant in `RULES`, so a change to the methodology is a diff anyone can see and a
 * composition can be reproduced from a commit hash and a date.
 *
 * The difference from a fundamentals index is that there are no fundamentals. A memecoin has no
 * revenue, no protocol and no claim on anything; what it has is attention, distribution and depth.
 * So this methodology spends almost all of its rules on two questions: can the fund safely custody
 * it, and is the trading real. Everything else is size.
 */

export const VERSION = "1.0.0";

export const RULES = {
  categoryTag: "meme",
  /** A memecoin that is also a stock, a stable or a staking receipt is one of those things instead. */
  excludedTags: ["token-2022", "stable", "rwa", "stocks", "xstocks", "equities", "lst", "original-lst"],
  minMarketCapUsd: 25_000_000,
  minLiquidityUsd: 1_000_000,
  minHolders: 25_000,
  /**
   * Memecoins die young. Six months of continuous trading is the cheapest available filter for
   * "this survived the attention that created it", and it removes essentially every rug before it
   * can reach the index.
   */
  minAgeDays: 180,
  /**
   * Jupiter's organic score discounts wash and bot volume. It is the single most useful field in
   * this screen: the universe is full of tokens reporting seven-figure daily volume against a
   * score of zero.
   */
  minOrganicScore: 60,
  minOrganicVolume24hUsd: 50_000,
  /**
   * Share of supply held by the largest wallets. Above this the coin is a treasury with a ticker,
   * and the index would be underwriting one desk's exit.
   */
  maxTopHoldersPercentage: 40,
  liquidityCapMultiple: 25,
  maxConstituents: 8,
  maxWeightBps: 2_500,
  minWeightBps: 500,
  retentionSlack: 0.8,
} as const;

export interface ScreenResult {
  token: TokenStats;
  passed: boolean;
  failures: string[];
  ageDays: number | null;
  score: number;
  retained: boolean;
}

export function ageDays(token: TokenStats, now: Date): number | null {
  if (!token.firstPoolCreatedAt) return null;
  const created = Date.parse(token.firstPoolCreatedAt);
  if (Number.isNaN(created)) return null;
  return (now.getTime() - created) / 86_400_000;
}

/**
 * Square root of liquidity-adjusted market cap.
 *
 * Two dampeners, for two different problems. The liquidity cap stops the index from weighting a
 * coin at a size it could never trade out of, which in this category is the difference between a
 * rebalance and a bag. The square root stops the largest coin from being the index: meme market
 * caps span two orders of magnitude, and a plain cap-weighted meme index is a leveraged bet on
 * whichever coin is winning this month, which is not what someone buying the category wants.
 */
export function score(token: TokenStats): number {
  return Math.sqrt(Math.min(token.marketCapUsd, RULES.liquidityCapMultiple * token.liquidityUsd));
}

export function screen(token: TokenStats, options: { now: Date; incumbent: boolean }): ScreenResult {
  const failures: string[] = [];
  const slack = options.incumbent ? RULES.retentionSlack : 1;
  const age = ageDays(token, options.now);

  if (!token.tags.includes(RULES.categoryTag)) failures.push(`not tagged ${RULES.categoryTag}`);
  for (const tag of RULES.excludedTags) {
    if (token.tags.includes(tag)) failures.push(`excluded tag ${tag}`);
  }
  // Custody rules never get slack. A coin the fund cannot safely hold is not a near miss.
  if (token.tokenProgram !== SPL_TOKEN_PROGRAM) failures.push("not the SPL Token program");
  if (!token.mintAuthorityDisabled) failures.push("mint authority not provably disabled");
  if (!token.freezeAuthorityDisabled) failures.push("freeze authority not provably disabled");
  if (!token.isVerified) failures.push("not verified");

  if (token.topHoldersPercentage === null) {
    failures.push("holder concentration unknown");
  } else if (token.topHoldersPercentage > RULES.maxTopHoldersPercentage) {
    failures.push(`top holders own ${token.topHoldersPercentage.toFixed(1)}%`);
  }

  if (token.marketCapUsd < RULES.minMarketCapUsd * slack) {
    failures.push(`market cap ${fmt(token.marketCapUsd)} below ${fmt(RULES.minMarketCapUsd * slack)}`);
  }
  if (token.liquidityUsd < RULES.minLiquidityUsd * slack) {
    failures.push(`liquidity ${fmt(token.liquidityUsd)} below ${fmt(RULES.minLiquidityUsd * slack)}`);
  }
  if (token.holderCount < RULES.minHolders * slack) {
    failures.push(`${token.holderCount.toLocaleString("en-US")} holders below ${Math.round(RULES.minHolders * slack).toLocaleString("en-US")}`);
  }
  if (age === null || age < RULES.minAgeDays * slack) {
    failures.push(age === null ? "no first pool date" : `${age.toFixed(0)} days old`);
  }
  if (token.organicScore < RULES.minOrganicScore * slack) {
    failures.push(`organic score ${token.organicScore.toFixed(0)} below ${Math.round(RULES.minOrganicScore * slack)}`);
  }
  if (token.organicVolume24hUsd < RULES.minOrganicVolume24hUsd * slack) {
    failures.push(`organic volume ${fmt(token.organicVolume24hUsd)} below ${fmt(RULES.minOrganicVolume24hUsd * slack)}`);
  }

  return {
    token,
    passed: failures.length === 0,
    failures,
    ageDays: age,
    score: score(token),
    retained: options.incumbent && failures.length === 0 && slack < 1,
  };
}

function fmt(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export interface Constituent {
  mint: string;
  symbol: string;
  decimals: number;
  score: number;
  weightBps: number;
  marketCapUsd: number;
  liquidityUsd: number;
  holderCount: number;
  organicScore: number;
  topHoldersPercentage: number | null;
  usdPrice: number;
}

/**
 * Turn scores into weights that add up to exactly 10000 bps, with a cap and a floor.
 *
 * The cap is applied the way a committee applies one: fix whatever breaches it, re-weight the rest
 * proportionally over what remains, and repeat, because capping one name raises the others. The
 * floor works the same way downward. Rounding uses largest remainders so the total is exactly
 * 10000 rather than 9999, which the launch command requires.
 *
 * Where the cap is arithmetically impossible (three names cannot each hold at most 25% and sum to
 * 100%), the binding constraint is `1/n` and the answer is equal weight.
 */
export function weight(scores: number[]): number[] {
  const n = scores.length;
  if (n === 0) return [];
  if (scores.some((value) => value <= 0)) throw new Error("every constituent needs a positive score");
  if (RULES.minWeightBps * n > 10_000) {
    throw new Error(`${n} constituents cannot all clear a ${RULES.minWeightBps} bps floor`);
  }

  const cap = Math.max(RULES.maxWeightBps / 10_000, 1 / n);
  const floor = Math.min(RULES.minWeightBps / 10_000, 1 / n);
  const fixed = new Array<number | null>(n).fill(null);

  for (let round = 0; round <= n; round += 1) {
    const free = fixed.map((value, i) => (value === null ? i : -1)).filter((i) => i >= 0);
    if (free.length === 0) break;
    const used = fixed.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const remaining = 1 - used;
    const freeScore = free.reduce((sum, i) => sum + (scores[i] ?? 0), 0);
    const proposed = free.map((i) => (remaining * (scores[i] ?? 0)) / freeScore);

    const over = proposed.findIndex((w) => w > cap + 1e-12);
    if (over >= 0) {
      fixed[free[over]!] = cap;
      continue;
    }
    const under = proposed.findIndex((w) => w < floor - 1e-12);
    if (under >= 0) {
      fixed[free[under]!] = floor;
      continue;
    }
    free.forEach((i, k) => {
      fixed[i] = proposed[k] ?? 0;
    });
    break;
  }

  const exact = fixed.map((value) => (value ?? 0) * 10_000);
  const floored = exact.map((value) => Math.floor(value));
  let remainder = 10_000 - floored.reduce((a, b) => a + b, 0);
  // Ties are broken by score, and "tie" has to tolerate floating point: capping one name and
  // dividing the rest leaves fractions that differ in the last bits of a double, which would
  // otherwise hand the spare basis point to an arbitrary name instead of the largest one.
  const order = exact
    .map((value, i) => ({ i, fraction: Math.round((value - Math.floor(value)) * 1e9) }))
    .sort((a, b) => b.fraction - a.fraction || (scores[b.i] ?? 0) - (scores[a.i] ?? 0));
  const result = [...floored];
  for (let k = 0; remainder > 0; k += 1, remainder -= 1) {
    const target = order[k % order.length]!.i;
    result[target] = (result[target] ?? 0) + 1;
  }
  return result;
}

export function compose(
  universe: TokenStats[],
  options: { now: Date; incumbents?: string[] },
): { constituents: Constituent[]; screened: ScreenResult[] } {
  const incumbents = new Set(options.incumbents ?? []);
  const screened = universe
    .map((token) => screen(token, { now: options.now, incumbent: incumbents.has(token.mint) }))
    .sort((a, b) => b.score - a.score);

  const selected = screened.filter((entry) => entry.passed).slice(0, RULES.maxConstituents);
  const weights = weight(selected.map((entry) => entry.score));

  return {
    constituents: selected.map((entry, i) => ({
      mint: entry.token.mint,
      symbol: entry.token.symbol,
      decimals: entry.token.decimals,
      score: entry.score,
      weightBps: weights[i] ?? 0,
      marketCapUsd: entry.token.marketCapUsd,
      liquidityUsd: entry.token.liquidityUsd,
      holderCount: entry.token.holderCount,
      organicScore: entry.token.organicScore,
      topHoldersPercentage: entry.token.topHoldersPercentage,
      usdPrice: entry.token.usdPrice,
    })),
    screened,
  };
}
