// ============================================================
//  SyncQR.tsx  —  Sincronizacion PC x Cel via QR  (DMW)
//  Codifica solo ranks personales. Precios ya estan en Supabase.
//  Formato payload: { v:1, s: serverId, r: {sealId: rankIndex} }
// ============================================================

import { useState, useEffect, useRef } from "react";
import type { AppData, SealUserData } from "../lib/types";
import { RANKS, RANK_ORDER } from "../lib/types";
import type { Lang } from "../lib/i18n";

const QR_API = (data: string, size = 280) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&ecc=M&margin=2`;

interface QRPayload { v: 1; s: string; r: Record<string, number>; }

function encodeRanks(userData: Map<string, SealUserData>, serverId: string): string {
  const r: Record<string, number> = {};
  for (const [id, u] of userData.entries()) {
    if (u.currentRank && u.currentRank !== "Unopened") r[id] = RANK_ORDER[u.currentRank];
  }
  return JSON.stringify({ v: 1, s: serverId, r } as QRPayload);
}

function decodeRanks(raw: string): { serverId: string; userData: Map<string, SealUserData> } | null {
  try {
    const p = JSON.parse(raw) as QRPayload;
    if (p.v !== 1 || !p.s || !p.r) return null;
    const userData = new Map<string, SealUserData>();
    for (const [id, idx] of Object.entries(p.r))
      userData.set(id, { sealId: id, currentRank: RANKS[idx] ?? null });
    return { serverId: p.s, userData };
  } catch { return null; }
}

interface Props {
  data: AppData;
  serverId: string;
  lang: Lang;
  onImport: (userData: Map<string, SealUserData>, serverId: string) => void;
  onClose: () => void;
}

export function SyncQRModal({ data, serverId, lang, onImport, onClose }: Props) {
  const [mode,       setMode]       = useState<"show" | "scan">("show");
  const [qrUrl,      setQrUrl]      = useState("");
  const [sealCount,  setSealCount]  = useState(0);
  const [scanResult, setScanResult] = useState<{ serverId: string; count: number } | null>(null);
  const [scanError,  setScanError]  = useState("");
  const [importing,  setImporting]  = useState(false);
  const [imported,   setImported]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const es = lang === "es";
  const t = {
    title:       es ? "Sincronizar con celular"   : "Sync with mobile",
    showQR:      es ? "Mostrar QR"                : "Show QR",
    scanQR:      es ? "Escanear QR"               : "Scan QR",
    showDesc:    es ? "Escanea este QR desde tu celular para importar tus ranks." : "Scan this QR from your phone to import your ranks.",
    scanDesc:    es ? "Toma una captura del QR desde tu cel y cargala aqui."     : "Take a screenshot of the QR from your phone and load it here.",
    loadImg:     es ? "Cargar imagen del QR"      : "Load QR image",
    orManual:    es ? "O pega el texto del QR manualmente:" : "Or paste the QR text manually:",
    manual:      es ? "Pegar texto JSON..."        : "Paste JSON text...",
    importBtn:   es ? "Importar ranks"             : "Import ranks",
    importing:   es ? "Importando..."              : "Importing...",
    imported:    es ? "Ranks importados!"          : "Ranks imported!",
    seals:       es ? "sellos con rank"            : "seals with rank",
    server:      es ? "Servidor"                   : "Server",
    wrongServer: es ? "El QR es de otro servidor. Importar de todos modos?" : "QR is from a different server. Import anyway?",
    noRanks:     es ? "No hay ranks que exportar aun." : "No ranks to export yet.",
    error:       es ? "QR invalido, no se pudo leer."  : "Invalid QR, could not read.",
    noBarcodeDetector: es
      ? "Tu navegador no soporta lectura de QR automatica. Usa la opcion de texto manual."
      : "Your browser does not support automatic QR reading. Use the manual text option.",
    tip: es ? "Solo se sincronizan los ranks. Los precios ya estan en la nube." : "Only ranks are synced. Prices are already in the cloud.",
  };

  useEffect(() => {
    const userData = new Map<string, SealUserData>();
    let count = 0;
    for (const seal of Object.values(data.seals)) {
      if (seal.currentRank && seal.currentRank !== "Unopened") {
        userData.set(seal.name, { sealId: seal.name, currentRank: seal.currentRank });
        count++;
      }
    }
    setSealCount(count);
    if (count === 0) { setQrUrl(""); return; }
    setQrUrl(QR_API(encodeRanks(userData, serverId)));
  }, [data, serverId]);

  const handleImageFile = (file: File) => {
    setScanError(""); setScanResult(null);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      if ("BarcodeDetector" in window) {
        new (window as any).BarcodeDetector({ formats: ["qr_code"] })
          .detect(canvas)
          .then((codes: any[]) => {
            if (!codes.length) { setScanError(t.error); return; }
            processQRText(codes[0].rawValue);
          })
          .catch(() => setScanError(t.error));
      } else {
        setScanError("warning: " + t.noBarcodeDetector);
      }
    };
    img.onerror = () => setScanError(t.error);
    img.src = url;
  };

  const processQRText = (raw: string) => {
    const result = decodeRanks(raw.trim());
    if (!result) { setScanError(t.error); return; }
    setScanResult({ serverId: result.serverId, count: result.userData.size });
    setScanError("");
    (window as any).__qrImportData = result;
  };

  const handleImport = () => {
    const result: { serverId: string; userData: Map<string, SealUserData> } | undefined =
      (window as any).__qrImportData;
    if (!result) return;
    if (result.serverId !== serverId && !confirm(t.wrongServer)) return;
    setImporting(true);
    setTimeout(() => {
      onImport(result.userData, result.serverId);
      setImporting(false); setImported(true);
      setTimeout(() => onClose(), 1500);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div className="bg-[#09141f] border border-[#1a3f6e] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="px-5 pt-5 pb-3 border-b border-[#1a3f6e]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">mobile</span>
              <h2 className="text-white font-bold text-sm">{t.title}</h2>
            </div>
            <button onClick={onClose} className="text-[#5a8aaa] hover:text-white text-lg transition-colors">x</button>
          </div>
          <div className="flex gap-1 mt-3">
            {(["show", "scan"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setScanResult(null); setScanError(""); }}
                className={`flex-1 py-1.5 rounded text-xs font-mono font-bold border transition-all ${
                  mode === m ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/10" : "border-[#1a3f6e] text-[#5a8aaa] hover:text-white"
                }`}>
                {m === "show" ? t.showQR : t.scanQR}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {mode === "show" && (
            <>
              <p className="text-[#5a8aaa] text-xs font-mono">{t.showDesc}</p>
              {sealCount === 0 ? (
                <div className="py-8 text-center text-[#2a4558] font-mono text-sm">{t.noRanks}</div>
              ) : (
                <>
                  <div className="flex justify-center">
                    <div className="p-2 bg-white rounded-xl">
                      <img src={qrUrl} alt="QR Sync" width={240} height={240} className="rounded-lg" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#060d18] border border-[#1a3f6e]">
                    <div>
                      <p className="text-white text-xs font-bold font-mono">{sealCount} {t.seals}</p>
                      <p className="text-[#5a8aaa] text-[10px] font-mono">{t.server}: {serverId}</p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {mode === "scan" && (
            <>
              <p className="text-[#5a8aaa] text-xs font-mono">{t.scanDesc}</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-3 rounded-xl border-2 border-dashed border-[#1a3f6e] text-[#5a8aaa] text-sm font-mono hover:border-[#00c8f0] hover:text-[#00c8f0] transition-all">
                {t.loadImg}
              </button>
              <div>
                <p className="text-[#2a4558] text-[10px] font-mono mb-1">{t.orManual}</p>
                <textarea rows={3} placeholder={t.manual}
                  onChange={e => { if (e.target.value.trim()) processQRText(e.target.value); }}
                  className="w-full px-3 py-2 rounded-lg bg-[#060d18] border border-[#1a3f6e] text-white font-mono text-xs focus:border-[#00c8f0] focus:outline-none resize-none placeholder-[#2a4558]" />
              </div>
              {scanError && <p className="text-red-400 text-xs font-mono">{scanError}</p>}
              {scanResult && !scanError && (
                <div className="px-3 py-2 rounded-lg border border-[#00e676]/30 bg-[#00e676]/05">
                  <p className="text-[#00e676] text-xs font-bold font-mono">QR leido</p>
                  <p className="text-[#5a8aaa] text-[10px] font-mono mt-0.5">
                    {scanResult.count} {t.seals} - {t.server}: {scanResult.serverId}
                  </p>
                </div>
              )}
              {scanResult && (
                <button onClick={handleImport} disabled={importing || imported}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold font-mono border transition-all ${
                    imported ? "border-[#00e676] text-[#00e676] bg-[#00e676]/10"
                             : "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/10 hover:bg-[#00c8f0]/20"
                  }`}>
                  {imported ? t.imported : importing ? t.importing : t.importBtn}
                </button>
              )}
            </>
          )}

          <p className="text-[#2a4558] text-[10px] font-mono leading-relaxed">{t.tip}</p>
        </div>
      </div>
    </div>
  );
}
