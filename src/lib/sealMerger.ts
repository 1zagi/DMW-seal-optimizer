// ============================================================
//  sealMerger.ts  —  Combina base data + user data
// ============================================================

import type { SealBase, SealUserData, MergedSeal, Seal } from "./types";

/**
 * Combina datos base (inmutables) con datos de usuario (mutables) y precios globales
 * 
 * @param baseData Array de SealBase (stats, ranks, requirements)
 * @param userData Map de SealUserData (currentRank only - prices are now global)
 * @param globalPrices Map de precios globales (sealId → priceM)
 * @returns Array de MergedSeal listo para usar en la app
 */
export function mergeSealData(
  baseData: SealBase[],
  userData: Map<string, SealUserData>,
  globalPrices?: Record<string, number>
): Record<string, MergedSeal> {
  const prices = globalPrices || {};
  const result: Record<string, MergedSeal> = {};

  for (const base of baseData) {
    const user = userData.get(base.id);
    
    const merged: MergedSeal = {
      id: base.id,
      name: base.name,
      stats: base.stats,
      qty: base.qty,
      currentRank: user?.currentRank ?? null,
      priceM: prices[base.id] ?? prices[base.name] ?? 0,
    };

    result[base.name] = merged;
  }

  return result;
}

/**
 * Extrae user data de un Seal (para guardar)
 * Nota: priceM ahora es global, no por usuario
 */
export function extractUserData(seal: Seal, sealId: string): SealUserData {
  return {
    sealId,
    currentRank: seal.currentRank,
  };
}

/**
 * Convierte viejo JSON (full seal data) a base + user
 * Para backward compatibility
 */
export function migrateOldSeal(oldSeal: Seal, id: string): { base: SealBase; user: SealUserData } {
  return {
    base: {
      id,
      name: oldSeal.name,
      stats: oldSeal.stats,
      qty: oldSeal.qty,
    },
    user: {
      sealId: id,
      currentRank: oldSeal.currentRank,
    },
  };
}

/**
 * Helper: obtén el stat actual de un sello basado en su currentRank
 */
export function getCurrentStat(
  seal: MergedSeal,
  attribute: string
): number {
  if (!seal.currentRank) return 0;
  const attrStats = seal.stats[attribute as keyof typeof seal.stats];
  return attrStats?.[seal.currentRank] ?? 0;
}
