// ============================================================
//  MarketTab.tsx  —  DMW Vista de tendencias de mercado
// ============================================================

import { useState, useEffect, useMemo } from "react";
import type { AppData } from "../lib/types";
import type { Lang } from "../lib/i18n";
import { formatM } from "../lib/currency";
import { isDMWNoMarket } from "../lib/noMarketSeals";

interface TrendEntry {
  sealId:    string;
  current:   number;
  previous:  number;
  change:    number;
  changePct: number;
  trend:     "up" | "down" | "stable" | "new";
}

interface Props {
  data: AppData;
  lang: Lang;
  fetchPricesNDaysAgo: (days?: number) => Promise<Map<string, number>>;
  fetchPriceHistory:   (sealId: string, days?: number) => Promise<{ price_m: number; recorded_at: string }[]>;
}

type SortKey = "change-desc" | "change-asc" | "pct-desc" | "pct-asc" | "name";
type Filter  = "all" | "up" | "down" | "new";

export function MarketTab({ data, lang, fetchPricesNDaysAgo, fetchPriceHistory }: Props) {
  const [oldPrices,    setOldPrices]    = useState<Map<string, number>>(new Map());
  const [loading,      setLoading]      = useState(true);
  const [sortKey,      setSortKey]      = useState<SortKey>("pct-desc");
  const [filter,       setFilter]       = useState<Filter>("all");
  const [search,       setSearch]       = useState("");
  const [selectedSeal, setSelectedSeal] = useState<string | null>(null);
  const [history,      setHistory]      = useState<{ price_m: number; recorded_at: string }[]>([]);
  const [histLoading,  setHistLoading]  = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchPricesNDaysAgo(7).then(map => { setOldPrices(map); setLoading(false); });
  }, []);

  // Excluye sellos sin mercado activo del análisis de tendencias
  const trends = useMemo<TrendEntry[]>(() => {
    return Object.values(data.seals)
      .filter(s => s.priceM > 0 && !isDMWNoMarket(s.name))
      .map(s => {
        const current  = s.priceM;
        const previous = oldPrices.get(s.name);
        if (previous === undefined) return { sealId: s.name, current, previous: 0, change: 0, changePct: 0, trend: "new" as const };
        const change    = current - previous;
        const changePct = previous > 0 ? (change / previous) * 100 : 0;
        const trend     = Math.abs(changePct) < 1 ? "stable" : change > 0 ? "up" : "down";
        return { sealId: s.name, current, previous, change, changePct, trend } as TrendEntry;
      });
  }, [data.seals, oldPrices]);

  const displayed = useMemo(() => {
    let list = trends;
    if (filter !== "all") list = list.filter(t => t.trend === filter);
    if (search) list = list.filter(t => t.sealId.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => {
      if (sortKey === "change-desc") return b.change - a.change;
      if (sortKey === "change-asc")  return a.change - b.change;
      if (sortKey === "pct-desc")    return b.changePct - a.changePct;
      if (sortKey === "pct-asc")     return a.changePct - b.changePct;
      return a.sealId.localeCompare(b.sealId);
    });
  }, [trends, filter, search, sortKey]);

  const summary = useMemo(() => ({
    up:     trends.filter(t => t.trend === "up").length,
    down:   trends.filter(t => t.trend === "down").length,
    stable: trends.filter(t => t.trend === "stable").length,
    new:    trends.filter(t => t.trend === "new").length,
  }), [trends]);

  useEffect(() => {
    if (!selectedSeal) return;
    setHistLoading(true);
    fetchPriceHistory(selectedSeal, 30).then(h => { setHistory(h); setHistLoading(false); });
  }, [selectedSeal]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-[#00c8f0] font-mono animate-pulse">{lang === "es" ? "Cargando tendencias..." : "Loading trends..."}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white">📈 {lang === "es" ? "Mercado" : "Market"}</h2>
        <p className="text-[#5a8aaa] font-mono text-sm">{lang === "es" ? "Tendencias de precio vs hace 7 días" : "Price trends vs 7 days ago"}</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {([
          { key: "up"   as Filter, label: lang === "es" ? "Subieron" : "Rising",   color: "#00e676", icon: "↑", count: summary.up     },
          { key: "down" as Filter, label: lang === "es" ? "Bajaron"  : "Falling",  color: "#ff6b6b", icon: "↓", count: summary.down   },
          { key: "new"  as Filter, label: lang === "es" ? "Sin datos" : "No data", color: "#ffd700", icon: "?", count: summary.new    },
          { key: "all"  as Filter, label: lang === "es" ? "Estables" : "Stable",   color: "#5a8aaa", icon: "–", count: summary.stable },
        ]).map(({ key, label, color, icon, count }) => (
          <button key={key} onClick={() => setFilter(f => f === key ? "all" : key)}
            className="p-3 rounded-xl border text-left transition-all"
            style={{ borderColor: filter === key ? color : `${color}30`, background: filter === key ? `${color}15` : "#09141f" }}>
            <p className="text-2xl font-bold" style={{ color }}>{icon} {count}</p>
            <p className="text-[#5a8aaa] text-xs font-mono mt-1">{label}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={lang === "es" ? "Buscar sello..." : "Search seal..."}
          className="flex-1 min-w-40 px-3 py-2 rounded bg-[#09141f] border border-[#1a3f6e] text-white font-mono text-sm focus:border-[#00c8f0] focus:outline-none" />
        <div className="flex gap-1 flex-wrap">
          {([
            ["pct-desc",    lang === "es" ? "% ↓"    : "% ↓"   ],
            ["pct-asc",     lang === "es" ? "% ↑"    : "% ↑"   ],
            ["change-desc", lang === "es" ? "M$ ↓"   : "M$ ↓"  ],
            ["change-asc",  lang === "es" ? "M$ ↑"   : "M$ ↑"  ],
            ["name",        lang === "es" ? "Nombre" : "Name"  ],
          ] as [SortKey, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setSortKey(k)}
              className={`px-3 py-2 rounded text-xs font-mono border transition-all ${sortKey === k ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/10" : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#5a8aaa]"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-[#1a3f6e]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#09141f] border-b border-[#1a3f6e]">
              {[lang === "es" ? "Sello" : "Seal", lang === "es" ? "Precio actual" : "Current", lang === "es" ? "Hace 7 días" : "7d ago", lang === "es" ? "Cambio" : "Change", "%", ""].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-[#5a8aaa] font-mono text-xs uppercase ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map(t => {
              const color = t.trend === "up" ? "#00e676" : t.trend === "down" ? "#ff6b6b" : t.trend === "new" ? "#ffd700" : "#5a8aaa";
              const icon  = t.trend === "up" ? "↑" : t.trend === "down" ? "↓" : t.trend === "new" ? "?" : "–";
              return (
                <tr key={t.sealId} onClick={() => setSelectedSeal(s => s === t.sealId ? null : t.sealId)}
                  className={`border-b border-[#1a3f6e]/50 cursor-pointer transition-all ${selectedSeal === t.sealId ? "bg-[#1a3f6e]/40" : "hover:bg-[#1a3f6e]/20"}`}>
                  <td className="px-4 py-3 font-semibold text-white">{t.sealId}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#00c8f0]">{formatM(t.current)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#5a8aaa]">{t.trend === "new" ? <span className="text-[#ffd700] text-xs">sin datos</span> : formatM(t.previous)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold" style={{ color }}>{t.trend === "new" ? "–" : `${t.change >= 0 ? "+" : ""}${formatM(Math.abs(t.change))}`}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold" style={{ color }}>{t.trend === "new" ? "–" : `${t.changePct >= 0 ? "+" : ""}${t.changePct.toFixed(1)}%`}</td>
                  <td className="px-4 py-3 text-center w-8"><span className="text-lg" style={{ color }}>{icon}</span></td>
                </tr>
              );
            })}
            {displayed.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[#5a8aaa] font-mono text-sm">{lang === "es" ? "No hay resultados" : "No results"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedSeal && (
        <div className="p-4 bg-[#09141f] border border-[#1a3f6e] rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-bold">{selectedSeal}</p>
            <button onClick={() => setSelectedSeal(null)} className="text-[#5a8aaa] text-xs font-mono hover:text-white">✕ {lang === "es" ? "cerrar" : "close"}</button>
          </div>
          {histLoading ? (
            <p className="text-[#5a8aaa] font-mono text-sm animate-pulse">{lang === "es" ? "Cargando historial..." : "Loading history..."}</p>
          ) : history.length === 0 ? (
            <p className="text-[#5a8aaa] font-mono text-sm">{lang === "es" ? "Sin historial en los últimos 30 días." : "No history in the last 30 days."}</p>
          ) : (
            <>
              <MiniChart points={history} />
              <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {[...history].reverse().map((p, i) => {
                  const prev  = history[history.length - 2 - i];
                  const delta = prev ? p.price_m - prev.price_m : 0;
                  return (
                    <div key={i} className="flex items-center justify-between px-2 py-1 rounded text-xs font-mono">
                      <span className="text-[#2a4558]">{new Date(p.recorded_at).toLocaleDateString()} {new Date(p.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-[#00c8f0]">{formatM(p.price_m)}</span>
                      {delta !== 0 && <span style={{ color: delta > 0 ? "#00e676" : "#ff6b6b" }}>{delta > 0 ? "+" : ""}{formatM(Math.abs(delta))}</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <p className="text-[#2a4558] text-xs font-mono">
        {lang === "es"
          ? "💡 Los sellos con ? no tienen registro de hace 7 días — pueden ser nuevos o sin precio previo."
          : "💡 Seals with ? have no record from 7 days ago — they may be new or previously unpriced."}
      </p>
    </div>
  );
}

function MiniChart({ points }: { points: { price_m: number }[] }) {
  if (points.length < 2) return null;
  const W = 600, H = 80, PAD = 8;
  const prices = points.map(p => p.price_m);
  const minP = Math.min(...prices), maxP = Math.max(...prices), range = maxP - minP || 1;
  const xs = points.map((_, i) => PAD + (i / (points.length - 1)) * (W - PAD * 2));
  const ys = prices.map(p => H - PAD - ((p - minP) / range) * (H - PAD * 2));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const fill = `${line} L${xs[xs.length-1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`;
  const color = prices[prices.length-1] >= prices[0] ? "#00e676" : "#ff6b6b";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 rounded">
      <defs><linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={fill} fill="url(#grad2)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="4" fill={color} />
    </svg>
  );
}
