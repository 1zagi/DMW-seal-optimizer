// ============================================================
//  optimizer.ts  —  Build Planner solver
// ============================================================
//
// Estrategia: greedy por eficiencia (costo/stat o seals/stat).
// Para cada sello solo se elige UN rank destino (el más conveniente
// según el criterio). Esto es O(n log n) y nunca congela la UI.
// La solución no es óptima en sentido estricto pero es muy buena
// y práctica para el caso real (pocos sellos relevantes).

import type { Candidate } from "./calculator";

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

export function optimizeBuild(
  candidates: Candidate[],
  targetStats: number,
): BuildResult {
  if (candidates.length === 0 || targetStats <= 0) {
    const empty: BuildSolution = { items: [], totalCost: 0, totalStats: 0, totalSeals: 0, isFeasible: false };
    return { cheapest: empty, fewest: empty };
  }

  // Para cada sello elegimos el rank destino óptimo según criterio
  const cheapest = greedySolve(candidates, targetStats, "cost");
  const fewest   = greedySolve(candidates, targetStats, "seals");

  return { cheapest, fewest };
}

/**
 * Greedy: para cada sello elige el rank destino óptimo según criterio,
 * luego ordena los sellos elegidos y los acumula hasta llegar al target.
 *
 * Lógica de selección de rank por sello:
 * - mode "cost":  entre todos los ranks del sello, elige el que tenga
 *                 mejor efficiency (costo/stat). Si varios tienen la misma
 *                 efficiency, prefiere el de mayor statBonus.
 * - mode "seals": entre todos los ranks del sello, elige el que tenga
 *                 menor qty/statBonus. Si empatan, prefiere mayor statBonus.
 *
 * Esto evita el problema de que Normal (costo total bajo) sea siempre
 * elegido sobre Silver/Platinum que dan mucho más stat por el mismo precio.
 */
function greedySolve(
  candidates: Candidate[],
  targetStats: number,
  mode: "cost" | "seals"
): BuildSolution {
  // candidates ya tiene 1 candidato por sello (elegido en calcCandidates).
  // Solo ordenar por el criterio y acumular.
  const score = (c: Candidate) =>
    mode === "cost" ? c.efficiency : c.qty / c.statBonus;

  const sorted = [...candidates].sort((a, b) => score(a) - score(b));

  const items: (Candidate & { count: number })[] = [];
  let totalStats = 0;
  let totalCost  = 0;
  let totalSeals = 0;

  for (const c of sorted) {
    if (totalStats >= targetStats) break;
    items.push({ ...c, count: 1 });
    totalStats += c.statBonus;
    totalCost  += c.totalCostM;
    totalSeals += c.qty;
  }

  return { items, totalCost, totalStats, totalSeals, isFeasible: totalStats >= targetStats };
}
