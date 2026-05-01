// ============================================================
//  storage.ts  —  Persistencia de datos en el navegador
// ============================================================
//
//  Usa localStorage para guardar y recuperar el estado de la app.
//  Los datos sobreviven entre sesiones mientras no se limpie el navegador.

import type { AppData } from "./types";
import { ATTRIBUTES, RANKS } from "./types";

const STORAGE_KEY = "izagi-seals-v1";

// Guarda el estado completo en localStorage
export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("[storage] Error al guardar:", e);
  }
}

// Carga el estado desde localStorage. Devuelve null si no hay nada guardado.
export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
}

// Borra todos los datos guardados
export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Estado inicial vacío para cuando el usuario abre la app por primera vez
export function emptyAppData(): AppData {
  return {
    seals: {},
    attrProgress: ATTRIBUTES.map(attr => ({
      attribute: attr,
      vActual:   0,
      vMax:      0,
      progress:  0,
    })),
    lastUpdated: Date.now(),
  };
}

// Carga datos predeterminados desde /seals_data.json (carpeta public/).
// Devuelve null si el archivo no existe o no tiene el formato correcto.
export async function loadDefaultData(): Promise<AppData | null> {
  try {
    const res = await fetch("/seals_data.json");
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.seals) return null;
    return json as AppData;
  } catch {
    return null;
  }
}

// Crea un sello vacío con todos los campos en 0
export function emptySeal(name: string) {
  return {
    name,
    priceM:      0,
    qty:         Object.fromEntries(RANKS.map(r => [r, 0])) as Record<string, number>,
    stats:       Object.fromEntries(
                   ATTRIBUTES.map(a => [a, Object.fromEntries(RANKS.map(r => [r, 0]))])
                 ) as Record<string, Record<string, number>>,
    currentRank: null,
  };
}
