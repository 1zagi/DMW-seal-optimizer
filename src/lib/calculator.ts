// ============================================================
//  calculator.ts  —  Lógica de cálculo de eficiencia
// ============================================================

import type { AppData, AttrProgress, Attribute, Rank } from "./types";
import { ATTRIBUTES, RANKS, RANK_ORDER } from "./types";
import { formatM } from "./currency";

// ── Calcula automáticamente el progreso de cada atributo a partir de los sellos ──
//
// vActual = suma de stats[attr][currentRank] para cada sello con currentRank definido
// vMax    = suma de stats[attr]["Master"] para todos los sellos
//
// Preserva vActual/vMax manuales previos solo si NO hay sellos con datos reales.
export function computeAttrProgress(data: AppData): AttrProgress[] {
  return ATTRIBUTES.map(attr => {
    let vActual = 0;
    let vMax    = 0;

    for (const seal of Object.values(data.seals)) {
      const attrStats = seal.stats?.[attr];
      if (!attrStats) continue;

      // Valor máximo: stat en Master
      vMax += attrStats["Master"] ?? 0;

      // Valor actual: stat en el rank que el jugador ya alcanzó
      if (seal.currentRank) {
        vActual += attrStats[seal.currentRank] ?? 0;
      }
    }

    const progress = vMax > 0 ? vActual / vMax : 0;
    return { attribute: attr, vActual, vMax, progress };
  });
}

// Resultado de evaluar un sello+rank para un atributo
export interface Candidate {
  name:       string; // nombre del Digimon
  rank:       Rank;   // rank objetivo a comprar
  priceM:     number; // precio por sello individual (en M)
  qty:        number; // sellos necesarios para ese rank
  totalCostM: number; // costo total = priceM * qty
  statBonus:  number; // puntos de atributo que GANAS al subir a este rank (delta)
  statFrom:   number; // stat del rank anterior (para mostrar en UI)
  statTo:     number; // stat del rank objetivo (para mostrar en UI)
  efficiency: number; // totalCostM / statBonus (menor = mejor)

  // Versiones formateadas para mostrar en la UI
  fPrice:     string;
  fTotal:     string;
  fEfficiency:string;
}

// Devuelve UN candidato por sello para el Build Planner.
// Para cada sello elige el rank destino que maximiza stat/costo
// (más AT por cada M gastado), tomando en cuenta el rank actual del jugador.
export function calcCandidates(data: AppData, attribute: Attribute, forRanking: boolean = false): Candidate[] {
  const results: Candidate[] = [];

  for (const seal of Object.values(data.seals)) {
    const currentOrder = seal.currentRank ? RANK_ORDER[seal.currentRank] : -1;
    const attrStats = seal.stats[attribute];
    if (!attrStats) continue;
    if (seal.priceM <= 0) continue;
    if (seal.currentRank === "Master") continue;

    const currentStat    = seal.currentRank ? (attrStats[seal.currentRank] ?? 0) : 0;
    const currentRankQty = seal.currentRank ? (seal.qty[seal.currentRank] ?? 0) : 0;

    // Evaluar todos los ranks superiores al actual
    let bestCandidate: Candidate | null = null;

    for (const rank of RANKS) {
      if (RANK_ORDER[rank] <= currentOrder) continue;

      const totalQtyNeeded = seal.qty[rank] ?? 0;
      const statTo         = attrStats[rank] ?? 0;
      const statBonus      = statTo - currentStat;
      const qty            = totalQtyNeeded - currentRankQty;

      if (qty <= 0 || statBonus <= 0) continue;

      const totalCostM = seal.priceM * qty;

      // Métrica: stat ganado por M invertido (mayor = mejor rank destino)
      // statBonus / totalCostM = (statTo - currentStat) / (priceM * qty_adicional)
      // statBonus / totalCostM = (statTo - currentStat) / (priceM * qty_adicional)

      const efficiency = totalCostM / statBonus; // para UI y ranking tab (menor = mejor)

      const candidate: Candidate = {
        name: seal.name,
        rank,
        priceM:      seal.priceM,
        qty,
        totalCostM,
        statBonus,
        statFrom:    currentStat,
        statTo,
        efficiency,
        fPrice:      formatM(seal.priceM),
        fTotal:      formatM(totalCostM),
        fEfficiency: formatM(efficiency),
      };

      // Para el Builder: Elegir el rank con MAYOR statBonus absoluto.
      // Para el Ranking: Elegir el rank con MEJOR eficiencia (menor costo por stat).
      if (forRanking) {
        if (!bestCandidate || efficiency < bestCandidate.efficiency) {
          bestCandidate = candidate;
        }
      } else {
        if (!bestCandidate || statBonus > bestCandidate.statBonus) {
          bestCandidate = candidate;
        }
      }
    }

    if (bestCandidate) results.push(bestCandidate);
  }

  // Ordenar por efficiency (menor costo/stat = mejor) para el ranking tab
  return results.sort((a, b) => a.efficiency - b.efficiency);
}
