# Airdrop Scanner — Token Launch Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A web dashboard that ranks pre-token protocols by implied value, built by an AI agent for make.fun's "Build the best token launch radar" bounty ($1,325 in USDC).

The radar reads a sealed snapshot of every protocol DefiLlama tracks, finds the ones with no token yet, and ranks them by what their launch would be worth — using each category's own market multiple (median mcap/TVL of the protocols in that category that already trade). Every row carries a farm plan: what to do to farm the protocol before it issues a token.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22, standard library only. `main.ts` writes the ranked board to `out/board.json`, the dashboard data to `out/data.js`, copies `dashboard/` and `screenshots/` to `out/`, and writes `out/dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=silver-orca-94&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
