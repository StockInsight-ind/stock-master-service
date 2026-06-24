// scripts/syncNewStocks.ts
// Detects newly listed stocks and inserts them into Supabase.

import { getSupabaseClient, finnhubGet, log } from "./lib/clients.ts";
import { FinnhubSymbolListSchema, type FinnhubSymbol } from "./lib/schemas.ts";

const MARKETS: Array<{
  exchange: string;
  market: "India" | "USA" | "Australia";
  country: string;
  currency: string;
  suffix?: string;
}> = [
  { exchange: "NS", market: "India",     country: "IN", currency: "INR", suffix: ".NS" },
  { exchange: "BO", market: "India",     country: "IN", currency: "INR", suffix: ".BO" },
  { exchange: "US", market: "USA",       country: "US", currency: "USD" },
  { exchange: "AU", market: "Australia", country: "AU", currency: "AUD", suffix: ".AX" },
];

export async function syncNewStocks(): Promise<void> {
  const supabase = getSupabaseClient();
  let totalNew = 0;

  for (const cfg of MARKETS) {
    // 1. Fetch from Finnhub
    const raw = await finnhubGet<unknown[]>("/stock/symbol", { exchange: cfg.exchange });
    const parsed = FinnhubSymbolListSchema.safeParse(raw);
    if (!parsed.success) {
      log("WARN", "Schema error, skipping", { exchange: cfg.exchange });
      continue;
    }

    // 2. Normalize symbols
    const finnhubSymbols = parsed.data.map((s: FinnhubSymbol) => {
      let sym = s.symbol;
      if (cfg.suffix && !sym.endsWith(cfg.suffix)) sym = sym + cfg.suffix;
      return { sym, s };
    });

    const symbolList = finnhubSymbols.map(({ sym }) => sym);

    // 3. Load existing symbols from DB for this market
    const { data: existing, error } = await supabase
      .from("stocks")
      .select("symbol")
      .eq("market", cfg.market)
      .in("symbol", symbolList);

    if (error) {
      log("ERROR", "Failed to fetch existing symbols", { error: error.message });
      continue;
    }

    const existingSet = new Set((existing ?? []).map((r: { symbol: string }) => r.symbol));

    // 4. Find truly new symbols
    const newEntries = finnhubSymbols.filter(({ sym }) => !existingSet.has(sym));

    if (newEntries.length === 0) {
      log("INFO", "No new listings", { exchange: cfg.exchange, market: cfg.market });
      continue;
    }

    // 5. Insert new stocks
    const rows = newEntries.map(({ sym, s }) => ({
      symbol:       sym,
      company_name: s.description ?? "",
      market:       cfg.market,
      exchange:     s.mic || cfg.exchange,
      currency:     s.currency || cfg.currency,
      country:      cfg.country,
      is_active:    true,
    }));

    const { error: insertErr } = await supabase.from("stocks").insert(rows);
    if (insertErr) {
      log("ERROR", "Insert new stocks failed", { error: insertErr.message });
      continue;
    }

    // 6. Log each new listing to audit table
    const changeLogs = rows.map((r) => ({
      symbol:      r.symbol,
      change_type: "new_listing",
      new_value:   r,
    }));
    await supabase.from("stock_changes").insert(changeLogs);

    log("INFO", "New listings inserted", {
      exchange: cfg.exchange,
      market: cfg.market,
      count: rows.length,
      symbols: rows.slice(0, 10).map((r) => r.symbol),
    });
    totalNew += rows.length;
  }

  log("INFO", "syncNewStocks complete", { totalNew });
}

if (import.meta.main) {
  await syncNewStocks();
}
