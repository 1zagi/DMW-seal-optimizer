// ============================================================
//  storage.ts  —  Persistencia de datos en el navegador
// ============================================================
//
//  localStorage structure:
//  - "izagi-seals-v2-base": SealBase[] (loaded from JSON, rarely changes)
//  - "izagi-seals-v2-user": SealUserData[] (user edits: currentRank, price)

import type { AppData, SealBase, SealUserData } from "./types";
import { ATTRIBUTES, RANKS, RANK_ORDER } from "./types";
import { mergeSealData, migrateOldSeal } from "./sealMerger";

const STORAGE_KEY_BASE = "izagi-seals-v2-base";
const STORAGE_KEY_USER = "izagi-seals-v2-user";
const OLD_STORAGE_KEY = "izagi-seals-v1"; // Para migración

/**
 * Carga user data desde localStorage
 */
export function loadUserData(): Map<string, SealUserData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as SealUserData[];
    return new Map(arr.map(u => [u.sealId, u]));
  } catch {
    return new Map();
  }
}

/**
 * Carga base data desde localStorage (fallback)
 */
export function loadBaseData(): SealBase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BASE);
    if (!raw) return [];
    return JSON.parse(raw) as SealBase[];
  } catch {
    return [];
  }
}

/**
 * Guarda user data en localStorage
 */
export function saveUserData(userData: Map<string, SealUserData>): void {
  try {
    const arr = Array.from(userData.values());
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(arr));
  } catch (e) {
    console.error("[storage] Error saving user data:", e);
  }
}

/**
 * Guarda base data en localStorage
 */
export function saveBaseData(baseData: SealBase[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BASE, JSON.stringify(baseData));
  } catch (e) {
    console.error("[storage] Error saving base data:", e);
  }
}

/**
 * NEW: Combina base + user data en AppData
 */
export function mergeStorageToAppData(
  baseData: SealBase[],
  userData: Map<string, SealUserData>
): AppData {
  return {
    seals: mergeSealData(baseData, userData),
    attrProgress: ATTRIBUTES.map(attr => ({
      attribute: attr,
      vActual: 0,
      vMax: 0,
      progress: 0,
    })),
    lastUpdated: Date.now(),
  };
}

/**
 * DEPRECATED: Guarda el estado completo (mantener para tests)
 * Ahora solo guarda user data
 */
export function saveData(data: AppData): void {
  const userData = new Map<string, SealUserData>();
  for (const [name, seal] of Object.entries(data.seals)) {
    // Usa name como ID si no existe mejor alternativa
    userData.set(seal.name || name, {
      sealId: seal.name || name,
      currentRank: seal.currentRank,
      priceM: seal.priceM,
    });
  }
  saveUserData(userData);
}

/**
 * DEPRECATED: Carga el estado completo
 * Intenta migrar si viene del formato antiguo
 */
