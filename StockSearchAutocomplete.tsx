// StockSearchAutocomplete.tsx
// Drop this React component into your StockInsight frontend.
// Uses the stock-search-client to search across markets.

import { useState, useCallback, useRef, useEffect } from "react";
import { searchStocks, type StockResult } from "./stock-search-client";

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  market?: "India" | "USA" | "Australia";
  onSelect: (stock: StockResult) => void;
  placeholder?: string;
}

export function StockSearchAutocomplete({ market, onSelect, placeholder }: Props) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const debouncedQuery = useDebounce(query, 250);
  const wrapperRef     = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search when query changes
  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    searchStocks(debouncedQuery, market, 15)
      .then((data) => {
        setResults(data);
        setOpen(data.length > 0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, market]);

  const handleSelect = useCallback(
    (stock: StockResult) => {
      setQuery(stock.symbol);
      setOpen(false);
      onSelect(stock);
    },
    [onSelect]
  );

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? "Search stocks…"}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: 14,
          border: "1px solid #ccc",
          borderRadius: 6,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {loading && (
        <span style={{ position: "absolute", right: 10, top: 8, fontSize: 12, color: "#888" }}>
          …
        </span>
      )}
      {open && results.length > 0 && (
        <ul
          style={{
            position:     "absolute",
            top:          "110%",
            left:         0,
            right:        0,
            background:   "#fff",
            border:       "1px solid #ddd",
            borderRadius: 6,
            boxShadow:    "0 4px 16px rgba(0,0,0,0.12)",
            listStyle:    "none",
            margin:       0,
            padding:      "4px 0",
            zIndex:       1000,
            maxHeight:    300,
            overflowY:    "auto",
          }}
        >
          {results.map((stock) => (
            <li
              key={stock.symbol}
              onClick={() => handleSelect(stock)}
              style={{
                padding:  "8px 14px",
                cursor:   "pointer",
                display:  "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "#f5f5f5")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
            >
              <span>
                <strong style={{ fontSize: 14 }}>{stock.symbol}</strong>{" "}
                <span style={{ fontSize: 12, color: "#555" }}>{stock.company_name}</span>
              </span>
              <span style={{ fontSize: 11, color: "#999" }}>{stock.exchange}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
