// ============================================================
//  App.tsx  —  Componente raíz de la aplicación
// ============================================================

import { useState, useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import type { AppData, SealBase, SealUserData, Attribute } from "./lib/types";
import { ATTRIBUTES } from "./lib/types";
import {
  loadData,
  clearData,
  emptyAppData,
  loadDefaultData,
  loadBaseData,
  loadUserData,
  saveUserData,
  mergeStorageToAppData,
  smartImportData,
  type ImportStrategy,
  loadOpenerPrice,
  saveOpenerPrice,
  loadIncludeOpener,
  saveIncludeOpener,
} from "./lib/storage";
import { extractUserData } from "./lib/sealMerger";
import { computeAttrProgress } from "./lib/calculator";
import { RankingTab } from "./components/RankingTab";
import { ManageTab } from "./components/ManageTab";
import { ProgressTab } from "./components/ProgressTab";
import { BuilderTab } from "./components/BuilderTab";
import { TRANSLATIONS, type Lang } from "./lib/i18n";

type Tab = "ranking" | "manage" | "progress" | "builder";
const MAX_HISTORY = 20;
const LANG_KEY = "izagi-lang";

export default function App() {
  const [data, setData] = useState<AppData>(emptyAppData());
  const [tab, setTab] = useState<Tab>("ranking");
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<AppData[]>([]);

  // ── Estado persistente por tab ──
  // RankingTab
  const [rankAttr,      setRankAttr]      = useState<Attribute>(ATTRIBUTES[0]);
  const [rankSimple,    setRankSimple]    = useState(false);
  const [rankTopN,      setRankTopN]      = useState(5);
  // BuilderTab
  const [builderAttr,   setBuilderAttr]   = useState<Attribute>(ATTRIBUTES[0]);
  const [builderTarget, setBuilderTarget] = useState("");
  const [builderSlider, setBuilderSlider] = useState(false);
  const [builderMode,   setBuilderMode]   = useState<"total" | "add">("total");
  // Global settings
  const [openerPrice,   setOpenerPrice]   = useState(() => loadOpenerPrice());
  const [includeOpener, setIncludeOpener] = useState(() => loadIncludeOpener());
  // ManageTab
  const [manageSearch,  setManageSearch]  = useState("");
  const [manageFilter,  setManageFilter]  = useState<Attribute | null>(null);
  const [manageSort,    setManageSort]    = useState<"name-asc"|"name-desc"|"stat-desc"|"stat-asc">("name-asc");
  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem(LANG_KEY) as Lang | null) ?? "es"
  );
  const [importDialog, setImportDialog] = useState<{
    show: boolean;
    baseData?: SealBase[];
    userData?: Map<string, SealUserData>;
  }>({ show: false });
  const fileRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[lang];

  const TABS: { key: Tab; label: string }[] = [
    { key: "progress", label: t.tabProgress },
    { key: "builder", label: t.tabBuilder },
    { key: "ranking", label: t.tabRanking },
    { key: "manage", label: t.tabManage },
  ];

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { attr: Attribute };
      setBuilderAttr(detail.attr);
      setBuilderTarget("");
      setTab("builder");
    };
    document.addEventListener("goto-builder", handler);
    return () => document.removeEventListener("goto-builder", handler);
  }, []);

  useEffect(() => {
    const init = async () => {
      // Cargar datos guardados
      const saved = loadData();
      if (saved) {
        setData({ ...saved, attrProgress: computeAttrProgress(saved) });
        setReady(true);
        return;
      }

      // Si no hay datos, cargar datos predeterminados
      const fallback = await loadDefaultData();
      if (fallback) {
        setData({ ...fallback, attrProgress: computeAttrProgress(fallback) });
      } else {
        setData(emptyAppData());
      }
      setReady(true);
    };
    init();
  }, []);

  // Guarda en historial ANTES de aplicar el cambio
  // Ahora solo guarda userData
  const updateData = (next: AppData) => {
    setHistory(prev => [...prev.slice(-MAX_HISTORY + 1), data]);
    const withProgress = { ...next, attrProgress: computeAttrProgress(next) };
    setData(withProgress);

    // NEW: Guardar solo user data
    const userData = new Map<string, SealUserData>();
    for (const [name, seal] of Object.entries(next.seals)) {
      userData.set(seal.name || name, extractUserData(seal, seal.name || name));
    }
    saveUserData(userData);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const withProgress = { ...prev, attrProgress: computeAttrProgress(prev) };
    setData(withProgress);

    // Guardar user data
    const userData = new Map<string, SealUserData>();
    for (const [name, seal] of Object.entries(prev.seals)) {
      userData.set(seal.name || name, extractUserData(seal, seal.name || name));
    }
    saveUserData(userData);
  };

  const handleReset = () => {
    if (!confirm(t.confirmReset)) return;
    clearData();
    setHistory([]);
    setData(emptyAppData());
  };

  const toggleLang = () => {
    const next: Lang = lang === "es" ? "en" : "es";
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  };

  // ── Importar JSON ──
  // SMART IMPORT: agrega sellos nuevos Y actualiza ranks/precios de los existentes
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);

        // ── Formato nuevo: { base: SealBase[] } ──
        if (parsed.base && Array.isArray(parsed.base)) {
          const newBase = parsed.base as SealBase[];
          setImportDialog({ show: true, baseData: newBase });
          return;
        }

        // ── Formato exportado por la app: { seals: Record<string, Seal> } ──
        if (parsed.seals) {
          const sealEntries = Object.values(parsed.seals) as any[];

          // Separar base y user data
          const baseToImport: SealBase[] = sealEntries.map((s: any) => ({
            id:    s.name,
            name:  s.name,
            stats: s.stats,
            qty:   s.qty,
          }));

          // Extraer userData (currentRank + priceM) de cada sello exportado
          const userToImport = new Map<string, SealUserData>();
          for (const s of sealEntries) {
            if (s.name) {
              userToImport.set(s.name, {
                sealId:      s.name,
                currentRank: s.currentRank ?? null,
                priceM:      s.priceM ?? 0,
              });
            }
          }

          setImportDialog({ show: true, baseData: baseToImport, userData: userToImport });
          return;
        }

        throw new Error(lang === "es" ? "JSON invalido: falta 'seals' o 'base'" : "Invalid JSON: missing 'seals' or 'base'");
      } catch (err) {
        alert(`❌ ${lang === "es" ? "Error al leer el JSON:" : "Error reading JSON:"} ` + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Confirmar import con estrategia ──
  const confirmImport = (strategy: ImportStrategy) => {
    if (!importDialog.baseData) return;
    
    smartImportData(importDialog.baseData, importDialog.userData, strategy);
    const merged = mergeStorageToAppData(loadBaseData(), loadUserData());
    updateData(merged);
    
    const sealCount = importDialog.baseData.length;
    const strategyLabel = lang === "es" 
      ? strategy === "preserve" ? "sin cambios en ranks existentes"
        : strategy === "update-ranks" ? "actualizando ranks"
        : "sobrescribiendo todo"
      : strategy === "preserve" ? "without changing existing ranks"
        : strategy === "update-ranks" ? "updating ranks"
        : "overwriting all";
    
    alert(`✅ ${lang === "es" ? "Importados" : "Imported"} ${sealCount} ${lang === "es" ? "sellos" : "seals"} (${strategyLabel})`);
    setImportDialog({ show: false });
  };

  // ── Exportar JSON ──
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seals_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ready) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[#00c8f0] font-mono animate-pulse">
        {lang === "es" ? "Cargando..." : "Loading..."}
      </p>
    </div>
  );

  const sealCount = Object.keys(data.seals).length;

  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a3f6e] bg-[#09141f]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚔️</span>
          <div>
            <h1 className="text-lg font-bold tracking-widest uppercase">Seal Optimizer</h1>
            <p className="text-[#5a8aaa] text-xs font-mono">
              {sealCount > 0 ? t.sealCount(sealCount) : t.noSeals}
            </p>
          </div>
        </div>

        {/* Botones de la barra superior */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="text-[#2a4558] text-xs font-mono hidden md:block mr-2">
            {t.saved} {new Date(data.lastUpdated).toLocaleTimeString()}
          </span>

          {/* Idioma */}
          <button
            onClick={toggleLang}
            className="px-3 py-1.5 text-xs font-mono border border-[#6aaccf]/40 text-[#6aaccf] rounded hover:bg-[#6aaccf]/10 transition-colors"
            title={lang === "es" ? "Switch to English" : "Cambiar a Español"}
          >
            🌐 {t.langToggle}
          </button>

          {/* Deshacer */}
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            title={lang === "es" ? `${history.length} acción(es) en historial` : `${history.length} action(s) in history`}
            className="px-3 py-1.5 text-xs font-mono border border-[#1a3f6e] text-[#5a8aaa] rounded hover:border-[#00c8f0] hover:text-[#00c8f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {t.undo}
            {history.length > 0 && (
              <span className="ml-1 text-[#2a4558]">({history.length})</span>
            )}
          </button>

          {/* Importar JSON */}
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-xs font-mono border border-[#00c8f0] text-[#00c8f0] rounded hover:bg-[#00c8f0]/10 transition-colors"
          >
            {t.importJson}
          </button>

          {/* Exportar JSON */}
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs font-mono border border-[#5a8aaa] text-[#5a8aaa] rounded hover:border-[#00c8f0] hover:text-[#00c8f0] transition-colors"
          >
            {t.exportJson}
          </button>

          {/* Reset total */}
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-mono border border-[#1a3f6e] text-[#5a8aaa] rounded hover:border-red-700 hover:text-red-400 transition-colors"
          >
            {t.resetAll}
          </button>
        </div>
      </header>

      <nav className="flex border-b border-[#1a3f6e] px-6 bg-[#09141f] overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold tracking-wider uppercase transition-all border-b-2 whitespace-nowrap ${tab === t.key ? "border-[#00c8f0] text-[#00c8f0]" : "border-transparent text-[#5a8aaa] hover:text-white"
              }`}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="p-6">
        {/* ── Panel global: Seal Opener ── */}
        {(tab === "ranking" || tab === "builder") && (
          <div className="mb-6 p-3 bg-[#09141f] border border-[#1a3f6e] rounded-xl flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <span className="text-white text-xs font-bold font-mono uppercase tracking-wider">Seal Opener</span>
              <span className="text-[#2a4558] text-xs font-mono">({lang === "es" ? "abre 50 sellos c/u" : "opens 50 seals each"})</span>
            </div>

            {/* Toggle */}
            <div
              onClick={() => { const n = !includeOpener; setIncludeOpener(n); saveIncludeOpener(n); }}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <div className={`w-9 h-5 rounded-full transition-all relative ${
                includeOpener ? "bg-[#00c8f0]" : "bg-[#1a3f6e]"
              }`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  includeOpener ? "left-[18px]" : "left-0.5"
                }`} />
              </div>
              <span className="text-xs font-mono text-[#5a8aaa]">
                {lang === "es" ? "Incluir en costos" : "Include in costs"}
              </span>
            </div>

            {/* Precio — solo visible cuando el toggle está activo */}
            {includeOpener && (
              <div className="flex items-center gap-2">
                <span className="text-[#5a8aaa] text-xs font-mono">
                  {lang === "es" ? "Precio del opener:" : "Opener price:"}
                </span>
                <input
                  type="number"
                  value={openerPrice || ""}
                  onChange={e => { const v = parseFloat(e.target.value) || 0; setOpenerPrice(v); saveOpenerPrice(v); }}
                  placeholder="500"
                  className="w-24 px-2 py-1 rounded bg-[#0a1520] border border-[#1a3f6e] text-white font-mono text-xs focus:border-[#00c8f0] focus:outline-none"
                />
                <span className="text-[#5a8aaa] text-xs font-mono">M</span>
                {openerPrice > 0 && (
                  <span className="text-[#00c8f0] text-xs font-mono">
                    → {(openerPrice / 50).toFixed(2)} M {lang === "es" ? "extra por sello" : "extra per seal"}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        {tab === "ranking" && <RankingTab data={data} lang={lang}
          selectedAttr={rankAttr} onAttrChange={setRankAttr}
          simpleMode={rankSimple} onSimpleModeChange={setRankSimple}
          topN={rankTopN} onTopNChange={setRankTopN}
          openerPrice={openerPrice} includeOpener={includeOpener}
        />}
        {tab === "manage" && <ManageTab data={data} onUpdate={updateData} lang={lang}
          search={manageSearch} onSearchChange={setManageSearch}
          attrFilter={manageFilter} onAttrFilterChange={setManageFilter}
          sortKey={manageSort} onSortKeyChange={setManageSort}
        />}
        {tab === "progress" && <ProgressTab data={data} onUpdate={updateData} lang={lang} />}
        {tab === "builder" && <BuilderTab data={data} lang={lang}
          selectedAttr={builderAttr} onAttrChange={setBuilderAttr}
          targetStat={builderTarget} onTargetStatChange={setBuilderTarget}
          useSlider={builderSlider} onUseSliderChange={setBuilderSlider}
          builderMode={builderMode} onBuilderModeChange={setBuilderMode}
          openerPrice={openerPrice} includeOpener={includeOpener}
        />}
      </main>

      {/* ── Modal de estrategia de import ── */}
      {importDialog.show && importDialog.baseData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#09141f] border border-[#1a3f6e] rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold text-[#00c8f0] mb-4">
              {lang === "es" ? "Estrategia de Import" : "Import Strategy"}
            </h2>
            <p className="text-[#5a8aaa] text-sm font-mono mb-6">
              {lang === "es" 
                ? `Se importarán ${importDialog.baseData.length} sellos. ¿Cómo deseas actualizar los ranks existentes?`
                : `Will import ${importDialog.baseData.length} seals. How do you want to update existing ranks?`}
            </p>

            <div className="space-y-2 mb-6">
              {/* Option 1: Preserve */}
              <button
                onClick={() => confirmImport("preserve")}
                className="w-full p-3 rounded-lg border border-[#1a3f6e] text-left hover:border-[#ffd700] hover:bg-[#ffd700]/10 transition-all"
              >
                <div className="font-bold text-[#ffd700]">
                  {lang === "es" ? "🔒 Preservar totalmente" : "🔒 Fully Preserve"}
                </div>
                <div className="text-xs text-[#5a8aaa] mt-1">
                  {lang === "es" 
                    ? "Solo agregar sellos nuevos, sin cambiar ranks existentes"
                    : "Only add new seals, don't change existing ranks"}
                </div>
              </button>

              {/* Option 2: Update Ranks (DEFAULT) */}
              <button
                onClick={() => confirmImport("update-ranks")}
                className="w-full p-3 rounded-lg border border-[#00c8f0] text-left hover:border-[#00c8f0] hover:bg-[#00c8f0]/10 transition-all bg-[#00c8f0]/5"
              >
                <div className="font-bold text-[#00c8f0]">
                  {lang === "es" ? "📈 Actualizar ranks (Recomendado)" : "📈 Update Ranks (Recommended)"}
                </div>
                <div className="text-xs text-[#5a8aaa] mt-1">
                  {lang === "es" 
                    ? "Subir a ranks más altos, conservar precios existentes"
                    : "Upgrade to higher ranks, keep existing prices"}
                </div>
              </button>

              {/* Option 3: Overwrite */}
              <button
                onClick={() => confirmImport("overwrite")}
                className="w-full p-3 rounded-lg border border-[#1a3f6e] text-left hover:border-red-400 hover:bg-red-400/10 transition-all"
              >
                <div className="font-bold text-red-400">
                  {lang === "es" ? "⚠️ Sobrescribir todo" : "⚠️ Overwrite All"}
                </div>
                <div className="text-xs text-[#5a8aaa] mt-1">
                  {lang === "es" 
                    ? "Reemplazar todos los ranks y precios importados"
                    : "Replace all ranks and prices with imported data"}
                </div>
              </button>
            </div>

            <button
              onClick={() => setImportDialog({ show: false })}
              className="w-full p-2 border border-[#1a3f6e] text-[#5a8aaa] rounded-lg hover:text-white transition-colors text-sm"
            >
              {lang === "es" ? "Cancelar" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      <Analytics />
    </div>
  );
}
