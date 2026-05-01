// ============================================================
//  ManageTab.tsx  —  Gestionar sellos (agregar, editar, borrar)
// ============================================================

import { useState, useMemo } from "react";
import type { AppData, Rank, Attribute } from "../lib/types";
import { RANKS, ATTRIBUTES, RANK_COLOR, ATTR_SHORT, ATTR_ICON, PERCENT_ATTRS, parseStat, formatStat } from "../lib/types";
import { CurrencyInput } from "./CurrencyInput";
import { emptySeal } from "../lib/storage";
import { formatM } from "../lib/currency";
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
  const [expandedSeal, setExpandedSeal] = useState<string | null>(null);
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

  const setQty = (name: string, rank: Rank, val: string) =>
    updateSeal(name, { qty: { ...data.seals[name].qty, [rank]: Number(val) || 0 } });

  const setStat = (name: string, attr: Attribute, rank: Rank, raw: string) => {
    const stored = parseStat(attr, raw);
    updateSeal(name, {
      stats: {
        ...data.seals[name].stats,
        [attr]: { ...data.seals[name].stats[attr], [rank]: stored },
      },
    });
  };

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
    setExpandedSeal(name);
  };

  // ── Borrar sello ──
  const deleteSeal = (name: string) => {
    if (!confirm(t.confirmDelete(name))) return;
    const { [name]: _removed, ...rest } = data.seals;
    onUpdate({ ...data, seals: rest, lastUpdated: Date.now() });
    if (expandedSeal === name) setExpandedSeal(null);
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

      {/* ── Lista de sellos ── */}
      <div className="space-y-2">
        {seals.map(seal => {
          const activeAttrMaster = attrFilter
            ? (seal.stats?.[attrFilter]?.["Master"] ?? 0)
            : null;
          const activeAttrCurrent = attrFilter && seal.currentRank
            ? (seal.stats?.[attrFilter]?.[seal.currentRank] ?? 0)
            : null;

          return (
            <div key={seal.name} className="border border-[#1a3f6e] rounded-xl overflow-hidden">

              {/* Cabecera del sello */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-[#09141f] cursor-pointer hover:bg-[#1a3f6e]/40 transition-colors"
                onClick={() => setExpandedSeal(expandedSeal === seal.name ? null : seal.name)}
              >
                <span className="text-[#5a8aaa] text-xs w-3">{expandedSeal === seal.name ? "▼" : "▶"}</span>
                <span className="font-bold text-white flex-1">{seal.name}</span>

                {/* Stat del atributo activo */}
                {attrFilter && activeAttrMaster !== null && activeAttrMaster > 0 && (
                  <span className="font-mono text-xs text-[#7ab0cc] hidden sm:inline">
                    {ATTR_ICON[attrFilter]}{" "}
                    <span className="text-[#00c8f0]">
                      {formatStat(attrFilter, activeAttrCurrent ?? 0)}
                    </span>
                    <span className="text-[#2a4558]"> / {formatStat(attrFilter, activeAttrMaster)}</span>
                  </span>
                )}

                {/* Rank actual */}
                {seal.currentRank && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold" style={{
                    color: RANK_COLOR[seal.currentRank],
                    border: `1px solid ${RANK_COLOR[seal.currentRank]}40`,
                    background: `${RANK_COLOR[seal.currentRank]}15`,
                  }}>{seal.currentRank}</span>
                )}

                {/* Precio rápido */}
                <span className="font-mono text-[#00c8f0] text-sm">
                  {seal.priceM > 0
                    ? `${formatM(seal.priceM)}/seal`
                    : <span className="text-[#2a4558]">{t.noPrice}</span>}
                </span>

                <button
                  onClick={e => { e.stopPropagation(); deleteSeal(seal.name); }}
                  className="px-2 py-0.5 text-xs font-mono text-[#2a4558] rounded hover:text-red-400 transition-colors"
                  title={t.deleteSeal}
                >✕</button>
              </div>

              {/* Panel expandido de edición */}
              {expandedSeal === seal.name && (
                <div className="p-5 border-t border-[#1a3f6e] bg-[#060e17] space-y-6">

                  {/* ── Precio por sello ── */}
                  <div>
                    <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider mb-2">{t.priceLabel}</p>
                    <CurrencyInput
                      valueM={seal.priceM}
                      onChange={v => setPrice(seal.name, v)}
                      className="max-w-[200px]"
                    />
                  </div>

                  {/* ── Rank actual del jugador — Unopened es el mínimo ── */}
                  <div>
                    <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider mb-2">{t.myRank}</p>
                    <div className="flex gap-1 flex-wrap">
                      {RANKS.map(rank => (
                        <button
                          key={rank}
                          onClick={() => setCurrentRank(seal.name, rank)}
                          className="px-3 py-1 rounded text-xs font-bold border transition-all"
                          style={{
                            color: RANK_COLOR[rank],
                            borderColor: seal.currentRank === rank ? RANK_COLOR[rank] : `${RANK_COLOR[rank]}30`,
                            background: seal.currentRank === rank ? `${RANK_COLOR[rank]}20` : "transparent",
                            opacity: seal.currentRank === rank ? 1 : 0.5,
                          }}
                        >{rank}</button>
                      ))}
                    </div>
                  </div>

                  {/* ── Cantidades por rank ── */}
                  <div>
                    <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider mb-2">{t.qtyLabel}</p>
                    <div className="grid grid-cols-7 gap-2">
                      {RANKS.map(rank => (
                        <div key={rank}>
                          <p className="text-xs font-mono mb-1 text-center truncate" style={{ color: RANK_COLOR[rank] }}>{rank}</p>
                          <input
                            type="number"
                            value={seal.qty[rank] || ""}
                            placeholder="0"
                            onChange={e => setQty(seal.name, rank, e.target.value)}
                            className="w-full bg-[#09141f] border border-[#1a3f6e] rounded px-1 py-1.5 text-white font-mono text-xs text-center focus:outline-none focus:border-[#00c8f0] transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Stats por atributo por rank ── */}
                  <div>
                    <p className="text-[#5a8aaa] text-xs font-mono uppercase tracking-wider mb-2">{t.statsLabel}</p>
                    <div className="overflow-x-auto">
                      <table className="text-xs w-full">
                        <thead>
                          <tr>
                            <th className="text-left text-[#5a8aaa] font-mono pb-2 pr-4 w-16">{t.statHeader}</th>
                            {RANKS.map(rank => (
                              <th key={rank} className="text-center font-mono pb-2 px-1" style={{ color: RANK_COLOR[rank] }}>
                                {rank}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ATTRIBUTES.map(attr => {
                            const isPct = PERCENT_ATTRS.has(attr);
                            return (
                              <tr key={attr} className={attrFilter === attr ? "bg-[#00c8f0]/5 rounded" : ""}>
                                <td className={`font-mono pr-4 py-1 ${attrFilter === attr ? "text-[#00c8f0]" : "text-[#5a8aaa]"}`}>
                                  {ATTR_SHORT[attr]}
                                  {isPct && <span className="text-[#2a4558] ml-0.5">%</span>}
                                </td>
                                {RANKS.map(rank => {
                                  const stored = seal.stats[attr]?.[rank] ?? 0;
                                  // Para % attrs: muestra valor * 100 en el input
                                  const displayVal = isPct && stored !== 0
                                    ? parseFloat((stored * 100).toPrecision(4))
                                    : stored || "";
                                  return (
                                    <td key={rank} className="px-1 py-1">
                                      <input
                                        type="number"
                                        step={isPct ? "0.001" : "1"}
                                        value={displayVal}
                                        placeholder="0"
                                        onChange={e => setStat(seal.name, attr, rank, e.target.value)}
                                        className={`w-full bg-[#09141f] border rounded px-1 py-1 text-white font-mono text-xs text-center focus:outline-none transition-colors ${
                                          attrFilter === attr
                                            ? "border-[#00c8f0]/40 focus:border-[#00c8f0]"
                                            : "border-[#1a3f6e] focus:border-[#00c8f0]"
                                        }`}
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {ATTRIBUTES.some(a => PERCENT_ATTRS.has(a)) && (
                        <p className="text-[#2a4558] text-xs font-mono mt-2">
                          🎯 CT / 🔰 BL / 💨 EV — {lang === "es"
                            ? "ingresar en % (ej. 0.3 = 0.3%)"
                            : "enter as % (e.g. 0.3 = 0.3%)"}
                        </p>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}

        {seals.length === 0 && (
          <div className="py-16 text-center text-[#2a4558] font-mono text-sm">
            {search || attrFilter ? t.noResults : t.noSealsYet}
          </div>
        )}
      </div>
    </div>
  );
}
