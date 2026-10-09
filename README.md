# Flock Meme Index (FMI)

The Solana memecoins that are large, genuinely traded, and safe to custody, in one token. This
repository is the index's rulebook, the code that runs it, and every composition it has published.

Built on [flock-protocol](https://github.com/nirholas/flock-protocol): in-kind issuance and
redemption, no privileged party able to move the fund's assets, and rebalances that clear as public
Dutch auctions.

## Composition, 2026-09-07

| Weight | Symbol | Market cap | Liquidity | Holders | Organic score | Top holders |
|---|---|---|---|---|---|---|
| 20.14% | Fartcoin | $171.7M | $6.2M | 177,574 | 91 | 33.5% |
| 20.03% | $WIF | $216.3M | $6.1M | 258,596 | 85 | 31.9% |
| 16.35% | USELESS | $225.0M | $4.1M | 56,004 | 96 | 27.2% |
| 13.26% | PENGU | $656.2M | $2.7M | 554,227 | 90 | 38.8% |
| 11.56% | POPCAT | $51.2M | $4.5M | 141,929 | 79 | 38.8% |
| 10.35% | TROLL | $46.7M | $1.6M | 67,100 | 87 | 23.9% |
| 8.31% | Bonk | $278.6M | $1.1M | 1,013,995 | 90 | 31.8% |

Screened from the 824 meme-tagged tokens in Jupiter's verified set. The full working, including
every candidate that failed and why, is in [`data/screen-2026-09-07.json`](data/screen-2026-09-07.json).

## Run it yourself

```bash
npm install
npm run screen -- --verbose     # live universe, writes data/latest.json and the working
npm test                        # the methodology's arithmetic
npm run propose                 # the exact flock command to launch or rebalance
```

No key, no account, no hardcoded token list.

## Why these rules

**Volume is the wrong number; organic volume is the right one.** The meme universe is full of coins
reporting seven figures of daily volume against an organic score of zero. MELANIA, MEW, BOME and
Pnut all have real market caps and all fail this screen on volume that is not real trading.

**Concentration is a custody question, not a taste question.** TRUMP is the second largest memecoin
on Solana and its top holders own 81.5% of the float. An index that holds it is underwriting one
desk's exit, so the screen excludes it, and says so in public.

**Square root of liquidity-adjusted market cap.** PENGU is the largest constituent by market cap and
the fourth by weight, because $2.7M of on-chain depth cannot support a $656M weighting. The square
root then stops any single coin from becoming the index. Buying this token should be buying the
category.

## What is in here

```
METHODOLOGY.md     the rulebook, in English
src/methodology.ts the same rulebook, in code, with every threshold as a named constant
src/screen.ts      runs it against the live universe and writes the result
src/propose.ts     turns a composition into the launch or rebalance command
data/              every composition and every screen, committed and dated
site/              a page that renders the current composition against live prices
test/              the arithmetic: screening, scoring, capping, rounding
```

## Status

The index is specified and screened; it is not deployed. The engine it runs on is unaudited and
deployed nowhere, and this repository does not hold a launch key. `npm run propose` prints the exact
command that would launch it.

MIT.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=nirholas/flock-meme-index&type=Date)](https://www.star-history.com/#nirholas/flock-meme-index&Date)
