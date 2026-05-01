// ============================================================
//  CurrencyInput.tsx  —  Input de precio con selector B/M/T
// ============================================================

import { useState, useEffect } from "react";
import { splitToUnit, parseWithUnit } from "../lib/currency";

interface Props {
  valueM: number;                        // valor actual en M
  onChange: (newValueM: number) => void; // callback con nuevo valor en M
  placeholder?: string;
  className?: string;
}

export function CurrencyInput({ valueM, onChange, placeholder = "0", className = "" }: Props) {
  const [unit, setUnit] = useState<"B" | "M" | "T">("M");
  const [raw, setRaw] = useState("0");

  // Sincronizar el input cuando el valor externo cambia
  useEffect(() => {
    const split = splitToUnit(valueM);
    setUnit(split.unit);
    setRaw(split.value === 0 ? "" : String(split.value));
  }, [valueM]);

  const handleChange = (newRaw: string) => {
    setRaw(newRaw);
    onChange(parseWithUnit(newRaw, unit));
  };

  const handleUnitChange = (newUnit: "B" | "M" | "T") => {
    setUnit(newUnit);
    onChange(parseWithUnit(raw, newUnit));
  };

  return (
    <div className={`flex rounded overflow-hidden border border-[#1a3f6e] focus-within:border-[#00c8f0] transition-colors ${className}`}>
      <input
        type="number"
        value={raw}
        placeholder={placeholder}
        onChange={e => handleChange(e.target.value)}
        className="flex-1 min-w-0 bg-[#09141f] px-2 py-1.5 text-white font-mono text-sm focus:outline-none"
      />
      <select
        value={unit}
        onChange={e => handleUnitChange(e.target.value as "B" | "M" | "T")}
        className="bg-[#0d1c2e] text-[#00c8f0] font-mono text-xs px-2 border-l border-[#1a3f6e] focus:outline-none cursor-pointer"
      >
        <option value="B">B</option>
        <option value="M">M</option>
        <option value="T">T</option>
      </select>
    </div>
  );
}
