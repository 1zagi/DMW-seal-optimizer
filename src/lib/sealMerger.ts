// ============================================================
//  sealMerger.ts  —  Combina base data + user data
// ============================================================

import type { SealBase, SealUserData, MergedSeal, Seal } from "./types";

/**
 * Combina datos base (inmutables) con datos de usuario (mutables)
 * 
 * @param baseData Array de SealBase (stats, ranks, requirements)
 * @param userData Map de SealUserData (currentRank, price)
 * @returns Array de MergedSeal listo para usar en la app
 */
export function mergeSealData(
  baseData: SealBase[],
  userData: Map<string, SealUserData>
): Record<string, MergedSeal> {
  const result: Record<string, MergedSeal> = {};

  for (const base of baseData) {
    const user = userData.get(base.id);
    
    const merged: MergedSeal = {
      id: base.id,
      name: base.name,
      stats: base.stats,
      qty: base.qty,
      currentRank: user?.currentRank ?? null,
      priceM: user?.priceM ?? 0,
    };

    result[base.name] = merged;
  }

  return result;
}

/**
 * Extrae user data de un Seal (para guardar)
 */
export function extractUserData(seal: Seal, sealId: string): SealUserData {
  return {
    sealId,
    currentRank: seal.currentRank,
    priceM: seal.priceM,
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
      priceM: oldSeal.priceM,
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
