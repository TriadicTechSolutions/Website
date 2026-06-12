import React, { useState } from "react";
import { searchCrypto, searchStock } from "../api";

export default function SearchModal({ open, onClose, onAdd }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  async function doSearch() {
    if (!q) return;
    setLoading(true);
    setPage(0);
    try {
      const [cryptoResult, stockResult] = await Promise.allSettled([
        searchCrypto(q),
        searchStock(q),
      ]);
      const items = [];

      if (cryptoResult.status === "fulfilled" && cryptoResult.value.coins) {
        cryptoResult.value.coins.slice(0, 20).forEach((cc) => {
          items.push({
            id: cc.id,
            name: cc.name,
            thumb: cc.thumb,
            category: "Crypto",
          });
        });
      }

      if (stockResult.status === "fulfilled" && stockResult.value.quotes) {
        stockResult.value.quotes.slice(0, 20).forEach((st) => {
          items.push({
            id: st.symbol,
            name: st.shortname || st.longname || st.symbol,
            thumb: null,
            category: "Stock",
          });
        });
      }

      setResults(items);
    } catch (error) {
      console.error(error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-w-2xl w-full glass p-4 rounded mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doSearch();
            }}
            placeholder="Search ETH, AAPL, Bitcoin, Tesla"
            className="flex-1 px-3 py-2 rounded bg-transparent border border-white/6 outline-none"
          />
          <div className="flex gap-2">
            <button onClick={doSearch} className="px-3 py-2 bg-blue-600 rounded">
              Search
            </button>
            <button onClick={onClose} className="px-3 py-2 bg-white/5 rounded">
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-auto">
          {loading && <div className="text-sm text-slate-400">Searching…</div>}

          {!loading && results.length === 0 && (
            <div className="text-sm text-slate-400">No results yet. Try another search term.</div>
          )}

          {results.slice(page * pageSize, (page + 1) * pageSize).map((r, index) => (
            <div
              key={`${r.category}:${r.id}:${index}`}
              className="p-2 flex items-center gap-3 bg-black/40 rounded cursor-pointer hover:bg-white/5"
              onClick={() => {
                onAdd(r);
                onClose();
              }}
            >
              <img
                src={r.thumb || "/placeholder.svg"}
                alt="thumb"
                className="w-12 h-12 object-cover rounded"
              />
              <div>
                <div className="font-semibold">{r.name}</div>
                <div className="text-xs text-slate-400">{r.category}</div>
              </div>
            </div>
          ))}
        </div>

        {results.length > pageSize && (
          <div className="flex items-center justify-between gap-2 mt-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-2 bg-white/10 rounded disabled:opacity-40"
            >
              Previous
            </button>
            <div className="text-sm text-slate-400">
              Page {page + 1} of {Math.ceil(results.length / pageSize)}
            </div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(Math.ceil(results.length / pageSize) - 1, p + 1))}
              disabled={(page + 1) * pageSize >= results.length}
              className="px-3 py-2 bg-white/10 rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
