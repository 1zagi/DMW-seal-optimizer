// ============================================================
//  newSeals.ts  —  Sistema de resaltado de seals nuevas (DMW)
// ============================================================

const RELEASE_DATE   = new Date("2026-06-13").getTime();
const HIGHLIGHT_DAYS = 14;

// ── Seals nuevas del último patch ────────────────────────────
export const NEW_SEALS_DMW = new Set<string>([
  "Meicoomon",
  "Fanglongmon (Shin)",
  "Meicrackmon Vicious Mode",
  "Raguelmon",
  "Ordinemon",
]);

export function isDMWNew(sealName: string): boolean {
  if (!NEW_SEALS_DMW.has(sealName)) return false;
  if (Date.now() - RELEASE_DATE > HIGHLIGHT_DAYS * 86_400_000) return false;
  return true;
}
