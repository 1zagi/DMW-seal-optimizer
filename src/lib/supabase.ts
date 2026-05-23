// ============================================================
//  supabase.ts  —  Cliente Supabase para DMW (servidor único)
// ============================================================

export const SUPABASE_URL = "https://ebwwrrrrgvljvzmrcjgq.supabase.co/rest/v1/";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVid3dycnJyZ3ZsanZ6bXJjamdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNjYyNDgsImV4cCI6MjA5Mzk0MjI0OH0.Woc5kJ6lPo7WyNN-uq6Mtj_PhgD9a4rzKpztRO_THC8";

export const DMW_SERVER_ID = "dmw" as const;

export interface SealPriceRow {
  server_id: string;
  seal_id:   string;
  price_m:   number;
  updated_at: string;
}

/** Precio remoto con instante de última escritura en Supabase (para no pisar ediciones locales más recientes). */
export interface ServerPriceEntry {
  priceM:      number;
  updatedAtMs: number;
}

function parseUpdatedAtMs(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export interface PricePoint {
  price_m:     number;
  recorded_at: string;
}

const headers = () => ({
  "Content-Type":  "application/json",
  "apikey":        SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Prefer":        "resolution=merge-duplicates",
});

const headersInsert = () => ({
  "Content-Type":  "application/json",
  "apikey":        SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
});

// ── Precios actuales ──────────────────────────────────────────

export async function fetchServerPrices(): Promise<Map<string, ServerPriceEntry>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}seal_prices?server_id=eq.${DMW_SERVER_ID}&select=seal_id,price_m,updated_at`,
      { headers: headers() }
    );
    if (!res.ok) throw new Error(await res.text());
    const rows = (await res.json()) as { seal_id: string; price_m: number; updated_at?: string }[];
    return new Map(
      rows.map(r => [
        r.seal_id,
        { priceM: r.price_m, updatedAtMs: parseUpdatedAtMs(r.updated_at) },
      ]),
    );
  } catch (err) {
    console.error("[supabase] fetchServerPrices:", err);
    return new Map();
  }
}

export async function upsertSealPrice(
  sealId: string,
  priceM: number,
  prevPriceM?: number,
): Promise<void> {
  const now = new Date().toISOString();
  try {
    const res = await fetch(`${SUPABASE_URL}seal_prices`, {
      method:  "POST",
      headers: headers(),
      body: JSON.stringify({ server_id: DMW_SERVER_ID, seal_id: sealId, price_m: priceM, updated_at: now }),
    });
    if (!res.ok) throw new Error(await res.text());

    if (prevPriceM === undefined || prevPriceM !== priceM) {
      await insertPriceHistory(sealId, priceM, now);
    }
  } catch (err) {
    console.error("[supabase] upsertSealPrice:", err);
  }
}

async function insertPriceHistory(sealId: string, priceM: number, recordedAt: string): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}seal_price_history`, {
      method:  "POST",
      headers: headersInsert(),
      body: JSON.stringify({ server_id: DMW_SERVER_ID, seal_id: sealId, price_m: priceM, recorded_at: recordedAt }),
    });
    if (!res.ok) console.error("[supabase] insertPriceHistory:", await res.text());
  } catch (err) {
    console.error("[supabase] insertPriceHistory:", err);
  }
}

// ── Historial de precios ──────────────────────────────────────

export async function fetchPriceHistory(sealId: string, days = 30): Promise<PricePoint[]> {
  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const url = `${SUPABASE_URL}seal_price_history`
      + `?server_id=eq.${DMW_SERVER_ID}`
      + `&seal_id=eq.${encodeURIComponent(sealId)}`
      + `&recorded_at=gte.${since}`
      + `&select=price_m,recorded_at`
      + `&order=recorded_at.asc`
      + `&limit=200`;
    const res = await fetch(url, { headers: headersInsert() });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (err) {
    console.error("[supabase] fetchPriceHistory:", err);
    return [];
  }
}

export async function fetchPricesNDaysAgo(days = 7): Promise<Map<string, number>> {
  try {
    // Ventana amplia: precio más reciente ANTES de hace N días
    const since  = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const before = new Date(Date.now() - (days - 1) * 86_400_000).toISOString();
    const url = `${SUPABASE_URL}seal_price_history`
      + `?server_id=eq.${DMW_SERVER_ID}`
      + `&recorded_at=gte.${since}`
      + `&recorded_at=lte.${before}`
      + `&select=seal_id,price_m,recorded_at`
      + `&order=recorded_at.desc`
      + `&limit=5000`;
    const res = await fetch(url, { headers: headersInsert() });
    if (!res.ok) throw new Error(await res.text());
    const rows = (await res.json()) as { seal_id: string; price_m: number }[];
    const map = new Map<string, number>();
    for (const r of rows) { if (!map.has(r.seal_id)) map.set(r.seal_id, r.price_m); }
    return map;
  } catch (err) {
    console.error("[supabase] fetchPricesNDaysAgo:", err);
    return new Map();
  }
}

// ── Realtime ──────────────────────────────────────────────────

export function subscribeToServerPrices(
  onUpdate: (sealId: string, entry: ServerPriceEntry) => void
): () => void {
  const { protocol, host } = new URL(SUPABASE_URL);
  const wsProto = protocol === "https:" ? "wss:" : "ws:";
  const wsUrl =
    `${wsProto}//${host}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;

  let ws:        WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws?.send(JSON.stringify({ topic: `realtime:public:seal_prices:server_id=eq.${DMW_SERVER_ID}`, event: "phx_join", payload: {}, ref: "1" }));
      heartbeat = setInterval(() => ws?.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: "hb" })), 25_000);
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.event === "INSERT" || msg.event === "UPDATE" || msg.payload?.type === "INSERT" || msg.payload?.type === "UPDATE") {
          const record: SealPriceRow = msg.payload?.record ?? msg.record ?? msg.payload?.new;
          if (record?.server_id === DMW_SERVER_ID && record.seal_id) {
            onUpdate(record.seal_id, {
              priceM:      record.price_m,
              updatedAtMs: parseUpdatedAtMs(record.updated_at),
            });
          }
        }
      } catch { }
    };
    ws.onclose = () => { if (heartbeat) clearInterval(heartbeat); if (!closed) setTimeout(connect, 3_000); };
    ws.onerror = () => ws?.close();
  };

  connect();
  return () => { closed = true; if (heartbeat) clearInterval(heartbeat); ws?.close(); };
}
