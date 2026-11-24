// Token Launch Radar v2 — farm plans.
// Written fresh in this session. Every plan is built from the protocol's
// own snapshot fields (name, category, chains, TVL tier) through templates:
// nothing is hand-written per protocol, and no step claims a points
// program exists — step 5 says to check whether one is live. Gas figures
// are typical per-chain estimates, labelled as such in the dashboard.

import type { RankedRow } from "./types.ts";

// Typical gas cost of one simple transaction on each chain, in USD.
// Estimates, not quotes: the dashboard says so.
const GAS_USD: Record<string, number> = {
  Ethereum: 4.0,
  Arbitrum: 0.2,
  Base: 0.1,
  Binance: 0.15,
  Solana: 0.02,
  Polygon: 0.08,
  Optimism: 0.15,
  Avalanche: 0.3,
  Sui: 0.03,
  Aptos: 0.03,
  "zkSync Era": 0.25,
  Linea: 0.2,
  Scroll: 0.2,
  Sonic: 0.05,
  Berachain: 0.05,
  "Hyperliquid L1": 0.05,
  Unichain: 0.1,
  xDai: 0.05,
  Fantom: 0.1,
  Cronos: 0.1,
  Mode: 0.1,
  Blast: 0.15,
  Mantle: 0.1,
  Sei: 0.05,
  Monad: 0.05,
  MegaETH: 0.05,
  Ink: 0.08,
  Soneium: 0.08,
  Abstract: 0.08,
  Katana: 0.08,
  Stable: 0.05,
  Plasma: 0.05,
  Tempo: 0.05,
};

function gasUsd(chain: string): number {
  return GAS_USD[chain] ?? 0.3;
}

