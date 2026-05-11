// ============================================================
//  PriceBackupModal.tsx  —  Modal para restaurar precios desde backups
// ============================================================

import { useMemo, useState } from "react";
import type { Lang } from "../lib/i18n";
import {
  getAvailableBackups,
  getRecommendedBackups,
  getBackupDiff,
  restorePriceBackup,
  type BackupInfo,
} from "../lib/storage";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (label: string) => void;
  lang: Lang;
}

export function PriceBackupModal({ isOpen, onClose, onRestore, lang }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const allBackups = useMemo(() => getAvailableBackups(), [isOpen]);
  const recommended = useMemo(() => getRecommendedBackups(), [isOpen]);

  if (!isOpen) return null;

  const handleRestore = async (index: number, label: string) => {
    if (!confirm(lang === "es" 
      ? `¿Restaurar precios desde ${label}? Esta acción no se puede deshacer.`
      : `Restore prices from ${label}? This action cannot be undone.`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const success = restorePriceBackup(index);
      if (success) {
        onRestore(label);
        setSelectedIndex(null);
        setTimeout(onClose, 300);
      } else {
        alert(lang === "es" ? "Error al restaurar backup" : "Error restoring backup");
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const getBackupDescription = (backup: BackupInfo): string => {
    const diff = getBackupDiff(backup.index);
    if (lang === "es") {
      return diff === 0 ? "Sin cambios" : `${diff} precio${diff > 1 ? "s" : ""} diferente${diff > 1 ? "s" : ""}`;
    } else {
      return diff === 0 ? "No changes" : `${diff} different price${diff > 1 ? "s" : ""}`;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#09141f] border border-[#1a3f6e] rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#00c8f0]">
            {lang === "es" ? "📦 Restaurar Precios" : "📦 Restore Prices"}
          </h2>
          <button
            onClick={onClose}
            className="text-[#5a8aaa] hover:text-white transition-colors text-2xl"
          >
            ✕
          </button>
        </div>

        {allBackups.length === 0 ? (
          <p className="text-center text-[#5a8aaa] py-6">
            {lang === "es"
              ? "No hay backups disponibles. Los backups se crean automáticamente cuando cambias precios."
              : "No backups available. Backups are created automatically when you change prices."}
          </p>
        ) : (
          <>
            {/* Recommended Backups Section */}
            {(recommended.day1 || recommended.day3 || recommended.day7) && (
              <div className="mb-8 p-4 bg-[#0a1520] border border-[#1a3f6e] rounded-lg">
                <h3 className="text-sm font-bold text-[#ffd700] mb-4 uppercase tracking-wider">
                  {lang === "es" ? "⭐ Puntos de Restauración Recomendados" : "⭐ Recommended Restore Points"}
                </h3>

                <div className="space-y-2">
                  {recommended.day1 && (
                    <button
                      onClick={() => handleRestore(recommended.day1!.index, "1 " + (lang === "es" ? "día" : "day"))}
                      disabled={isRestoring}
                      className="w-full p-3 rounded-lg border-2 border-[#00c8f0] bg-[#00c8f0]/10 hover:bg-[#00c8f0]/20 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#00c8f0]">
                            1 {lang === "es" ? "día atrás" : "day ago"} • {recommended.day1.label}
                          </div>
                          <div className="text-xs text-[#5a8aaa]">
                            {recommended.day1.date} {recommended.day1.time}
                          </div>
                          <div className="text-xs text-[#2a4558] mt-1">
                            {getBackupDescription(recommended.day1)}
                          </div>
                        </div>
                        <div className="text-lg">📅</div>
                      </div>
                    </button>
                  )}

                  {recommended.day3 && (
                    <button
                      onClick={() => handleRestore(recommended.day3!.index, "3 " + (lang === "es" ? "días" : "days"))}
                      disabled={isRestoring}
                      className="w-full p-3 rounded-lg border-2 border-[#6aaccf] bg-[#6aaccf]/10 hover:bg-[#6aaccf]/20 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#6aaccf]">
                            3 {lang === "es" ? "días atrás" : "days ago"} • {recommended.day3.label}
                          </div>
                          <div className="text-xs text-[#5a8aaa]">
                            {recommended.day3.date} {recommended.day3.time}
                          </div>
                          <div className="text-xs text-[#2a4558] mt-1">
                            {getBackupDescription(recommended.day3)}
                          </div>
                        </div>
                        <div className="text-lg">📅</div>
                      </div>
                    </button>
                  )}

                  {recommended.day7 && (
                    <button
                      onClick={() => handleRestore(recommended.day7!.index, "7 " + (lang === "es" ? "días" : "days"))}
                      disabled={isRestoring}
                      className="w-full p-3 rounded-lg border-2 border-[#5a8aaa] bg-[#5a8aaa]/10 hover:bg-[#5a8aaa]/20 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#5a8aaa]">
                            7 {lang === "es" ? "días atrás" : "days ago"} • {recommended.day7.label}
                          </div>
                          <div className="text-xs text-[#5a8aaa]">
                            {recommended.day7.date} {recommended.day7.time}
                          </div>
                          <div className="text-xs text-[#2a4558] mt-1">
                            {getBackupDescription(recommended.day7)}
                          </div>
                        </div>
                        <div className="text-lg">📅</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* All Backups Section */}
            <div>
              <h3 className="text-sm font-bold text-[#5a8aaa] mb-3 uppercase tracking-wider">
                {lang === "es" ? "Todos los backups" : "All backups"}
              </h3>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {[...allBackups].reverse().map((backup) => (
                  <button
                    key={backup.index}
                    onClick={() => handleRestore(backup.index, backup.label)}
                    disabled={isRestoring}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      selectedIndex === backup.index
                        ? "border-[#00c8f0] bg-[#00c8f0]/15"
                        : "border-[#1a3f6e] hover:border-[#2a4558] hover:bg-[#0a1520]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-mono text-[#5a8aaa]">
                          {backup.date} {backup.time}
                        </div>
                        <div className="text-xs text-[#2a4558] mt-0.5">
                          {getBackupDescription(backup)}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-[#00c8f0] whitespace-nowrap ml-2">
                        {backup.label}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-3 bg-[#0a1520] border border-[#1a3f6e] rounded-lg text-xs text-[#5a8aaa] space-y-1">
              <p>
                {lang === "es"
                  ? "• Los backups se crean automáticamente cada vez que cambias precios"
                  : "• Backups are created automatically whenever you change prices"}
              </p>
              <p>
                {lang === "es"
                  ? "• Se guardan hasta 50 backups; los más antiguos se eliminan automáticamente"
                  : "• Up to 50 backups are kept; older ones are deleted automatically"}
              </p>
              <p>
                {lang === "es"
                  ? "• Esta acción restaurará TODOS los precios al estado del backup seleccionado"
                  : "• This action will restore ALL prices to the selected backup state"}
              </p>
            </div>
          </>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-6 py-2 border border-[#1a3f6e] text-[#5a8aaa] rounded-lg hover:text-white hover:border-[#2a4558] transition-colors text-sm font-mono"
        >
          {lang === "es" ? "Cerrar" : "Close"}
        </button>
      </div>
    </div>
  );
}
