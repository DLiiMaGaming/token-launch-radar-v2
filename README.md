# Token Launch Radar v2

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/DLiiMaGaming/token-launch-radar-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/DLiiMaGaming/token-launch-radar-v2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Entry for the make.fun **best token launch radar** bounty
([token-radar-01](https://make.fun/bounty/token-radar-01)). A program, not a hand-kept list: it reads the sealed
DefiLlama snapshot, works out which protocols still record no token, ranks
them by what a token would be worth if it launched, and writes a dashboard
a reader can sort, filter, and farm from.

## The model ("radar-3")

```
implied = TVL x category multiple x growth x maturity x reach
```

- **Category multiple** — the median mcap/TVL of the tokenized peers in
  the same category. Every peer ratio is first capped at the 5th/95th
  percentile of the peer set, so one tiny-TVL protocol with a huge market
  cap cannot set its category's price alone; the median is then shrunk
  toward the global median with a pseudo-count of 4. Peers need a
  positive market cap: tokens recorded at $0 (15 of them) or -$1 carry
  no pricing information and are left out of the fit.
- **Growth** — the 7-day TVL change, damped with tanh (at most ±25%).
- **Maturity** — days since DefiLlama first tracked the protocol,
  saturating toward 1 over about 18 months; unknown listing dates score
  a neutral 0.90.
- **Reach** — 1 + 0.12 · log2(chain count), capped at 1.5.
- **P(token)** — the odds the category ever issues a token, read from the
  snapshot's own record (tokenized share of the category, shrunk toward
  the global rate). It never enters the implied value, which is the value
  *if* a token launches. Expected value = implied × P(token) is shown as
  a separate column.

The candidate universe is the house watchlist rule with the TVL floor
removed: records no token (`gecko_id` and `symbol` both null) and is not a
wrapped/staked/bridged product, a CEX, a versioned sibling, or an
exchange's own product. All 40 watchlist protocols are inside it; the
rest are the early ones the radar exists to find. The 144 protocols the
rule sets aside are listed in the dashboard's appendix with their reason.

Every run also fits the global multiple on half the tokenized peers and
reports its median error on the other half (the held-out check), so the
model's accuracy is measured, not asserted.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
node tools/check-gate.mjs out
```

`main.ts` is Node 22, standard library only. It writes `board.json`,
`data.js` (beside the dashboard), the dashboard, the screenshots, and
`dossier.json` (via `vendor/makefun-board.ts`). Two runs write identical
bytes.

## Layout

- `main.ts` — orchestration (read snapshot → model → farm plans → outputs)
- `src/model.ts` — candidate rule, peer multiples, factors, ranking
- `src/farm.ts` — costed, timed farm plans per category
- `src/emit.ts` — board rows, dashboard data, generated model card
- `dashboard/` — the page: `index.html`, `theme.css`, `radar.js`
- `screenshots/` — board, detail, filtered views (1440×1000)
- `tools/check-gate.mjs` — the seven gate rows, run locally
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte

## License

MIT — see `LICENSE`.

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
