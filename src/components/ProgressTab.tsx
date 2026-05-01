// ============================================================
//  ProgressTab.tsx  —  Muestra el progreso de atributos
//                      calculado automáticamente desde los sellos
// ============================================================

import type { AppData, Attribute } from "../lib/types";
import { ATTR_SHORT, ATTR_ICON, PERCENT_ATTRS, formatStat } from "../lib/types";
import { TRANSLATIONS, type Lang } from "../lib/i18n";

interface Props {
  data:     AppData;
  onUpdate: (data: AppData) => void;
  lang:     Lang;
}

// Color de la barra según el porcentaje
function barColor(pct: number): string {
  if (pct >= 1)    return "from-[#e040fb] to-[#7c4dff]";
  if (pct >= 0.75) return "from-[#6aaccf] to-[#7ab0cc]";
  if (pct >= 0.5)  return "from-[#ffd700] to-[#ffab00]";
  if (pct >= 0.25) return "from-[#00c8f0] to-[#00aed0]";
  return "from-[#5a8aaa] to-[#1e3a52]";
}

export function ProgressTab({ data, lang }: Props) {
  const t = TRANSLATIONS[lang];
  const hasSeals = Object.keys(data.seals).length > 0;

  return (
    <div>
      {/* ── Cabecera informativa ── */}
      <div className="mb-5 p-4 bg-[#081522] border border-[#1a3f6e] rounded-xl flex items-start gap-3">
        <span className="text-xl mt-0.5">📊</span>
        <div>
          <p className="text-white font-semibold text-sm mb-1">{t.progressAuto}</p>
          <p className="text-[#5a8aaa] text-xs font-mono leading-relaxed">
            {t.progressDescBefore}{" "}
            <span className="text-[#00c8f0]">{t.manageTabName}</span>
            {t.progressDescAfter}
          </p>
        </div>
      </div>

      {!hasSeals ? (
        <div className="py-20 text-center text-[#2a4558] font-mono text-sm">
          {t.noSealsMsg}{" "}
          <span className="text-[#00c8f0]">{t.manageTabName}</span>.
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-[#1a3f6e]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#09141f] border-b border-[#1a3f6e]">
                <th className="px-4 py-3 text-left   text-[#5a8aaa] font-mono text-xs uppercase">{t.attribute}</th>
                <th className="px-4 py-3 text-right  text-[#5a8aaa] font-mono text-xs uppercase">{t.actualLabel}</th>
                <th className="px-4 py-3 text-right  text-[#5a8aaa] font-mono text-xs uppercase">{t.maxLabel}</th>
                <th className="px-4 py-3 text-left   text-[#5a8aaa] font-mono text-xs uppercase pl-6">{t.progress}</th>
              </tr>
            </thead>
            <tbody>
              {data.attrProgress.map(p => {
                const attr    = p.attribute as Attribute;
                const pct     = Math.min(p.progress, 1);
                const pctDisp = (p.progress * 100).toFixed(1);
                const color   = barColor(pct);
                const hasData = p.vMax > 0;

                return (
                  <tr
                    key={p.attribute}
                    className="border-b border-[#1a3f6e]/40 hover:bg-[#1a3f6e]/10 transition-colors"
                  >
                    {/* Nombre del atributo */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{ATTR_ICON[attr]}</span>
                        <span className="font-semibold text-white">{ATTR_SHORT[attr]}</span>
                        {PERCENT_ATTRS.has(attr) && (
                          <span className="text-[#2a4558] text-xs font-mono">%</span>
                        )}
                        <span className="text-[#2a4558] text-xs hidden md:inline">{p.attribute}</span>
                      </div>
                    </td>

                    {/* V. Actual — solo lectura */}
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono font-bold text-sm ${hasData ? "text-[#00c8f0]" : "text-[#2a4558]"}`}>
                        {hasData ? formatStat(attr, p.vActual) : "—"}
                      </span>
                    </td>

                    {/* V. Máximo — solo lectura */}
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-sm ${hasData ? "text-[#7ab0cc]" : "text-[#2a4558]"}`}>
                        {hasData ? formatStat(attr, p.vMax) : "—"}
                      </span>
                    </td>

                    {/* Barra de progreso */}
                    <td className="px-4 py-3 pl-6">
                      {hasData ? (
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2.5 bg-[#1a3f6e] rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
                              style={{ width: `${pct * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs w-14 text-right" style={{
                            color: pct >= 1 ? "#e040fb" : pct >= 0.5 ? "#ffd700" : "#00c8f0"
                          }}>
                            {pctDisp}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#2a4558] font-mono text-xs">{t.noData}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
