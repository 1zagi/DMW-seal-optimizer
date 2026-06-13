// ============================================================
//  newSeals.ts  —  Sistema de resaltado de seals nuevas (DMW)
// ============================================================

const RELEASE_DATE   = new Date("2026-06-13").getTime();
const HIGHLIGHT_DAYS = 14;
const STORAGE_KEY    = "dmw_seen_new_seals";

// ── Seals nuevas del último patch ────────────────────────────
export const NEW_SEALS_DMW = new Set<string>([
  "Meicoomon",
  "Fanglongmon (Shin)",
  "Meicrackmon Vicious Mode",
  "Raguelmon",
  "Ordinemon",
]);

function getSeenSeals(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")); }
  catch { return new Set(); }
}

export function isDMWNew(sealName: string): boolean {
  if (!NEW_SEALS_DMW.has(sealName)) return false;
  if (Date.now() - RELEASE_DATE > HIGHLIGHT_DAYS * 86_400_000) return false;
  return !getSeenSeals().has(sealName);
}

export function markDMWSeen(sealName: string) {
  try {
    const seen = getSeenSeals();
    seen.add(sealName);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
  } catch {}
}
