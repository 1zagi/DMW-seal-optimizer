// ============================================================
//  optimizer.ts  —  Multiple-Choice Knapsack estable
// ============================================================
//
// Solución robusta:
//   - Máximo 1 rank por seal
//   - Sin traceback corrupto
//   - Sin duplicados
//   - Sin estados mezclados
//
// Estrategia:
//   Cada celda del DP guarda:
//
//     {
//       score,
//       items
//     }
//
//   Esto consume más memoria que un traceback optimizado,
//   pero para ~300-400 seals sigue siendo perfectamente viable
//   y muchísimo más estable.
//
// ============================================================

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
  "AT [Attack Damage]": 5,
  "HP [Health Points]": 5,
  "DS [Digi-Soul Points]": 5,
  "DE [Defense]": 5,
  "HT [Hit Rate]": 5,
  "CT [Critical Hit Rate]": 0.0005,
  "BL [Block Rate]": 0.0005,
  "EV [Evasion]": 0.0005,
  "SK [Skill Damage]": 5,
};

const OVERSHOOT_UNITS = 200;

type DPState = {
  score: number;
  items: Candidate[];
} | null;

export function optimizeBuild(
  candidates: Candidate[],
  targetStats: number,
  attribute: Attribute,
): BuildResult {

  const empty: BuildSolution = {
    items: [],
    totalCost: 0,
    totalStats: 0,
    totalSeals: 0,
    isFeasible: false,
  };

  if (candidates.length === 0 || targetStats <= 0) {
    return {
      cheapest: empty,
      fewest: empty,
    };
  }

  const resolution = ATTR_RESOLUTION[attribute] ?? 1;

  return {
    cheapest: knapsack(candidates, targetStats, resolution, "cost"),
    fewest: knapsack(candidates, targetStats, resolution, "seals"),
  };
}

function knapsack(
  candidates: Candidate[],
  targetStats: number,
  resolution: number,
  mode: "cost" | "seals",
): BuildSolution {

  const targetUnits = Math.ceil(targetStats / resolution);
  const maxUnits = targetUnits + OVERSHOOT_UNITS;

  // ============================================================
  // AGRUPAR POR SEAL
  // ============================================================

  const bySeal = new Map<string, Candidate[]>();

  for (const c of candidates) {

    if (!bySeal.has(c.id)) {
      bySeal.set(c.id, []);
    }

    bySeal.get(c.id)!.push(c);
  }

  const sealGroups = [...bySeal.values()];

  // ============================================================
  // DP
  // ============================================================

  const dp: DPState[] = Array(maxUnits + 1).fill(null);

  dp[0] = {
    score: 0,
    items: [],
  };

  // ============================================================
  // MULTIPLE-CHOICE KNAPSACK
  // ============================================================

  for (const group of sealGroups) {

    // snapshot previo
    const prev = [...dp];

    // copiar estados actuales
    const next = [...dp];

    for (const candidate of group) {

      const units = Math.max(
        1,
        Math.round(candidate.statBonus / resolution)
      );

      const addScore =
        mode === "cost"
          ? candidate.totalCostM
          : candidate.qty;

      for (let u = 0; u <= maxUnits - units; u++) {

        const state = prev[u];

        if (!state) continue;

        const newU = u + units;

        // seguridad extra:
        // nunca repetir mismo seal
        const alreadyUsed = state.items.some(
          i => i.id === candidate.id
        );

        if (alreadyUsed) continue;

        const newScore = state.score + addScore;

        const existing = next[newU];

        if (!existing || newScore < existing.score) {

          next[newU] = {
            score: newScore,
            items: [
              ...state.items,
              candidate,
            ],
          };
        }
      }
    }

    // avanzar capa
    for (let i = 0; i <= maxUnits; i++) {
      dp[i] = next[i];
    }
  }

  // ============================================================
  // BUSCAR MEJOR SOLUCIÓN
  // ============================================================

  let bestState: DPState = null;

  for (let u = targetUnits; u <= maxUnits; u++) {

    const state = dp[u];

    if (!state) continue;

    if (!bestState || state.score < bestState.score) {
      bestState = state;
    }
  }

  // si no alcanza meta -> mejor parcial
  if (!bestState) {

    for (let u = maxUnits; u >= 0; u--) {

      if (dp[u]) {
        bestState = dp[u];
        break;
      }
    }
  }

  if (!bestState) {

    return {
      items: [],
      totalCost: 0,
      totalStats: 0,
      totalSeals: 0,
      isFeasible: false,
    };
  }

  // ============================================================
  // RESULTADO
  // ============================================================

  const items = bestState.items.map(i => ({
    ...i,
    count: 1,
  }));

  const totalStats = items.reduce(
    (s, i) => s + i.statBonus,
    0
  );

  const totalCost = items.reduce(
    (s, i) => s + i.totalCostM,
    0
  );

  const totalSeals = items.reduce(
    (s, i) => s + i.qty,
    0
  );

  return {
    items,
    totalCost,
    totalStats,
    totalSeals,
    isFeasible: totalStats >= targetStats,
  };
}