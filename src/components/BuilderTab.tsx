// ============================================================
//  BuilderTab.tsx  —  Build Planner: compra inteligente
// ============================================================

import { useState, useMemo } from "react";
import type { AppData, Attribute } from "../lib/types";
import { ATTRIBUTES, ATTR_SHORT, ATTR_ICON, RANK_COLOR, PERCENT_ATTRS, formatStat } from "../lib/types";
import { calcCandidates } from "../lib/calculator";
import { optimizeBuild, type BuildSolution } from "../lib/optimizer";
import { TRANSLATIONS, type Lang } from "../lib/i18n";
import { formatM } from "../lib/currency";

interface Props {
  data: AppData;
  lang: Lang;
}

export function BuilderTab({ data, lang }: Props) {
  const t = TRANSLATIONS[lang];
  const [selectedAttr, setSelectedAttr] = useState<Attribute>(ATTRIBUTES[0]);
  const [targetStat, setTargetStat] = useState<string>("");
  const [useSlider, setUseSlider] = useState(false);

  const candidates = useMemo(
    () => calcCandidates(data, selectedAttr, false),
    [data, selectedAttr]
  );

  const isPct = PERCENT_ATTRS.has(selectedAttr);

  const progress = data.attrProgress.find(p => p.attribute === selectedAttr);
  const currentStats = progress?.vActual ?? 0;
  const maxStats = progress?.vMax ?? 0;

  // Para % attrs: trabajamos en display con valores * 100 (el usuario ve "0.30%" como "0.30")
  // Para attrs normales: el usuario trabaja con el valor directo
  const toDisplay = (v: number) => isPct ? parseFloat((v * 100).toPrecision(4)) : v;
  const toInternal = (v: number) => isPct ? v / 100 : v;

  const currentDisplay = toDisplay(currentStats);
  const maxDisplay = toDisplay(maxStats);

  // Valor por defecto: 50% arriba del actual
  const defaultTargetDisplay = parseFloat((currentDisplay + (maxDisplay - currentDisplay) * 0.5).toPrecision(4));

  const displayTarget = targetStat !== "" ? parseFloat(targetStat) : defaultTargetDisplay;
  const internalTarget = toInternal(displayTarget);

  const solution = useMemo(() => {
    if (internalTarget <= 0) {
      const empty = { items: [], totalCost: 0, totalStats: 0, totalSeals: 0, isFeasible: false };
      return { cheapest: empty, fewest: empty };
    }
    return optimizeBuild(candidates, internalTarget);
  }, [candidates, internalTarget]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">🎯 {t.tabBuilder}</h2>
        <p className="text-[#5a8aaa] font-mono text-sm">{t.builderSubtitle}</p>
      </div>

      {/* Inputs */}
      <div className="p-4 bg-[#09141f] border border-[#1a3f6e] rounded-lg space-y-4">
        {/* Attribute selector */}
        <div>
          <label className="text-[#5a8aaa] text-xs font-mono uppercase block mb-2">
            {t.attribute}
          </label>
          <select
            value={selectedAttr}
            onChange={e => {
              setSelectedAttr(e.target.value as Attribute);
              setTargetStat(""); // Reset cuando cambias atributo
            }}
            className="w-full px-3 py-2 rounded bg-[#0a1520] border border-[#1a3f6e] text-white font-mono text-sm focus:border-[#00c8f0] focus:outline-none"
          >
            {ATTRIBUTES.map(attr => (
              <option key={attr} value={attr}>
                {ATTR_ICON[attr]} {ATTR_SHORT[attr]} - {attr}
              </option>
            ))}
          </select>
        </div>

        {/* Current & Max stats */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-black bg-opacity-30 rounded">
          <div>
            <p className="text-[#5a8aaa] text-xs font-mono uppercase">Tienes ahora</p>
            <p className="text-[#00c8f0] font-semibold text-lg">
              {isPct ? `${currentDisplay}%` : currentStats.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[#5a8aaa] text-xs font-mono uppercase">Máximo posible</p>
            <p className="text-[#7ab0cc] font-semibold text-lg">
              {isPct ? `${maxDisplay}%` : maxStats.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Target: Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[#5a8aaa] text-xs font-mono uppercase">Tu meta</label>
            <button
              onClick={() => setUseSlider(!useSlider)}
              className="text-[#00c8f0] text-xs font-mono hover:text-white transition-colors"
            >
              {useSlider ? "Cambiar a input" : "Usar slider"}
            </button>
          </div>

          {useSlider ? (
            <div className="space-y-3">
              <input
                type="range"
                min={currentDisplay}
                max={maxDisplay}
                step={isPct ? 0.001 : 1}
                value={displayTarget}
                onChange={e => setTargetStat(e.target.value)}
                className="w-full"
              />
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#5a8aaa] font-mono">{isPct ? `${currentDisplay}%` : currentDisplay.toLocaleString()}</span>
                <span className="text-white font-bold">{isPct ? `${displayTarget}%` : displayTarget.toLocaleString()}</span>
                <span className="text-[#5a8aaa] font-mono">{isPct ? `${maxDisplay}%` : maxDisplay.toLocaleString()}</span>
              </div>
              <div className="text-center">
                <p className="text-[#00c8f0] font-semibold text-xl">{isPct ? `${displayTarget}%` : displayTarget.toLocaleString()}</p>
                <p className="text-[#2a4558] text-xs">+{isPct ? `${parseFloat((displayTarget - currentDisplay).toPrecision(4))}%` : (displayTarget - currentDisplay).toLocaleString()} desde ahora</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="number"
                  value={targetStat}
                  onChange={e => setTargetStat(e.target.value)}
                  min={0}
                  step={isPct ? 0.001 : 1}
                  className="w-full px-3 py-2 pr-10 rounded bg-[#0a1520] border border-[#1a3f6e] text-white font-mono text-sm focus:border-[#00c8f0] focus:outline-none"
                  placeholder={String(defaultTargetDisplay)}
                />
                {isPct && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a8aaa] font-mono text-sm pointer-events-none">%</span>
                )}
              </div>
              <p className="text-[#2a4558] text-xs">
                {isPct
                  ? `Escribe un % (ej: 0.5). Tienes ${currentDisplay}%, máximo es ${maxDisplay}%`
                  : `Escribe un número. Tienes ${currentDisplay.toLocaleString()}, máximo es ${maxDisplay.toLocaleString()}`
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {solution.cheapest.items.length > 0 || solution.fewest.items.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {/* Solución 1: Más barata */}
          <SolutionCard
            solution={solution.cheapest}
            label={t.builderCheapest}
            sublabel={t.builderCheapestDesc}
            attr={selectedAttr}
            isPct={isPct}
            targetValue={internalTarget}
            currentStats={currentStats}
            type="cost"
          />

          {/* Solución 2: Menos sellos */}
          <SolutionCard
            solution={solution.fewest}
            label={t.builderFewest}
            sublabel={t.builderFewestDesc}
            attr={selectedAttr}
            isPct={isPct}
            targetValue={internalTarget}
            currentStats={currentStats}
            type="seals"
          />
        </div>
      ) : (
        <div className="p-8 text-center bg-[#09141f] border border-[#1a3f6e] rounded-lg">
          <p className="text-[#5a8aaa] font-mono text-sm">{t.builderNoSeals}</p>
          <p className="text-[#2a4558] text-xs mt-2">{t.builderAddSeals}</p>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de solución ──
function SolutionCard({
  solution,
  label,
  sublabel,
  attr,
  isPct,
  targetValue,
  currentStats,
  type,
}: {
  solution: BuildSolution;
  label: string;
  sublabel: string;
  attr: Attribute;
  isPct: boolean;
  targetValue: number;
  currentStats: number;
  type: "cost" | "seals";
}) {
  const finalStats = currentStats + solution.totalStats;
  const isMet = solution.isFeasible;

  return (
    <div className={`p-4 rounded-lg border ${
      isMet
        ? type === "cost"
          ? "bg-[#0a2a1a] border-[#00e676]"
          : "bg-[#1a1a0a] border-[#ffd700]"
        : "bg-[#2a1a0a] border-[#ff6b6b]"
    }`}>
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-current border-opacity-30">
        <p className="text-sm font-bold text-current">{label}</p>
        <p className="text-xs text-current text-opacity-70 mt-1">{sublabel}</p>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div className="bg-black bg-opacity-30 p-2 rounded">
          <p className="text-[#5a8aaa] text-xs font-mono uppercase">Costo</p>
          <p className="text-white font-semibold">{formatM(solution.totalCost)}</p>
        </div>
        <div className="bg-black bg-opacity-30 p-2 rounded">
          <p className="text-[#5a8aaa] text-xs font-mono uppercase">{type === "cost" ? "Stats" : "Sellos"}</p>
          <p className="text-white font-semibold">
            {type === "seals" ? `${solution.totalSeals}x` : isPct ? formatStat(attr, solution.totalStats) : solution.totalStats}
          </p>
        </div>
      </div>

      {/* Final stats + progress */}
      <div className="mb-4 pb-3 border-b border-current border-opacity-30">
        <div className="flex justify-between items-center mb-2">
          <p className="text-[#5a8aaa] text-xs font-mono">Total: {formatStat(attr, finalStats)}</p>
          <p className={`text-xs font-mono ${isMet ? "text-[#00e676]" : "text-[#ffd700]"}`}>
            {isMet ? "✓ Meta alcanzada" : "⚠ Incompleto"}
          </p>
        </div>
        {targetValue > 0 && (
          <div className="w-full h-1.5 bg-black bg-opacity-30 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all ${
                isMet
                  ? type === "cost"
                    ? "bg-[#00e676]"
                    : "bg-[#ffd700]"
                  : "bg-[#ff6b6b]"
              }`}
              style={{ width: `${Math.min((finalStats / targetValue) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Lista de compras */}
      <div className="space-y-2 text-xs">
        <p className="text-[#5a8aaa] font-mono uppercase text-xs">Compra:</p>
        {solution.items.map((item, i) => (
          <div key={`${item.name}-${item.rank}-${i}`} className="flex justify-between items-start gap-2 bg-black bg-opacity-30 p-2 rounded">
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate">{item.name}</p>
              <p className="text-[#5a8aaa] text-xs mt-0.5">
                {item.statFrom > 0 && (
                  <span className="text-[#2a4558] mr-1">
                    {isPct ? formatStat(attr, item.statFrom) : item.statFrom.toLocaleString()} →
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{
                  color: RANK_COLOR[item.rank] ?? "#fff",
                  background: `${(RANK_COLOR[item.rank] ?? "#fff")}20`,
                  border: `1px solid ${(RANK_COLOR[item.rank] ?? "#fff")}40`,
                }}>{item.rank}</span>
                <span className="text-[#2a4558] ml-1">{item.qty.toLocaleString()} sellos</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[#00c8f0] font-semibold text-xs">+{isPct ? formatStat(attr, item.statBonus) : item.statBonus.toLocaleString()}</p>
              <p className="text-[#5a8aaa] text-[10px]">{formatM(item.totalCostM)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
