// ============================================================
//  storage.ts  —  Persistencia de datos en el navegador
// ============================================================
//
//  localStorage structure:
//  - "dmw-seals-v1-base"    : SealBase[]   (base data, compartida)
//  - "dmw-seals-v1-user"    : SealUserData[] (ranks del jugador)
//  - "dmw-prices-global"    : GlobalPrices  (precios — cache local de Supabase)
//  - "dmw-prices-backups"   : PriceBackup[] (historial de precios)
//
//  Precios: vienen de Supabase en tiempo real.
//  El localStorage es solo cache — si Supabase está disponible, sus
//  precios sobreescriben los locales vía useServerPrices en App.tsx.

import type { AppData, SealBase, SealUserData, GlobalPrices, PriceBackup } from "./types";
import { ATTRIBUTES, RANKS, RANK_ORDER } from "./types";
import { mergeSealData, migrateOldSeal } from "./sealMerger";

const STORAGE_KEY_BASE     = "dmw-seals-v1-base";
const STORAGE_KEY_USER     = "dmw-seals-v1-user";
const STORAGE_KEY_PRICES   = "dmw-prices-global";
const STORAGE_KEY_BACKUPS  = "dmw-prices-backups";
const OLD_STORAGE_KEY      = "dmw-seals-v0";
const STORAGE_KEY_OPENER_PRICE   = "dmw-opener-price";
const STORAGE_KEY_INCLUDE_OPENER = "dmw-include-opener";
const MAX_BACKUPS = 50;

// ── User data ─────────────────────────────────────────────────

export function loadUserData(): Map<string, SealUserData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as SealUserData[];
    return new Map(arr.map(u => [u.sealId, u]));
  } catch { return new Map(); }
}

export function saveUserData(userData: Map<string, SealUserData>): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(Array.from(userData.values())));
  } catch (e) { console.error("[storage] saveUserData:", e); }
}

// ── Base data ──────────────────────────────────────────────────

export function loadBaseData(): SealBase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BASE);
    return raw ? (JSON.parse(raw) as SealBase[]) : [];
  } catch { return []; }
}

export function saveBaseData(baseData: SealBase[]): void {
  try { localStorage.setItem(STORAGE_KEY_BASE, JSON.stringify(baseData)); }
  catch (e) { console.error("[storage] saveBaseData:", e); }
}

// ── Global prices (cache local de Supabase) ────────────────────

export function loadGlobalPrices(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRICES);
    return raw ? (JSON.parse(raw) as GlobalPrices).prices || {} : {};
  } catch { return {}; }
}

export function loadPriceTimestamps(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRICES);
    return raw ? (JSON.parse(raw) as GlobalPrices).priceTimestamps || {} : {};
  } catch { return {}; }
}

export function saveGlobalPrices(prices: Record<string, number>, updatedSealId?: string): void {
  try {
    const existing = loadGlobalPrices();
    if (Object.keys(existing).length > 0) createPriceBackup(existing);
    const existingTs = loadPriceTimestamps();
    const now = Date.now();
    const newTs = updatedSealId
      ? { ...existingTs, [updatedSealId]: now }
      : { ...existingTs, ...Object.fromEntries(
          Object.entries(prices)
            .filter(([id, p]) => existing[id] !== p)
            .map(([id]) => [id, now])
        ) };
    const data: GlobalPrices = { timestamp: now, prices, priceTimestamps: newTs };
    localStorage.setItem(STORAGE_KEY_PRICES, JSON.stringify(data));
  } catch (e) { console.error("[storage] saveGlobalPrices:", e); }
}

/** Guarda un solo precio y actualiza su timestamp — para usar en handlePriceChange */
export function saveSinglePrice(sealId: string, priceM: number): void {
  const prices = loadGlobalPrices();
  prices[sealId] = priceM;
  saveGlobalPrices(prices, sealId);
}

// ── Price backups ──────────────────────────────────────────────

