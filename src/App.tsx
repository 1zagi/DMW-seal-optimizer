// ============================================================
//  App.tsx  —  DMW + tab Mercado
// ============================================================

import { useState, useEffect, useRef } from "react";
import type { AppData, SealBase, SealUserData, Attribute, Rank } from "./lib/types";
import { ATTRIBUTES } from "./lib/types";
import {
  loadData, clearData, emptyAppData, loadDefaultData,
  loadBaseData, loadUserData, saveUserData,
  loadGlobalPrices, saveGlobalPrices, loadPriceTimestamps,
  mergeStorageToAppData, smartImportData, type ImportStrategy,
  loadOpenerPrice, saveOpenerPrice, loadIncludeOpener, saveIncludeOpener,
  autoUpdateFromJSON, getAvailableBackups,
} from "./lib/storage";
import { extractUserData } from "./lib/sealMerger";
import { computeAttrProgress } from "./lib/calculator";
import { RankingTab }       from "./components/RankingTab";
import { ManageTab }        from "./components/ManageTab";
import { ProgressTab }      from "./components/ProgressTab";
import { BuilderTab }       from "./components/BuilderTab";
import { MarketTab }        from "./components/MarketTab";
import { PriceBackupModal } from "./components/PriceBackupModal";
import { useServerPrices }  from "./lib/useServerPrices";
import { fetchPricesNDaysAgo, fetchPriceHistory } from "./lib/supabase";
import { TRANSLATIONS, type Lang } from "./lib/i18n";
import { SyncQRModal } from "./components/SyncQR";
import { Analytics } from "@vercel/analytics/react";

type Tab = "ranking" | "manage" | "progress" | "builder" | "market";
type CheckMode = "mark-only" | "update-rank";
const MAX_HISTORY = 20;
const LANG_KEY = "dmw-lang";