export function loadData(): AppData | null {
  try {
    // Intenta cargar formato nuevo
    const baseData = loadBaseData();
    if (baseData.length > 0) {
      const userData = loadUserData();
      return mergeStorageToAppData(baseData, userData);
    }

    // Fallback: intenta cargar formato antiguo
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (raw) {
      const old = JSON.parse(raw) as AppData;
      // Migrar automáticamente
      const migrated = migrateOldData(old);
      saveBaseData(migrated.base);
      saveUserData(migrated.user);
      return mergeStorageToAppData(migrated.base, migrated.user);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Migra AppData antiguo a base + user
 */
function migrateOldData(oldData: AppData): { base: SealBase[]; user: Map<string, SealUserData> } {
  const base: SealBase[] = [];
  const user = new Map<string, SealUserData>();

  for (const [name, seal] of Object.entries(oldData.seals)) {
    const id = name; // Usa name como ID temporal
    const { base: b, user: u } = migrateOldSeal(seal, id);
    base.push(b);
    user.set(id, u);
  }

  return { base, user };
}

// Borra todos los datos guardados
export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY_BASE);
  localStorage.removeItem(STORAGE_KEY_USER);
  localStorage.removeItem(OLD_STORAGE_KEY);
}

// Estado inicial vacío para cuando el usuario abre la app por primera vez
export function emptyAppData(): AppData {
  return {
    seals: {},
    attrProgress: ATTRIBUTES.map(attr => ({
      attribute: attr,
      vActual: 0,
      vMax: 0,
      progress: 0,
    })),
    lastUpdated: Date.now(),
  };
}

/**
 * Carga datos base desde /seals_data.json
 */
export async function loadDefaultData(): Promise<AppData | null> {
  try {
    const res = await fetch("/seals_data.json");
    if (!res.ok) return null;
    
    // Espera formato { seals: Seal[] } (antiguo) o { base: SealBase[] }
    const json = await res.json();
    
    // Si tiene "base", usa formato nuevo
    if (json.base && Array.isArray(json.base)) {
      saveBaseData(json.base);
      const userData = loadUserData();
      return mergeStorageToAppData(json.base, userData);
    }
    
    // Si tiene "seals", convierte formato antiguo
    if (json.seals) {
      const appData = json as AppData;
      const migrated = migrateOldData(appData);
      saveBaseData(migrated.base);
      saveUserData(migrated.user);
      return mergeStorageToAppData(migrated.base, migrated.user);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * SMART IMPORT: Mezcla JSON importado.
 * - Si el sello NO existe en base: lo agrega.
 * - Si el sello YA existe: actualiza currentRank y priceM en userData
 *   solo si el JSON importado trae valores válidos (rank distinto de null/Unopened o precio > 0).
 */
/**
 * Import strategy options:
 * - "preserve": Keep existing user data, only add new seals (safest)
 * - "update-ranks": Update ranks if incoming is higher, preserve prices
 * - "overwrite": Fully overwrite with imported data (riskiest)
 */
export type ImportStrategy = "preserve" | "update-ranks" | "overwrite";

export function smartImportData(
  newBaseData: SealBase[],
  newUserData?: Map<string, SealUserData>,
  strategy: ImportStrategy = "update-ranks"
): void {
  const existingBase = loadBaseData();
  const existingIds  = new Set(existingBase.map(b => b.id));

  // Agregar solo base data nueva (NUNCA sobrescribir base data)
  const toAdd = newBaseData.filter(b => !existingIds.has(b.id));
  if (toAdd.length > 0) {
    saveBaseData([...existingBase, ...toAdd]);
  }

  // Actualizar user data según estrategia
  if (newUserData && newUserData.size > 0) {
    const existingUser = loadUserData();

    for (const [id, incoming] of newUserData.entries()) {
      const current = existingUser.get(id);

      if (strategy === "preserve") {
        // Solo agregar si no existe
        if (!current) {
          existingUser.set(id, {
            sealId:      id,
            currentRank: incoming.currentRank ?? null,
            priceM:      incoming.priceM ?? 0,
          });
        }
      } else if (strategy === "update-ranks") {
        // Update rank si incoming es más alto, preservar precios existentes
        const currentRank = current?.currentRank ?? null;
        const currentPrice = current?.priceM ?? 0;

        let newRank = currentRank;
        if (incoming.currentRank && currentRank !== null) {
          const currentIdx = RANK_ORDER[currentRank];
          const incomingIdx = RANK_ORDER[incoming.currentRank];
          if (incomingIdx > currentIdx) {
            newRank = incoming.currentRank;
          }
        } else if (incoming.currentRank && !currentRank) {
          newRank = incoming.currentRank;
        }

        existingUser.set(id, {
          sealId: id,
          currentRank: newRank,
          priceM: incoming.priceM > 0 ? incoming.priceM : currentPrice,
        });
      } else if (strategy === "overwrite") {
        // Fully overwrite
        existingUser.set(id, {
          sealId:      id,
          currentRank: incoming.currentRank ?? null,
          priceM:      incoming.priceM ?? 0,
        });
      }
    }

    saveUserData(existingUser);
  }
}

// DEPRECATED — kept for backward compat
export function smartImportBaseData(newBaseData: SealBase[], strategy: ImportStrategy = "update-ranks"): void {
  smartImportData(newBaseData, undefined, strategy);
}

// Crea un sello vacío con todos los campos en 0
export function emptySeal(name: string) {
  return {
    id: name,
    name,
    stats: Object.fromEntries(
      ATTRIBUTES.map(a => [a, Object.fromEntries(RANKS.map(r => [r, 0]))])
    ) as Record<string, Record<string, number>>,
    qty: Object.fromEntries(RANKS.map(r => [r, 0])) as Record<string, number>,
  } as SealBase;
}