export function loadPriceBackups(): PriceBackup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BACKUPS);
    return raw ? (JSON.parse(raw) as PriceBackup[]) : [];
  } catch { return []; }
}

export function createPriceBackup(prices: Record<string, number>): void {
  try {
    const backups = loadPriceBackups();
    if (backups.length > 0) {
      const last = backups[backups.length - 1];
      if (JSON.stringify(last.prices) === JSON.stringify(prices)) return;
    }
    backups.push({ timestamp: Date.now(), prices });
    if (backups.length > MAX_BACKUPS) backups.shift();
    localStorage.setItem(STORAGE_KEY_BACKUPS, JSON.stringify(backups));
  } catch (e) { console.error("[storage] createPriceBackup:", e); }
}

export interface BackupInfo {
  index:     number;
  timestamp: number;
  date:      string;
  time:      string;
  hoursAgo:  number;
  daysAgo:   number;
  label:     string;
}

export function getAvailableBackups(): BackupInfo[] {
  const backups = loadPriceBackups();
  const now = Date.now();
  return backups.map((b, index) => {
    const hoursAgo = Math.round((now - b.timestamp) / 3_600_000);
    const daysAgo  = Math.round((now - b.timestamp) / 86_400_000);
    const d = new Date(b.timestamp);
    let label: string;
    if (hoursAgo < 1)       label = "Just now";
    else if (hoursAgo < 24) label = `${hoursAgo}h ago`;
    else if (daysAgo < 7)   label = `${daysAgo}d ago`;
    else                    label = `${Math.round(daysAgo / 7)}w ago`;
    return { index, timestamp: b.timestamp, date: d.toLocaleDateString(), time: d.toLocaleTimeString(), hoursAgo, daysAgo, label };
  });
}

export function getRecommendedBackups(): { day1?: BackupInfo; day3?: BackupInfo; day7?: BackupInfo } {
  const available = getAvailableBackups();
  return {
    day1: available.find(b => b.hoursAgo >= 18 && b.hoursAgo <= 30),
    day3: available.find(b => b.daysAgo >= 3  && b.daysAgo < 4),
    day7: available.find(b => b.daysAgo >= 6  && b.daysAgo < 8),
  };
}

export function restorePriceBackup(backupIndex: number): boolean {
  try {
    const backups = loadPriceBackups();
    if (backupIndex < 0 || backupIndex >= backups.length) return false;
    saveGlobalPrices(backups[backupIndex].prices);
    return true;
  } catch { return false; }
}

export function getBackupDiff(backupIndex: number): number {
  try {
    const backups = loadPriceBackups();
    if (backupIndex < 0 || backupIndex >= backups.length) return 0;
    const current = loadGlobalPrices();
    return Object.entries(backups[backupIndex].prices)
      .filter(([id, price]) => current[id] !== price).length;
  } catch { return 0; }
}

// ── Merge ──────────────────────────────────────────────────────

export function mergeStorageToAppData(
  baseData: SealBase[],
  userData: Map<string, SealUserData>,
  globalPrices?: Record<string, number>
): AppData {
  const prices = globalPrices ?? loadGlobalPrices();
  return {
    seals: mergeSealData(baseData, userData, prices),
    attrProgress: ATTRIBUTES.map(attr => ({ attribute: attr, vActual: 0, vMax: 0, progress: 0 })),
    lastUpdated: Date.now(),
  };
}

// ── Load / Save ────────────────────────────────────────────────

export function loadData(): AppData | null {
  try {
    const baseData = loadBaseData();
    if (baseData.length > 0) {
      return mergeStorageToAppData(baseData, loadUserData());
    }
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (raw) {
      const migrated = migrateOldData(JSON.parse(raw) as AppData);
      saveBaseData(migrated.base);
      saveUserData(migrated.user);
      saveGlobalPrices(migrated.prices);
      return mergeStorageToAppData(migrated.base, migrated.user, migrated.prices);
    }
    return null;
  } catch { return null; }
}

