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

/**
 * Calcula el costo total real incluyendo openers.
 * 
 * La lógica correcta: cada opener abre hasta 50 sellos.
 * Si compras 1 sello, necesitas 1 opener completo (no 1/50 de opener).
 * Si compras 51 sellos, necesitas 2 openers.
 * 
 * totalCost = (qty × sealPrice) + (ceil(qty / 50) × openerPrice)
 */
export function calcEffectiveCost(sealPrice: number, qty: number, openerPrice: number) {
  const openersNeeded = openerPrice > 0 ? Math.ceil(qty / 50) : 0;
  const totalOpenerCost = openersNeeded * openerPrice;
  const totalCost = sealPrice * qty + totalOpenerCost;
  // Para mostrar en UI: costo promedio por sello incluyendo opener
  const effectivePricePerSeal = qty > 0 ? totalCost / qty : sealPrice;
  return { totalCost, openersNeeded, totalOpenerCost, effectivePricePerSeal };
}

// Devuelve todos los candidatos disponibles para un atributo.
// Genera UN candidato por cada combinacion (sello x rank destino) alcanzable.
// El Knapsack en optimizer.ts se encarga de elegir como mucho 1 rank por sello.
export function calcCandidates(data: AppData, attribute: Attribute, openerPrice?: number): Candidate[] {
  const results: Candidate[] = [];

  for (const seal of Object.values(data.seals)) {
    const currentOrder = seal.currentRank ? RANK_ORDER[seal.currentRank] : -1;
    const attrStats = seal.stats[attribute];
    if (!attrStats) continue;
    if (seal.priceM <= 0) continue;
    if (seal.currentRank === "Master") continue;

    const currentStat    = seal.currentRank ? (attrStats[seal.currentRank] ?? 0) : 0;
    const currentRankQty = seal.currentRank ? (seal.qty[seal.currentRank] ?? 0) : 0;

    for (const rank of RANKS) {
      if (RANK_ORDER[rank] <= currentOrder) continue;

      const totalQtyNeeded = seal.qty[rank] ?? 0;
      const statTo         = attrStats[rank] ?? 0;
      const statBonus      = statTo - currentStat;
      const qty            = totalQtyNeeded - currentRankQty;

      if (qty <= 0 || statBonus <= 0) continue;

      const { totalCost: totalCostM } = calcEffectiveCost(seal.priceM, qty, openerPrice ?? 0);
      const efficiency = totalCostM / statBonus;

      results.push({
        name:        seal.name,
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
      });
    }
  }

  return results.sort((a, b) => a.efficiency - b.efficiency);
}
