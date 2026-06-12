import React from "react";

const RANGES = ["1H", "24H", "1W", "1M", "1Y", "MAX"];

export default function FilterBar({ range, setRange, lastUpdated }) {
  return (
    <div className="w-full flex items-center justify-between mb-4">
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={
              "px-3 py-1 rounded text-sm font-medium " +
              (r === range
                ? "bg-blue-600 text-white"
                : "bg-transparent text-slate-300 border border-transparent hover:bg-white/5")
            }
          >
            {r}
          </button>
        ))}
      </div>
      <div className="text-sm text-slate-400">
        Last updated: {lastUpdated}s ago
      </div>
    </div>
  );
}
