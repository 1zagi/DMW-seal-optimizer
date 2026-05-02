// ============================================================
//  ManageTab.tsx  —  Gestionar sellos (grid de cuadritos)
// ============================================================

import { useState, useMemo } from "react";
import type { AppData, Rank, Attribute } from "../lib/types";
import { RANKS, RANK_COLOR, ATTRIBUTES, ATTR_SHORT, ATTR_ICON, PERCENT_ATTRS } from "../lib/types";
import { CurrencyInput } from "./CurrencyInput";
import { emptySeal } from "../lib/storage";
import { TRANSLATIONS, type Lang } from "../lib/i18n";

interface Props {
  data: AppData;
  onUpdate: (data: AppData) => void;
  lang: Lang;
}

type SortKey = "name-asc" | "name-desc" | "stat-desc" | "stat-asc";

export function ManageTab({ data, onUpdate, lang }: Props) {
  const t = TRANSLATIONS[lang];

  const [search,       setSearch]       = useState("");
  const [showForm,     setShowForm]     = useState(false);
  const [newName,      setNewName]      = useState("");
  const [attrFilter,   setAttrFilter]   = useState<Attribute | null>(null);
  const [sortKey,      setSortKey]      = useState<SortKey>("name-asc");

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "name-asc",  label: t.sortNameAsc },
    { key: "name-desc", label: t.sortNameDesc },
    { key: "stat-desc", label: t.sortStatDesc },
    { key: "stat-asc",  label: t.sortStatAsc },
  ];

  // ── Lista filtrada y ordenada ──
  const seals = useMemo(() => {
    let list = Object.values(data.seals);

    if (search) {
      list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    }

    if (attrFilter) {
      list = list.filter(s => {
        const attrStats = s.stats?.[attrFilter];
        if (!attrStats) return false;
        return Object.values(attrStats).some(v => (v ?? 0) > 0);
      });
    }

    const attr = attrFilter;
    list = [...list].sort((a, b) => {
      if (sortKey === "name-asc")  return a.name.localeCompare(b.name);
      if (sortKey === "name-desc") return b.name.localeCompare(a.name);
      const getMax = (s: typeof a) =>
        attr ? (s.stats?.[attr]?.["Master"] ?? 0) : 0;
      const diff = getMax(b) - getMax(a);
      return sortKey === "stat-desc" ? diff : -diff;
    });

    return list;
  }, [data.seals, search, attrFilter, sortKey]);

  // ── Helpers para actualizar el estado ──

  const updateSeal = (name: string, patch: Partial<typeof data.seals[string]>) => {
    onUpdate({
      ...data,
      seals: { ...data.seals, [name]: { ...data.seals[name], ...patch } },
      lastUpdated: Date.now(),
    });
  };

  const setPrice = (name: string, priceM: number) =>
    updateSeal(name, { priceM });

  const setCurrentRank = (name: string, rank: Rank) =>
    updateSeal(name, { currentRank: rank });

  // ── Reset de todos los sellos a Unopened ──
  const resetAllToUnopened = () => {
    if (!confirm(t.confirmUnopened)) return;
    const updatedSeals = Object.fromEntries(
      Object.entries(data.seals).map(([k, s]) => [k, { ...s, currentRank: "Unopened" as Rank }])
    );
    onUpdate({ ...data, seals: updatedSeals, lastUpdated: Date.now() });
  };

  // ── Agregar sello nuevo ──
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

  // ── Borrar sello ──
  const deleteSeal = (name: string) => {
    if (!confirm(t.confirmDelete(name))) return;
    const { [name]: _removed, ...rest } = data.seals;
    onUpdate({ ...data, seals: rest, lastUpdated: Date.now() });
  };

  const handleAttrFilter = (attr: Attribute | null) => {
    setAttrFilter(attr);
    if (!attr && (sortKey === "stat-asc" || sortKey === "stat-desc")) {
      setSortKey("name-asc");
    }
  };

  return (
    <div>
      {/* ── Barra superior ── */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-[#09141f] border border-[#1a3f6e] rounded-lg px-4 py-2.5 text-white placeholder-[#2a4558] font-mono text-sm focus:outline-none focus:border-[#00c8f0] transition-colors"
        />
        <span className="text-[#5a8aaa] font-mono text-xs whitespace-nowrap">{t.sealsCount(seals.length)}</span>

        {/* Reset a Unopened */}
        <button
          onClick={resetAllToUnopened}
          disabled={Object.keys(data.seals).length === 0}
          className="px-3 py-2 text-xs font-mono border border-[#5a8aaa]/40 text-[#5a8aaa] rounded-lg hover:border-[#ffd700]/60 hover:text-[#ffd700] disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          title={t.confirmUnopened}
        >
          {t.resetToUnopened}
        </button>

        <button
          onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 text-xs font-mono font-bold border border-[#00e676] text-[#00e676] rounded-lg hover:bg-[#00e676]/10 transition-colors whitespace-nowrap"
        >
          {t.addSeal}
        </button>
      </div>

      {/* ── Filtros: atributo + ordenamiento ── */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          <button
            onClick={() => handleAttrFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${
              attrFilter === null
                ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/15"
                : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0]/50 hover:text-white"
            }`}
          >
            {t.filterAll}
          </button>
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
            const isStatSort = opt.key === "stat-asc" || opt.key === "stat-desc";
            const disabled   = isStatSort && !attrFilter;
            return (
              <button
                key={opt.key}
                onClick={() => !disabled && setSortKey(opt.key)}
                disabled={disabled}
                title={disabled ? t.sortHint : undefined}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                  sortKey === opt.key
                    ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/15"
                    : disabled
                    ? "border-[#1a3f6e]/40 text-[#2a4558]/40 cursor-not-allowed"
                    : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0]/50 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Formulario de nuevo sello ── */}
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
            >
              {t.create}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName(""); }}
              className="px-4 py-2 text-sm font-mono border border-[#1a3f6e] text-[#5a8aaa] rounded-lg hover:text-red-400 transition-colors"
            >
              {t.cancel}
            </button>
          </div>
          {data.seals[newName.trim()] && (
            <p className="text-red-400 text-xs font-mono mt-2">{t.duplicateName}</p>
          )}
          <p className="text-[#2a4558] text-xs font-mono mt-2">{t.afterCreate}</p>
        </div>
      )}

      {/* ── GRID DE TARJETAS ── */}
      {seals.length === 0 ? (
        <div className="py-16 text-center text-[#2a4558] font-mono text-sm">
          {search || attrFilter ? t.noResults : t.noSealsYet}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {seals.map(seal => {
            const rankColor = seal.currentRank ? RANK_COLOR[seal.currentRank] : "#4b4b4bff";
            const bgOpacity = `${rankColor}20`;
            
            return (
              <div
                key={seal.name}
                className="rounded-lg border-2 transition-all duration-200 p-4"
                style={{
                  borderColor: rankColor,
                  backgroundColor: bgOpacity,
                }}
              >
                {/* ── Encabezado: nombre + badge de rank ── */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-sm mb-1">{seal.name}</h3>
                    {seal.currentRank && (
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-bold"
                        style={{
                          color: rankColor,
                          border: `1px solid ${rankColor}60`,
                          backgroundColor: `${rankColor}15`,
                        }}
                      >
                        {seal.currentRank}
                      </span>
                    )}
                  </div>

                  {/* Botón borrar */}
                  <button
                    onClick={() => deleteSeal(seal.name)}
                    className="ml-2 text-[#2a4558] hover:text-red-400 transition-colors text-lg leading-none"
                    title={t.deleteSeal}
                  >
                    ✕
                  </button>
                </div>

                {/* ── Separador ── */}
                <div className="border-t border-[#1a3f6e]/50 my-3"></div>

                {/* ── BOTÓN 1: Cambiar Rank ── */}
                <div className="mb-4">
                  <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider mb-2">
                    {t.myRank}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {RANKS.map(rank => (
                      <button
                        key={rank}
                        onClick={() => setCurrentRank(seal.name, rank)}
                        className="px-2 py-1 rounded text-xs font-bold border transition-all"
                        style={{
                          color: RANK_COLOR[rank],
                          borderColor:
                            seal.currentRank === rank
                              ? RANK_COLOR[rank]
                              : `${RANK_COLOR[rank]}30`,
                          backgroundColor:
                            seal.currentRank === rank
                              ? `${RANK_COLOR[rank]}20`
                              : "transparent",
                          opacity: seal.currentRank === rank ? 1 : 0.6,
                        }}
                      >
                        {rank.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── BOTÓN 2: Cambiar Precio ── */}
                <div>
                  <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider mb-2">
                    {t.priceLabel}
                  </p>
                  <CurrencyInput
                    valueM={seal.priceM}
                    onChange={v => setPrice(seal.name, v)}
                    className="w-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
