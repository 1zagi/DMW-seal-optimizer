// ============================================================
//  RankingTab.tsx  —  Rankings + checkboxes del build activo
// ============================================================

import { useMemo } from "react";
import type { AppData, Attribute, Rank } from "../lib/types";
import { ATTRIBUTES, ATTR_SHORT, ATTR_ICON, RANK_COLOR, PERCENT_ATTRS, formatStat } from "../lib/types";
import { calcCandidates, type Candidate } from "../lib/calculator";
import type { BuildSolution } from "../lib/optimizer";
import { TRANSLATIONS, type Lang } from "../lib/i18n";
import { formatM } from "../lib/currency";

type CheckMode = "mark-only" | "update-rank";

interface Props {
  data: AppData;
  lang: Lang;
  selectedAttr: Attribute;
  onAttrChange: (a: Attribute) => void;
  simpleMode: boolean;
  onSimpleModeChange: (v: boolean) => void;
  topN: number;
  onTopNChange: (n: number) => void;
  openerPrice: number;
  includeOpener: boolean;
  buildSolution?: BuildSolution | null;
  checkedKeys?: Set<string>;
  checkMode?: CheckMode;
  onCheckModeChange?: (m: CheckMode) => void;
  onToggleCheck?: (key: string, sealName: string, rank: Rank) => void;
  onClearChecks?: () => void;
}

