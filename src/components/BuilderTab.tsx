// ============================================================
//  BuilderTab.tsx  —  DMW Build Planner
//  checkedKeys / checkMode / activeSolution vienen de App
// ============================================================

import { useMemo, useState } from "react";
import type { AppData, Attribute, Rank } from "../lib/types";
import { ATTRIBUTES, ATTR_ICON, RANK_COLOR, PERCENT_ATTRS, formatStat } from "../lib/types";
import { calcCandidates } from "../lib/calculator";
import { optimizeBuild, type BuildSolution } from "../lib/optimizer";
import { TRANSLATIONS, type Lang } from "../lib/i18n";
import { formatM } from "../lib/currency";

type CheckMode = "mark-only" | "update-rank";

interface Props {
  data: AppData;
  lang: Lang;
  selectedAttr: Attribute;
  onAttrChange: (a: Attribute) => void;
  targetStat: string;
  onTargetStatChange: (v: string) => void;
  useSlider: boolean;
  onUseSliderChange: (v: boolean) => void;
  builderMode: "total" | "add";
  onBuilderModeChange: (m: "total" | "add") => void;
  openerPrice: number;
  includeOpener: boolean;
  checkedKeys: Set<string>;
  checkMode: CheckMode;
  activeSolution: "cheapest" | "fewest";
  onActiveSolutionChange: (s: "cheapest" | "fewest") => void;
  onToggleCheck: (key: string, sealName: string, rank: Rank) => void;
  onClearChecks: () => void;
  onCheckModeChange: (m: CheckMode) => void;
}