function migrateOldData(old: AppData): { base: SealBase[]; user: Map<string, SealUserData>; prices: Record<string, number> } {
  const base: SealBase[] = [];
  const user = new Map<string, SealUserData>();
  const prices: Record<string, number> = {};
  for (const [name, seal] of Object.entries(old.seals)) {
    const { base: b, user: u } = migrateOldSeal(seal, name);
    base.push(b); user.set(name, u);
    if (seal.priceM > 0) prices[name] = seal.priceM;
  }
  return { base, user, prices };
}

export function saveData(data: AppData): void {
  const userData = new Map<string, SealUserData>();
  const prices: Record<string, number> = {};
  for (const [name, seal] of Object.entries(data.seals)) {
    userData.set(seal.name || name, { sealId: seal.name || name, currentRank: seal.currentRank });
    if (seal.priceM > 0) prices[seal.name || name] = seal.priceM;
  }
  saveUserData(userData);
  if (Object.keys(prices).length > 0) saveGlobalPrices(prices);
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY_BASE);
  localStorage.removeItem(STORAGE_KEY_USER);
  localStorage.removeItem(STORAGE_KEY_PRICES);
  localStorage.removeItem(STORAGE_KEY_BACKUPS);
  localStorage.removeItem(OLD_STORAGE_KEY);
}

export function emptyAppData(): AppData {
  return {
    seals: {},
    attrProgress: ATTRIBUTES.map(attr => ({ attribute: attr, vActual: 0, vMax: 0, progress: 0 })),
    lastUpdated: Date.now(),
  };
}

// ── loadDefaultData ────────────────────────────────────────────

export async function loadDefaultData(): Promise<AppData | null> {
  try {
    const res = await fetch("/seals_data.json");
    if (!res.ok) return null;
    const json = await res.json();
    if (json.base && Array.isArray(json.base)) {
      saveBaseData(json.base);
      const prices = json.prices || {};
      if (Object.keys(prices).length > 0) saveGlobalPrices(prices);
      return mergeStorageToAppData(json.base, loadUserData(), prices);
    }
    if (json.seals) {
      const migrated = migrateOldData(json as AppData);
      saveBaseData(migrated.base);
      saveUserData(migrated.user);
      saveGlobalPrices(migrated.prices);
      return mergeStorageToAppData(migrated.base, migrated.user, migrated.prices);
    }
    return null;
  } catch { return null; }
}

// ── autoUpdateFromJSON ─────────────────────────────────────────
//
//  Actualiza stats/qty desde el JSON.
//  Precios del JSON SOLO se cargan si el usuario no tiene precios
//  guardados (primera visita). Si ya tiene, los preserva para no
//  pisar cambios hechos vía Supabase o manualmente.

export async function autoUpdateFromJSON(): Promise<boolean> {
  try {
    const res = await fetch("/seals_data.json");
    if (!res.ok) return false;
    const json = await res.json();

    const newBase: SealBase[] = json.base && Array.isArray(json.base)
      ? json.base
      : json.seals
        ? Object.values(json.seals as Record<string, any>).map((s: any) => ({
            id: s.name || s.id, name: s.name, stats: s.stats, qty: s.qty,
          }))
        : null;
    if (!newBase) return false;

    const jsonPrices: Record<string, number> = json.prices || {};
    if (json.seals) {
      for (const s of Object.values(json.seals as Record<string, any>)) {
        if ((s.name || s.id) && (s as any).priceM > 0)
          jsonPrices[s.name || s.id] = (s as any).priceM;
      }
    }

    const hasSavedPrices = Object.keys(loadGlobalPrices()).length > 0;

    if (hasSavedPrices) {
      smartImportData(newBase, undefined, undefined, "auto-sync");
    } else {
      smartImportData(newBase, undefined, jsonPrices, "auto-sync");
    }

    return true;
  } catch (err) {
    console.error("[storage] autoUpdateFromJSON:", err);
    return false;
  }
}

