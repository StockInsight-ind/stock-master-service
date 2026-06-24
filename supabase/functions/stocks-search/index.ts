// supabase/functions/stocks-search/index.ts
// GET /stocks/search?q=rel&market=India&limit=20

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
};

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url    = new URL(req.url);
  const q      = (url.searchParams.get("q") ?? "").trim();
  const market = url.searchParams.get("market") ?? null;
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);

  if (q.length < 1) {
    return new Response(JSON.stringify({ error: "q param required (min 1 char)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Call the SQL function for <100ms response
  const { data, error } = await supabase.rpc("search_stocks", {
    query_text:   q,
    market_filter: market,
    result_limit: limit,
  });

  if (error) {
    console.error(JSON.stringify({ level: "ERROR", error: error.message }));
    return new Response(JSON.stringify({ error: "Search failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data ?? []), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60", // 60s cache
    },
  });
});
