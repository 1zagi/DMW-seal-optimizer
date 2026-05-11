// ============================================================
//  useServerPrices.ts  —  DMW
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { fetchServerPrices, upsertSealPrice, subscribeToServerPrices } from "./supabase";

export interface UseServerPricesResult {
  prices:      Map<string, number>;
  loading:     boolean;
  connected:   boolean;
  updatePrice: (sealId: string, priceM: number, prevPriceM?: number) => Promise<void>;
}

export function useServerPrices(): UseServerPricesResult {
  const [prices,    setPrices]    = useState<Map<string, number>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchServerPrices().then(map => { setPrices(map); setLoading(false); });
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToServerPrices((sealId, priceM) => {
      setPrices(prev => { const n = new Map(prev); n.set(sealId, priceM); return n; });
      setConnected(true);
    });
    const timer = setTimeout(() => setConnected(true), 2_000);
    return () => { unsubscribe(); clearTimeout(timer); setConnected(false); };
  }, []);

  const updatePrice = useCallback(async (sealId: string, priceM: number, prevPriceM?: number) => {
    setPrices(prev => { const n = new Map(prev); n.set(sealId, priceM); return n; });
    await upsertSealPrice(sealId, priceM, prevPriceM);
  }, []);

  return { prices, loading, connected, updatePrice };
}
