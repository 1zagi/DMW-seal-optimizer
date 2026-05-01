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

// Devuelve todos los candidatos para un atributo, ordenados por eficiencia (menor primero)
// Solo incluye ranks SUPERIORES al rank actual del jugador
export function calcCandidates(data: AppData, attribute: Attribute): Candidate[] {
  const results: Candidate[] = [];

  for (const seal of Object.values(data.seals)) {
    const currentOrder = seal.currentRank ? RANK_ORDER[seal.currentRank] : -1;
    const attrStats = seal.stats[attribute];
    if (!attrStats) continue;

    for (const rank of RANKS) {
      // Saltar ranks que el jugador ya tiene o son inferiores
      if (RANK_ORDER[rank] <= currentOrder) continue;

      const qty    = seal.qty[rank] ?? 0;
      const statTo = attrStats[rank] ?? 0;

      // Stat del rank inmediatamente anterior (lo que ya tiene el jugador en este sello)
      const prevRank  = RANKS[RANK_ORDER[rank] - 1] as Rank | undefined;
      const statFrom  = prevRank ? (attrStats[prevRank] ?? 0) : 0;

      // La mejora REAL es la diferencia entre el rank objetivo y el anterior
      // Ejemplo: Bronze=40, Silver=80 → subir a Silver da +40, no +80
      const statBonus = statTo - statFrom;

      // Si no tiene cantidad o no da mejora real, ignorar
      if (qty <= 0 || statBonus <= 0) continue;

      // El precio del sello podría ser 0 si no se ha configurado aún
      if (seal.priceM <= 0) continue;

      const totalCostM = seal.priceM * qty;
      const efficiency = totalCostM / statBonus;

      results.push({
        name:        seal.name,
        rank,
        priceM:      seal.priceM,
        qty,
        totalCostM,
        statBonus,
        statFrom,
        statTo,
        efficiency,
        fPrice:      formatM(seal.priceM),
        fTotal:      formatM(totalCostM),
        fEfficiency: formatM(efficiency),
      });
    }
  }

  // Ordenar por eficiencia ascendente (más barato por punto = mejor)
  return results.sort((a, b) => a.efficiency - b.efficiency);
}
