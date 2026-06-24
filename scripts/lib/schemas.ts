// scripts/lib/schemas.ts
// Zod validation schemas for Finnhub responses

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Single symbol entry from /stock/symbol
export const FinnhubSymbolSchema = z.object({
  symbol:      z.string(),
  description: z.string().optional().default(""),
  displaySymbol: z.string().optional().default(""),
  type:        z.string().optional().default(""),
  currency:    z.string().optional().default(""),
  mic:         z.string().optional().default(""),   // exchange MIC code
  figi:        z.string().optional().default(""),
});
export type FinnhubSymbol = z.infer<typeof FinnhubSymbolSchema>;

export const FinnhubSymbolListSchema = z.array(FinnhubSymbolSchema);

// Canonical stock shape used internally
export const StockRowSchema = z.object({
  symbol:       z.string(),
  company_name: z.string().default(""),
  market:       z.enum(["India", "USA", "Australia"]),
  exchange:     z.string().default(""),
  currency:     z.string().default(""),
  country:      z.string().default(""),
  is_active:    z.boolean().default(true),
});
export type StockRow = z.infer<typeof StockRowSchema>;