function money(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

function farmSize(tvlUsd: number): number {
  if (tvlUsd >= 1_000_000_000) return 2000;
  if (tvlUsd >= 100_000_000) return 1000;
  if (tvlUsd >= 50_000_000) return 500;
  return 250;
}

function primaryChain(row: RankedRow): string {
  return row.chains[0] ?? "Ethereum";
}

function otherChain(row: RankedRow): string | null {
  return row.chains.length > 1 ? row.chains[1] : null;
}

// The core action, by category family. Returns [verb phrase, second action].
function coreActions(row: RankedRow, size: number): [string, string] {
  const name = row.name;
  const chain = primaryChain(row);
  const cat = row.category ?? "";
  switch (cat) {
    case "Dexs":
      return [
        `Swap ${money(size)} of USDC for the pool's main asset on ${name} (${chain}), then add ${money(size)} of liquidity to its deepest pool (about ${money(gasUsd(chain))} gas, around 10 minutes).`,
        `Keep the LP position open for at least two weeks and collect the trading fees; re-add liquidity once if the pool's range drifts.`,
      ];
    case "Lending":
      return [
        `Supply ${money(size)} of USDC as collateral on ${name} (${chain}), then borrow a small amount against it and repay it the same week (about ${money(gasUsd(chain))} gas per step, around 15 minutes).`,
        `Leave the supply position earning yield for a month and repeat a borrow-repay cycle once, keeping the health factor above 2.`,
      ];
    case "Yield":
    case "Yield Aggregator":
      return [
        `Deposit ${money(size)} of USDC into the highest-TVL vault on ${name} (${chain}) and confirm the receipt token in your wallet (about ${money(gasUsd(chain))} gas, around 10 minutes).`,
        `Leave the deposit compounding for a month, then harvest or re-deposit the yield once so the vault records two distinct actions.`,
      ];
    case "RWA":
      return [
        `Complete any identity check ${name} asks for, then buy ${money(size)} of its tokenized asset on ${chain} (about ${money(gasUsd(chain))} gas, around 20 minutes).`,
        `Hold the position for at least a month and record the purchase receipt; if the asset pays yield, claim it once.`,
      ];
    case "Derivatives":
      return [
        `Open a small ${money(size)} long on ${name} (${chain}) with low leverage, then close it after a day so the protocol records a full round trip (about ${money(gasUsd(chain) * 2)} gas, around 15 minutes).`,
        `Provide ${money(size)} of liquidity to its perp vault if one is open, and leave it for two weeks.`,
      ];
    case "CDP":
      return [
        `Lock ${money(size)} of collateral in a ${name} vault on ${chain} and mint a modest amount of its stablecoin, keeping the ratio above 200% (about ${money(gasUsd(chain))} gas, around 15 minutes).`,
        `Repay part of the minted stablecoin after a week and leave the vault open so the position stays active.`,
      ];
    case "Risk Curators":
      return [
        `Deposit ${money(size)} of USDC into a curated vault on ${name} (${chain}) and confirm the vault's curator and allocation (about ${money(gasUsd(chain))} gas, around 10 minutes).`,
        `Leave the deposit for a month, then top it up once by ${money(Math.round(size / 2))} so the vault records a second deposit.`,
      ];
    case "Onchain Capital Allocator":
      return [
        `Allocate ${money(size)} of USDC through ${name} on ${chain} into its largest strategy and confirm the allocation receipt (about ${money(gasUsd(chain))} gas, around 10 minutes).`,
        `Check the allocation's performance after two weeks and rebalance once into a second strategy if the interface allows it.`,
      ];
    case "Basis Trading":
      return [
        `Deposit ${money(size)} of USDC into the basis strategy on ${name} (${chain}) and confirm the position receipt (about ${money(gasUsd(chain))} gas, around 10 minutes).`,
        `Leave the position for a full funding cycle of about a month, then add ${money(Math.round(size / 2))} once.`,
      ];
    case "Indexes":
      return [
        `Buy ${money(size)} of the index token on ${name} (${chain}) and hold it in the same wallet you farmed with (about ${money(gasUsd(chain))} gas, around 10 minutes).`,
        `Hold the index for at least a month and rebalance once if the index composition changes.`,
      ];
    case "Privacy":
      return [
        `Deposit ${money(size)} of USDC into the shielded pool on ${name} (${chain}) using a fresh address, and keep the withdrawal note offline (about ${money(gasUsd(chain))} gas, around 15 minutes).`,
        `Withdraw to a different address after a week, then deposit again once so the pool records repeat use.`,
      ];
    default:
      return [
        `Use ${name}'s core feature on ${chain} with ${money(size)}: open its main page, connect your wallet and complete one full transaction end to end (about ${money(gasUsd(chain))} gas, around 10 minutes).`,
        `Repeat the core action once a week for a month so the protocol records sustained use rather than a single visit.`,
      ];
  }
}

export interface FarmPlan {
  steps: string[];
  costUsd: number;
  minutes: number;
}

export function buildFarmPlan(row: RankedRow): FarmPlan {
  const name = row.name;
  const chain = primaryChain(row);
  const second = otherChain(row);
  const size = farmSize(row.tvlUsd);
  const gas = gasUsd(chain);
  const [core, repeat] = coreActions(row, size);

  const steps: string[] = [];
  steps.push(
    `Set up a fresh wallet you control and connect it to ${name} on ${chain}; check the URL matches the protocol's own site before you approve anything (about ${money(gas)} gas, around 5 minutes).`,
  );
  steps.push(
    second
      ? `Move ${money(size)} of USDC to ${chain} with a reputable bridge, or to ${second} if ${chain} is congested, and confirm the balance arrived (bridge fee roughly ${money(1)}-${money(5)}, around 10 minutes).`
      : `Move ${money(size)} of USDC to ${chain} with a reputable bridge and confirm the balance arrived before you touch the protocol (bridge fee roughly ${money(1)}-${money(5)}, around 10 minutes).`,
  );
  steps.push(core);
  steps.push(repeat);
  steps.push(
    `Check whether ${name} runs a points, quest or testnet program right now; if it does, finish its listed tasks with the same wallet, otherwise skip this step (no cost if there is no program).`,
  );
  steps.push(
    `Review the position weekly and keep a note of every transaction hash; withdraw if TVL falls by half or the interface changes unexpectedly, and never sign a blind approval (about 5 minutes a week).`,
  );

  // Cost: one gas payment per on-chain step (1, 3, 4) plus the bridge fee.
  const costUsd = Math.round((gas * 3 + 3) * 100) / 100;
  const minutes = 5 + 10 + 12 + 8 + 10 + 5;
  return { steps, costUsd, minutes };
}
