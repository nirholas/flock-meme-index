# Flock Meme Index (FMI) methodology

**Version 1.0.0.** This document and [`src/methodology.ts`](src/methodology.ts) are the same rules
written twice: once for people, once for a machine. Every number below is a constant in `RULES`, so
any composition can be reproduced from a commit hash and a date.

## What the index is for

FMI holds the Solana memecoins that are large, genuinely traded, and safe for a fund to custody. It
is an expression of the category, not a bet on whichever coin is winning this month.

A memecoin has no revenue, no protocol, and no claim on anything. There are no fundamentals to
screen on, so this methodology spends almost all of its rules on two questions the category actually
turns on:

1. **Can the fund safely hold it?** Can the issuer mint more, freeze the vault, or does a handful of
   wallets own the float?
2. **Is the trading real?** Volume in this category is frequently manufactured.

Everything else is size.

## Universe

Every token in Jupiter's verified set (3,203 as of 2026-09-07) carrying the `meme` tag: 824 of them.
That is the same list wallets use to decide what to show, so the index can never hold something a
wallet would warn about.

## Eligibility

All of the following must hold. Failures are reported in full, so a near miss is visible in
`data/screen-<date>.json`.

### Custody and control (never relaxed)

| Rule | Why |
|---|---|
| Token program is SPL Token (classic) | The index program custodies classic SPL Token only. Token-2022 mints cannot be held at all today. |
| Mint authority provably disabled | An issuer who can mint can dilute the index's holding to nothing. Unknown is treated as **not** disabled. |
| Freeze authority provably disabled | An issuer who can freeze can trap the vault, which makes redemption impossible for every holder. |
| Top holders own at most 40% | Above this the coin is a treasury with a ticker, and the index would be underwriting one desk's exit. Unknown concentration is a failure, not a pass. |
| Verified on Jupiter | The universe definition above. |
| No excluded tag | `token-2022`, `stable`, `rwa`, `stocks`, `xstocks`, `equities`, `lst`, `original-lst`. |

### Size, depth and honesty of volume

| Rule | Threshold |
|---|---|
| Circulating market cap | at least $25M |
| On-chain liquidity | at least $1M |
| Holders | at least 25,000 |
| Age since first pool | at least 180 days |
| Jupiter organic score | at least 60 |
| Organic 24h volume | at least $50k |

The organic-score rule is the single most useful one here. The universe is full of coins reporting
seven figures of daily volume against a score of zero. Six months of continuous trading is the
cheapest available filter for "this survived the attention that created it", and it removes
essentially every rug before it can reach the index.

**On `devMints`.** Jupiter reports a count of other mints by the same deployer. It looks like a rug
signal and is not used as one, because for launchpad-deployed coins it counts the launchpad's
deployments rather than the team's: two of the strongest coins in this universe report values in the
hundreds. It is recorded in the screen output and deliberately not made a rule.

### Retention buffer

A current constituent is held while it clears **80%** of each numeric threshold. Turnover costs
holders real money in auction premiums, so the bar to leave is lower than the bar to enter. The
custody rules above get no slack.

## Weighting

**Square root of liquidity-adjusted market cap**, capped at 25%, floored at 5%, top 8 names.

Two dampeners, for two different problems:

- **The liquidity cap** (market cap capped at 25x on-chain liquidity) stops the index from weighting
  a coin at a size it could never trade out of. In this category that is the difference between a
  rebalance and a bag. It is why PENGU, the largest constituent by market cap at $656M, carries the
  fourth largest weight: $2.7M of on-chain depth does not support a $656M weighting.
- **The square root** stops the largest coin from being the index. Meme market caps span two orders
  of magnitude, and a plain cap-weighted meme index is a leveraged position in one name, which is not
  what someone buying the category wants.

Weights are then capped and floored the way a committee does it (fix a breach, re-weight the rest,
repeat) and rounded by largest remainder so they sum to exactly 10000 basis points.

## Schedule

| Event | Cadence | What happens |
|---|---|---|
| Screen | continuous, on demand | `npm run screen` writes the composition and the full working |
| Rebalance | monthly, first Tuesday | Weights recomputed, published as a Dutch auction |
| Reconstitution | monthly | Constituents may enter or leave, subject to the retention buffer |

Memes turn over faster than protocols, so reconstitution is monthly here rather than quarterly.
Because the index program fixes the component set when an index is sealed, a reconstitution that
adds or removes a name is a new index token and holders migrate by redeeming and re-issuing.

## Composition as of 2026-09-07

| Weight | Symbol | Market cap | Liquidity | Holders | Organic score | Top holders |
|---|---|---|---|---|---|---|
| 20.14% | Fartcoin | $171.7M | $6.2M | 177,574 | 91 | 33.5% |
| 20.03% | $WIF | $216.3M | $6.1M | 258,596 | 85 | 31.9% |
| 16.35% | USELESS | $225.0M | $4.1M | 56,004 | 96 | 27.2% |
| 13.26% | PENGU | $656.2M | $2.7M | 554,227 | 90 | 38.8% |
| 11.56% | POPCAT | $51.2M | $4.5M | 141,929 | 79 | 38.8% |
| 10.35% | TROLL | $46.7M | $1.6M | 67,100 | 87 | 23.9% |
| 8.31% | Bonk | $278.6M | $1.1M | 1,013,995 | 90 | 31.8% |

## What the screen rejected, and why it matters

- **TRUMP**, at $618M the second largest meme on Solana by market cap: top holders own 81.5%.
- **YZY**: 85% concentration, an organic score of zero, and $109 of organic volume in a day.
- **MELANIA**, **MEW**, **BOME**, **Pnut**: real market caps, but volume that the organic filter says
  is not real trading.
- **SPX**: mint authority not provably disabled.

Four of the ten largest memecoins in the universe fail this screen. That is the methodology working,
not the methodology being unlucky.

## Known limitations

- **Top-holder percentage includes contracts.** Liquidity pools, staking programs and exchange
  wallets can all sit in the top holders, so the 40% rule is stricter than it looks for coins with
  deep pooled liquidity. A future version should net out known pool and CEX addresses.
- **Jupiter is a single source** for market cap, liquidity, concentration and organic score.
- **Token-2022 is not investable** while the index program custodies classic SPL Token only.
