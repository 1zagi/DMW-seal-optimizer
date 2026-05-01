// ============================================================
//  RankingTab.tsx  —  Pestaña principal de eficiencia
// ============================================================

import { useState, useMemo } from "react";
import type { AppData, Attribute } from "../lib/types";
import { ATTRIBUTES, ATTR_SHORT, ATTR_ICON, RANK_COLOR, PERCENT_ATTRS, formatStat } from "../lib/types";
import { calcCandidates, type Candidate } from "../lib/calculator";
import { TRANSLATIONS, type Lang } from "../lib/i18n";

interface Props {
  data: AppData;
  lang: Lang;
}

export function RankingTab({ data, lang }: Props) {
  const t = TRANSLATIONS[lang];
  const [selectedAttr, setSelectedAttr] = useState<Attribute>(ATTRIBUTES[0]);
  const [topN, setTopN] = useState(5);
  const [simpleMode, setSimpleMode] = useState(false);

  const candidates = useMemo(
    () => calcCandidates(data, selectedAttr),
    [data, selectedAttr]
  );

  const progress = data.attrProgress.find(p => p.attribute === selectedAttr);
  const isPct = PERCENT_ATTRS.has(selectedAttr);

  return (
    <div className="flex gap-6">

      {/* ── Selector de atributo ── */}
      <div className="w-48 shrink-0">
        <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-widest mb-3">{t.attribute}</p>
        <div className="flex flex-col gap-1">
          {ATTRIBUTES.map(attr => (
            <button
              key={attr}
              onClick={() => setSelectedAttr(attr)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left ${
                selectedAttr === attr
                  ? "bg-[#00c8f0]/15 border border-[#00c8f0]/40 text-[#00c8f0]"
                  : "border border-transparent text-[#5a8aaa] hover:text-white hover:bg-[#1a3f6e]/50"
              }`}
            >
              <span>{ATTR_ICON[attr]}</span>
              <span>{ATTR_SHORT[attr]}</span>
              {PERCENT_ATTRS.has(attr) && (
                <span className="text-[#2a4558] text-xs ml-auto font-normal">%</span>
              )}
              {selectedAttr === attr && !PERCENT_ATTRS.has(attr) && <span className="ml-auto">›</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido principal ── */}
      <div className="flex-1">

        {/* Toggle modo Simple/Avanzado */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setSimpleMode(false)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${
              !simpleMode
                ? "bg-[#00c8f0]/15 border-[#00c8f0]/40 text-[#00c8f0]"
                : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#2a6496] hover:text-white"
            }`}
          >
            {t.modeAdvanced}
          </button>
          <button
            onClick={() => setSimpleMode(true)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${
              simpleMode
                ? "bg-[#00c8f0]/15 border-[#00c8f0]/40 text-[#00c8f0]"
                : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#2a6496] hover:text-white"
            }`}
          >
            {t.modeSimple}
          </button>
        </div>

        {simpleMode ? (
          <>
            {/* ── MODO SIMPLE ── */}
            {candidates.length > 0 ? (
              <div className="space-y-4">
                {/* TOP 1: Compra esto */}
                {candidates[0] && (
                  <div className="p-5 bg-[#0a2a1a] border-2 border-[#00e676] rounded-xl">
                    <p className="text-[#00e676] text-xs font-mono uppercase mb-2">{t.bestBuy}</p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[#5a8aaa] text-xs font-mono mb-1">{candidates[0].name}</p>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded text-xs font-bold" style={{
                            color: RANK_COLOR[candidates[0].rank] ?? "#fff",
                            border: `1px solid ${(RANK_COLOR[candidates[0].rank] ?? "#fff")}40`,
                            background: `${(RANK_COLOR[candidates[0].rank] ?? "#fff")}15`,
                          }}>{candidates[0].rank}</span>
                          <span className="text-white font-semibold">
                            {isPct ? `+${formatStat(selectedAttr, candidates[0].statBonus)}` : `+${candidates[0].statBonus}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-[#00c8f0]">💰 {candidates[0].fTotal}</span>
                        <span className="text-[#5a8aaa] text-xs">{t.bestValue}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TOP 2: Siguiente */}
                {candidates[1] && (
                  <div className="p-5 bg-[#1a1a0a] border-2 border-[#ffd700] rounded-xl">
                    <p className="text-[#ffd700] text-xs font-mono uppercase mb-2">{t.nextBuy}</p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[#5a8aaa] text-xs font-mono mb-1">{candidates[1].name}</p>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded text-xs font-bold" style={{
                            color: RANK_COLOR[candidates[1].rank] ?? "#fff",
                            border: `1px solid ${(RANK_COLOR[candidates[1].rank] ?? "#fff")}40`,
                            background: `${(RANK_COLOR[candidates[1].rank] ?? "#fff")}15`,
                          }}>{candidates[1].rank}</span>
                          <span className="text-white font-semibold">
                            {isPct ? `+${formatStat(selectedAttr, candidates[1].statBonus)}` : `+${candidates[1].statBonus}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-[#00c8f0]">💰 {candidates[1].fTotal}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-[#5a8aaa] font-mono text-sm">
                {t.noSealsAvail}<br/>
                <span className="text-xs">{t.noSealsHint}</span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── MODO AVANZADO ── */}
            {/* Barra de progreso del atributo */}
            {progress && (
              <div className="mb-5 p-4 bg-[#09141f] border border-[#1a3f6e] rounded-xl flex flex-wrap gap-6 items-center">
                <div>
                  <p className="text-[#5a8aaa] text-xs font-mono uppercase">{t.vActual}</p>
                  <p className="text-white font-semibold">
                    {formatStat(selectedAttr, progress.vActual)}
                  </p>
                </div>
                <div>
                  <p className="text-[#5a8aaa] text-xs font-mono uppercase">{t.vMax}</p>
                  <p className="text-white font-semibold">
                    {formatStat(selectedAttr, progress.vMax)}
                  </p>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <div className="flex justify-between mb-1">
                    <p className="text-[#5a8aaa] text-xs font-mono uppercase">{t.progress}</p>
                    <p className="text-[#00c8f0] text-xs font-mono">{(progress.progress * 100).toFixed(1)}%</p>
                  </div>
                  <div className="h-2 bg-[#1a3f6e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00c8f0] to-[#00aed0] rounded-full"
                      style={{ width: `${Math.min(progress.progress * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Selector top N */}
            <div className="flex items-center gap-3 mb-4">
              <p className="text-[#5a8aaa] text-xs font-mono uppercase">{t.showTop}</p>
              {[3, 5, 10, 20].map(n => (
                <button
                  key={n}
                  onClick={() => setTopN(n)}
                  className={`px-3 py-1 text-xs font-mono rounded border transition-all ${
                    topN === n
                      ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/10"
                      : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#2a6496]"
                  }`}
                >
                  {n}
                </button>
              ))}
              <span className="ml-auto text-[#2a4558] text-xs font-mono">
                {t.optionsFound(candidates.length)}
              </span>
            </div>

            {/* Tabla de candidatos */}
            <div className="rounded-xl overflow-hidden border border-[#1a3f6e]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#09141f] border-b border-[#1a3f6e]">
                    {["#", "Digimon", "Rank", t.colGain, t.colPrice, t.colSeals, t.colTotal, t.colEfficiency].map(h => (
                      <th key={h} className={`px-4 py-3 text-[#5a8aaa] font-mono text-xs uppercase ${
                        ["#", "Digimon", "Rank"].includes(h) ? "text-left" : "text-right"
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, topN).map((c, i) => (
                    <CandidateRow key={`${c.name}-${c.rank}`} c={c} i={i} attr={selectedAttr} isPct={isPct} />
                  ))}
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-[#5a8aaa] font-mono text-sm">
                        {t.noSealsAvail}<br/>
                        <span className="text-xs">{t.noSealsHint}</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[#2a4558] text-xs font-mono">
              {t.efficiencyNote}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Fila individual de candidato ──
function CandidateRow({ c, i, attr, isPct }: { c: Candidate; i: number; attr: Attribute; isPct: boolean }) {
  const rankColor = RANK_COLOR[c.rank] ?? "#fff";
  const rowStyle =
    i === 0 ? "bg-[#0a2a1a] border-l-2 border-[#00e676]" :
    i === 1 ? "bg-[#1a1a0a] border-l-2 border-[#ffd700]" :
    i === 2 ? "bg-[#1a0a0a] border-l-2 border-[#ff6b6b]" :
              "border-l-2 border-transparent";
  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;

  // Display del stat bonus — si es % mostrar como porcentaje
  const fBonus = isPct
    ? `+${formatStat(attr, c.statBonus)}`
    : `+${c.statBonus}`;
  const fFrom = isPct ? formatStat(attr, c.statFrom) : `${c.statFrom}`;
  const fTo   = isPct ? formatStat(attr, c.statTo)   : `${c.statTo}`;

  return (
    <tr className={`border-b border-[#1a3f6e]/50 hover:bg-[#1a3f6e]/20 transition-colors ${rowStyle}`}>
      <td className="px-4 py-3 font-mono text-sm">{medal}</td>
      <td className="px-4 py-3 font-semibold text-white">{c.name}</td>
      <td className="px-4 py-3">
        <span className="px-2 py-0.5 rounded text-xs font-bold" style={{
          color: rankColor,
          border: `1px solid ${rankColor}40`,
          background: `${rankColor}15`,
        }}>{c.rank}</span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-[#00c8f0]">
        {fBonus}
        <span className="text-[#2a4558] text-xs ml-1">({fFrom}→{fTo})</span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-[#7ab0cc]">{c.fPrice}</td>
      <td className="px-4 py-3 text-right font-mono text-[#7ab0cc]">{c.qty.toLocaleString()}</td>
      <td className="px-4 py-3 text-right font-mono text-white font-semibold">{c.fTotal}</td>
      <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: i === 0 ? "#00e676" : "#fff" }}>
        {c.fEfficiency}<span className="text-[#5a8aaa] font-normal text-xs">/pt</span>
      </td>
    </tr>
  );
}
