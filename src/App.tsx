// ============================================================
//  App.tsx  —  Componente raíz de la aplicación
// ============================================================

import { useState, useEffect, useRef } from "react";
import type { AppData } from "./lib/types";
import { loadData, saveData, clearData, emptyAppData, loadDefaultData } from "./lib/storage";
import { computeAttrProgress } from "./lib/calculator";
import { RankingTab } from "./components/RankingTab";
import { ManageTab } from "./components/ManageTab";
import { ProgressTab } from "./components/ProgressTab";
import { TRANSLATIONS, type Lang } from "./lib/i18n";

type Tab = "ranking" | "manage" | "progress";
const MAX_HISTORY = 20;
const LANG_KEY = "izagi-lang";

export default function App() {
  const [data, setData] = useState<AppData>(emptyAppData());
  const [tab, setTab] = useState<Tab>("ranking");
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<AppData[]>([]);
  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem(LANG_KEY) as Lang | null) ?? "es"
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const t = TRANSLATIONS[lang];

  const TABS: { key: Tab; label: string }[] = [
    { key: "ranking", label: t.tabRanking },
    { key: "manage", label: t.tabManage },
    { key: "progress", label: t.tabProgress },
  ];

  useEffect(() => {
    const init = async () => {
      const saved = loadData();
      if (saved) {
        setData({ ...saved, attrProgress: computeAttrProgress(saved) });
      } else {
        const fallback = await loadDefaultData();
        if (fallback) {
          const withProgress = { ...fallback, attrProgress: computeAttrProgress(fallback) };
          setData(withProgress);
          saveData(withProgress);
        }
      }
      setReady(true);
    };
    init();
  }, []);

  // Guarda en historial ANTES de aplicar el cambio
  const updateData = (next: AppData) => {
    setHistory(prev => [...prev.slice(-MAX_HISTORY + 1), data]);
    const withProgress = { ...next, attrProgress: computeAttrProgress(next) };
    setData(withProgress);
    saveData(withProgress);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const withProgress = { ...prev, attrProgress: computeAttrProgress(prev) };
    setData(withProgress);
    saveData(withProgress);
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
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as AppData;
        if (!parsed.seals) throw new Error("JSON inválido: falta 'seals'");
        parsed.lastUpdated = Date.now();
        updateData(parsed);
        alert(`✅ ${lang === "es" ? "Importados" : "Imported"} ${Object.keys(parsed.seals).length} ${lang === "es" ? "sellos correctamente." : "seals successfully."}`);
      } catch (err) {
        alert(`❌ ${lang === "es" ? "Error al leer el JSON:" : "Error reading JSON:"} ` + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
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
        {tab === "ranking" && <RankingTab data={data} lang={lang} />}
        {tab === "manage" && <ManageTab data={data} onUpdate={updateData} lang={lang} />}
        {tab === "progress" && <ProgressTab data={data} onUpdate={updateData} lang={lang} />}
      </main>
    </div>
  );
}
