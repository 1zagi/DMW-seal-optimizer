// ============================================================
//  noMarketSeals.ts  —  Sellos sin precio de mercado en DMW
//  Incluye: eventos pasados, "próximamente", milestones, etc.
// ============================================================

export const DMW_NO_MARKET_SEALS = new Set<string>([
  // ── Eventos pasados (ya no obtenibles) ──────────────────
  "KingSukamon",
  "PrinceMamemon",
  "Gaioumon Itto Mode",
  "UlforceVeedramon Future Mode",
  "Lotusmon",
  "Bokomon",
  "Sukamon",

  // ── No disponibles aún / no lanzados ────────────────────
  "Marsmon",
  "Gomamon",
  "Sakuyamon",
  "Antylamon",
  "Phantomon",
  "Kuzuhamon",
  "Alphamon",
  "Silphymon",

  // ── Milestones (no tienen precio de mercado) ────────────
  "Calumon",
  "Delumon",
]);

/** Devuelve true si el sello NO tiene mercado activo */
export function isDMWNoMarket(sealName: string): boolean {
  return DMW_NO_MARKET_SEALS.has(sealName);
}
