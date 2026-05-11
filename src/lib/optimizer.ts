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
//
// FIX: el dp ahora solo guarda (score, prevU, chosenOpt) por celda —
// traceback al final en O(n) en vez de copiar arrays en cada paso.
// Esto elimina el crash de memoria (pantalla negra) con targets grandes.

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
  "EV [Evasion]":           0.0005,
  "SK [Skill Damage]":      5,
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
 * Knapsack 0/1 con discretización + traceback.
 *
 * score[u]     = mejor puntaje acumulado para llegar a u unidades
 * prevU[u]     = índice u del que venimos (para reconstruir la solución)
 * usedSeal[u]  = índice del sealGroup elegido al llegar a u
 * usedOpt[u]   = índice dentro del grupo elegido al llegar a u
 *
 * Al terminar, reconstruimos los items haciendo traceback desde bestU → 0.
 */
function knapsack(
  candidates: Candidate[],
  targetStats: number,
  resolution: number,
  mode: "cost" | "seals",
): BuildSolution {
  const targetUnits = Math.ceil(targetStats / resolution);

  // Agrupar candidatos por sello (opciones mutuamente exclusivas por sello)
  const bySeal = new Map<string, Candidate[]>();
  for (const c of candidates) {
    if (!bySeal.has(c.name)) bySeal.set(c.name, []);
    bySeal.get(c.name)!.push(c);
  }

  const sealGroups = [...bySeal.values()];

  // Pre-calcular units por candidato
  type Opt = { c: Candidate; units: number };
  const sealOpts: Opt[][] = sealGroups.map(group =>
    group
      .map(c => ({ c, units: Math.max(1, Math.round(c.statBonus / resolution)) }))
      .filter(o => o.units > 0)
  );

  const INF = Infinity;

  // dp arrays paralelos — solo números/índices, sin objetos anidados
  const score    = new Float64Array(targetUnits + 1).fill(INF);
  const prevU    = new Int32Array(targetUnits + 1).fill(-1);
  const usedSeal = new Int16Array(targetUnits + 1).fill(-1);
  const usedOpt  = new Int16Array(targetUnits + 1).fill(-1);

  score[0] = 0;

  for (let si = 0; si < sealOpts.length; si++) {
    const opts = sealOpts[si];
    if (opts.length === 0) continue;

    // Recorrer de mayor a menor para garantía 0/1 (cada sello elegido una sola vez)
    for (let u = targetUnits - 1; u >= 0; u--) {
      if (score[u] === INF) continue;

      for (let oi = 0; oi < opts.length; oi++) {
        const { c, units } = opts[oi];
        const newU     = Math.min(u + units, targetUnits);
        const addScore = mode === "cost" ? c.totalCostM : c.qty;
        const newScore = score[u] + addScore;

        if (newScore < score[newU]) {
          score[newU]    = newScore;
          prevU[newU]    = u;
          usedSeal[newU] = si;
          usedOpt[newU]  = oi;
        }
      }
    }
  }

  // Encontrar la mejor celda alcanzable (targetUnits o la más cercana por debajo)
  let bestU = targetUnits;
  if (score[bestU] === INF) {
    for (let u = targetUnits - 1; u >= 0; u--) {
      if (score[u] < INF) { bestU = u; break; }
    }
  }

  if (score[bestU] === INF || bestU === 0) {
    return { items: [], totalCost: 0, totalStats: 0, totalSeals: 0, isFeasible: false };
  }

  // Traceback para reconstruir los items elegidos
  const items: (Candidate & { count: number })[] = [];
  let cur = bestU;
  while (cur > 0 && prevU[cur] !== -1) {
    const si = usedSeal[cur];
    const oi = usedOpt[cur];
    if (si >= 0 && oi >= 0) {
      items.push({ ...sealOpts[si][oi].c, count: 1 });
    }
    cur = prevU[cur];
  }

  if (items.length === 0) {
    return { items: [], totalCost: 0, totalStats: 0, totalSeals: 0, isFeasible: false };
  }

  const totalStats = items.reduce((s, i) => s + i.statBonus, 0);
  const totalCost  = items.reduce((s, i) => s + i.totalCostM, 0);
  const totalSeals = items.reduce((s, i) => s + i.qty, 0);

  return { items, totalCost, totalStats, totalSeals, isFeasible: totalStats >= targetStats };
}
