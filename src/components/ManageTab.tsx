// ============================================================
//  ManageTab.tsx  —  Gestionar sellos (grid de cuadritos)
//  + indicador de precio desactualizado (+7 días)
//  + badge "evento" para sellos sin mercado activo
//  + onPriceChange para sincronizar a Supabase
// ============================================================

import { useState, useMemo } from "react";
import type { AppData, Rank, Attribute } from "../lib/types";
import { RANKS, ATTRIBUTES, RANK_COLOR, ATTR_SHORT, ATTR_ICON, PERCENT_ATTRS, formatStat } from "../lib/types";
import { CurrencyInput } from "./CurrencyInput";
import { formatM } from "../lib/currency";
import { TRANSLATIONS, type Lang } from "../lib/i18n";
import { isDMWNoMarket } from "../lib/noMarketSeals";
import { isDMWNew } from "../lib/newSeals";

const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

interface Props {
  data: AppData;
  onUpdate: (data: AppData) => void;
  onPriceChange?: (sealId: string, priceM: number) => Promise<void>;
  lang: Lang;
  search: string;
  onSearchChange: (v: string) => void;
  attrFilter: Attribute | null;
  onAttrFilterChange: (v: Attribute | null) => void;
  sortKey: "name-asc"|"name-desc"|"stat-desc"|"stat-asc";
  onSortKeyChange: (v: "name-asc"|"name-desc"|"stat-desc"|"stat-asc") => void;
  priceTimestamps?: Record<string, number>;
}

type SortKey = "name-asc" | "name-desc" | "stat-desc" | "stat-asc";

function priceAge(ts?: number): "fresh" | "stale" | "unknown" {
  if (!ts) return "unknown";
  return Date.now() - ts > STALE_MS ? "stale" : "fresh";
}

function priceAgeLabel(ts: number, lang: Lang): string {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60) return lang === "es" ? `hace ${mins}min`  : `${mins}min ago`;
  if (hours < 24) return lang === "es" ? `hace ${hours}h`   : `${hours}h ago`;
  return lang === "es" ? `hace ${days}d` : `${days}d ago`;
}