export function RankingTab({
  data, lang, selectedAttr, onAttrChange, simpleMode, onSimpleModeChange,
  topN, onTopNChange, openerPrice, includeOpener,
  buildSolution, checkedKeys, checkMode = "mark-only",
  onCheckModeChange, onToggleCheck, onClearChecks,
}: Props) {
  const t = TRANSLATIONS[lang];

  const candidates = useMemo(
    () => calcCandidates(data, selectedAttr, includeOpener ? openerPrice : undefined),
    [data, selectedAttr, includeOpener, openerPrice]
  );

  const progress = data.attrProgress.find(p => p.attribute === selectedAttr);
  const isPct    = PERCENT_ATTRS.has(selectedAttr);

  const buildItemMap = useMemo(() => {
    const map = new Map<string, true>();
    if (buildSolution) for (const item of buildSolution.items) map.set(`${item.name}::${item.rank}`, true);
    return map;
  }, [buildSolution]);

  const hasBuild     = buildItemMap.size > 0;
  const checkedCount = checkedKeys?.size ?? 0;
  const totalCount   = buildItemMap.size;
  const allDone      = checkedCount === totalCount && totalCount > 0;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">

      {/* Selector de atributo — horizontal scroll en mobile, vertical en desktop */}
      <div className="lg:w-48 lg:shrink-0">
        <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-widest mb-2 lg:mb-3">{t.attribute}</p>
        {/* Mobile: fila de íconos scrollable */}
        <div className="flex lg:hidden gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {ATTRIBUTES.map(attr => (
            <button key={attr} onClick={() => onAttrChange(attr)}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                selectedAttr === attr
                  ? "bg-[#00c8f0]/15 border border-[#00c8f0]/40 text-[#00c8f0]"
                  : "border border-transparent text-[#5a8aaa] bg-[#09141f] hover:text-white"
              }`}>
              <span>{ATTR_ICON[attr]}</span>
              <span>{ATTR_SHORT[attr]}</span>
            </button>
          ))}
        </div>
        {/* Desktop: columna vertical */}
        <div className="hidden lg:flex flex-col gap-1">
          {ATTRIBUTES.map(attr => (
            <button key={attr} onClick={() => onAttrChange(attr)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left ${
                selectedAttr === attr
                  ? "bg-[#00c8f0]/15 border border-[#00c8f0]/40 text-[#00c8f0]"
                  : "border border-transparent text-[#5a8aaa] hover:text-white hover:bg-[#1a3f6e]/50"
              }`}>
              <span>{ATTR_ICON[attr]}</span>
              <span>{ATTR_SHORT[attr]}</span>
              {PERCENT_ATTRS.has(attr) && <span className="text-[#2a4558] text-xs ml-auto font-normal">%</span>}
              {selectedAttr === attr && !PERCENT_ATTRS.has(attr) && <span className="ml-auto">›</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1">

        {/* Toggle simple/avanzado + modo de check */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {[false, true].map(simple => (
            <button key={String(simple)} onClick={() => onSimpleModeChange(simple)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${
                simpleMode === simple
                  ? "bg-[#00c8f0]/15 border-[#00c8f0]/40 text-[#00c8f0]"
                  : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#2a6496] hover:text-white"
              }`}>
              {simple ? t.modeSimple : t.modeAdvanced}
            </button>
          ))}

          {/* Toggle mark-only / update-rank (siempre visible) */}
          {onCheckModeChange && (
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-[#2a4558] text-[9px] font-mono mr-1">
                {lang === "es" ? "Al marcar:" : "On check:"}
              </span>
              {(["mark-only", "update-rank"] as CheckMode[]).map(mode => (
                <button key={mode} onClick={() => onCheckModeChange(mode)}
                  className={`px-2 py-1 rounded text-[10px] font-mono transition-all border ${
                    checkMode === mode
                      ? mode === "update-rank"
                        ? "bg-[#00e676]/15 border-[#00e676] text-[#00e676]"
                        : "bg-[#00c8f0]/15 border-[#00c8f0] text-[#00c8f0]"
                      : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#5a8aaa]"
                  }`}>
                  {mode === "mark-only"
                    ? (lang === "es" ? "✔ Solo marcar" : "✔ Mark only")
                    : (lang === "es" ? "⬆ Actualizar rank" : "⬆ Update rank")}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Panel de build activo */}
        {hasBuild && onToggleCheck && (
          <div className="mb-5 p-3 bg-[#09141f] border border-[#1a3f6e] rounded-xl">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider">
                {lang === "es" ? "Lista de compra activa" : "Active shopping list"}
              </p>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${
                allDone
                  ? "border-[#00e676] text-[#00e676] bg-[#00e676]/10"
                  : "border-[#1a3f6e] text-[#5a8aaa]"
              }`}>{checkedCount}/{totalCount}</span>

              <div className="flex gap-1 ml-auto">
                {(["mark-only", "update-rank"] as CheckMode[]).map(mode => (
                  <button key={mode} onClick={() => onCheckModeChange?.(mode)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all border ${
                      checkMode === mode
                        ? mode === "update-rank"
                          ? "bg-[#00e676]/15 border-[#00e676] text-[#00e676]"
                          : "bg-[#00c8f0]/15 border-[#00c8f0] text-[#00c8f0]"
                        : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#5a8aaa]"
                    }`}>
                    {mode === "mark-only"
                      ? (lang === "es" ? "✔ Solo marcar" : "✔ Mark only")
                      : (lang === "es" ? "⬆ Actualizar rank" : "⬆ Update rank")}
                  </button>
                ))}
                {checkedCount > 0 && (
                  <button onClick={onClearChecks}
                    className="px-2 py-1 rounded text-[10px] font-mono border border-[#1a3f6e] text-[#2a4558] hover:text-[#5a8aaa] transition-all">
                    ✕
                  </button>
                )}
              </div>
            </div>

            {allDone ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#00e676]/10 border border-[#00e676]/40">
                <span>🎉</span>
                <span className="text-[#00e676] font-mono text-[11px] font-bold">
                  {checkMode === "update-rank"
                    ? (lang === "es" ? "¡Todo comprado y ranks actualizados!" : "All bought and ranks updated!")
                    : (lang === "es" ? "¡Todo comprado!" : "All bought!")}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {buildSolution!.items.map(item => {
                  const key    = `${item.name}::${item.rank}`;
                  const isDone = checkedKeys?.has(key) ?? false;
                  const rc     = RANK_COLOR[item.rank as Rank] ?? "#fff";
                  return (
                    <button key={key}
                      onClick={() => onToggleCheck(key, item.name, item.rank as Rank)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono border transition-all select-none ${
                        isDone
                          ? "opacity-50 border-[#00e676]/30 bg-[#00e676]/08 line-through text-[#5a8aaa]"
                          : "border-[#1a3f6e] hover:border-[#5a8aaa] text-white"
                      }`}>
                      <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                        isDone ? "border-[#00e676] bg-[#00e676]" : "border-[#5a8aaa]"
                      }`}>
                        {isDone && <span className="text-black text-[8px] font-black leading-none">✓</span>}
                      </div>
                      <span className="truncate max-w-[110px]">{item.name}</span>
                      <span className="px-1 rounded text-[9px] font-bold shrink-0"
                        style={{ color: rc, background: `${rc}20`, border: `1px solid ${rc}40` }}>
                        {item.rank}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {checkMode === "update-rank" && !allDone && (
              <p className="text-[#ffd700]/60 text-[9px] font-mono mt-2">
                {lang === "es"
                  ? "⚠ Solo activa si ya abriste los sellos y subiste el rank en el juego."
                  : "⚠ Only use after opening seals and upgrading rank in-game."}
              </p>
            )}
          </div>
        )}

        {simpleMode ? (
          <SimpleModeContent
            candidates={candidates} progress={progress} selectedAttr={selectedAttr}
            isPct={isPct} lang={lang} t={t} buildItemMap={buildItemMap}
            checkedKeys={checkedKeys} onToggleCheck={onToggleCheck}
          />
        ) : (
          <AdvancedModeContent
            candidates={candidates} progress={progress} selectedAttr={selectedAttr}
            isPct={isPct} lang={lang} t={t} topN={topN} onTopNChange={onTopNChange}
            buildItemMap={buildItemMap} checkedKeys={checkedKeys}
            checkMode={checkMode} onToggleCheck={onToggleCheck}
            openerPrice={openerPrice} includeOpener={includeOpener}
          />
        )}
      </div>
    </div>
  );
}

// ── Modo Simple ───────────────────────────────────────────────
function SimpleModeContent({ candidates, progress, selectedAttr, isPct, lang, t, buildItemMap, checkedKeys, onToggleCheck }: {
  candidates: Candidate[]; progress: any; selectedAttr: Attribute;
  isPct: boolean; lang: Lang; t: any;
  buildItemMap: Map<string, true>; checkedKeys?: Set<string>;
  onToggleCheck?: (key: string, name: string, rank: Rank) => void;
}) {
  if (candidates.length === 0) return (
    <div className="p-8 text-center text-[#5a8aaa] font-mono text-sm">
      {t.noSealsAvail}<br/><span className="text-xs">{t.noSealsHint}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      {[candidates[0], candidates[1]].filter(Boolean).map((c, i) => {
        const isFirst   = i === 0;
        const rankColor = RANK_COLOR[c.rank] ?? "#fff";
        const remaining = progress ? (progress.vMax - progress.vActual) : null;
        const pctGain   = remaining && remaining > 0 ? (c.statBonus / remaining) * 100 : null;
        const key       = `${c.name}::${c.rank}`;
        const inBuild   = buildItemMap.has(key);
        const isDone    = checkedKeys?.has(key) ?? false;

        return (
          <div key={c.name}
            className={`p-4 rounded-xl border-2 transition-all ${
              isDone
                ? "opacity-60 bg-[#0a1a0a] border-[#00e676]/30"
                : isFirst ? "bg-[#0a2a1a] border-[#00e676]" : "bg-[#1a1a0a] border-[#ffd700]"
            }`}>
            <div className="flex items-start justify-between mb-2">
              <p className={`text-xs font-mono uppercase ${isFirst ? "text-[#00e676]" : "text-[#ffd700]"}`}>
                {isFirst ? t.bestBuy : t.nextBuy}
              </p>
              {inBuild && onToggleCheck && (
                <button onClick={() => onToggleCheck(key, c.name, c.rank as Rank)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                    isDone
                      ? "border-[#00e676]/40 text-[#00e676] bg-[#00e676]/10"
                      : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00e676]/60 hover:text-[#00e676]"
                  }`}>
                  <div className={`w-3 h-3 rounded border flex items-center justify-center ${
                    isDone ? "border-[#00e676] bg-[#00e676]" : "border-[#5a8aaa]"
                  }`}>
                    {isDone && <span className="text-black text-[8px] font-black">✓</span>}
                  </div>
                  {isDone
                    ? (lang === "es" ? "Comprado" : "Bought")
                    : (lang === "es" ? "Marcar comprado" : "Mark bought")}
                </button>
              )}
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className={`font-bold text-sm mb-1 ${isDone ? "line-through text-[#5a8aaa]" : "text-white"}`}>
                  {c.name}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={{
                    color: rankColor, border: `1px solid ${rankColor}40`, background: `${rankColor}15`,
                  }}>{c.rank}</span>
                  <span className="text-white font-semibold text-sm">
                    {isPct ? `+${formatStat(selectedAttr, c.statBonus)}` : `+${c.statBonus.toLocaleString()}`}
                  </span>
                  {pctGain !== null && (
                    <span className="text-[#5a8aaa] text-xs font-mono">
                      (~{pctGain.toFixed(1)}% {lang === "es" ? "del restante" : "of remaining"})
                    </span>
                  )}
                </div>
                <p className="text-[#5a8aaa] text-xs font-mono mt-1">
                  {c.qty.toLocaleString()} {lang === "es" ? "sellos necesarios" : "seals needed"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[#00c8f0] font-bold text-lg">{c.fTotal}</p>
                <p className="text-[#2a4558] text-xs font-mono">
                  {formatM(c.priceM)}/{lang === "es" ? "sello" : "seal"}
                </p>
              </div>
            </div>

            {isFirst && (
              <div className="mt-3 pt-3 border-t border-[#00e676]/20">
                <p className="text-[#5a8aaa] text-xs font-mono">{t.bestValue}</p>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={() => document.dispatchEvent(new CustomEvent("goto-builder", { detail: { attr: selectedAttr } }))}
        className="w-full py-3 rounded-xl border border-[#00c8f0]/40 text-[#00c8f0] text-xs font-mono hover:bg-[#00c8f0]/10 transition-all flex items-center justify-center gap-2">
        🔨 {lang === "es" ? "Planear build completo para" : "Plan full build for"} {selectedAttr.split(" ")[0]}
        <span className="text-[#2a4558]">→ Build Planner</span>
      </button>
    </div>
  );
}

// ── Modo Avanzado ─────────────────────────────────────────────
function AdvancedModeContent({ candidates, progress, selectedAttr, isPct, lang, t, topN, onTopNChange, buildItemMap, checkedKeys, checkMode, onToggleCheck, openerPrice, includeOpener }: {
  candidates: Candidate[]; progress: any; selectedAttr: Attribute;
  isPct: boolean; lang: Lang; t: any; topN: number; onTopNChange: (n: number) => void;
  buildItemMap: Map<string, true>; checkedKeys?: Set<string>;
  checkMode: CheckMode; onToggleCheck?: (key: string, name: string, rank: Rank) => void;
  openerPrice: number; includeOpener: boolean;
}) {
  return (
    <>
      {progress && (
        <div className="mb-5 p-4 bg-[#09141f] border border-[#1a3f6e] rounded-xl flex flex-wrap gap-6 items-center">
          <div>
            <p className="text-[#5a8aaa] text-xs font-mono uppercase">{t.vActual}</p>
            <p className="text-white font-semibold">{formatStat(selectedAttr, progress.vActual)}</p>
          </div>
          <div>
            <p className="text-[#5a8aaa] text-xs font-mono uppercase">{t.vMax}</p>
            <p className="text-white font-semibold">{formatStat(selectedAttr, progress.vMax)}</p>
          </div>
          <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between mb-1">
              <p className="text-[#5a8aaa] text-xs font-mono uppercase">{t.progress}</p>
              <p className="text-[#00c8f0] text-xs font-mono">{(progress.progress * 100).toFixed(1)}%</p>
            </div>
            <div className="h-2 bg-[#1a3f6e] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#00c8f0] to-[#00aed0] rounded-full"
                style={{ width: `${Math.min(progress.progress * 100, 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <p className="text-[#5a8aaa] text-xs font-mono uppercase">{t.showTop}</p>
        {[3, 5, 10, 20].map(n => (
          <button key={n} onClick={() => onTopNChange(n)}
            className={`px-3 py-1 text-xs font-mono rounded border transition-all ${
              topN === n ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/10"
                : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#2a6496]"
            }`}>{n}</button>
        ))}
        <span className="ml-auto text-[#2a4558] text-xs font-mono">{t.optionsFound(candidates.length)}</span>
      </div>

      <div className="rounded-xl overflow-x-auto border border-[#1a3f6e]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#09141f] border-b border-[#1a3f6e]">
              {["#", "Digimon", "Rank", t.colGain, t.colPrice, t.colSeals, t.colTotal, t.colEfficiency, ""].map((h, idx) => (
                <th key={idx} className={`px-4 py-3 text-[#5a8aaa] font-mono text-xs uppercase ${
                  idx < 3 || idx === 8 ? "text-left" : "text-right"
                }`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates.slice(0, topN).map((c, i) => {
              const key     = `${c.name}::${c.rank}`;
              const inBuild = buildItemMap.has(key);
              const isDone  = checkedKeys?.has(key) ?? false;
              return (
                <CandidateRow key={key} c={c} i={i} attr={selectedAttr} isPct={isPct}
                  inBuild={inBuild} isDone={isDone} checkMode={checkMode}
                  onToggle={onToggleCheck ? () => onToggleCheck(key, c.name, c.rank as Rank) : undefined}
                  lang={lang} />
              );
            })}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[#5a8aaa] font-mono text-sm">
                  {t.noSealsAvail}<br/><span className="text-xs">{t.noSealsHint}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[#2a4558] text-xs font-mono">
        {t.efficiencyNote}
        {includeOpener && openerPrice > 0 && (
          <><br />💡 {lang === "es"
            ? `Opener incluido: ${formatM(openerPrice)}/opener ÷ 50 sellos.`
            : `Opener included: ${formatM(openerPrice)}/opener ÷ 50 seals.`}
          </>
        )}
      </p>
    </>
  );
}

// ── Fila de candidato ─────────────────────────────────────────
function CandidateRow({ c, i, attr, isPct, inBuild, isDone, checkMode, onToggle, lang }: {
  c: Candidate; i: number; attr: Attribute; isPct: boolean;
  inBuild: boolean; isDone: boolean; checkMode: CheckMode;
  onToggle?: () => void; lang: Lang;
}) {
  const rankColor = RANK_COLOR[c.rank] ?? "#fff";
  const rowStyle =
    i === 0 ? "bg-[#0a2a1a] border-l-2 border-[#00e676]" :
    i === 1 ? "bg-[#1a1a0a] border-l-2 border-[#ffd700]" :
    i === 2 ? "bg-[#1a0a0a] border-l-2 border-[#ff6b6b]" :
              "border-l-2 border-transparent";
  const medal  = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
  const fBonus = isPct ? `+${formatStat(attr, c.statBonus)}` : `+${c.statBonus}`;
  const fFrom  = isPct ? formatStat(attr, c.statFrom) : `${c.statFrom}`;
  const fTo    = isPct ? formatStat(attr, c.statTo)   : `${c.statTo}`;

  return (
    <tr className={`border-b border-[#1a3f6e]/50 transition-colors ${rowStyle} ${isDone ? "opacity-50" : "hover:bg-[#1a3f6e]/20"}`}>
      <td className="px-4 py-3 font-mono text-sm">{medal}</td>
      <td className="px-4 py-3 font-semibold">
        <span className={isDone ? "line-through text-[#5a8aaa]" : "text-white"}>{c.name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="px-2 py-0.5 rounded text-xs font-bold" style={{
          color: rankColor, border: `1px solid ${rankColor}40`, background: `${rankColor}15`,
        }}>{c.rank}</span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-[#00c8f0]">
        {fBonus}<span className="text-[#2a4558] text-xs ml-1">({fFrom}→{fTo})</span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-[#7ab0cc]">{c.fPrice}</td>
      <td className="px-4 py-3 text-right font-mono text-[#7ab0cc]">{c.qty.toLocaleString()}</td>
      <td className="px-4 py-3 text-right font-mono text-white font-semibold">{c.fTotal}</td>
      <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: i === 0 ? "#00e676" : "#fff" }}>
        {c.fEfficiency}<span className="text-[#5a8aaa] font-normal text-xs">/pt</span>
      </td>
      <td className="px-3 py-3 text-center w-10">
        {inBuild && onToggle && (
          <button onClick={onToggle}
            title={isDone
              ? (lang === "es" ? "Desmarcar" : "Unmark")
              : checkMode === "update-rank"
                ? (lang === "es" ? "Marcar y actualizar rank" : "Mark and update rank")
                : (lang === "es" ? "Marcar como comprado" : "Mark as bought")}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all ${
              isDone
                ? "border-[#00e676] bg-[#00e676]"
                : checkMode === "update-rank"
                  ? "border-[#00e676]/50 hover:border-[#00e676]"
                  : "border-[#1a3f6e] hover:border-[#5a8aaa]"
            }`}>
            {isDone && <span className="text-black text-[9px] font-black leading-none">✓</span>}
          </button>
        )}
      </td>
    </tr>
  );
}
