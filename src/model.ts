// Token Launch Radar v2 — the value model ("radar-3").
// Written fresh in this session. Everything is fitted from the snapshot
// itself: no hardcoded list of protocol names anywhere.
//
//   implied = TVL x category multiple x growth x maturity x reach
//
// - category multiple: the median mcap/TVL of the tokenized peers in the
//   same category. Every peer ratio is first capped at the 5th/95th
//   percentile of the whole peer set — one tiny-TVL protocol with a huge
//   market cap must not set its category's price alone — then the
//   category median is shrunk toward the global median with a
//   pseudo-count K = 4, so thin categories borrow strength instead of
//   trusting two or three peers.
// - growth: the 7-day TVL change, damped with tanh so a hot or cold week
//   moves the value by at most +/-25%.
// - maturity: days since DefiLlama first tracked the protocol, saturating
//   toward 1 over ~18 months; unknown listing date scores neutral 0.90.
// - reach: 1 + 0.12 * log2(chain count), capped at 1.5: multi-chain
//   distribution is worth something, but the tenth chain adds little.
// - p_token: the odds this category ever issues a token, read from the
//   snapshot's own record (tokenized share of the category, shrunk toward
//   the global rate with K = 8). It never enters the implied value: the
//   implied value is the conditional value IF a token launches. The board
//   also shows expected = implied x p_token as a separate column.
//
// The candidate universe is the house watchlist rule with the TVL floor
// removed: records no token (gecko_id and symbol both null) and is not a
// wrapped/staked/bridged product, a CEX, a versioned sibling, or an
// exchange's own name. The 40 watchlist protocols are all inside it; the
// rest are the early ones the radar exists to find. Protocols the rule
// sets aside are reported in the appendix with their reason, not hidden.

import { createHash } from "node:crypto";
import type { ModelMeta, PeerStat, Protocol, RankedRow, Snapshot } from "./types.ts";

const EXCLUDED_CATEGORIES = new Set([
  "Bridge",
  "Canonical Bridge",
  "Liquid Staking",
  "Liquid Restaking",
  "Restaked BTC",
  "CEX",
]);

const EXCHANGE_NAMES = [
  "Binance",
  "Coinbase",
  "Bybit",
  "Kraken",
  "Bitget",
  "OKX",
  "Bitfinex",
  "Gemini",
];

const VERSION_MARKER = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

const SHRINK_K = 4; // pseudo-count for category multiples
const ODDS_SHRINK_K = 8; // pseudo-count for token odds

export function recordsNoToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

export function setAsideReason(p: Protocol): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) {
    return p.category;
  }
  if (VERSION_MARKER.test(p.name)) return "versioned sibling (V2 / 2.0)";
  if (WRAPPED_WORD.test(p.name)) return "wrapped / staked product";
  for (const ex of EXCHANGE_NAMES) {
    if (p.name.startsWith(ex)) return "exchange's own product";
  }
  return null;
}

export function isCandidate(p: Protocol): boolean {
  return recordsNoToken(p) && setAsideReason(p) === null;
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

function winsorBounds(values: number[]): [number, number] {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return [NaN, NaN];
  return [v[Math.max(0, Math.floor(0.05 * n))], v[Math.min(n - 1, Math.floor(0.95 * n))]];
}

function winsorize(values: number[]): number[] {
  const [lo, hi] = winsorBounds(values);
  return values.map((x) => Math.min(Math.max(x, lo), hi));
}

function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(fromDay + "T00:00:00Z");
  const to = Date.parse(toDay + "T00:00:00Z");
  return Math.max(0, Math.round((to - from) / 86400000));
}

function md5Parity(slug: string): number {
  const h = createHash("md5").update(slug).digest();
  return h[0] % 2;
}

export interface ModelOutput {
  rows: RankedRow[];
  meta: ModelMeta;
}

