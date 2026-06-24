// scripts/updateMetadata.ts
// Syncs company_name, exchange, currency, and detects changes.

import { getSupabaseClient, finnhubGet, log } from "./lib/clients.ts";
import { FinnhubSymbolListSchema } from "./lib/schemas.ts";

const MARKETS: Array<{
  exchange: string;
  market: "India" | "USA" | "Australia";
  suffix?: string;
  defaultCurrency: string;
}> = [
  { exchange: "NS", market: "India",     suffix: ".NS", defaultCurrency: "INR" },
  { exchange: "BO", market: "India",     suffix: ".BO", defaultCurrency: "INR" },
  { exchange: "US", market: "USA",       defaultCurrency: "USD" },
  { exchange: "AU", market: "Australia", suffix: ".AX", defaultCurrency: "AUD" },
];

export async function updateMetadata(): Promise<void> {
  const supabase = getSupabaseClient();
  let totalUpdated = 0;
  const changeLogs: object[] = [];

  for (const cfg of MARKETS) {
    // 1. Fetch from Finnhub
    const raw = await finnhubGet<unknown[]>("/stock/symbol", { exchange: cfg.exchange });
    const parsed = FinnhubSymbolListSchema.safeParse(raw);
    if (!parsed.success) {
      log("WARN", "Schema error", { exchange: cfg.exchange });
      continue;
    }

    // Build a map: symbol → finnhub data
    const finnhubMap = new Map(
      parsed.data.map((s) => {
        let sym = s.symbol;
        if (cfg.suffix && !sym.endsWith(cfg.suffix)) sym = sym + cfg.suffix;
        return [sym, s];
      })
    );

    // 2. Load corresponding DB records (active only)
    const symbolList = [...finnhubMap.keys()];

    // Process in chunks
    const CHUNK = 500;
    for (let i = 0; i < symbolList.length; i += CHUNK) {
      const chunk = symbolList.slice(i, i + CHUNK);
      const { data: dbRows, error } = await supabase
        .from("stocks")
        .select("symbol, company_name, exchange, currency")
        .in("symbol", chunk)
        .eq("is_active", true);

      if (error) {
        log("ERROR", "Fetch chunk failed", { error: error.message });
        continue;
      }

      // 3. Diff and build updates
      for (const row of dbRows ?? []) {
        const fi = finnhubMap.get(row.symbol);
        if (!fi) continue;

        const newName     = fi.description ?? "";
        const newExchange = fi.mic || cfg.exchange;
        const newCurrency = fi.currency || cfg.defaultCurrency;

        const nameChanged     = newName && newName !== row.company_name;
        const exchangeChanged = newExchange !== row.exchange;
        const currencyChanged = newCurrency !== row.currency;

        if (!nameChanged && !exchangeChanged && !currencyChanged) continue;

        // Apply update
        await supabase
          .from("stocks")
          .update({
            company_name: newName || row.company_name,
            exchange:     newExchange,
            currency:     newCurrency,
          })
          .eq("symbol", row.symbol);

        // Log each change type separately
        if (nameChanged) {
          changeLogs.push({
            symbol:      row.symbol,
            change_type: "name_change",
            old_value:   { company_name: row.company_name },
            new_value:   { company_name: newName },
          });
        }
        if (exchangeChanged || currencyChanged) {
          changeLogs.push({
            symbol:      row.symbol,
            change_type: "metadata_update",
            old_value:   { exchange: row.exchange, currency: row.currency },
            new_value:   { exchange: newExchange, currency: newCurrency },
          });
        }
        totalUpdated++;
      }
    }

    log("INFO", "Metadata sync done for exchange", { exchange: cfg.exchange });
  }

  // Batch insert audit logs
  if (changeLogs.length > 0) {
    await supabase.from("stock_changes").insert(changeLogs);
  }

  log("INFO", "updateMetadata complete", { totalUpdated, changesLogged: changeLogs.length });
}

if (import.meta.main) {
  await updateMetadata();
}
