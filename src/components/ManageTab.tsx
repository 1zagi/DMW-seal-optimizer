// ============================================================
//  ManageTab.tsx  —  Gestionar sellos (grid de cuadritos)
// ============================================================

import { useState, useMemo } from "react";
import type { AppData, Rank, Attribute } from "../lib/types";
import { RANKS, ATTRIBUTES, RANK_COLOR, ATTR_SHORT, ATTR_ICON, PERCENT_ATTRS, formatStat } from "../lib/types";
import { CurrencyInput } from "./CurrencyInput";
import { emptySeal } from "../lib/storage";
import { formatM } from "../lib/currency";
import { TRANSLATIONS, type Lang } from "../lib/i18n";

interface Props {
  data: AppData;
  onUpdate: (data: AppData) => void;
  lang: Lang;
  search: string;
  onSearchChange: (v: string) => void;
  attrFilter: Attribute | null;
  onAttrFilterChange: (v: Attribute | null) => void;
  sortKey: "name-asc"|"name-desc"|"stat-desc"|"stat-asc";
  onSortKeyChange: (v: "name-asc"|"name-desc"|"stat-desc"|"stat-asc") => void;
}

type SortKey = "name-asc" | "name-desc" | "stat-desc" | "stat-asc";

// ── Modal: cambiar rank ──────────────────────────────────────
function RankModal({
  seal, onSelect, onClose,
}: {
  seal: AppData["seals"][string];
  onSelect: (r: Rank) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.78)" }}
      onClick={onClose}
    >
      <div
        className="bg-[#09141f] border border-[#1a3f6e] rounded-2xl p-6 w-72 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-white font-bold text-sm truncate">{seal.name}</p>
        <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider">Mi rank actual</p>
        <div className="grid grid-cols-2 gap-2">
          {RANKS.map(rank => (
            <button
              key={rank}
              onClick={() => { onSelect(rank); onClose(); }}
              className="py-2.5 px-3 rounded-lg text-sm font-bold border transition-all"
              style={{
                color: RANK_COLOR[rank],
                borderColor: seal.currentRank === rank ? RANK_COLOR[rank] : `${RANK_COLOR[rank]}40`,
                background: seal.currentRank === rank ? `${RANK_COLOR[rank]}25` : `${RANK_COLOR[rank]}08`,
              }}
            >
              {rank}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-1 py-1.5 text-xs font-mono text-[#5a8aaa] border border-[#1a3f6e] rounded-lg hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Modal: cambiar precio ────────────────────────────────────
function PriceModal({
  seal, onSave, onClose,
}: {
  seal: AppData["seals"][string];
  onSave: (v: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.78)" }}
      onClick={onClose}
    >
      <div
        className="bg-[#09141f] border border-[#1a3f6e] rounded-2xl p-6 w-72 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-white font-bold text-sm truncate">{seal.name}</p>
        <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider">Precio por sello</p>
        <CurrencyInput
          valueM={seal.priceM}
          onChange={onSave}
          className="w-full"
        />
        <button
          onClick={onClose}
          className="w-full py-1.5 text-xs font-mono text-[#5a8aaa] border border-[#1a3f6e] rounded-lg hover:text-white transition-colors"
        >
          Listo
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────
export function ManageTab({ data, onUpdate, lang, search, onSearchChange, attrFilter, onAttrFilterChange, sortKey, onSortKeyChange }: Props) {
  const t = TRANSLATIONS[lang];

  const [showForm,   setShowForm]   = useState(false);
  const [newName,    setNewName]    = useState("");
  const [rankModal,  setRankModal]  = useState<string | null>(null);
  const [priceModal, setPriceModal] = useState<string | null>(null);

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "name-asc",  label: t.sortNameAsc },
    { key: "name-desc", label: t.sortNameDesc },
    { key: "stat-desc", label: t.sortStatDesc },
    { key: "stat-asc",  label: t.sortStatAsc },
  ];

  const seals = useMemo(() => {
    let list = Object.values(data.seals);
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    if (attrFilter) {
      list = list.filter(s =>
        Object.values(s.stats?.[attrFilter] ?? {}).some(v => (v ?? 0) > 0)
      );
    }
    const attr = attrFilter;
    return [...list].sort((a, b) => {
      if (sortKey === "name-asc")  return a.name.localeCompare(b.name);
      if (sortKey === "name-desc") return b.name.localeCompare(a.name);
      const getMax = (s: typeof a) => attr ? (s.stats?.[attr]?.["Master"] ?? 0) : 0;
      const diff = getMax(b) - getMax(a);
      return sortKey === "stat-desc" ? diff : -diff;
    });
  }, [data.seals, search, attrFilter, sortKey]);

  const updateSeal = (name: string, patch: Partial<typeof data.seals[string]>) =>
    onUpdate({ ...data, seals: { ...data.seals, [name]: { ...data.seals[name], ...patch } }, lastUpdated: Date.now() });

  const setCurrentRank = (name: string, rank: Rank) => updateSeal(name, { currentRank: rank });
  const setPrice       = (name: string, v: number)  => updateSeal(name, { priceM: v });

  const resetAllToUnopened = () => {
    if (!confirm(t.confirmUnopened)) return;
    const updatedSeals = Object.fromEntries(
      Object.entries(data.seals).map(([k, s]) => [k, { ...s, currentRank: "Unopened" as Rank }])
    );
    onUpdate({ ...data, seals: updatedSeals, lastUpdated: Date.now() });
  };

  const addSeal = () => {
    const name = newName.trim();
    if (!name || data.seals[name]) return;
    onUpdate({
      ...data,
      seals: { ...data.seals, [name]: emptySeal(name) as unknown as typeof data.seals[string] },
      lastUpdated: Date.now(),
    });
    setNewName("");
    setShowForm(false);
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

  const rankModalSeal  = rankModal  ? data.seals[rankModal]  : null;
  const priceModalSeal = priceModal ? data.seals[priceModal] : null;

  return (
    <div>
      {/* Modales */}
      {rankModal && rankModalSeal && (
        <RankModal
          seal={rankModalSeal}
          onSelect={r => setCurrentRank(rankModal, r)}
          onClose={() => setRankModal(null)}
        />
      )}
      {priceModal && priceModalSeal && (
        <PriceModal
          seal={priceModalSeal}
          onSave={v => setPrice(priceModal, v)}
          onClose={() => setPriceModal(null)}
        />
      )}

      {/* Barra superior */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="flex-1 bg-[#09141f] border border-[#1a3f6e] rounded-lg px-4 py-2.5 text-white placeholder-[#2a4558] font-mono text-sm focus:outline-none focus:border-[#00c8f0] transition-colors"
        />
        <span className="text-[#5a8aaa] font-mono text-xs whitespace-nowrap">{t.sealsCount(seals.length)}</span>
        <button
          onClick={resetAllToUnopened}
          disabled={Object.keys(data.seals).length === 0}
          className="px-3 py-2 text-xs font-mono border border-[#5a8aaa]/40 text-[#5a8aaa] rounded-lg hover:border-[#ffd700]/60 hover:text-[#ffd700] disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >{t.resetToUnopened}</button>
        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 text-xs font-mono font-bold border border-[#00e676] text-[#00e676] rounded-lg hover:bg-[#00e676]/10 transition-colors whitespace-nowrap"
        >{t.addSeal}</button>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          <button
            onClick={() => handleAttrFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
              attrFilter === null
                ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/15"
                : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0]/50 hover:text-white"
            }`}
          >{t.filterAll}</button>
          {ATTRIBUTES.map(attr => (
            <button
              key={attr}
              onClick={() => handleAttrFilter(attrFilter === attr ? null : attr)}
              className={`px-3 py-1 rounded-full text-xs font-mono border transition-all flex items-center gap-1 ${
                attrFilter === attr
                  ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/15"
                  : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0]/50 hover:text-white"
              }`}
            >
              <span>{ATTR_ICON[attr]}</span>
              <span>{ATTR_SHORT[attr]}</span>
              {PERCENT_ATTRS.has(attr) && <span className="text-[#2a4558]">%</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[#2a4558] font-mono text-xs whitespace-nowrap">{t.sortLabel}</span>
          {SORT_OPTIONS.map(opt => {
            const disabled = (opt.key === "stat-asc" || opt.key === "stat-desc") && !attrFilter;
            return (
              <button
                key={opt.key}
                onClick={() => !disabled && onSortKeyChange(opt.key)}
                disabled={disabled}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                  sortKey === opt.key
                    ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/15"
                    : disabled
                    ? "border-[#1a3f6e]/40 text-[#2a4558]/40 cursor-not-allowed"
                    : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0]/50 hover:text-white"
                }`}
              >{opt.label}</button>
            );
          })}
        </div>
      </div>

      {/* Formulario nuevo sello */}
      {showForm && (
        <div className="mb-5 p-5 bg-[#0a2a1a] border border-[#00e676]/30 rounded-xl">
          <p className="text-[#00e676] font-bold text-sm uppercase tracking-wider mb-3">{t.newSeal}</p>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={t.sealNamePlaceholder}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addSeal()}
              className="flex-1 bg-[#09141f] border border-[#1a3f6e] rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#00c8f0]"
            />
            <button
              onClick={addSeal}
              disabled={!newName.trim() || !!data.seals[newName.trim()]}
              className="px-5 py-2 text-sm font-bold font-mono bg-[#00e676]/20 border border-[#00e676] text-[#00e676] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#00e676]/30 transition-colors"
            >{t.create}</button>
            <button
              onClick={() => { setShowForm(false); setNewName(""); }}
              className="px-4 py-2 text-sm font-mono border border-[#1a3f6e] text-[#5a8aaa] rounded-lg hover:text-red-400 transition-colors"
            >{t.cancel}</button>
          </div>
          {data.seals[newName.trim()] && (
            <p className="text-red-400 text-xs font-mono mt-2">{t.duplicateName}</p>
          )}
        </div>
      )}

      {/* Grid de cuadritos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {seals.map(seal => {
          const rank      = seal.currentRank;
          const rankColor = rank ? RANK_COLOR[rank] : "#1a3f6e";
          const attrStat  = attrFilter && rank ? (seal.stats?.[attrFilter]?.[rank] ?? 0) : null;
          const attrMax   = attrFilter ? (seal.stats?.[attrFilter]?.["Master"] ?? 0) : null;

          return (
            <div
              key={seal.name}
              className="relative rounded-xl overflow-hidden border transition-all"
              style={{
                borderColor: `${rankColor}60`,
                background: `linear-gradient(145deg, #09141f 55%, ${rankColor}14)`,
              }}
            >
              {/* Barra de color del rank en el tope */}
              <div
                className="h-1 w-full"
                style={{ background: rank ? rankColor : "#1a3f6e40" }}
              />

              <div className="p-3">
                {/* Nombre */}
                <p
                  className="text-white text-xs font-bold leading-tight mb-2 line-clamp-2"
                  title={seal.name}
                  style={{ minHeight: "2.2em" }}
                >
                  {seal.name}
                </p>

                {/* Rank badge */}
                <div className="mb-2 h-5">
                  {rank ? (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold leading-none"
                      style={{
                        color: rankColor,
                        background: `${rankColor}20`,
                        border: `1px solid ${rankColor}50`,
                      }}
                    >{rank}</span>
                  ) : (
                    <span className="text-[#2a4558] text-[10px] font-mono">sin rank</span>
                  )}
                </div>

                {/* Stat del atributo filtrado */}
                {attrFilter && attrMax !== null && attrMax > 0 ? (
                  <p className="text-[10px] font-mono text-[#5a8aaa] mb-2 h-4">
                    {ATTR_ICON[attrFilter]}{" "}
                    <span className="text-[#00c8f0]">{formatStat(attrFilter, attrStat ?? 0)}</span>
                    <span className="text-[#2a4558]"> / {formatStat(attrFilter, attrMax)}</span>
                  </p>
                ) : (
                  <div className="mb-2 h-4" />
                )}

                {/* Precio */}
                <p className="text-[10px] font-mono mb-3 h-4">
                  {seal.priceM > 0
                    ? <><span className="text-[#00c8f0]">{formatM(seal.priceM)}</span><span className="text-[#2a4558]">/seal</span></>
                    : <span className="text-[#2a4558]">{t.noPrice}</span>
                  }
                </p>

                {/* Botones: Rank | Precio | X */}
                <div className="flex gap-1">
                  <button
                    onClick={() => setRankModal(seal.name)}
                    className="flex-1 py-1 text-[10px] font-bold font-mono rounded border transition-all"
                    style={{
                      color: rankColor,
                      borderColor: `${rankColor}50`,
                      background: `${rankColor}12`,
                    }}
                  >Rank</button>
                  <button
                    onClick={() => setPriceModal(seal.name)}
                    className="flex-1 py-1 text-[10px] font-bold font-mono rounded border border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0]/60 hover:text-[#00c8f0] transition-all"
                  >Precio</button>
                  <button
                    onClick={() => deleteSeal(seal.name)}
                    className="px-2 py-1 text-[10px] font-mono text-[#2a4558] rounded border border-[#1a3f6e] hover:text-red-400 hover:border-red-400/40 transition-all"
                  >✕</button>
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
