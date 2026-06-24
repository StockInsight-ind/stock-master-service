// scripts/lib/clients.ts
// Shared API clients used by all sync scripts

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Supabase ────────────────────────────────────────────────
export function getSupabaseClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ── Finnhub ─────────────────────────────────────────────────
const FINNHUB_BASE = "https://finnhub.io/api/v1";

export async function finnhubGet<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const apiKey = Deno.env.get("FINNHUB_API_KEY");
  if (!apiKey) throw new Error("Missing FINNHUB_API_KEY");

  const url = new URL(`${FINNHUB_BASE}${path}`);
  url.searchParams.set("token", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Finnhub ${path} → HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Structured logger ────────────────────────────────────────
export function log(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  data?: Record<string, unknown>
) {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), level, message, ...data })
  );
}
