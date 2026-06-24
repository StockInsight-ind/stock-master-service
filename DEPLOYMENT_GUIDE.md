# Stock Master Service — Complete Deployment Guide

## What This Is

A production-ready global stock database running entirely on Supabase + GitHub Actions.
- **Database**: Supabase PostgreSQL (your new project)
- **APIs**: Supabase Edge Functions (auto-deployed)
- **Scheduler**: GitHub Actions (free, no server needed)
- **Data Source**: Finnhub API

---

## STEP 1 — Create a New Supabase Project

> You already have `StockInsight-ind's Project`. Create a **separate** project for stocks.

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Fill in:
   - **Name**: `stock-master` (or any name you like)
   - **Database Password**: generate a strong one → save it somewhere safe
   - **Region**: pick closest to you (e.g., Singapore for India)
4. Click **Create new project** → wait ~2 minutes for it to spin up

---

## STEP 2 — Run the SQL Migrations

Run each migration file in order in the **Supabase SQL Editor** of your new project.

Go to: `Dashboard → SQL Editor → New Query`

### Migration 1 — Markets table
Copy and run: `supabase/migrations/001_create_markets.sql`

### Migration 2 — Stocks table
Copy and run: `supabase/migrations/002_create_stocks.sql`

### Migration 3 — Triggers, RLS, Search Function
Copy and run: `supabase/migrations/003_triggers_rls_functions.sql`

### Migration 4 — Audit Log
Copy and run: `supabase/migrations/004_stock_changes_log.sql`

✅ After running all 4, go to **Table Editor** — you should see:
- `markets` (with India, USA, Australia already inserted)
- `stocks` (empty for now)
- `stock_changes` (empty for now)

---

## STEP 3 — Get Your Supabase Credentials

In your new `stock-master` Supabase project:

Go to: `Settings → API`

