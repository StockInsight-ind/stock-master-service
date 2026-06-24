// ============================================================
// stock-search-client.ts
// Drop this file into your StockInsight (or any other) project.
// It calls the Stock Master Service Edge Functions directly.
// No local DB needed — it reads from the Stock Master Supabase project.
// ============================================================

// ── Config ───────────────────────────────────────────────────
// Replace with your Stock Master project's Supabase URL + publishable key.
const STOCK_MASTER_URL     = "https://YOUR_STOCK_MASTER_REF.supabase.co";
const STOCK_MASTER_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // from Supabase Settings → API

// ── Types ─────────────────────────────────────────────────────
export interface StockResult {
  symbol:       string;
  company_name: string;
  market:       string;
  exchange:     string;
  currency:     string;
}

// ── Core fetch helper ─────────────────────────────────────────
async function callEdgeFunction<T>(
  functionName: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(
    `${STOCK_MASTER_URL}/functions/v1/${functionName}`
  );
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${STOCK_MASTER_ANON_KEY}`,
      apikey:        STOCK_MASTER_ANON_KEY,
    },
  });

  if (!res.ok) throw new Error(`Edge Function ${functionName} → HTTP ${res.status}`);
  return res.json();
}

// ── Public API ────────────────────────────────────────────────

/**
 * Search stocks by symbol or company name.
 *
 * @example
 * const results = await searchStocks("rel", "India");
 * // [{ symbol: "RELIANCE.NS", company_name: "Reliance Industries", ... }]
 */
export async function searchStocks(
  query: string,
  market?: "India" | "USA" | "Australia",
  limit = 20
): Promise<StockResult[]> {
  const params: Record<string, string> = { q: query, limit: String(limit) };
  if (market) params.market = market;
  return callEdgeFunction<StockResult[]>("stocks-search", params);
}

/**
 * Get list of all supported markets.
 * @returns ["India", "USA", "Australia"]
 */
export async function getMarkets(): Promise<string[]> {
  return callEdgeFunction<string[]>("get-markets");
}

/**
 * Get stock counts per market.
 * @returns { india: 5000, usa: 10000, australia: 2500 }
 */
export async function getStockStats(): Promise<Record<string, number>> {
  return callEdgeFunction<Record<string, number>>("get-stats");
}

// ── Direct DB access (alternative — if you prefer REST over Edge Functions) ──
//
// You can also query the stocks table directly using Supabase client:
//
//   import { createClient } from "@supabase/supabase-js";
//   const client = createClient(STOCK_MASTER_URL, STOCK_MASTER_ANON_KEY);
//
//   const { data } = await client
//     .from("stocks")
//     .select("symbol, company_name, market, exchange, currency")
//     .eq("is_active", true)
//     .ilike("symbol", `${query}%`)
//     .limit(20);
