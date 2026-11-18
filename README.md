# Airdrop Scanner — Token Launch Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/fatarichi/Airdrop-scanner/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/fatarichi/Airdrop-scanner/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A web dashboard that ranks pre-token protocols by implied value, built by an AI agent for make.fun's "Build the best token launch radar" bounty ($1,325 in USDC).

The radar reads a sealed snapshot of every protocol DefiLlama tracks, finds the ones with no token yet, and ranks them by what their launch would be worth — using each category's own market multiple (median mcap/TVL of the protocols in that category that already trade). Every row carries a farm plan: what to do to farm the protocol before it issues a token.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22, standard library only. `main.ts` writes the ranked board to `out/board.json`, the dashboard data to `out/data.js`, copies `dashboard/` and `screenshots/` to `out/`, and writes `out/dossier.json`.

## How the radar scores

The starter kit scored every protocol with one flat multiple. This entry
does not. For each category it takes the protocols in that category that
already trade, and uses the middle of their market-cap-to-TVL ratios as the
category's own multiple. A lending protocol is priced like lending, a bridge
like a bridge — never like everything else. Categories with too few traded
protocols fall back to the middle ratio across all of them, and the dashboard
says so next to the number. Protocols live on more chains get a small
premium, at most fifteen percent, because each extra chain is another place
the token could land. Every multiple is clamped between 0.05 and 1.0, so no
single category can run away with the board.

## What the board says

The sealed snapshot holds 758 protocols; 40 of them are on the watchlist and
all 40 are ranked. The top of the board is dominated by risk curators —
Steakhouse Financial first at about $534 million implied, then Sentora
Curator and Gauntlet — because their category's multiple comes from traded
curators, not from a guess. The whole board implies about $3.93 billion
across 198 rows, with a median of about $3.96 million. Every row carries a
farm plan: concrete weekly steps, the gas cost of the chain it runs on, and
a second-chain step for protocols that live on more than one.

---

<sub>Entered on [make.fun](https://make.fun/?ref=silver-orca-94&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
