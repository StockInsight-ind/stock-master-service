// scripts/importStocks.ts
// Full initial import for all markets (safe to re-run).

import { getSupabaseClient, finnhubGet, log } from "./lib/clients.ts";
import {
  FinnhubSymbolListSchema,
  type FinnhubSymbol,
  type StockRow,
} from "./lib/schemas.ts";

const BATCH_SIZE = 500; // upsert rows per DB call

// ── helpers ──────────────────────────────────────────────────

async function fetchSymbols(exchange: string): Promise<FinnhubSymbol[]> {
  log("INFO", `Fetching symbols from Finnhub`, { exchange });
  const raw = await finnhubGet<unknown[]>("/stock/symbol", { exchange });
  const parsed = FinnhubSymbolListSchema.safeParse(raw);
  if (!parsed.success) {
    log("ERROR", "Schema validation failed", { exchange, error: parsed.error.message });
    return [];
  }
  return parsed.data;
}

async function upsertBatch(
  supabase: ReturnType<typeof getSupabaseClient>,
  rows: StockRow[]
): Promise<number> {
  const { error, count } = await supabase
    .from("stocks")
    .upsert(rows, { onConflict: "symbol", ignoreDuplicates: true })
    .select("id", { count: "exact", head: true });

  if (error) {
    log("ERROR", "Upsert batch failed", { error: error.message });
    return 0;
  }
  return count ?? rows.length;
}

async function importMarket(
  supabase: ReturnType<typeof getSupabaseClient>,
  exchange: string,
  market: StockRow["market"],
  country: string,
  currency: string,
  mapSymbol: (s: FinnhubSymbol) => string = (s) => s.symbol
): Promise<void> {
  const symbols = await fetchSymbols(exchange);
  log("INFO", `Fetched ${symbols.length} symbols`, { exchange, market });

  const rows: StockRow[] = symbols.map((s) => ({
    symbol:       mapSymbol(s),
    company_name: s.description ?? "",
    market,
    exchange:     s.mic || exchange,
    currency:     s.currency || currency,
    country,
    is_active:    true,
  }));

  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const inserted = await upsertBatch(supabase, batch);
    total += inserted;
  }

  log("INFO", `Import complete`, { exchange, market, total, fetched: symbols.length });
}

// ── Public functions ──────────────────────────────────────────

export async function importIndiaStocks(): Promise<void> {
  const supabase = getSupabaseClient();
  // NSE
  await importMarket(supabase, "NS", "India", "IN", "INR", (s) =>
    s.symbol.endsWith(".NS") ? s.symbol : `${s.symbol}.NS`
  );
  // BSE
  await importMarket(supabase, "BO", "India", "IN", "INR", (s) =>
    s.symbol.endsWith(".BO") ? s.symbol : `${s.symbol}.BO`
  );
}

export async function importUSAStocks(): Promise<void> {
  const supabase = getSupabaseClient();
  // Finnhub exchange code "US" covers NYSE, NASDAQ, AMEX
  await importMarket(supabase, "US", "USA", "US", "USD");
}

export async function importAustraliaStocks(): Promise<void> {
  const supabase = getSupabaseClient();
  // ASX
  await importMarket(supabase, "AU", "Australia", "AU", "AUD", (s) =>
    s.symbol.endsWith(".AX") ? s.symbol : `${s.symbol}.AX`
  );
}

// ── Entry point (run directly with Deno) ─────────────────────
if (import.meta.main) {
  log("INFO", "Starting full stock import");

  // await importIndiaStocks();

  await importUSAStocks();
  await importAustraliaStocks();

  log("INFO", "Full import finished");
}