Copy these values (you'll need them next):
- **Project URL** → this is your `SUPABASE_URL`
- **Secret key** (or `service_role` key on older projects; never expose publicly) → use this for `SUPABASE_SERVICE_ROLE_KEY`
- **Publishable / anon key** (safe for frontend) → needed for the StockInsight project later

---

## STEP 4 — Get a Finnhub API Key

1. Go to [https://finnhub.io](https://finnhub.io)
2. Click **Get free API key** (sign up)
3. Copy the API key from your dashboard → this is `FINNHUB_API_KEY`

> Free tier: 60 API calls/minute. This is enough for all sync scripts.

---

## STEP 5 — Create GitHub Repository

1. Go to [https://github.com/new](https://github.com/new)
2. Create a new **private** repository: `stock-master-service`
3. Push this project folder to it:

```bash
cd stock-master-service
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stock-master-service.git
git push -u origin main
```

---

## STEP 6 — Add GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these 3 secrets:

| Secret Name                 | Value                                      |
|-----------------------------|--------------------------------------------|
| `SUPABASE_URL`              | Your Supabase project URL from Step 3      |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase secret key from Step 3       |
| `FINNHUB_API_KEY`           | Your Finnhub API key from Step 4           |

---

## STEP 7 — Deploy Edge Functions

Install Supabase CLI if you haven't:
```bash
npm install -g supabase
```

Login and link your project:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
# (project ref is the part after https://supabase.com/dashboard/project/ in your URL)
```

Deploy all 3 Edge Functions:
```bash
supabase functions deploy stocks-search
supabase functions deploy get-markets
supabase functions deploy get-stats
```

Set Edge Function secrets (same as GitHub secrets):
```bash
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_supabase_secret_key
```

✅ Test your Edge Functions:
```
GET https://YOUR_PROJECT_REF.supabase.co/functions/v1/get-markets
GET https://YOUR_PROJECT_REF.supabase.co/functions/v1/get-stats
GET https://YOUR_PROJECT_REF.supabase.co/functions/v1/stocks-search?q=rel&market=India
```

---

## STEP 8 — Run the Initial Import (One Time)

Go to your GitHub repo → **Actions → Initial Stock Import (Run Once) → Run workflow**

This will:
1. Import all India stocks (NSE + BSE) — ~5,000–8,000 stocks
2. Import all USA stocks (NYSE + NASDAQ + AMEX) — ~10,000+ stocks
3. Import all Australia stocks (ASX) — ~2,000+ stocks

⏱ This takes 10–30 minutes. Watch the logs in GitHub Actions.

> After this, the daily and weekly workflows run automatically. You never need to run this again.

---

## STEP 9 — Verify the Import

In Supabase SQL Editor:
```sql
-- Check counts per market
SELECT market, COUNT(*) FROM stocks GROUP BY market;

-- Test search
SELECT * FROM search_stocks('rel', 'India', 10);
SELECT * FROM search_stocks('app', 'USA', 10);
SELECT * FROM search_stocks('bhp', 'Australia', 5);
```

---

## STEP 10 — Use in Your StockInsight Project

### Option A — Use Edge Functions (recommended)

Copy `stock-search-client.ts` into your StockInsight project.

Update the two constants at the top:
```typescript
const STOCK_MASTER_URL      = "https://YOUR_STOCK_MASTER_REF.supabase.co";
const STOCK_MASTER_ANON_KEY = "YOUR_PUBLISHABLE_KEY"; // from Settings → API in stock-master project
```

Then use it anywhere:
```typescript
import { searchStocks } from "./stock-search-client";

// In any component or page:
const results = await searchStocks("rel", "India");
// → [{ symbol: "RELIANCE.NS", company_name: "Reliance Industries", ... }]
```

### Option B — Use the React Autocomplete Component

Copy both files to your StockInsight project:
- `stock-search-client.ts`
- `StockSearchAutocomplete.tsx`

Use in any page:
```tsx
import { StockSearchAutocomplete } from "./StockSearchAutocomplete";

function MyPage() {
  return (
    <StockSearchAutocomplete
      market="India"
      onSelect={(stock) => {
        console.log("Selected:", stock.symbol);
        // navigate to stock detail page etc.
      }}
    />
  );
}
```

### Option C — Direct Supabase Client (cross-project DB access)

```typescript
import { createClient } from "@supabase/supabase-js";

const stockDB = createClient(
  "https://YOUR_STOCK_MASTER_REF.supabase.co",
  "YOUR_PUBLISHABLE_KEY"  // publishable / anon key only — RLS ensures read-only access
);

// Search
const { data } = await stockDB
  .from("stocks")
  .select("symbol, company_name, market, exchange, currency")
  .eq("is_active", true)
  .eq("market", "India")
  .ilike("symbol", "REL%")
  .limit(20);
```

---

## Automatic Schedule

| Workflow         | Schedule              | What it does                           |
|------------------|-----------------------|----------------------------------------|
| Daily Sync       | Every day at 01:00 UTC | updateMetadata + syncNewStocks        |
| Weekly Delist    | Every Sunday 02:00 UTC | syncDelistedStocks                    |
| Initial Import   | Manual (run once)      | Full import of all markets            |

---

## API Reference

### Search Stocks
```
GET /functions/v1/stocks-search?q=rel&market=India&limit=20

Response:
[
  { "symbol": "RELIANCE.NS", "company_name": "Reliance Industries Ltd", "market": "India", "exchange": "NSE", "currency": "INR" }
]
```

### Get Markets
```
GET /functions/v1/get-markets

Response: ["India", "USA", "Australia"]
```

### Get Stats
```
GET /functions/v1/get-stats

Response: { "india": 5000, "usa": 10000, "australia": 2500 }
```

---

## Security Notes

- ✅ RLS is enabled on all tables
- ✅ Public can only READ (anon key)
- ✅ Only service_role key can write (used only by Edge Functions + GitHub Actions)
- ✅ Never expose service_role key in frontend code
- ✅ All secrets stored in GitHub Secrets (never hardcoded)

---

## Project Structure

```
stock-master-service/
├── .github/
│   └── workflows/
│       ├── daily-sync.yml          # runs daily
│       ├── weekly-sync.yml         # runs weekly
│       └── initial-import.yml      # run once manually
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 001_create_markets.sql
│   │   ├── 002_create_stocks.sql
│   │   ├── 003_triggers_rls_functions.sql
│   │   └── 004_stock_changes_log.sql
│   └── functions/
│       ├── stocks-search/index.ts  # search API
│       ├── get-markets/index.ts    # markets list
│       └── get-stats/index.ts      # stock counts
├── scripts/
│   ├── lib/
│   │   ├── clients.ts              # Supabase + Finnhub clients
│   │   └── schemas.ts              # Zod schemas
│   ├── importStocks.ts             # full initial import
│   ├── syncNewStocks.ts            # new listing detection
│   ├── syncDelistedStocks.ts       # delist detection
│   └── updateMetadata.ts          # name/ticker change sync
├── stock-search-client.ts          # drop into StockInsight project
└── StockSearchAutocomplete.tsx     # drop into StockInsight frontend
```