function MenuItem({ icon, label, onClick, danger, highlight, disabled }: {
  icon: string; label: string; onClick: () => void;
  danger?: boolean; highlight?: "gold"; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-mono text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed
        ${danger ? "text-[#5a8aaa] hover:bg-red-900/30 hover:text-red-400"
          : highlight === "gold" ? "text-[#ffd700] hover:bg-[#ffd700]/10"
          : "text-[#5a8aaa] hover:bg-[#1a3f6e]/60 hover:text-white"}`}>
      <span>{icon}</span><span>{label}</span>
    </button>
  );
}

export default function App() {
  const [data,     setData]     = useState<AppData>(emptyAppData());
  const [tab,      setTab]      = useState<Tab>("ranking");
  const [ready,    setReady]    = useState(false);
  const [history,  setHistory]  = useState<AppData[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  const { prices: serverPrices, connected, updatePrice } = useServerPrices();

  const [rankAttr,      setRankAttr]      = useState<Attribute>(ATTRIBUTES[0]);
  const [rankSimple,    setRankSimple]    = useState(false);
  const [rankTopN,      setRankTopN]      = useState(5);
  const [builderAttr,   setBuilderAttr]   = useState<Attribute>(ATTRIBUTES[0]);
  const [builderTarget, setBuilderTarget] = useState("");
  const [builderSlider, setBuilderSlider] = useState(false);
  const [builderMode,   setBuilderMode]   = useState<"total" | "add">("total");
  const [openerPrice,   setOpenerPrice]   = useState(() => loadOpenerPrice());
  const [includeOpener, setIncludeOpener] = useState(() => loadIncludeOpener());
  const [manageSearch,  setManageSearch]  = useState("");
  const [manageFilter,  setManageFilter]  = useState<Attribute | null>(null);
  const [manageSort,    setManageSort]    = useState<"name-asc"|"name-desc"|"stat-desc"|"stat-asc">("name-asc");
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang | null) ?? "es");
  const [priceTimestamps, setPriceTimestamps] = useState<Record<string, number>>(() => loadPriceTimestamps());

  const [activeSolution, setActiveSolution] = useState<"cheapest" | "fewest">("cheapest");
  const [checkedKeys,    setCheckedKeys]    = useState<Set<string>>(new Set());
  const [checkMode,      setCheckMode]      = useState<CheckMode>("mark-only");
  const [rankingCheckedKeys, setRankingCheckedKeys] = useState<Set<string>>(new Set());
  const [rankingCheckMode,   setRankingCheckMode]   = useState<CheckMode>("mark-only");

  const [importDialog, setImportDialog] = useState<{
    show: boolean; baseData?: SealBase[];
    userData?: Map<string, SealUserData>; prices?: Record<string, number>;
  }>({ show: false });
  const [isSyncing,      setIsSyncing]      = useState(false);
  const [showBackups,    setShowBackups]    = useState(false);
  const [showSyncQR,     setShowSyncQR]     = useState(false);
  const [backupRestored, setBackupRestored] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[lang];
  const TABS: { key: Tab; label: string }[] = [
    { key: "progress", label: t.tabProgress },
    { key: "builder",  label: t.tabBuilder  },
    { key: "ranking",  label: t.tabRanking  },
    { key: "manage",   label: t.tabManage   },
    { key: "market",   label: lang === "es" ? "Mercado" : "Market" },
  ];

  useEffect(() => {
    if (!ready || serverPrices.size === 0) return;
    setData(prev => {
      const localTsMap = loadPriceTimestamps();
      const seals = { ...prev.seals };
      let changed = false;
      for (const [id, row] of serverPrices.entries()) {
        if (!seals[id]) continue;
        const localEditMs = localTsMap[id] ?? 0;
        if (localEditMs > row.updatedAtMs) continue;
        if (seals[id].priceM !== row.priceM) {
          seals[id] = { ...seals[id], priceM: row.priceM };
          changed = true;
        }
      }
      if (!changed) return prev;
      const next = { ...prev, seals, lastUpdated: Date.now() };
      return { ...next, attrProgress: computeAttrProgress(next) };
    });
  }, [serverPrices, ready]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { attr } = (e as CustomEvent).detail as { attr: Attribute };
      setBuilderAttr(attr); setBuilderTarget(""); setTab("builder");
    };
    document.addEventListener("goto-builder", handler);
    return () => document.removeEventListener("goto-builder", handler);
  }, []);

  useEffect(() => {
    const init = async () => {
      const saved = loadData();
      if (saved) {
        setData({ ...saved, attrProgress: computeAttrProgress(saved) });
        setReady(true);
        const synced = await autoUpdateFromJSON();
        if (synced) { const r = loadData(); if (r) setData({ ...r, attrProgress: computeAttrProgress(r) }); }
        return;
      }
      const fallback = await loadDefaultData();
      setData(fallback ? { ...fallback, attrProgress: computeAttrProgress(fallback) } : emptyAppData());
      setReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!ready) return;
    setCheckedKeys(new Set());
  }, [data, builderAttr, builderTarget, builderMode, includeOpener, openerPrice, activeSolution, ready]);

  const persist = (next: AppData, updatedSealId?: string): AppData => {
    const withProgress = { ...next, attrProgress: computeAttrProgress(next) };
    const userData = new Map<string, SealUserData>();
    const prices: Record<string, number> = {};
    for (const [name, seal] of Object.entries(next.seals)) {
      userData.set(seal.name || name, extractUserData(seal, seal.name || name));
      if (seal.priceM > 0) prices[seal.name || name] = seal.priceM;
    }
    saveUserData(userData);
    if (Object.keys(prices).length > 0) saveGlobalPrices(prices, updatedSealId);
    return withProgress;
  };

  const updateData = (next: AppData) => {
    setData(prev => { setHistory(h => [...h.slice(-MAX_HISTORY + 1), prev]); return persist(next); });
  };

  const handlePriceChange = async (sealId: string, priceM: number) => {
    const prevPrice = data.seals[sealId]?.priceM;
    setData(prev => {
      if (!prev.seals[sealId]) return prev;
      const next = { ...prev, seals: { ...prev.seals, [sealId]: { ...prev.seals[sealId], priceM } }, lastUpdated: Date.now() };
      return persist(next, sealId);
    });
    setPriceTimestamps(prev => ({ ...prev, [sealId]: Date.now() }));
    await updatePrice(sealId, priceM, prevPrice);
  };

  const handleToggleCheck = (key: string, sealName: string, rank: Rank) => {
    setCheckedKeys(prev => {
      const next = new Set(prev);
      const wasChecked = next.has(key);
      wasChecked ? next.delete(key) : next.add(key);
      if (!wasChecked && checkMode === "update-rank") {
        setData(prevData => {
          if (!prevData.seals[sealName]) return prevData;
          setHistory(h => [...h.slice(-MAX_HISTORY + 1), prevData]);
          return persist({ ...prevData, seals: { ...prevData.seals, [sealName]: { ...prevData.seals[sealName], currentRank: rank } }, lastUpdated: Date.now() });
        });
      }
      return next;
    });
  };

  const handleClearChecks = () => setCheckedKeys(new Set());

  const handleToggleRankingCheck = (key: string, sealName: string, rank: Rank) => {
    setRankingCheckedKeys(prev => {
      const next = new Set(prev);
      const wasChecked = next.has(key);
      wasChecked ? next.delete(key) : next.add(key);
      if (!wasChecked && rankingCheckMode === "update-rank") {
        setData(prevData => {
          if (!prevData.seals[sealName]) return prevData;
          setHistory(h => [...h.slice(-MAX_HISTORY + 1), prevData]);
          return persist({ ...prevData, seals: { ...prevData.seals, [sealName]: { ...prevData.seals[sealName], currentRank: rank } }, lastUpdated: Date.now() });
        });
      }
      return next;
    });
  };

  const handleClearRankingChecks = () => setRankingCheckedKeys(new Set());

  const handleUndo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setData(persist(prev));
  };

  const handleReset = () => {
    if (!confirm(t.confirmReset)) return;
    clearData(); setHistory([]); setData(emptyAppData()); setCheckedKeys(new Set());
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const ok = await autoUpdateFromJSON();
      if (ok) { const r = loadData(); if (r) updateData(r); alert(lang === "es" ? "✓ Sincronización completada" : "✓ Sync completed"); }
      else alert(lang === "es" ? "❌ No se pudo sincronizar" : "❌ Could not sync");
    } finally { setIsSyncing(false); }
  };

  const handleQRImport = (userData: Map<string, SealUserData>, _fromServerId: string) => {
    setData(prev => {
      const seals = { ...prev.seals };
      for (const [id, u] of userData.entries()) {
        if (seals[id]) seals[id] = { ...seals[id], currentRank: u.currentRank };
      }
      const next = { ...prev, seals, lastUpdated: Date.now() };
      return persist(next);
    });
    setShowSyncQR(false);
  };

  const handleRestoreBackup = (label: string) => {
    const r = loadData();
    if (r) { updateData(r); setBackupRestored(label); setTimeout(() => setBackupRestored(null), 3000); alert(lang === "es" ? `✓ Precios restaurados desde ${label}` : `✓ Prices restored from ${label}`); }
  };

  const toggleLang = () => {
    const next: Lang = lang === "es" ? "en" : "es";
    setLang(next); localStorage.setItem(LANG_KEY, next);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const p = JSON.parse(ev.target?.result as string);
        if (p.base && Array.isArray(p.base)) { setImportDialog({ show: true, baseData: p.base, prices: p.prices }); return; }
        if (p.seals) {
          const entries = Object.values(p.seals) as any[];
          const base = entries.map((s: any) => ({ id: s.name, name: s.name, stats: s.stats, qty: s.qty }));
          const user = new Map<string, SealUserData>(); const prices: Record<string, number> = {};
          for (const s of entries) { if (s.name) { user.set(s.name, { sealId: s.name, currentRank: s.currentRank ?? null }); if (s.priceM > 0) prices[s.name] = s.priceM; } }
          setImportDialog({ show: true, baseData: base, userData: user, prices }); return;
        }
        throw new Error(lang === "es" ? "JSON inválido" : "Invalid JSON");
      } catch (err) { alert(`❌ ${(err as Error).message}`); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  const confirmImport = (strategy: ImportStrategy) => {
    if (!importDialog.baseData) return;
    smartImportData(importDialog.baseData, importDialog.userData, importDialog.prices, strategy);
    updateData(mergeStorageToAppData(loadBaseData(), loadUserData(), loadGlobalPrices()));
    alert(`✅ ${importDialog.baseData.length} ${lang === "es" ? "sellos importados" : "seals imported"}`);
    setImportDialog({ show: false });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "seals_data.json"; a.click();
    URL.revokeObjectURL(url);
  };

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[#00c8f0] font-mono animate-pulse">{lang === "es" ? "Cargando..." : "Loading..."}</p>
    </div>
  );

  const sealCount    = Object.keys(data.seals).length;
  const hasBackups   = getAvailableBackups().length > 0;
  // DMW usa servidor único fijo
  const DMW_SERVER_ID = "dmw";

  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      <header className="flex items-center justify-between px-3 py-3 sm:px-6 sm:py-4 border-b border-[#1a3f6e] bg-[#09141f]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="text-xl sm:text-2xl shrink-0">⚔️</span>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold tracking-widest uppercase truncate">DMW Seal Optimizer</h1>
            <p className="text-[#5a8aaa] text-[10px] sm:text-xs font-mono truncate">{sealCount > 0 ? t.sealCount(sealCount) : t.noSeals}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono border-[#1a3f6e]" style={{ color: connected ? "#00e676" : "#5a8aaa" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? "#00e676" : "#5a8aaa" }} />
            {connected ? (lang === "es" ? "En vivo" : "Live") : (lang === "es" ? "Conectando..." : "Connecting...")}
          </span>
          <button onClick={handleUndo} disabled={!history.length}
            className="px-3 py-1.5 text-xs font-mono border border-[#1a3f6e] text-[#5a8aaa] rounded hover:border-[#00c8f0] hover:text-[#00c8f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ↩{history.length > 0 && <span className="ml-1 text-[#2a4558]">({history.length})</span>}
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)}
              className={`px-3 py-1.5 text-xs font-mono border rounded transition-colors ${showMenu ? "border-[#00c8f0] text-[#00c8f0]" : "border-[#1a3f6e] text-[#5a8aaa] hover:border-[#00c8f0] hover:text-[#00c8f0]"}`}>
              ⋯ {lang === "es" ? "Opciones" : "Options"}
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-[#09141f] border border-[#1a3f6e] rounded-xl overflow-hidden shadow-xl py-1">
                  <input ref={fileRef} type="file" accept=".json" onChange={e => { setShowMenu(false); handleImport(e); }} className="hidden" />
                  <MenuItem icon="📥" label={lang === "es" ? "Importar JSON" : "Import JSON"} onClick={() => { setShowMenu(false); fileRef.current?.click(); }} />
                  <MenuItem icon="📤" label={lang === "es" ? "Exportar JSON" : "Export JSON"} onClick={() => { setShowMenu(false); handleExport(); }} />
                  <MenuItem icon="↻" label={isSyncing ? (lang === "es" ? "Sincronizando..." : "Syncing...") : (lang === "es" ? "Sincronizar sellos" : "Sync seals")} disabled={isSyncing} onClick={() => { setShowMenu(false); handleSync(); }} />
                  <MenuItem icon="📱" label={lang === "es" ? "Sincronizar con cel" : "Sync with mobile"} onClick={() => { setShowMenu(false); setShowSyncQR(true); }} />
                  {hasBackups && <><div className="border-t border-[#1a3f6e] my-0.5" /><MenuItem icon="📦" label={lang === "es" ? "Ver backups" : "View backups"} highlight="gold" onClick={() => { setShowMenu(false); setShowBackups(true); }} /></>}
                  <div className="border-t border-[#1a3f6e] my-0.5" />
                  <MenuItem icon="🌐" label={lang === "es" ? "English" : "Español"} onClick={() => { setShowMenu(false); toggleLang(); }} />
                  <div className="border-t border-[#1a3f6e] my-0.5" />
                  <MenuItem icon="🗑" label={lang === "es" ? "Resetear todo" : "Reset all"} danger onClick={() => { setShowMenu(false); handleReset(); }} />
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="flex border-b border-[#1a3f6e] px-6 bg-[#09141f] overflow-x-auto">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`relative px-5 py-3 text-sm font-semibold tracking-wider uppercase transition-all border-b-2 whitespace-nowrap ${tab === tb.key ? "border-[#00c8f0] text-[#00c8f0]" : "border-transparent text-[#5a8aaa] hover:text-white"}`}>
            {tb.label}
          </button>
        ))}
      </nav>

      <main className="p-3 sm:p-6">
        <div className="mb-4 px-3 py-2 rounded-lg border border-[#00c8f0]/20 bg-[#00c8f0]/5 flex items-center gap-2">
          <span className="shrink-0">🌐</span>
          <span className="text-[#5a8aaa] text-xs font-mono">{lang === "es" ? "Precios compartidos en tiempo real" : "Prices shared in real time"}</span>
        </div>

        {(tab === "ranking" || tab === "builder") && (
          <div className="mb-6 p-3 bg-[#09141f] border border-[#1a3f6e] rounded-xl flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2"><span>📦</span><span className="text-white text-xs font-bold font-mono uppercase tracking-wider">Seal Opener</span><span className="text-[#2a4558] text-xs font-mono">({lang === "es" ? "abre 50 sellos c/u" : "opens 50 seals each"})</span></div>
            <div onClick={() => { const n = !includeOpener; setIncludeOpener(n); saveIncludeOpener(n); }} className="flex items-center gap-2 cursor-pointer select-none">
              <div className={`w-9 h-5 rounded-full transition-all relative ${includeOpener ? "bg-[#00c8f0]" : "bg-[#1a3f6e]"}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${includeOpener ? "left-[18px]" : "left-0.5"}`} /></div>
              <span className="text-xs font-mono text-[#5a8aaa]">{lang === "es" ? "Incluir en costos" : "Include in costs"}</span>
            </div>
            {includeOpener && (
              <div className="flex items-center gap-2">
                <span className="text-[#5a8aaa] text-xs font-mono">{lang === "es" ? "Precio opener:" : "Opener price:"}</span>
                <input type="number" value={openerPrice || ""} onChange={e => { const v = parseFloat(e.target.value) || 0; setOpenerPrice(v); saveOpenerPrice(v); }} placeholder="500" className="w-24 px-2 py-1 rounded bg-[#0a1520] border border-[#1a3f6e] text-white font-mono text-xs focus:border-[#00c8f0] focus:outline-none" />
                <span className="text-[#5a8aaa] text-xs font-mono">M</span>
              </div>
            )}
          </div>
        )}

        {tab === "ranking"  && <RankingTab  data={data} lang={lang} selectedAttr={rankAttr} onAttrChange={setRankAttr} simpleMode={rankSimple} onSimpleModeChange={setRankSimple} topN={rankTopN} onTopNChange={setRankTopN} openerPrice={openerPrice} includeOpener={includeOpener} checkedKeys={rankingCheckedKeys} checkMode={rankingCheckMode} onCheckModeChange={setRankingCheckMode} onToggleCheck={handleToggleRankingCheck} onClearChecks={handleClearRankingChecks} onPriceChange={handlePriceChange} />}
        {tab === "manage"   && <ManageTab   data={data} onUpdate={updateData} onPriceChange={handlePriceChange} lang={lang} search={manageSearch} onSearchChange={setManageSearch} attrFilter={manageFilter} onAttrFilterChange={setManageFilter} sortKey={manageSort} onSortKeyChange={setManageSort} priceTimestamps={priceTimestamps} />}
        {tab === "progress" && <ProgressTab data={data} onUpdate={updateData} lang={lang} />}
        {tab === "builder"  && <BuilderTab  data={data} lang={lang} selectedAttr={builderAttr} onAttrChange={attr => { setBuilderAttr(attr); setBuilderTarget(""); setCheckedKeys(new Set()); }} targetStat={builderTarget} onTargetStatChange={setBuilderTarget} useSlider={builderSlider} onUseSliderChange={setBuilderSlider} builderMode={builderMode} onBuilderModeChange={setBuilderMode} openerPrice={openerPrice} includeOpener={includeOpener} checkedKeys={checkedKeys} checkMode={checkMode} activeSolution={activeSolution} onActiveSolutionChange={s => { setActiveSolution(s); setCheckedKeys(new Set()); }} onToggleCheck={handleToggleCheck} onClearChecks={handleClearChecks} onCheckModeChange={setCheckMode} onPriceChange={handlePriceChange} />}
        {tab === "market"   && <MarketTab   data={data} lang={lang} fetchPricesNDaysAgo={fetchPricesNDaysAgo} fetchPriceHistory={fetchPriceHistory} />}
      </main>

      {importDialog.show && importDialog.baseData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#09141f] border border-[#1a3f6e] rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-[#00c8f0] mb-4">{lang === "es" ? "Estrategia de Import" : "Import Strategy"}</h2>
            <p className="text-[#5a8aaa] text-sm font-mono mb-6">{lang === "es" ? `${importDialog.baseData.length} sellos a importar` : `${importDialog.baseData.length} seals to import`}</p>
            <div className="space-y-2 mb-6">
              <button onClick={() => confirmImport("preserve")} className="w-full p-3 rounded-lg border border-[#1a3f6e] text-left hover:border-[#ffd700] hover:bg-[#ffd700]/10 transition-all"><div className="font-bold text-[#ffd700]">🔒 {lang === "es" ? "Preservar" : "Preserve"}</div><div className="text-xs text-[#5a8aaa] mt-1">{lang === "es" ? "Solo agregar sellos nuevos" : "Only add new seals"}</div></button>
              <button onClick={() => confirmImport("update-ranks")} className="w-full p-3 rounded-lg border border-[#00c8f0] bg-[#00c8f0]/5 text-left hover:bg-[#00c8f0]/10 transition-all"><div className="font-bold text-[#00c8f0]">📈 {lang === "es" ? "Actualizar ranks (Recomendado)" : "Update Ranks (Recommended)"}</div><div className="text-xs text-[#5a8aaa] mt-1">{lang === "es" ? "Subir ranks, conservar precios" : "Upgrade ranks, keep prices"}</div></button>
              <button onClick={() => confirmImport("auto-sync")} className="w-full p-3 rounded-lg border border-[#1a3f6e] text-left hover:border-[#6aaccf] hover:bg-[#6aaccf]/10 transition-all"><div className="font-bold text-[#6aaccf]">🔄 Auto-sync</div><div className="text-xs text-[#5a8aaa] mt-1">{lang === "es" ? "Actualizar stats/precios, preservar tu rank" : "Update stats/prices, preserve rank"}</div></button>
              <button onClick={() => confirmImport("overwrite")} className="w-full p-3 rounded-lg border border-[#1a3f6e] text-left hover:border-red-400 hover:bg-red-400/10 transition-all"><div className="font-bold text-red-400">⚠️ {lang === "es" ? "Sobrescribir todo" : "Overwrite All"}</div><div className="text-xs text-[#5a8aaa] mt-1">{lang === "es" ? "Reemplazar todo" : "Replace everything"}</div></button>
            </div>
            <button onClick={() => setImportDialog({ show: false })} className="w-full p-2 border border-[#1a3f6e] text-[#5a8aaa] rounded-lg hover:text-white transition-colors text-sm">{lang === "es" ? "Cancelar" : "Cancel"}</button>
          </div>
        </div>
      )}

      <PriceBackupModal isOpen={showBackups} onClose={() => setShowBackups(false)} onRestore={handleRestoreBackup} lang={lang} />

      {backupRestored && (
        <div className="fixed bottom-6 left-6 bg-[#0a8a54] border border-[#00c8f0] rounded-lg p-3 text-sm text-white font-mono z-40">
          ✓ {lang === "es" ? "Precios restaurados desde" : "Prices restored from"} {backupRestored}
        </div>
      )}

      {showSyncQR && (
        <SyncQRModal
          data={data}
          serverId={DMW_SERVER_ID}
          lang={lang}
          onImport={handleQRImport}
          onClose={() => setShowSyncQR(false)}
        />
      )}

      <Analytics />
    </div>
  );
}
