// ============================================================
//  types.ts  —  Tipos y constantes centrales del proyecto
// ============================================================

// ── Ranks disponibles para un sello, en orden ascendente ──
export const RANKS = [
  "Unopened",
  "Normal",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Master",
] as const;

export type Rank = (typeof RANKS)[number];

// Permite comparar ranks por índice: RANK_ORDER["Bronze"] === 2
export const RANK_ORDER: Record<Rank, number> = Object.fromEntries(
  RANKS.map((r, i) => [r, i])
) as Record<Rank, number>;

// ── Atributos de personaje que los sellos pueden mejorar ──
export const ATTRIBUTES = [
  "AT [Attack Damage]",
  "CT [Critical Hit Rate]",
  "HT [Hit Rate]",
  "HP [Health Points]",
  "DS [Digi-Soul Points]",
  "DE [Defense]",
  "BL [Block Rate]",
  "EV [Evade Rate]",
] as const;

export type Attribute = (typeof ATTRIBUTES)[number];

// Abreviación para mostrar en la UI
export const ATTR_SHORT: Record<Attribute, string> = {
  "AT [Attack Damage]": "AT",
  "CT [Critical Hit Rate]": "CT",
  "HT [Hit Rate]": "HT",
  "HP [Health Points]": "HP",
  "DS [Digi-Soul Points]": "DS",
  "DE [Defense]": "DE",
  "BL [Block Rate]": "BL",
  "EV [Evade Rate]": "EV",
};

export const ATTR_ICON: Record<Attribute, string> = {
  "AT [Attack Damage]": "⚔️",
  "CT [Critical Hit Rate]": "🎯",
  "HT [Hit Rate]": "🎪",
  "HP [Health Points]": "❤️",
  "DS [Digi-Soul Points]": "💠",
  "DE [Defense]": "🛡️",
  "BL [Block Rate]": "🔰",
  "EV [Evade Rate]": "💨",
};

// Atributos que se almacenan como fracción (0.003 = 0.3%) y deben mostrarse como %
export const PERCENT_ATTRS = new Set<Attribute>([
  "CT [Critical Hit Rate]",
  "BL [Block Rate]",
  "EV [Evade Rate]",
]);

/**
 * Formatea un valor de stat para mostrar en la UI.
 * Para PERCENT_ATTRS: almacenado como fracción → muestra "X.XX%"
 * Para el resto: muestra el número con separador de miles.
 *
 * @param attr  Atributo (determina si es porcentaje o no)
 * @param value Valor almacenado (fracción para % attrs, entero para el resto)
 */
export function formatStat(attr: Attribute, value: number): string {
  if (PERCENT_ATTRS.has(attr)) {
    // Convertir fracción → porcentaje con hasta 4 dígitos significativos
    const pct = value * 100;
    return `${parseFloat(pct.toPrecision(4))}%`;
  }
  return Number.isInteger(value)
    ? value.toLocaleString()
    : parseFloat(value.toFixed(4)).toLocaleString();
}

/**
 * Parsea el valor introducido en un input de stat.
 * Para PERCENT_ATTRS: el usuario escribe "0.3" (en %) → se almacena 0.003
 * Para el resto: el usuario escribe "120" → se almacena 120
 */
export function parseStat(attr: Attribute, raw: string): number {
  const n = parseFloat(raw);
  if (isNaN(n)) return 0;
  return PERCENT_ATTRS.has(attr) ? n / 100 : n;
}

// Colores por rank para la UI
export const RANK_COLOR: Record<Rank, string> = {
  Unopened: "#4b4b4bff",
  Normal: "#1f68c7",
  Bronze: "#cd7f32",
  Silver: "#b5c4c0",
  Gold: "#f1ce04",
  Platinum: "#2eceb8",
  Master: "#ea75ff",
};

// ── Estructura de un sello (Digimon) ──
export interface Seal {
  // Nombre del Digimon (también sirve como ID único)
  name: string;

  // Precio individual de cada sello en la tienda, expresado en M
  // Ejemplos: 0.001 = 1B,  1 = 1M,  1000 = 1T
  priceM: number;

  // Cuántos sellos se necesitan para COMPLETAR ese rank (acumulado)
  // Ejemplo: { Normal: 10, Bronze: 100, Silver: 500, ... }
  qty: Record<Rank, number>;

  // Bonus de stat que otorga ese rank (valor acumulado al llegar a ese rank)
  // Ejemplo: stats["AT [Attack Damage]"]["Bronze"] = 30
  stats: Record<Attribute, Record<Rank, number>>;

  // Rank que el jugador ya tiene comprado (null = ninguno)
  currentRank: Rank | null;
}

/**
 * ── NEW: Base data (immutable, controlled by developer) ──
 * Contains all static seal information: stats, ranks, requirements
 */
export interface SealBase {
  id: string; // Unique identifier
  name: string; // Display name (Cherrymon, Patamon, etc)

  // Stats por rank (inmutable)
  stats: Record<Attribute, Record<Rank, number>>;

  // Cuántos sellos se necesitan para completar cada rank
  qty: Record<Rank, number>;
}

/**
 * ── NEW: User data (mutable, edited by player) ──
 * Only contains what users can modify: rank and price
 */
export interface SealUserData {
  sealId: string;
  currentRank: Rank | null;
  priceM: number;
}

/**
 * ── NEW: Merged seal (combines base + user) ──
 * This is what the app actually uses for display/logic
 */
export interface MergedSeal extends Seal {
  id: string; // Added from base for reference
}

// ── Progreso del jugador en cada atributo ──
export interface AttrProgress {
  attribute: Attribute;
  vActual: number; // valor actual del atributo
  vMax: number; // valor máximo posible
  progress: number; // fracción 0-1
}

// ── Estado global de la app ──
export interface AppData {
  seals: Record<string, Seal>;   // clave = seal.name
  attrProgress: AttrProgress[];
  lastUpdated: number;                 // timestamp
}