export function buildModel(snap: Snapshot, snapshotSha256: string): ModelOutput {
  const protocols = snap.protocols;
  const watchlist = new Set(snap.watchlist);

  // --- tokenized peers: the only source of "what is a token worth" ------
  // A peer needs a positive market cap: a token recorded at $0 carries no
  // pricing information and its zero ratio would poison the median.
  const peers = protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
  const peerRatio = (p: Protocol): number => (p.mcap_usd as number) / p.tvl_usd;
  // Cap every ratio at the peer set's 5th/95th percentile first: a single
  // tiny-TVL protocol with a huge market cap (rain: 400x) must not set its
  // category's multiple on its own.
  const [capLo, capHi] = winsorBounds(peers.map(peerRatio));
  const cappedRatio = (p: Protocol): number =>
    Math.min(Math.max(peerRatio(p), capLo), capHi);
  const globalMultiple = median(peers.map(cappedRatio));

  const ratiosByCat = new Map<string, number[]>();
  for (const p of peers) {
    const cat = p.category ?? "(no category)";
    if (!ratiosByCat.has(cat)) ratiosByCat.set(cat, []);
    ratiosByCat.get(cat)!.push(cappedRatio(p));
  }
  const fittedMultiple = (cat: string | null): { mult: number; n: number } => {
    const key = cat ?? "(no category)";
    const ratios = ratiosByCat.get(key) ?? [];
    if (ratios.length === 0) return { mult: globalMultiple, n: 0 };
    const med = median(ratios);
    const n = ratios.length;
    return { mult: (n * med + SHRINK_K * globalMultiple) / (n + SHRINK_K), n };
  };

  // --- held-out check: fit the whole multiple pipeline on half the ------
  // --- peers, score it on the other half. Caps and medians come from -----
  // --- the train half only, so the error is honest. -----------------------
  const train = peers.filter((p) => md5Parity(p.slug) === 0);
  const test = peers.filter((p) => md5Parity(p.slug) === 1);
  const [trainLo, trainHi] = winsorBounds(train.map(peerRatio));
  const trainCapped = (p: Protocol): number =>
    Math.min(Math.max(peerRatio(p), trainLo), trainHi);
  const trainGlobal = median(train.map(trainCapped));
  const trainByCat = new Map<string, number[]>();
  for (const p of train) {
    const cat = p.category ?? "(no category)";
    if (!trainByCat.has(cat)) trainByCat.set(cat, []);
    trainByCat.get(cat)!.push(trainCapped(p));
  }
  const trainFitted = (cat: string | null): number => {
    const ratios = trainByCat.get(cat ?? "(no category)") ?? [];
    if (ratios.length === 0) return trainGlobal;
    const med = median(ratios);
    return (ratios.length * med + SHRINK_K * trainGlobal) / (ratios.length + SHRINK_K);
  };
  const logErrors = test
    .map((p) => Math.abs(Math.log(Math.max(peerRatio(p), 1e-9) / trainFitted(p.category))))
    .sort((a, b) => a - b);
  const heldOutMedianLogError = median(logErrors);

  // --- token odds from the category's own record -------------------------
  const catTotal = new Map<string, number>();
  const catTokenized = new Map<string, number>();
  let tokenizedTotal = 0;
  for (const p of protocols) {
    const key = p.category ?? "(no category)";
    catTotal.set(key, (catTotal.get(key) ?? 0) + 1);
    if (p.mcap_usd !== null) {
      catTokenized.set(key, (catTokenized.get(key) ?? 0) + 1);
      tokenizedTotal += 1;
    }
  }
  const globalTokenRate = tokenizedTotal / protocols.length;
  const tokenOdds = (cat: string | null): number => {
    const key = cat ?? "(no category)";
    const n = catTotal.get(key) ?? 0;
    const t = catTokenized.get(key) ?? 0;
    return (t + ODDS_SHRINK_K * globalTokenRate) / (n + ODDS_SHRINK_K);
  };

  // --- factor functions --------------------------------------------------
  const growthFactor = (change7d: number | null): number =>
    change7d === null ? 1 : 1 + 0.25 * Math.tanh(change7d / 25);

  const maturityFactor = (listedAt: string | null): number => {
    if (listedAt === null) return 0.9;
    const days = daysBetween(listedAt, snap.as_of);
    return 0.8 + 0.2 * (1 - Math.exp(-days / 540));
  };

  const reachFactor = (chains: string[]): number =>
    Math.min(1.5, 1 + 0.12 * Math.log2(Math.max(1, chains.length)));

  // --- rank the candidates ----------------------------------------------
  const candidates = protocols.filter(isCandidate);
  const rows: RankedRow[] = candidates.map((p) => {
    const { mult, n } = fittedMultiple(p.category);
    const growth = growthFactor(p.change_7d);
    const maturity = maturityFactor(p.listed_at);
    const reach = reachFactor(p.chains);
    const pToken = tokenOdds(p.category);
    const implied = Math.max(
      1,
      Math.round(p.tvl_usd * mult * growth * maturity * reach),
    );
    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvlUsd: p.tvl_usd,
      change7d: p.change_7d,
      listedAt: p.listed_at,
      watchlist: watchlist.has(p.slug),
      factors: {
        tvlUsd: p.tvl_usd,
        multiple: mult,
        peerCount: n,
        growth,
        maturity,
        reach,
        pToken,
      },
      impliedValueUsd: implied,
      expectedValueUsd: Math.max(1, Math.round(implied * pToken)),
      farmSteps: [],
      farmCostUsd: 0,
      farmMinutes: 0,
    };
  });
  rows.sort((a, b) => {
    if (b.impliedValueUsd !== a.impliedValueUsd) return b.impliedValueUsd - a.impliedValueUsd;
    if (b.tvlUsd !== a.tvlUsd) return b.tvlUsd - a.tvlUsd;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  // --- appendix: what the rule set aside, and why -------------------------
  const setAside = protocols.filter((p) => recordsNoToken(p) && !isCandidate(p));
  const groups = new Map<string, Protocol[]>();
  for (const p of setAside) {
    const reason = setAsideReason(p) ?? "other";
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason)!.push(p);
  }
  const excludedGroups = [...groups.entries()]
    .map(([reason, ps]) => ({
      reason,
      count: ps.length,
      names: ps
        .sort((a, b) => b.tvl_usd - a.tvl_usd)
        .slice(0, 6)
        .map((p) => p.name),
    }))
    .sort((a, b) => b.count - a.count);

  // --- peer reference table ------------------------------------------------
  const peerStats: PeerStat[] = [...ratiosByCat.entries()]
    .map(([category, ratios]) => {
      const { mult, n } = fittedMultiple(category === "(no category)" ? null : category);
      return {
        category,
        peers: n,
        medianMultiple: median(ratios),
        fittedMultiple: mult,
      };
    })
    .sort((a, b) => b.peers - a.peers);

  const meta: ModelMeta = {
    asOf: snap.as_of,
    snapshotSha256,
    floorUsd: snap.floor_usd,
    protocolsTotal: protocols.length,
    candidates: candidates.length,
    watchlistTotal: snap.watchlist.length,
    watchlistCovered: rows.filter((r) => r.watchlist).length,
    setAside: setAside.length,
    globalMultiple,
    peerTotal: peers.length,
    heldOutMedianLogError,
    heldOutTrainN: train.length,
    heldOutTestN: test.length,
    globalTokenRate,
    peerStats,
    excludedGroups,
  };

  return { rows, meta };
}