// ── Smart import ───────────────────────────────────────────────

export type ImportStrategy = "preserve" | "update-ranks" | "overwrite" | "auto-sync";

export function smartImportData(
  newBaseData: SealBase[],
  newUserData?: Map<string, SealUserData>,
  newPrices?: Record<string, number>,
  strategy: ImportStrategy = "update-ranks"
): void {
  const existingBase   = loadBaseData();
  const existingIds    = new Set(existingBase.map(b => b.id));
  const existingPrices = loadGlobalPrices();

  if (strategy === "auto-sync") {
    const updated = existingBase.map(e => {
      const inc = newBaseData.find(b => b.id === e.id);
      return inc ? { ...e, stats: inc.stats, qty: inc.qty } : e;
    });
    saveBaseData(updated);
  }
  const toAdd = newBaseData.filter(b => !existingIds.has(b.id));
  if (toAdd.length > 0) {
    const current = strategy === "auto-sync" ? loadBaseData() : existingBase;
    saveBaseData([...current, ...toAdd]);
  }

  if (newPrices && Object.keys(newPrices).length > 0) {
    let updated = { ...existingPrices };
    if (strategy === "preserve") {
      toAdd.forEach(b => { if (newPrices[b.id] && !updated[b.id]) updated[b.id] = newPrices[b.id]; });
    } else if (strategy === "overwrite") {
      updated = newPrices;
    } else {
      updated = { ...updated, ...newPrices };
    }
    saveGlobalPrices(updated);
  }

  if (newUserData && newUserData.size > 0) {
    const existing = loadUserData();
    for (const [id, incoming] of newUserData.entries()) {
      const current = existing.get(id);
      if (strategy === "preserve") {
        if (!current) existing.set(id, { sealId: id, currentRank: incoming.currentRank ?? null });
      } else if (strategy === "update-ranks") {
        const cur = current?.currentRank ?? null;
        let newRank = cur;
        if (incoming.currentRank) {
          if (!cur || RANK_ORDER[incoming.currentRank] > RANK_ORDER[cur]) newRank = incoming.currentRank;
        }
        existing.set(id, { sealId: id, currentRank: newRank });
      } else if (strategy === "overwrite") {
        existing.set(id, { sealId: id, currentRank: incoming.currentRank ?? null });
      } else if (strategy === "auto-sync") {
        existing.set(id, { sealId: id, currentRank: current?.currentRank ?? null });
      }
    }
    saveUserData(existing);
  }
}

// kept for backward compat
export function smartImportBaseData(newBaseData: SealBase[], strategy: ImportStrategy = "update-ranks"): void {
  smartImportData(newBaseData, undefined, undefined, strategy);
}

// ── Seal vacío ─────────────────────────────────────────────────

export function emptySeal(name: string): SealBase {
  return {
    id: name, name,
    stats: Object.fromEntries(ATTRIBUTES.map(a => [a, Object.fromEntries(RANKS.map(r => [r, 0]))])) as any,
    qty:   Object.fromEntries(RANKS.map(r => [r, 0])) as any,
  };
}

// ── Opener settings ────────────────────────────────────────────

export function saveOpenerPrice(v: number): void   { localStorage.setItem(STORAGE_KEY_OPENER_PRICE, String(v)); }
export function loadOpenerPrice(): number           { return parseFloat(localStorage.getItem(STORAGE_KEY_OPENER_PRICE) ?? "0") || 0; }
export function saveIncludeOpener(v: boolean): void { localStorage.setItem(STORAGE_KEY_INCLUDE_OPENER, v ? "1" : "0"); }
export function loadIncludeOpener(): boolean        { return localStorage.getItem(STORAGE_KEY_INCLUDE_OPENER) === "1"; }
