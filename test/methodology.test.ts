import { describe, expect, it } from "vitest";

import { RULES, compose, score, screen, weight } from "../src/methodology.js";
import { SPL_TOKEN_PROGRAM, type TokenStats } from "../src/jupiter.js";

const NOW = new Date("2026-09-07T00:00:00Z");

/** WIF as the live screen sees it: a coin that passes on every rule, so a failure is the rule's. */
function token(overrides: Partial<TokenStats> = {}): TokenStats {
  return {
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    symbol: "$WIF",
    name: "dogwifhat",
    decimals: 6,
    usdPrice: 0.216,
    marketCapUsd: 216_000_000,
    fdvUsd: 216_000_000,
    circulatingSupply: 998_000_000,
    liquidityUsd: 6_100_000,
    holderCount: 258_000,
    organicScore: 85,
    organicScoreLabel: "high",
    isVerified: true,
    tags: ["verified", "meme", "community"],
    tokenProgram: SPL_TOKEN_PROGRAM,
    firstPoolCreatedAt: "2023-12-19T00:00:00Z",
    mintAuthorityDisabled: true,
    freezeAuthorityDisabled: true,
    topHoldersPercentage: 31.9,
    devMints: 15,
    volume24hUsd: 2_500_000,
    organicVolume24hUsd: 188_000,
    priceChange24h: 2,
    holderChange24h: 0,
    ...overrides,
  };
}

describe("screening", () => {
  it("passes a coin that clears every rule", () => {
    expect(screen(token(), { now: NOW, incumbent: false }).failures).toEqual([]);
  });

  it("refuses a coin a handful of wallets control", () => {
    // This is the rule that keeps TRUMP (81.5%) and YZY (85%) out of the index.
    const concentrated = token({ topHoldersPercentage: 81.5 });
    expect(screen(concentrated, { now: NOW, incumbent: false }).failures).toContain(
      "top holders own 81.5%",
    );
  });

  it("refuses a coin whose concentration is unknown", () => {
    expect(screen(token({ topHoldersPercentage: null }), { now: NOW, incumbent: false }).failures).toContain(
      "holder concentration unknown",
    );
  });

  it("refuses volume that is not real, however large it looks", () => {
    // The universe is full of coins reporting seven figures of daily volume against a zero score.
    const washed = token({ organicScore: 0, volume24hUsd: 5_000_000, organicVolume24hUsd: 900 });
    const failures = screen(washed, { now: NOW, incumbent: false }).failures;
    expect(failures.join(" ")).toMatch(/organic score 0/);
    expect(failures.join(" ")).toMatch(/organic volume \$900/);
  });

  it("refuses a coin younger than the attention that made it", () => {
    const fresh = token({ firstPoolCreatedAt: "2026-08-01T00:00:00Z" });
    expect(screen(fresh, { now: NOW, incumbent: false }).failures.join(" ")).toMatch(/days old/);
  });

  it("refuses a mint or freeze authority that is not provably gone", () => {
    expect(screen(token({ mintAuthorityDisabled: false }), { now: NOW, incumbent: true }).failures).toContain(
      "mint authority not provably disabled",
    );
  });

  it("holds an incumbent that drifted just under a size threshold", () => {
    const drifted = token({ marketCapUsd: 21_000_000 }); // 84% of the $25M floor
    expect(screen(drifted, { now: NOW, incumbent: false }).passed).toBe(false);
    expect(screen(drifted, { now: NOW, incumbent: true }).passed).toBe(true);
  });
});

describe("scoring", () => {
  it("dampens size twice: once for depth, once for skew", () => {
    const deep = token({ marketCapUsd: 100_000_000, liquidityUsd: 50_000_000 });
    expect(score(deep)).toBeCloseTo(Math.sqrt(100_000_000), 6);

    // 655M of market cap on 2.7M of depth scores as 67.5M, then square-rooted.
    const thin = token({ marketCapUsd: 655_000_000, liquidityUsd: 2_700_000 });
    expect(score(thin)).toBeCloseTo(Math.sqrt(2_700_000 * RULES.liquidityCapMultiple), 6);
    expect(score(thin)).toBeLessThan(score(deep));
  });

  it("keeps a 10x market cap difference from becoming a 10x weight", () => {
    const small = token({ marketCapUsd: 50_000_000, liquidityUsd: 50_000_000 });
    const large = token({ marketCapUsd: 500_000_000, liquidityUsd: 500_000_000 });
    const ratio = score(large) / score(small);
    expect(ratio).toBeCloseTo(Math.sqrt(10), 3);
  });
});

describe("weighting", () => {
  it("always adds up to exactly 10000 bps", () => {
    for (const scores of [[1], [3, 2], [9, 8, 7, 6, 5], [100, 1, 1, 1, 1, 1, 1, 1]]) {
      expect(weight(scores).reduce((a, b) => a + b, 0)).toBe(10_000);
    }
  });

  it("caps the largest and floors the smallest", () => {
    const weights = weight([1_000_000, 5, 5, 5, 5, 5, 5, 5]);
    expect(Math.max(...weights)).toBeLessThanOrEqual(RULES.maxWeightBps);
    expect(Math.min(...weights)).toBeGreaterThanOrEqual(RULES.minWeightBps);
  });

  it("falls back to equal weight when the cap cannot be satisfied", () => {
    expect(weight([9, 1, 1])).toEqual([3_334, 3_333, 3_333]);
  });

  it("refuses a set too large for its own floor", () => {
    expect(() => weight(new Array(21).fill(1))).toThrow(/floor/);
  });
});

describe("composition", () => {
  it("takes the top names by score and weights them to exactly 10000", () => {
    const universe = Array.from({ length: 12 }, (_, i) =>
      token({
        mint: `mint${i}`,
        symbol: `M${i}`,
        marketCapUsd: 30_000_000 + i * 20_000_000,
        liquidityUsd: 20_000_000,
      }),
    );
    const { constituents } = compose(universe, { now: NOW });
    expect(constituents).toHaveLength(RULES.maxConstituents);
    expect(constituents[0]!.symbol).toBe("M11");
    expect(constituents.reduce((sum, c) => sum + c.weightBps, 0)).toBe(10_000);
  });
});
