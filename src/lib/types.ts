// ============================================================
//  types.ts  —  Tipos y constantes centrales del proyecto
// ============================================================

export const RANKS = [
  "Unopened", "Normal", "Bronze", "Silver", "Gold", "Platinum", "Master",
] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_ORDER: Record<Rank, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i])
) as Record<Rank, number>;

export const ATTRIBUTES = [
  "AT [Attack Damage]",
  "CT [Critical Hit Rate]",
  "HT [Hit Rate]",
  "HP [Health Points]",
  "DS [Digi-Soul Points]",
  "DE [Defense]",
  "BL [Block Rate]",
  "EV [Evasion]",
  "SK [Skill Damage]",
] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const ATTR_SHORT: Record<Attribute, string> = {
  "AT [Attack Damage]": "AT",
  "CT [Critical Hit Rate]": "CT",
  "HT [Hit Rate]": "HT",
  "HP [Health Points]": "HP",
  "DS [Digi-Soul Points]": "DS",
  "DE [Defense]": "DE",
  "BL [Block Rate]": "BL",
  "EV [Evasion]": "EV",
  "SK [Skill Damage]": "SK",
};

export const ATTR_ICON: Record<Attribute, string> = {
  "AT [Attack Damage]": "⚔️",
  "CT [Critical Hit Rate]": "🎯",
  "HT [Hit Rate]": "🎪",
  "HP [Health Points]": "❤️",
  "DS [Digi-Soul Points]": "💠",
  "DE [Defense]": "🛡️",
  "BL [Block Rate]": "🔰",
  "EV [Evasion]": "💨",
  "SK [Skill Damage]": "✨",
};

export const PERCENT_ATTRS = new Set<Attribute>([
  "CT [Critical Hit Rate]",
  "BL [Block Rate]",
  "EV [Evasion]",
  "SK [Skill Damage]",
]);

export function formatStat(attr: Attribute, value: number): string {
  if (PERCENT_ATTRS.has(attr)) {
    const pct = value * 100;
    return `${parseFloat(pct.toPrecision(4))}%`;
  }
  return Number.isInteger(value)
    ? value.toLocaleString()
    : parseFloat(value.toFixed(4)).toLocaleString();
}

export function parseStat(attr: Attribute, raw: string): number {
  const n = parseFloat(raw);
  if (isNaN(n)) return 0;
  return PERCENT_ATTRS.has(attr) ? n / 100 : n;
}

export const RANK_COLOR: Record<Rank, string> = {
  Unopened: "#4b4b4bff",
  Normal: "#1f68c7",
  Bronze: "#cd7f32",
  Silver: "#b5c4c0",
  Gold: "#f1ce04",
  Platinum: "#2eceb8",
  Master: "#ea75ff",
};

export interface Seal {
  name: string;
  priceM: number;
  qty: Record<Rank, number>;
  stats: Record<Attribute, Record<Rank, number>>;
  currentRank: Rank | null;
}

export interface SealBase {
  id: string;
  name: string;
  stats: Record<Attribute, Record<Rank, number>>;
  qty: Record<Rank, number>;
}

export interface SealUserData {
  sealId: string;
  currentRank: Rank | null;
}

export interface GlobalPrices {
  timestamp: number;
  prices: Record<string, number>;
  /** Timestamp individual por sello — cuándo se actualizó cada precio */
  priceTimestamps?: Record<string, number>;
}

export interface PriceBackup {
  timestamp: number;
  prices: Record<string, number>;
  serverId?: string;
}

export interface MergedSeal extends Seal {
  id: string;
}

export interface AttrProgress {
  attribute: Attribute;
  vActual: number;
  vMax: number;
  progress: number;
}

export interface AppData {
  seals: Record<string, Seal>;
  attrProgress: AttrProgress[];
  lastUpdated: number;
  priceTimestamps?: Record<string, number>;
}
