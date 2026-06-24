// scripts/syncDelistedStocks.ts
// Detects delisted stocks. Never deletes — sets is_active = false.

import { getSupabaseClient, finnhubGet, log } from "./lib/clients.ts";
import { FinnhubSymbolListSchema } from "./lib/schemas.ts";

const MARKETS: Array<{
  exchange: string;
  market: "India" | "USA" | "Australia";
  suffix?: string;
}> = [
  { exchange: "NS", market: "India",     suffix: ".NS" },
  { exchange: "BO", market: "India",     suffix: ".BO" },
  { exchange: "US", market: "USA" },
  { exchange: "AU", market: "Australia", suffix: ".AX" },
];

export async function syncDelistedStocks(): Promise<void> {
  const supabase = getSupabaseClient();
  let totalDelisted = 0;

  for (const cfg of MARKETS) {
    // 1. Fetch live symbols from Finnhub
    const raw = await finnhubGet<unknown[]>("/stock/symbol", { exchange: cfg.exchange });
    const parsed = FinnhubSymbolListSchema.safeParse(raw);
    if (!parsed.success) {
      log("WARN", "Schema error, skipping", { exchange: cfg.exchange });
      continue;
    }

    const liveSet = new Set(
      parsed.data.map((s) => {
        let sym = s.symbol;
        if (cfg.suffix && !sym.endsWith(cfg.suffix)) sym = sym + cfg.suffix;
        return sym;
      })
    );

    // 2. Load all active stocks from DB for this exchange
    //    We page through in chunks of 1000 to avoid timeouts
    let page = 0;
    const PAGE = 1000;
    const toDeactivate: string[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("stocks")
        .select("symbol")
        .eq("market", cfg.market)
        .eq("is_active", true)
        .range(page * PAGE, (page + 1) * PAGE - 1);

      if (error) {
        log("ERROR", "Failed to load active stocks", { error: error.message });
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        if (!liveSet.has(row.symbol)) {
          toDeactivate.push(row.symbol);
        }
      }

      if (data.length < PAGE) break;
      page++;
    }

    if (toDeactivate.length === 0) {
      log("INFO", "No delistings detected", { exchange: cfg.exchange });
      continue;
    }

    // 3. Mark is_active = false (never delete)
    const { error: updateErr } = await supabase
      .from("stocks")
      .update({ is_active: false, delisted_at: new Date().toISOString() })
      .in("symbol", toDeactivate);

    if (updateErr) {
      log("ERROR", "Failed to mark delistings", { error: updateErr.message });
      continue;
    }

    // 4. Audit log
    const changeLogs = toDeactivate.map((symbol) => ({
      symbol,
      change_type: "delisted",
      old_value: { is_active: true },
      new_value: { is_active: false, delisted_at: new Date().toISOString() },
    }));
    await supabase.from("stock_changes").insert(changeLogs);

    log("INFO", "Delistings recorded", {
      exchange: cfg.exchange,
      market: cfg.market,
      count: toDeactivate.length,
      sample: toDeactivate.slice(0, 10),
    });
    totalDelisted += toDeactivate.length;
  }

  log("INFO", "syncDelistedStocks complete", { totalDelisted });
}

if (import.meta.main) {
  await syncDelistedStocks();
}
