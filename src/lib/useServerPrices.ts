// ============================================================
//  useServerPrices.ts  —  DMW
// ============================================================

import { useState, useEffect, useCallback } from "react";
import type { ServerPriceEntry } from "./supabase";
import { fetchServerPrices, upsertSealPrice, subscribeToServerPrices } from "./supabase";

export interface UseServerPricesResult {
  prices:      Map<string, ServerPriceEntry>;
  loading:     boolean;
  connected:   boolean;
  updatePrice: (sealId: string, priceM: number, prevPriceM?: number) => Promise<void>;
}

export function useServerPrices(): UseServerPricesResult {
  const [prices,    setPrices]    = useState<Map<string, ServerPriceEntry>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchServerPrices().then(map => { setPrices(map); setLoading(false); });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToServerPrices((sealId, entry) => {
      setPrices(prev => { const n = new Map(prev); n.set(sealId, entry); return n; });
      setConnected(true);
    });
    const timer = setTimeout(() => setConnected(true), 2_000);
    return () => { unsubscribe(); clearTimeout(timer); setConnected(false); };
  }, []);

  const updatePrice = useCallback(async (sealId: string, priceM: number, prevPriceM?: number) => {
    const optimistic: ServerPriceEntry = { priceM, updatedAtMs: Date.now() };
    setPrices(prev => { const n = new Map(prev); n.set(sealId, optimistic); return n; });
    await upsertSealPrice(sealId, priceM, prevPriceM);
  }, []);

  return { prices, loading, connected, updatePrice };
}
