// supabase/functions/get-stats/index.ts
// GET /get-stats → { india: 5000, usa: 10000, australia: 2500 }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Count active stocks per market in a single query
  const { data, error } = await supabase
    .from("stocks")
    .select("market")
    .eq("is_active", true);

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to fetch stats" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const counts: Record<string, number> = { india: 0, usa: 0, australia: 0 };
  for (const row of data ?? []) {
    const key = row.market.toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return new Response(JSON.stringify(counts), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
});