export function BuilderTab({
  data, lang, selectedAttr, onAttrChange, targetStat, onTargetStatChange,
  useSlider, onUseSliderChange, builderMode, onBuilderModeChange,
  openerPrice, includeOpener,
  checkedKeys, checkMode, activeSolution, onActiveSolutionChange,
  onToggleCheck, onClearChecks, onCheckModeChange,
}: Props) {
  const t = TRANSLATIONS[lang];

  const candidates = useMemo(
    () => calcCandidates(data, selectedAttr, includeOpener ? openerPrice : undefined),
    [data, selectedAttr, includeOpener, openerPrice]
  );

  const isPct        = PERCENT_ATTRS.has(selectedAttr);
  const progress     = data.attrProgress.find(p => p.attribute === selectedAttr);
  const currentStats = progress?.vActual ?? 0;
  const maxStats     = progress?.vMax    ?? 0;

  const toDisplay  = (v: number) => isPct ? parseFloat((v * 100).toPrecision(4)) : v;
  const toInternal = (v: number) => isPct ? v / 100 : v;

  const currentDisplay       = toDisplay(currentStats);
  const maxDisplay           = toDisplay(maxStats);
  const defaultTargetDisplay = parseFloat((currentDisplay + (maxDisplay - currentDisplay) * 0.5).toPrecision(4));
  const displayTarget        = targetStat !== "" ? parseFloat(targetStat) : defaultTargetDisplay;
  const internalTarget       = toInternal(displayTarget);
  const targetNeeded         = builderMode === "total" ? Math.max(0, internalTarget - currentStats) : internalTarget;

  const solutions = useMemo(() => {
    if (targetNeeded <= 0) {
      const e = { items: [], totalCost: 0, totalStats: 0, totalSeals: 0, isFeasible: false };
      return { cheapest: e, fewest: e };
    }
    return optimizeBuild(candidates, targetNeeded, selectedAttr);
  }, [candidates, targetNeeded, selectedAttr]);

  const activeSol    = activeSolution === "cheapest" ? solutions.cheapest : solutions.fewest;
  const hasSolutions = solutions.cheapest.items.length > 0 || solutions.fewest.items.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">🎯 {t.tabBuilder}</h2>
        <p className="text-[#5a8aaa] font-mono text-sm">{t.builderSubtitle}</p>
      </div>

      {/* Config */}
      <div className="p-4 bg-[#09141f] border border-[#1a3f6e] rounded-lg space-y-4">
        <div>
          <label className="text-[#5a8aaa] text-xs font-mono uppercase block mb-2">{t.attribute}</label>
          <select value={selectedAttr} onChange={e => onAttrChange(e.target.value as Attribute)}
            className="w-full px-3 py-2 rounded bg-[#0a1520] border border-[#1a3f6e] text-white font-mono text-sm focus:border-[#00c8f0] focus:outline-none">
            {ATTRIBUTES.map(attr => <option key={attr} value={attr}>{ATTR_ICON[attr]} {attr}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 bg-black/30 rounded">
          <div>
            <p className="text-[#5a8aaa] text-xs font-mono uppercase">{t.builderCurrent}</p>
            <p className="text-[#00c8f0] font-semibold text-lg">{isPct ? `${currentDisplay}%` : currentStats.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[#5a8aaa] text-xs font-mono uppercase">{lang === "es" ? "Máximo posible" : "Max possible"}</p>
            <p className="text-[#7ab0cc] font-semibold text-lg">{isPct ? `${maxDisplay}%` : maxStats.toLocaleString()}</p>
          </div>
        </div>

        <div>
          <label className="text-[#5a8aaa] text-xs font-mono uppercase mb-2 block">{lang === "es" ? "Modo" : "Mode"}</label>
          <div className="grid grid-cols-2 gap-2">
            {(["total", "add"] as const).map(mode => (
              <button key={mode} onClick={() => onBuilderModeChange(mode)}
                className={`px-3 py-2 rounded text-xs font-mono transition-all ${
                  builderMode === mode ? "bg-[#00c8f0]/20 border border-[#00c8f0] text-[#00c8f0]" : "border border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0] hover:text-[#00c8f0]"
                }`}>
                {mode === "total" ? (lang === "es" ? "👁️ Objetivo total" : "👁️ Target total") : (lang === "es" ? "➕ Agregar stats" : "➕ Add stats")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[#5a8aaa] text-xs font-mono uppercase">
              {builderMode === "total" ? t.builderTarget : (lang === "es" ? "Stats a agregar" : "Stats to add")}
            </label>
            <button onClick={() => onUseSliderChange(!useSlider)} className="text-[#00c8f0] text-xs font-mono hover:text-white transition-colors">
              {useSlider ? (lang === "es" ? "Cambiar a input" : "Switch to input") : (lang === "es" ? "Usar slider" : "Use slider")}
            </button>
          </div>
          {useSlider ? (
            <div className="space-y-3">
              <input type="range" min={builderMode === "total" ? currentDisplay : 0}
                max={builderMode === "total" ? maxDisplay : (maxDisplay - currentDisplay)}
                step={isPct ? 0.001 : 1} value={displayTarget} onChange={e => onTargetStatChange(e.target.value)} className="w-full" />
              <div className="flex justify-between text-sm">
                <span className="text-[#5a8aaa] font-mono">{isPct ? `${currentDisplay}%` : currentDisplay.toLocaleString()}</span>
                <span className="text-white font-bold">{isPct ? `${displayTarget}%` : displayTarget.toLocaleString()}</span>
                <span className="text-[#5a8aaa] font-mono">{isPct ? `${maxDisplay}%` : maxDisplay.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <input type="number" value={targetStat} onChange={e => onTargetStatChange(e.target.value)}
                  min={0} step={isPct ? 0.001 : 1} placeholder={String(defaultTargetDisplay)}
                  className="w-full px-3 py-2 pr-10 rounded bg-[#0a1520] border border-[#1a3f6e] text-white font-mono text-sm focus:border-[#00c8f0] focus:outline-none" />
                {isPct && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a8aaa] font-mono text-sm pointer-events-none">%</span>}
              </div>
              <p className="text-[#2a4558] text-xs">
                {lang === "es" ? `Tienes ${currentDisplay}${isPct?"%" : ""}, máximo ${maxDisplay}${isPct?"%" : ""}` : `You have ${currentDisplay}${isPct?"%" : ""}, max ${maxDisplay}${isPct?"%" : ""}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {hasSolutions ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["cheapest", "fewest"] as const).map(s => (
              <button key={s} onClick={() => onActiveSolutionChange(s)}
                className={`px-4 py-2 rounded-lg text-xs font-mono font-bold border transition-all ${
                  activeSolution === s
                    ? s === "cheapest" ? "border-[#00e676] text-[#00e676] bg-[#00e676]/10" : "border-[#ffd700] text-[#ffd700] bg-[#ffd700]/10"
                    : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#5a8aaa]"
                }`}>
                {s === "cheapest" ? (lang === "es" ? "💰 Más barato" : "💰 Cheapest") : (lang === "es" ? "📦 Menos sellos" : "📦 Fewest seals")}
              </button>
            ))}
          </div>

          <SolutionCard solution={activeSol}
            label={activeSolution === "cheapest" ? t.builderCheapest : t.builderFewest}
            sublabel={activeSolution === "cheapest" ? t.builderCheapestDesc : t.builderFewestDesc}
            attr={selectedAttr} isPct={isPct} targetValue={internalTarget} currentStats={currentStats}
            lang={lang} builderMode={builderMode} openerPrice={openerPrice} includeOpener={includeOpener}
            checkedKeys={checkedKeys} checkMode={checkMode}
            onToggleCheck={onToggleCheck} onClearChecks={onClearChecks} onCheckModeChange={onCheckModeChange} />
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

function SolutionCard({
  solution, label, sublabel, attr, isPct, targetValue, currentStats,
  lang, builderMode, openerPrice, includeOpener,
  checkedKeys, checkMode, onToggleCheck, onClearChecks, onCheckModeChange,
}: {
  solution: BuildSolution; label: string; sublabel: string;
  attr: Attribute; isPct: boolean; targetValue: number; currentStats: number;
  lang: Lang; builderMode: "total" | "add"; openerPrice: number; includeOpener: boolean;
  checkedKeys: Set<string>; checkMode: CheckMode;
  onToggleCheck: (key: string, name: string, rank: Rank) => void;
  onClearChecks: () => void;
  onCheckModeChange: (m: CheckMode) => void;
}) {
  const [sortType, setSortType] = useState<"order" | "price" | "efficiency">("efficiency");

  const finalStats   = currentStats + solution.totalStats;
  const isMet        = solution.isFeasible;
  const totalOpeners = solution.items.reduce((s, i) => s + Math.ceil(i.qty / 50), 0);
  const itemKey      = (name: string, rank: string) => `${name}::${rank}`;
  const checkedCount = checkedKeys.size;
  const totalCount   = solution.items.length;
  const allDone      = checkedCount === totalCount && totalCount > 0;

  const sortedItems = useMemo(() => {
    const items = [...solution.items];
    if (sortType === "efficiency") return items.sort((a, b) => (a.statBonus > 0 ? a.totalCostM / a.statBonus : Infinity) - (b.statBonus > 0 ? b.totalCostM / b.statBonus : Infinity));
    if (sortType === "price") return items.sort((a, b) => b.totalCostM - a.totalCostM);
    return items;
  }, [solution.items, sortType]);

  const progressPct = targetValue > 0 ? Math.min(((builderMode === "add" ? solution.totalStats : finalStats) / targetValue) * 100, 100) : 0;
  const borderColor = isMet ? "border-[#00e676]" : "border-[#ff6b6b]";
  const bgColor     = isMet ? "bg-[#0a2a1a]"    : "bg-[#2a1a0a]";
  const barColor    = isMet ? "bg-[#00e676]"    : "bg-[#ff6b6b]";

  return (
    <div className={`p-4 rounded-lg border ${bgColor} ${borderColor}`}>
      <div className="mb-4 pb-3 border-b border-current border-opacity-30">
        <p className="text-sm font-bold text-current">{label}</p>
        <p className="text-xs text-current opacity-70 mt-1">{sublabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-black/30 p-2 rounded"><p className="text-[#5a8aaa] text-xs font-mono uppercase">{lang === "es" ? "Costo" : "Cost"}</p><p className="text-white font-semibold text-sm">{formatM(solution.totalCost)}</p></div>
        <div className="bg-black/30 p-2 rounded"><p className="text-[#5a8aaa] text-xs font-mono uppercase">{lang === "es" ? "Sellos" : "Seals"}</p><p className="text-white font-semibold text-sm">{solution.totalSeals.toLocaleString()}x</p></div>
        {totalOpeners > 0 && <div className="bg-black/30 p-2 rounded col-span-2 flex items-center justify-between"><p className="text-[#5a8aaa] text-xs font-mono uppercase">📦 Openers</p><p className="text-[#ffd700] font-bold text-sm">{totalOpeners}x</p></div>}
      </div>

      <div className="mb-4 pb-3 border-b border-current border-opacity-30">
        <div className="flex justify-between items-center mb-2">
          <p className="text-[#5a8aaa] text-xs font-mono">{builderMode === "add" ? `+${formatStat(attr, solution.totalStats)} / +${formatStat(attr, targetValue)}` : `Total: ${formatStat(attr, finalStats)}`}</p>
          <p className={`text-xs font-mono ${isMet ? "text-[#00e676]" : "text-[#ffd700]"}`}>{isMet ? (lang === "es" ? "✓ Meta alcanzada" : "✓ Goal reached") : (lang === "es" ? "⚠ Incompleto" : "⚠ Incomplete")}</p>
        </div>
        {targetValue > 0 && <div className="w-full h-1.5 bg-black/30 rounded overflow-hidden"><div className={`h-full rounded transition-all ${barColor}`} style={{ width: `${progressPct}%` }} /></div>}
      </div>

      {/* Checklist */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <p className="text-[#5a8aaa] font-mono uppercase text-xs">{lang === "es" ? "Lista de compra" : "Shopping list"}</p>
            {totalCount > 0 && <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${allDone ? "border-[#00e676] text-[#00e676] bg-[#00e676]/10" : "border-[#1a3f6e] text-[#5a8aaa]"}`}>{checkedCount}/{totalCount}</span>}
            {checkedCount > 0 && <button onClick={onClearChecks} className="text-[#2a4558] text-[10px] font-mono hover:text-[#5a8aaa] transition-colors">✕ {lang === "es" ? "limpiar" : "clear"}</button>}
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-[#2a4558] text-[9px] font-mono mr-1">{lang === "es" ? "Al marcar:" : "On check:"}</span>
            {(["mark-only", "update-rank"] as const).map(m => (
              <button key={m} onClick={() => onCheckModeChange(m)}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-all border ${checkMode === m ? m === "update-rank" ? "bg-[#00e676]/15 border-[#00e676] text-[#00e676]" : "bg-[#00c8f0]/15 border-[#00c8f0] text-[#00c8f0]" : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#5a8aaa]"}`}>
                {m === "mark-only" ? (lang === "es" ? "✔ Solo marcar" : "✔ Mark only") : (lang === "es" ? "⬆ Actualizar rank" : "⬆ Update rank")}
              </button>
            ))}
          </div>
        </div>

        {checkMode === "update-rank" && (
          <div className="flex items-start gap-1.5 p-2 rounded bg-[#00e676]/08 border border-[#00e676]/20 mb-2">
            <span className="text-[10px]">ℹ</span>
            <p className="text-[#00e676] text-[10px] font-mono">
              {lang === "es" ? "Al marcar un sello se actualizará tu rank en Gestión. Úsalo solo después de abrir y subir el rank en el juego." : "Checking a seal updates your rank in Manage. Use only after opening and upgrading in-game."}
            </p>
          </div>
        )}

        <div className="flex gap-1 mb-1">
          {(["efficiency", "price", "order"] as const).map(s => (
            <button key={s} onClick={() => setSortType(s)} className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${sortType === s ? "bg-[#00c8f0]/30 border border-[#00c8f0] text-[#00c8f0]" : "border border-[#1a3f6e]/50 text-[#5a8aaa] hover:border-[#00c8f0]/50 hover:text-[#00c8f0]"}`}>
              {s === "efficiency" ? (lang === "es" ? "Eficiente" : "Efficient") : s === "price" ? (lang === "es" ? "Precio" : "Price") : (lang === "es" ? "Original" : "Original")}
            </button>
          ))}
        </div>

        {allDone && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-[#00e676]/10 border border-[#00e676]/40 mb-2">
            <span>🎉</span>
            <span className="text-[#00e676] font-mono text-[11px] font-bold">
              {checkMode === "update-rank" ? (lang === "es" ? "¡Todo comprado y ranks actualizados!" : "All bought and ranks updated!") : (lang === "es" ? "¡Todo comprado! Ya puedes subir tus sellos." : "All bought! You can now upgrade your seals.")}
            </span>
          </div>
        )}

        {sortedItems.map((item, i) => {
          const key    = itemKey(item.name, item.rank);
          const isDone = checkedKeys.has(key);
          const eff    = item.statBonus > 0 ? item.totalCostM / item.statBonus : 0;
          return (
            <div key={`${key}-${i}`} onClick={() => onToggleCheck(key, item.name, item.rank as Rank)}
              className={`flex items-start gap-2.5 p-2 rounded cursor-pointer transition-all select-none ${isDone ? "bg-[#00e676]/08 border border-[#00e676]/20 opacity-60" : "bg-black/30 border border-transparent hover:border-[#1a3f6e]"}`}>
              <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isDone ? "border-[#00e676] bg-[#00e676]" : "border-[#1a3f6e] hover:border-[#5a8aaa]"}`}>
                {isDone && <span className="text-black text-[10px] font-black leading-none">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate transition-all ${isDone ? "line-through text-[#5a8aaa]" : "text-white"}`}>{item.name}</p>
                <p className="text-[#5a8aaa] text-[10px] mt-0.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold mr-1" style={{ color: RANK_COLOR[item.rank as Rank] ?? "#fff", background: `${RANK_COLOR[item.rank as Rank] ?? "#fff"}20`, border: `1px solid ${RANK_COLOR[item.rank as Rank] ?? "#fff"}40` }}>{item.rank}</span>
                  {item.qty.toLocaleString()} {lang === "es" ? "sellos" : "seals"}
                  {Math.ceil(item.qty / 50) > 0 && <span className="text-[#2a4558] ml-1">· {Math.ceil(item.qty / 50)} opener{Math.ceil(item.qty / 50) > 1 ? "s" : ""}</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-semibold text-xs ${isDone ? "text-[#2a4558]" : "text-[#00c8f0]"}`}>+{isPct ? formatStat(attr, item.statBonus) : item.statBonus.toLocaleString()}</p>
                <p className="text-[#5a8aaa] text-[10px]">{formatM(item.totalCostM)}</p>
                {eff > 0 && sortType === "efficiency" && <p className="text-[#2a4558] text-[10px] font-mono">{formatM(eff)}/stat</p>}
              </div>
            </div>
          );
        })}

        {includeOpener && openerPrice > 0 && (
          <p className="text-[#2a4558] text-[10px] font-mono text-center mt-2">💡 {lang === "es" ? "Incluye opener:" : "Includes opener:"} {formatM(openerPrice / 50)}/sello</p>
        )}
      </div>
    </div>
  );
}
