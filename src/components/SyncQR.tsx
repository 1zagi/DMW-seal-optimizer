// ============================================================
//  SyncQR.tsx  —  Sincronización PC ↔ Cel via QR  (DMW)
//  Lector de cámara en tiempo real + carga de imagen
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
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
  data: AppData; serverId: string; lang: Lang;
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
  const [camActive,  setCamActive]  = useState(false);
  const [camError,   setCamError]   = useState("");
  const [scanning,   setScanning]   = useState(false);

  const fileRef   = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);
  const foundRef  = useRef(false);

  const es = lang === "es";
  const t = {
    title:       es ? "Sincronizar con celular"    : "Sync with mobile",
    showQR:      es ? "Mostrar QR"                 : "Show QR",
    scanQR:      es ? "Escanear QR"                : "Scan QR",
    showDesc:    es ? "Escanea este QR desde tu celular para importar tus ranks." : "Scan this QR from your phone to import your ranks.",
    scanDesc:    es ? "Usa la cámara o carga una imagen del QR." : "Use the camera or load a QR image.",
    openCam:     es ? "Abrir cámara"               : "Open camera",
    closeCam:    es ? "Cerrar cámara"              : "Close camera",
    loadImg:     es ? "Cargar imagen del QR"        : "Load QR image",
    orManual:    es ? "O pega el texto manualmente:" : "Or paste text manually:",
    manual:      es ? "Pegar texto JSON..."         : "Paste JSON text...",
    import:      es ? "Importar ranks"              : "Import ranks",
    importing:   es ? "Importando..."               : "Importing...",
    imported:    es ? "¡Ranks importados!"          : "Ranks imported!",
    seals:       es ? "sellos con rank"             : "seals with rank",
    server:      es ? "Servidor"                    : "Server",
    wrongServer: es ? "El QR es de otro servidor. ¿Importar de todos modos?" : "QR is from a different server. Import anyway?",
    noRanks:     es ? "No hay ranks que exportar aún." : "No ranks to export yet.",
    error:       es ? "QR inválido — no se pudo leer." : "Invalid QR — could not read.",
    camError:    es ? "No se pudo acceder a la cámara." : "Could not access camera.",
    scanning:    es ? "Buscando QR..."              : "Looking for QR...",
    tip:         es ? "💡 Solo se sincronizan los ranks. Los precios ya están en la nube." : "💡 Only ranks are synced. Prices are already in the cloud.",
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

  useEffect(() => { return () => stopCamera(); }, []);

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamActive(false);
    setScanning(false);
    foundRef.current = false;
  };

  const scanFrame = useCallback(async () => {
    if (foundRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);

    if ("BarcodeDetector" in window) {
      try {
        const codes = await new (window as any).BarcodeDetector({ formats: ["qr_code"] }).detect(canvas);
        if (codes.length > 0) { foundRef.current = true; processQRText(codes[0].rawValue); return; }
      } catch {}
    } else {
      await new Promise(r => setTimeout(r, 800));
      canvas.toBlob(async (blob) => {
        if (!blob || foundRef.current) return;
        const fd = new FormData();
        fd.append("file", blob, "frame.jpg");
        const res = await fetch("https://api.qrserver.com/v1/read-qr-code/", { method: "POST", body: fd });
        if (!res.ok) return;
        const json = await res.json() as { symbol: { data: string | null }[] }[];
        const text = json?.[0]?.symbol?.[0]?.data;
        if (text && !foundRef.current) { foundRef.current = true; processQRText(text); return; }
      }, "image/jpeg", 0.8);
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, []);

  const openCamera = async () => {
    setCamError(""); setScanError(""); setScanResult(null); foundRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setCamActive(true);
      setScanning(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            rafRef.current = requestAnimationFrame(scanFrame);
          });
        }
      }, 100);
    } catch { setCamError(t.camError); }
  };

  const handleImageFile = async (file: File) => {
    setScanError(""); setScanResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("https://api.qrserver.com/v1/read-qr-code/", { method: "POST", body: fd });
      if (!res.ok) { setScanError(t.error); return; }
      const json = await res.json() as { symbol: { data: string | null }[] }[];
      const text = json?.[0]?.symbol?.[0]?.data;
      if (!text) { setScanError(t.error); return; }
      processQRText(text);
    } catch { setScanError(t.error); }
  };

  const processQRText = (raw: string) => {
    stopCamera();
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

  const switchMode = (m: "show" | "scan") => {
    stopCamera(); setMode(m); setScanResult(null); setScanError(""); setCamError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => { stopCamera(); onClose(); }}>
      <div className="bg-[#09141f] border border-[#1a3f6e] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="px-5 pt-5 pb-3 border-b border-[#1a3f6e]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">📱</span>
              <h2 className="text-white font-bold text-sm">{t.title}</h2>
            </div>
            <button onClick={() => { stopCamera(); onClose(); }} className="text-[#5a8aaa] hover:text-white text-lg transition-colors">✕</button>
          </div>
          <div className="flex gap-1 mt-3">
            {(["show", "scan"] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className={`flex-1 py-1.5 rounded text-xs font-mono font-bold border transition-all ${
                  mode === m ? "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/12" : "border-[#1a3f6e] text-[#5a8aaa] hover:text-white"
                }`}>
                {m === "show" ? `📤 ${t.showQR}` : `📷 ${t.scanQR}`}
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
                    <div className="text-2xl">⚔️</div>
                  </div>
                </>
              )}
            </>
          )}

          {mode === "scan" && (
            <>
              <p className="text-[#5a8aaa] text-xs font-mono">{t.scanDesc}</p>

              {camActive && (
                <div className="relative rounded-xl overflow-hidden bg-black border border-[#1a3f6e]">
                  <video ref={videoRef} playsInline muted
                    className="w-full rounded-xl" style={{ maxHeight: 220, objectFit: "cover" }} />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-40 border-2 border-[#00c8f0] rounded-xl opacity-70" />
                  </div>
                  {scanning && (
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                      <span className="text-[#00c8f0] text-[10px] font-mono bg-black/60 px-2 py-1 rounded-full animate-pulse">
                        {t.scanning}
                      </span>
                    </div>
                  )}
                  <button onClick={stopCamera}
                    className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 text-[#5a8aaa] text-[10px] font-mono hover:text-white transition-colors">
                    ✕ {t.closeCam}
                  </button>
                </div>
              )}

              {!camActive && !scanResult && (
                <button onClick={openCamera}
                  className="w-full py-3 rounded-xl border-2 border-[#00c8f0]/50 text-[#00c8f0] text-sm font-mono hover:bg-[#00c8f0]/10 transition-all flex items-center justify-center gap-2">
                  📷 {t.openCam}
                </button>
              )}

              {camError && <p className="text-red-400 text-xs font-mono">{camError}</p>}

              {!camActive && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }} />
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-[#1a3f6e] text-[#5a8aaa] text-sm font-mono hover:border-[#00c8f0] hover:text-[#00c8f0] transition-all">
                    📂 {t.loadImg}
                  </button>
                  <div>
                    <p className="text-[#2a4558] text-[10px] font-mono mb-1">{t.orManual}</p>
                    <textarea rows={2} placeholder={t.manual}
                      onChange={e => { if (e.target.value.trim()) processQRText(e.target.value); }}
                      className="w-full px-3 py-2 rounded-lg bg-[#060d18] border border-[#1a3f6e] text-white font-mono text-xs focus:border-[#00c8f0] focus:outline-none resize-none placeholder-[#2a4558]" />
                  </div>
                </>
              )}

              {scanError && <p className="text-red-400 text-xs font-mono">{scanError}</p>}

              {scanResult && !scanError && (
                <div className="px-3 py-2 rounded-lg border border-[#00e676]/30 bg-[#00e676]/05">
                  <p className="text-[#00e676] text-xs font-bold font-mono">✓ QR leído</p>
                  <p className="text-[#5a8aaa] text-[10px] font-mono mt-0.5">
                    {scanResult.count} {t.seals} · {t.server}: {scanResult.serverId}
                  </p>
                </div>
              )}

              {scanResult && (
                <button onClick={handleImport} disabled={importing || imported}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold font-mono border transition-all ${
                    imported ? "border-[#00e676] text-[#00e676] bg-[#00e676]/10"
                             : "border-[#00c8f0] text-[#00c8f0] bg-[#00c8f0]/10 hover:bg-[#00c8f0]/20"
                  }`}>
                  {imported ? `✓ ${t.imported}` : importing ? t.importing : `⬇ ${t.import}`}
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
