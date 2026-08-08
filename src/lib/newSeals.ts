// ============================================================
//  newSeals.ts  —  Sistema de resaltado de seals nuevas (DMW)
//
//  Las seals en NEW_SEALS_DMO se resaltan como "nueva" durante
//  HIGHLIGHT_DAYS dias desde RELEASE_DATE.
//  Actualizar lista y fecha con cada patch nuevo.
// ============================================================

const RELEASE_DATE   = new Date("2026-07-23").getTime();
const HIGHLIGHT_DAYS = 30;

export const NEW_SEALS_DMW = new Set<string>([
  // sin seals nuevas por ahora
]);

export function isDMWNew(sealName: string): boolean {
  if (!NEW_SEALS_DMW.has(sealName)) return false;
  if (Date.now() - RELEASE_DATE > HIGHLIGHT_DAYS * 86_400_000) return false;
  return true;
}
