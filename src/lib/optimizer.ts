// ============================================================
//  optimizer.ts  —  Knapsack discretizado para Build Planner
// ============================================================
//
// Discretizamos los stats dividiendo entre el GCD del atributo,
// convirtiendo floats a enteros manejables:
//   AT/HP/DS/DE/HT: GCD=5  ->  max ~4150 estados
//   CT/EV/BL:       GCD=0.0005 -> max ~3600 estados
// Esto permite un Knapsack 0/1 exacto sin freezes.
// Cada sello aparece como mucho 1 vez; sus ranks son opciones exclusivas.

import type { Candidate } from "./calculator";
import type { Attribute } from "./types";

export interface BuildSolution {
  items: (Candidate & { count: number })[];
  totalCost: number;
  totalStats: number;
  totalSeals: number;
  isFeasible: boolean;
}

export interface BuildResult {
  cheapest: BuildSolution;
  fewest: BuildSolution;
}

const ATTR_RESOLUTION: Partial<Record<Attribute, number>> = {
  "AT [Attack Damage]":     5,
  "HP [Health Points]":     5,
  "DS [Digi-Soul Points]":  5,
  "DE [Defense]":           5,
  "HT [Hit Rate]":          5,
  "CT [Critical Hit Rate]": 0.0005,
  "BL [Block Rate]":        0.0005,
  "EV [Evade Rate]":        0.0005,
};

export function optimizeBuild(
  candidates: Candidate[],
  targetStats: number,
  attribute: Attribute,
): BuildResult {
  const empty: BuildSolution = { items: [], totalCost: 0, totalStats: 0, totalSeals: 0, isFeasible: false };
  if (candidates.length === 0 || targetStats <= 0) return { cheapest: empty, fewest: empty };

  const resolution = ATTR_RESOLUTION[attribute] ?? 1;
  const cheapest = knapsack(candidates, targetStats, resolution, "cost");
  const fewest   = knapsack(candidates, targetStats, resolution, "seals");
  return { cheapest, fewest };
}

/**
 * Knapsack 0/1 con discretizacion.
 * - Agrupa candidatos por nombre de sello (opciones mutuamente exclusivas).
 * - Itera cada grupo una vez (garantia 0/1).
 * - Array denso indexado por unidades enteras.
 */
function knapsack(
  candidates: Candidate[],
  targetStats: number,
  resolution: number,
  mode: "cost" | "seals",
): BuildSolution {
  const targetUnits = Math.ceil(targetStats / resolution);

  const bySeal = new Map<string, Candidate[]>();
  for (const c of candidates) {
    if (!bySeal.has(c.name)) bySeal.set(c.name, []);
    bySeal.get(c.name)!.push(c);
  }

  const INF = Infinity;
  type Entry = { score: number; items: (Candidate & { count: number })[] };

  const dp: Entry[] = Array.from({ length: targetUnits + 1 }, (_, i) =>
    i === 0 ? { score: 0, items: [] } : { score: INF, items: [] }
  );

  for (const options of bySeal.values()) {
    const opts = options
      .map(c => ({ c, units: Math.max(1, Math.round(c.statBonus / resolution)) }))
      .filter(o => o.units > 0);
    if (opts.length === 0) continue;

    for (let u = targetUnits - 1; u >= 0; u--) {
      if (dp[u].score === INF) continue;

      for (const { c, units } of opts) {
        const newU = Math.min(u + units, targetUnits);
        const addScore = mode === "cost" ? c.totalCostM : c.qty;
        const newScore = dp[u].score + addScore;

        if (newScore < dp[newU].score) {
          dp[newU] = {
            score: newScore,
            items: [...dp[u].items, { ...c, count: 1 }],
          };
        }
      }
    }
  }

  let best: Entry = dp[targetUnits];
  if (best.score === INF) {
    for (let u = targetUnits - 1; u >= 0; u--) {
      if (dp[u].score < INF) { best = dp[u]; break; }
    }
  }

  if (!best || best.items.length === 0) {
    return { items: [], totalCost: 0, totalStats: 0, totalSeals: 0, isFeasible: false };
  }

  const totalStats = best.items.reduce((s, i) => s + i.statBonus, 0);
  const totalCost  = best.items.reduce((s, i) => s + i.totalCostM, 0);
  const totalSeals = best.items.reduce((s, i) => s + i.qty, 0);

  return { items: best.items, totalCost, totalStats, totalSeals, isFeasible: totalStats >= targetStats };
}
