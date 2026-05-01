// ============================================================
//  currency.ts  —  Manejo de moneda del juego
// ============================================================
//
//  Unidades (base = M):
//    1 B  = 0.001 M
//    1 M  = 1     M
//    1 T  = 1000  M
//
//  Internamente TODO se guarda en M para hacer matemáticas simples.
//  Las funciones de aquí convierten entre M y texto legible.

// Convierte un número en M a texto legible
// Ejemplos: 0.001 → "1 B",  1 → "1 M",  1500 → "1.50 T"
export function formatM(m: number): string {
  if (m === 0) return "0 M";
  if (m >= 1000)  return `${(m / 1000).toFixed(2)} T`;
  if (m >= 1)     return `${m.toFixed(2)} M`;
  if (m >= 0.001) return `${(m * 1000).toFixed(2)} B`;
  return `${m.toFixed(6)} M`; // fallback para valores muy pequeños
}

// Convierte un string con unidad a M
// Acepta: "50 B", "3.5M", "1T", "1000" (sin unidad = M)
export function parseToM(raw: string): number {
  const str = raw.trim().toUpperCase();
  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  if (str.endsWith("T")) return num * 1000;
  if (str.endsWith("M")) return num;
  if (str.endsWith("B")) return num * 0.001;

  return num; // sin unidad → M
}

// Parsea un input numérico simple (el usuario ya eligió la unidad con un select)
export function parseWithUnit(value: string, unit: "B" | "M" | "T"): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  if (unit === "T") return num * 1000;
  if (unit === "B") return num * 0.001;
  return num; // M
}

// Descompone un valor en M a { value, unit } para mostrar en inputs
// Ejemplos: 0.05 → { value: 50, unit: "B" }
//           2.5  → { value: 2.5, unit: "M" }
//           3000 → { value: 3, unit: "T" }
export function splitToUnit(m: number): { value: number; unit: "B" | "M" | "T" } {
  if (m === 0) return { value: 0, unit: "M" };
  if (m >= 1000)  return { value: m / 1000, unit: "T" };
  if (m >= 1)     return { value: m,        unit: "M" };
  return          { value: m * 1000,        unit: "B" };
}