function RankModal({ seal, onSelect, onClose, lang }: {
  seal: AppData["seals"][string]; onSelect: (r: Rank) => void;
  onClose: () => void; lang: Lang;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="bg-[#09141f] border border-[#1a3f6e] rounded-2xl p-6 w-72 space-y-3"
        onClick={e => e.stopPropagation()}>
        <p className="text-white font-bold text-sm truncate">{seal.name}</p>
        <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider">
          {lang === "es" ? "Mi rank actual" : "My current rank"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {RANKS.map(rank => (
            <button key={rank} onClick={() => { onSelect(rank); onClose(); }}
              className="py-2.5 px-3 rounded-lg text-sm font-bold border transition-all"
              style={{
                color:       RANK_COLOR[rank],
                borderColor: seal.currentRank === rank ? RANK_COLOR[rank] : `${RANK_COLOR[rank]}40`,
                background:  seal.currentRank === rank ? `${RANK_COLOR[rank]}25` : `${RANK_COLOR[rank]}08`,
              }}>
              {rank}
              {seal.currentRank === rank && <span className="ml-1 text-[10px]">✓</span>}
            </button>
          ))}
        </div>
        <button onClick={onClose}
          className="w-full mt-1 py-1.5 text-xs font-mono text-[#5a8aaa] border border-[#1a3f6e] rounded-lg hover:text-white transition-colors">
          {lang === "es" ? "Cancelar" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

function PriceModal({ seal, onSave, onClose, lang, priceTs }: {
  seal: AppData["seals"][string]; onSave: (v: number) => void;
  onClose: () => void; lang: Lang; priceTs?: number;
}) {
  const age = priceAge(priceTs);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.78)" }} onClick={onClose}>
      <div className="bg-[#09141f] border border-[#1a3f6e] rounded-2xl p-6 w-72 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-white font-bold text-sm truncate mb-1">{seal.name}</p>
          <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider mb-1">
            {lang === "es" ? "Precio por sello (global)" : "Price per seal (global)"}
          </p>
          <p className="text-[#2a4558] text-xs font-mono">
            {lang === "es"
              ? "¿El precio no corresponde al mercado actual? Corrígelo aquí — todos los jugadores verán el cambio."
              : "Price doesn't match the current market? Fix it here — all players will see the update."}
          </p>
          {priceTs && (
            <p className={`text-[10px] font-mono mt-2 ${age === "stale" ? "text-orange-400" : "text-[#5a8aaa]"}`}>
              {age === "stale" ? "⚠ " : "✓ "}
              {lang === "es" ? "Última actualización: " : "Last updated: "}
              {priceAgeLabel(priceTs, lang)}
            </p>
          )}
        </div>
        <CurrencyInput valueM={seal.priceM} onChange={onSave} className="w-full" />
        <button onClick={onClose}
          className="w-full py-1.5 text-xs font-mono text-[#5a8aaa] border border-[#1a3f6e] rounded-lg hover:text-white transition-colors">
          {lang === "es" ? "Listo" : "Done"}
        </button>
      </div>
    </div>
  );
}

export function ManageTab({
  data, onUpdate, onPriceChange, lang, search, onSearchChange,
  attrFilter, onAttrFilterChange, sortKey, onSortKeyChange,
  priceTimestamps = {},
}: Props) {
  const t = TRANSLATIONS[lang];

  const [rankModal,  setRankModal]  = useState<string | null>(null);
  const [priceModal, setPriceModal] = useState<string | null>(null);

  const [sealTypeFilter, setSealTypeFilter] = useState<"all" | "normal" | "event">("all");

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "name-asc",  label: t.sortNameAsc  },
    { key: "name-desc", label: t.sortNameDesc },
    { key: "stat-desc", label: t.sortStatDesc },
    { key: "stat-asc",  label: t.sortStatAsc  },
  ];

  const seals = useMemo(() => {
    let list = Object.values(data.seals);
    if (search)     list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    if (attrFilter) list = list.filter(s => Object.values(s.stats?.[attrFilter] ?? {}).some(v => (v ?? 0) > 0));
    if (sealTypeFilter === "normal") list = list.filter(s => !isDMWNoMarket(s.name));
    if (sealTypeFilter === "event")  list = list.filter(s => isDMWNoMarket(s.name));
    const attr = attrFilter;
    return [...list].sort((a, b) => {
      const aNew   = isDMWNew(a.name)      ? 0 : 1;
      const bNew   = isDMWNew(b.name)      ? 0 : 1;
      const aEvent = isDMWNoMarket(a.name) ? 0 : 1;
      const bEvent = isDMWNoMarket(b.name) ? 0 : 1;
      if (aNew   !== bNew)   return aNew   - bNew;
      if (aEvent !== bEvent) return aEvent - bEvent;
      if (sortKey === "name-asc")  return a.name.localeCompare(b.name);
      if (sortKey === "name-desc") return b.name.localeCompare(a.name);
      const getMax = (s: typeof a) => attr ? (s.stats?.[attr]?.["Master"] ?? 0) : 0;
      const diff = getMax(b) - getMax(a);
      return sortKey === "stat-desc" ? diff : -diff;
    });
  }, [data.seals, search, attrFilter, sortKey, sealTypeFilter]);

  const updateSeal = (name: string, patch: Partial<AppData["seals"][string]>) =>
    onUpdate({ ...data, seals: { ...data.seals, [name]: { ...data.seals[name], ...patch } }, lastUpdated: Date.now() });

  const setCurrentRank = (name: string, rank: Rank) => updateSeal(name, { currentRank: rank });

  const setPrice = (name: string, v: number) => {
    updateSeal(name, { priceM: v });
    onPriceChange?.(name, v);
  };

  const resetAllToUnopened = () => {
    if (!confirm(t.confirmUnopened)) return;
    const updatedSeals = Object.fromEntries(
      Object.entries(data.seals).map(([k, s]) => [k, { ...s, currentRank: "Unopened" as Rank }])
    );
    onUpdate({ ...data, seals: updatedSeals, lastUpdated: Date.now() });
  };

  const deleteSeal = (name: string) => {
    if (!confirm(t.confirmDelete(name))) return;
    const { [name]: _r, ...rest } = data.seals;
    onUpdate({ ...data, seals: rest, lastUpdated: Date.now() });
  };

  const handleAttrFilter = (attr: Attribute | null) => {
    onAttrFilterChange(attr);
    if (!attr && (sortKey === "stat-asc" || sortKey === "stat-desc")) onSortKeyChange("name-asc");
  };

  const staleCount   = seals.filter(s => s.priceM > 0 && priceAge(priceTimestamps[s.name]) === "stale").length;
  const unknownCount = seals.filter(s => s.priceM > 0 && !priceTimestamps[s.name]).length;

  const rankModalSeal  = rankModal  ? data.seals[rankModal]  : null;
  const priceModalSeal = priceModal ? data.seals[priceModal] : null;

  return (
    <div>
      {rankModal && rankModalSeal && (
        <RankModal seal={rankModalSeal} lang={lang}
          onSelect={r => setCurrentRank(rankModal, r)} onClose={() => setRankModal(null)} />
      )}
      {priceModal && priceModalSeal && (
        <PriceModal seal={priceModalSeal} lang={lang}
          priceTs={priceTimestamps[priceModal]}
          onSave={v => { setPrice(priceModal, v); }}
          onClose={() => setPriceModal(null)} />
      )}

      {/* Banner de precios desactualizados */}
      {(staleCount > 0 || unknownCount > 0) && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-500/30 bg-orange-500/05">
          <span>⚠</span>
          <p className="text-orange-400 text-xs font-mono">
            {staleCount > 0 && (lang === "es"
              ? `${staleCount} precio${staleCount > 1 ? "s" : ""} sin actualizar hace más de 7 días`
              : `${staleCount} price${staleCount > 1 ? "s" : ""} not updated in over 7 days`)}
            {staleCount > 0 && unknownCount > 0 && " · "}
            {unknownCount > 0 && (lang === "es"
              ? `${unknownCount} sin fecha de actualización`
              : `${unknownCount} with no update date`)}
          </p>
        </div>
      )}

      {/* Barra superior */}
      <div className="flex items-center gap-3 mb-4">
        <input type="text" placeholder={t.searchPlaceholder} value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="flex-1 bg-[#09141f] border border-[#1a3f6e] rounded-lg px-4 py-2.5 text-white placeholder-[#2a4558] font-mono text-sm focus:outline-none focus:border-[#00c8f0] transition-colors"
        />
        <div className="flex rounded-lg overflow-hidden border border-[#1a3f6e]">
          {([
            ["all",    lang === "es" ? "Todas"    : "All"   ],
            ["normal", lang === "es" ? "Normales" : "Normal"],
            ["event",  lang === "es" ? "Evento"   : "Event" ],
          ] as ["all"|"normal"|"event", string][]).map(([key, label]) => (
            <button key={key} onClick={() => setSealTypeFilter(key)}
              className={`px-3 py-2 text-[11px] font-mono transition-all ${
                sealTypeFilter === key
                  ? key === "event"
                    ? "bg-[#8855cc]/30 text-[#bb88ff] border-x border-[#8855cc]/40"
                    : "bg-[#00c8f0]/15 text-[#00c8f0]"
                  : "text-[#5a8aaa] hover:text-white"
              }`}>{label}</button>
          ))}
        </div>
        <span className="text-[#5a8aaa] font-mono text-xs whitespace-nowrap">{t.sealsCount(seals.length)}</span>
        <button onClick={resetAllToUnopened} disabled={Object.keys(data.seals).length === 0}
          className="px-3 py-2 text-xs font-mono border border-[#5a8aaa]/40 text-[#5a8aaa] rounded-lg hover:border-[#ffd700]/60 hover:text-[#ffd700] disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
          {t.resetToUnopened}
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          <button onClick={() => handleAttrFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
              attrFilter === null
                ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/15"
                : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0]/50 hover:text-white"
            }`}>{t.filterAll}</button>
          {ATTRIBUTES.map(attr => (
            <button key={attr} onClick={() => handleAttrFilter(attrFilter === attr ? null : attr)}
              className={`px-3 py-1 rounded-full text-xs font-mono border transition-all flex items-center gap-1 ${
                attrFilter === attr
                  ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/15"
                  : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0]/50 hover:text-white"
              }`}>
              <span>{ATTR_ICON[attr]}</span><span>{ATTR_SHORT[attr]}</span>
              {PERCENT_ATTRS.has(attr) && <span className="text-[#2a4558]">%</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[#2a4558] font-mono text-xs whitespace-nowrap">{t.sortLabel}</span>
          {SORT_OPTIONS.map(opt => {
            const disabled = (opt.key === "stat-asc" || opt.key === "stat-desc") && !attrFilter;
            return (
              <button key={opt.key} onClick={() => !disabled && onSortKeyChange(opt.key)} disabled={disabled}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                  sortKey === opt.key
                    ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/15"
                    : disabled
                    ? "border-[#1a3f6e]/40 text-[#2a4558]/40 cursor-not-allowed"
                    : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0]/50 hover:text-white"
                }`}>{opt.label}</button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {seals.map(seal => {
          const rank      = seal.currentRank && seal.currentRank !== "Unopened" ? seal.currentRank : null;
          const rankColor = rank ? RANK_COLOR[rank] : "#1a3f6e";
          const attrStat  = attrFilter && rank ? (seal.stats?.[attrFilter]?.[rank] ?? 0) : null;
          const attrMax   = attrFilter ? (seal.stats?.[attrFilter]?.["Master"] ?? 0) : null;
          const noMarket  = isDMWNoMarket(seal.name);
          const isNew     = isDMWNew(seal.name);
          const ts        = priceTimestamps[seal.name];
          const age       = seal.priceM > 0 ? priceAge(ts) : null;

          return (
            <div key={seal.name}
              className="relative rounded-xl overflow-hidden border transition-all"
              style={{
                borderColor: isNew ? "#f59e0b" : `${rankColor}60`,
                background: isNew
                  ? `linear-gradient(145deg, #1a1200 55%, #f59e0b18)`
                  : `linear-gradient(145deg, #09141f 55%, ${rankColor}14)`,
                boxShadow: isNew ? "0 0 12px #f59e0b30" : undefined,
              }}>
              {isNew && (
                <div className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-[#f59e0b] text-black leading-none">
                  ✨ nueva
                </div>
              )}
              <div className="h-1 w-full" style={{ background: isNew ? "#f59e0b" : rank ? rankColor : "#1a3f6e40" }} />
              <div className="p-3">
                <p className="text-white text-xs font-bold leading-tight mb-2 line-clamp-2"
                  title={seal.name} style={{ minHeight: "2.2em" }}>{seal.name}</p>

                <div className="mb-2 h-5">
                  {rank
                    ? <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold leading-none"
                        style={{ color: rankColor, background: `${rankColor}20`, border: `1px solid ${rankColor}50` }}>{rank}</span>
                    : <span className="text-[#2a4558] text-[10px] font-mono">
                        {lang === "es" ? "sin rank" : "no rank"}
                      </span>}
                </div>

                {attrFilter && attrMax !== null && attrMax > 0 ? (
                  <p className="text-[10px] font-mono text-[#5a8aaa] mb-1 h-4">
                    {ATTR_ICON[attrFilter]}{" "}
                    <span className="text-[#00c8f0]">{formatStat(attrFilter, attrStat ?? 0)}</span>
                    <span className="text-[#2a4558]"> / {formatStat(attrFilter, attrMax)}</span>
                  </p>
                ) : <div className="mb-1 h-4" />}

                {/* Precio con indicador de frescura o badge evento */}
                <div className="mb-3 h-8">
                  <div className="flex items-center gap-1">
                    {seal.priceM > 0 ? (
                      <>
                        <span className={`text-[10px] font-mono ${age === "stale" ? "text-orange-400" : "text-[#00c8f0]"}`}>
                          {formatM(seal.priceM)}
                        </span>
                        <span className="text-[#2a4558] text-[10px] font-mono">/seal</span>
                        {age === "stale" && (
                          <span className="text-orange-400 text-[9px]"
                            title={lang === "es" ? "Precio desactualizado (+7 días)" : "Stale price (+7 days)"}>⚠</span>
                        )}
                      </>
                    ) : noMarket ? (
                      <span className="text-[#8855cc] text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#8855cc]/30 bg-[#8855cc]/08">🎫 evento</span>
                    ) : (
                      <span className="text-[#2a4558] text-[10px] font-mono">{t.noPrice}</span>
                    )}
                  </div>
                  {ts && seal.priceM > 0 && (
                    <p className={`text-[9px] font-mono ${age === "stale" ? "text-orange-400/70" : "text-[#2a4558]"}`}>
                      {priceAgeLabel(ts, lang)}
                    </p>
                  )}
                </div>

                <div className="flex gap-1">
                  <button onClick={() => setRankModal(seal.name)}
                    className="flex-1 py-1 text-[10px] font-bold font-mono rounded border transition-all"
                    style={{ color: rankColor, borderColor: `${rankColor}50`, background: `${rankColor}12` }}>
                    {lang === "es" ? "Rank" : "Rank"}
                  </button>
                  <button
                    onClick={() => !noMarket && setPriceModal(seal.name)}
                    disabled={noMarket}
                    className={`flex-1 py-1 text-[10px] font-bold font-mono rounded border transition-all ${noMarket ? "cursor-not-allowed" : ""}`}
                    style={{
                      color:       noMarket ? "#8855cc80" : age === "stale" ? "#fb923c" : "#5a8aaa",
                      borderColor: noMarket ? "#8855cc30" : age === "stale" ? "#fb923c50" : "#1a3f6e",
                      background:  noMarket ? "#8855cc08" : age === "stale" ? "#fb923c10" : "transparent",
                    }}
                    title={noMarket
                      ? (lang === "es" ? "Sello de evento — sin mercado activo" : "Event seal — no active market")
                      : (lang === "es" ? "¿El precio se ve mal? Tócalo para corregirlo" : "Price look wrong? Tap to fix it")}>
                    {noMarket ? "🎫" : (seal.priceM > 0 ? (lang === "es" ? "¿Precio mal?" : "Wrong price?") : (lang === "es" ? "+ Precio" : "+ Price"))}
                    {!noMarket && age === "stale" && " ⚠"}
                  </button>
                  <button onClick={() => deleteSeal(seal.name)}
                    className="px-2 py-1 text-[10px] font-mono text-[#2a4558] rounded border border-[#1a3f6e] hover:text-red-400 hover:border-red-400/40 transition-all">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {seals.length === 0 && (
        <div className="py-16 text-center text-[#2a4558] font-mono text-sm">
          {search || attrFilter ? t.noResults : t.noSealsYet}
        </div>
      )}
    </div>
  );
}
