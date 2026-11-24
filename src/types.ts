// Token Launch Radar v2 — types for the sealed DefiLlama snapshot.
// Written fresh in this session. No field is invented: every value below
// comes from the snapshot's own ten protocol fields.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

// One fitted factor per candidate, kept so the dashboard can show its work.
export interface Factors {
  tvlUsd: number;
  multiple: number; // category mcap/TVL multiple, winsorized + shrunk
  peerCount: number; // tokenized peers in this category (before shrinkage)
  growth: number; // damped 7-day TVL change factor
  maturity: number; // staying-power factor from listed_at
  reach: number; // chain-count factor
  pToken: number; // odds the category ever issues a token, from its own record
}

export interface RankedRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvlUsd: number;
  change7d: number | null;
  listedAt: string | null;
  watchlist: boolean;
  factors: Factors;
  impliedValueUsd: number;
  expectedValueUsd: number;
  farmSteps: string[];
  farmCostUsd: number;
  farmMinutes: number;
}

export interface PeerStat {
  category: string;
  peers: number;
  medianMultiple: number;
  fittedMultiple: number;
}

export interface ModelMeta {
  asOf: string;
  snapshotSha256: string;
  floorUsd: number;
  protocolsTotal: number;
  candidates: number;
  watchlistTotal: number;
  watchlistCovered: number;
  setAside: number;
  globalMultiple: number;
  peerTotal: number;
  heldOutMedianLogError: number;
  heldOutTrainN: number;
  heldOutTestN: number;
  globalTokenRate: number;
  peerStats: PeerStat[];
  excludedGroups: { reason: string; count: number; names: string[] }[];
}

export interface BoardRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  watchlist: boolean;
  multiple: number;
  peer_count: number;
  growth: number;
  maturity: number;
  reach: number;
  p_token: number;
  expected_value_usd: number;
  farm_cost_usd: number;
  farm_minutes: number;
}
