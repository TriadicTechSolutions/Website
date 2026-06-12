import React, { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, ReferenceLine, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { fetchCrypto, fetchStock } from "../api";

function Arrow({ up }) {
  return (
    <span className={up ? "text-blue-400" : "text-red-400"}>
      {up ? "▲" : "▼"}
    </span>
  );
}

export default function Card({ item, rangeKey, onRemove, refreshTick, onDragHandleStart, onDragEnter, onDrop, onDragEnd, isDragging, isDragOver }) {
  const [data, setData] = useState({
    price: null,
    prevPrice: null,
    series: [],
    loading: true,
    error: null,
  });
  const [pulse, setPulse] = useState(false);
  const [stopLoss, setStopLoss] = useState(null);
  const [takeProfit, setTakeProfit] = useState(null);
  const [alertStop, setAlertStop] = useState(false);
  const [alertProfit, setAlertProfit] = useState(false);

  useEffect(() => {
    load();
  }, [item.id, rangeKey, refreshTick]);

  async function load() {
    try {
      setData((d) => ({ ...d, loading: true, error: null, series: [] }));
      if (item.category === "Crypto") {
        const res = await fetchCrypto(item.id, null, null, rangeKey);
        const prices = (res.prices || [])
          .map((p) => ({ t: p[0], v: p[1] }))
          .filter((entry) => entry.t && typeof entry.v === 'number')
          .sort((a, b) => a.t - b.t);
        const series = prices.map((p) => ({ value: p.v, time: p.t }));
        const last = series[series.length - 1]?.value ?? null;
        const first = series[0]?.value ?? last;
        setData({
          price: last,
          prevPrice: first,
          series,
          loading: false,
          error: null,
        });
      } else if (item.category === "Stock") {
        const res = await fetchStock(item.id, rangeKey);
        const chart = res.chart && res.chart.result && res.chart.result[0];
        const meta = chart?.meta || {};
        const closes = chart?.indicators?.quote?.[0]?.close || [];
        const timestamps = chart?.timestamp || [];
        const series = closes
          .map((c, i) => ({
            value: c,
            time: timestamps[i]
              ? timestamps[i] * 1000
              : Date.now() - (closes.length - i) * 60000,
          }))
          .filter((s) => s.value !== null && typeof s.value === 'number')
          .sort((a, b) => a.time - b.time);
        const last = series[series.length - 1]?.value ?? null;
        const first = series[0]?.value ?? last;
        const basePrice = ["1H", "24H"].includes(rangeKey)
          ? typeof meta.chartPreviousClose === 'number'
            ? meta.chartPreviousClose
            : typeof meta.previousClose === 'number'
            ? meta.previousClose
            : first
          : first;
        setData({
          price: last,
          prevPrice: basePrice,
          series,
          loading: false,
          error: null,
        });
      } else {
        // Game or Sneaker: no reliable time series via these APIs; create simple series
        const nowPrice = item.price ?? Math.random() * 100;
        const series = Array.from({ length: 20 }).map((_, i) => ({
          value: nowPrice * (1 + Math.sin(i) / 200),
          time: Date.now() - (20 - i) * 60000,
        }));
        setData({
          price: nowPrice,
          prevPrice: series[0].value,
          series,
          loading: false,
          error: null,
        });
      }
    } catch (e) {
      setData((d) => ({ ...d, loading: false, error: "Failed to load", series: [] }));
    }
  }

  

  // pulse animation on price change
  useEffect(() => {
    if (!data.loading && data.price != null) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 400);
      return () => clearTimeout(t);
    }
  }, [data.price]);

  // load thresholds from localStorage
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(`thresholds:${item.id}:${item.category}`)
      if (raw) {
        const obj = JSON.parse(raw)
        setStopLoss(obj.stopLoss ?? null)
        setTakeProfit(obj.takeProfit ?? null)
      }
    }catch{}
  }, [item.id, item.category])

  // check alerts when price updates
  useEffect(()=>{
    if (!data.loading && data.price != null) {
      if (stopLoss != null && data.price <= Number(stopLoss)) setAlertStop(true)
      if (takeProfit != null && data.price >= Number(takeProfit)) setAlertProfit(true)
    }
  }, [data.price, stopLoss, takeProfit, data.loading])

  const change = (() => {
    if (!data.series || data.series.length < 2) return 0;
    const first = data.prevPrice ?? data.series[0]?.value;
    const last = data.series[data.series.length - 1].value;
    if (first === null || first === undefined || first === 0) return 0;
    return ((last - first) / first) * 100;
  })();

  function placeholderDataUrl(text) {
    const bg = '#0f1724'
    const fg = '#94a3b8'
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%' height='100%' fill='${bg}'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter, Arial' font-size='48' fill='${fg}'>${text}</text></svg>`
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }

  const thumbSrc = item.thumb || (item.category === 'Stock' ? placeholderDataUrl((item.id||'').slice(0,4).toUpperCase()) : '/placeholder.svg')

  const lowPrice = data.series && data.series.length ? Math.min(...data.series.map(s=>s.value)) : null

  const formatTime = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (rangeKey === '1Y' || rangeKey === 'MAX') {
      return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    }
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (onDragEnter) onDragEnter(e);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (onDrop) onDrop(e);
      }}
      className={
        'p-3 rounded glass flex flex-col gap-2 transform transition-all duration-200 ' +
        (isDragging ? 'opacity-70 ' : '') +
        (isDragOver ? 'ring-2 ring-blue-400/30 shadow-lg ' : '') +
        (pulse ? (change >= 0 ? 'ring-2 ring-blue-500/40 scale-101' : 'ring-2 ring-red-500/30 scale-101') : '') +
        ' ' + (change >= 0 ? 'hover:ring-4 hover:ring-green-400/20' : 'hover:ring-4 hover:ring-red-400/20')
      }
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img src={thumbSrc} alt="img" className="w-12 h-12 object-cover rounded" />
          <div>
            <div className="font-semibold">{item.name}</div>
            <div className="text-xs text-slate-400">{item.category}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="text-slate-400 hover:text-white cursor-grab"
            title="Drag to reorder"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', `${item.id}::${item.category}`)
              if (onDragHandleStart) onDragHandleStart(item)
            }}
            onDragEnd={(e) => {
              if (onDragEnd) onDragEnd(e)
            }}
          >
            ≡
          </div>
          <button
            onClick={() => onRemove(item)}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-2xl font-bold">
            {data.price
              ? "$" +
                Number(data.price).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "—"}
          </div>
          <div className="text-sm text-slate-400 flex items-center gap-2">
            {data.price ? <Arrow up={change >= 0} /> : null}{" "}
            {Number(change).toFixed(2)}%
          </div>
          {lowPrice != null && (
            <div className="text-xs text-slate-400 mt-1 hidden sm:block">Low ({rangeKey}): ${Number(lowPrice).toFixed(2)}</div>
          )}
        </div>
        <div className="w-full h-28 sm:h-32 lg:h-36">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series.map((s) => ({ pv: s.value, time: s.time }))}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                axisLine={false}
                tickLine={false}
                minTickGap={10}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(value) => {
                  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`
                  return `$${value.toFixed(value < 10 ? 2 : 0)}`
                }}
                axisLine={false}
                tickLine={false}
                width={40}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                cursor={{ stroke: '#60a5fa', strokeDasharray: '3 3', strokeWidth: 1 }}
                formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Price']}
                labelFormatter={(label) => formatTime(label)}
                wrapperStyle={{ pointerEvents: 'none', zIndex: 20 }}
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 36, 0.96)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                  fontSize: '12px',
                }}
                position={{ x: 10, y: 10 }}
                allowEscapeViewBox={{ x: true, y: true }}
              />
              <Line dataKey="pv" stroke="#60a5fa" strokeWidth={2} dot={false} />
              {stopLoss != null && !isNaN(Number(stopLoss)) && (
                <ReferenceLine y={Number(stopLoss)} stroke="red" strokeDasharray="3 3" />
              )}
              {takeProfit != null && !isNaN(Number(takeProfit)) && (
                <ReferenceLine y={Number(takeProfit)} stroke="green" strokeDasharray="3 3" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      {alertStop && <div className="text-xs text-red-400 font-semibold">Stop loss triggered!</div>}
      {alertProfit && <div className="text-xs text-green-400 font-semibold">Take profit triggered!</div>}

      <div className="grid gap-2 mt-2 sm:grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_auto_auto] items-center">
        <input value={stopLoss ?? ''} onChange={e=>setStopLoss(e.target.value)} placeholder="Stop loss" className="w-full px-2 py-1 text-sm rounded bg-transparent border border-white/6" />
        <input value={takeProfit ?? ''} onChange={e=>setTakeProfit(e.target.value)} placeholder="Take profit" className="w-full px-2 py-1 text-sm rounded bg-transparent border border-white/6" />
        <button onClick={()=>{ localStorage.setItem(`thresholds:${item.id}:${item.category}`, JSON.stringify({ stopLoss: stopLoss || null, takeProfit: takeProfit || null })); setAlertStop(false); setAlertProfit(false); }} className="w-full sm:w-auto px-2 py-1 bg-blue-600 text-sm rounded">Save</button>
        <button onClick={()=>{ setStopLoss(null); setTakeProfit(null); localStorage.removeItem(`thresholds:${item.id}:${item.category}`); setAlertStop(false); setAlertProfit(false); }} className="w-full sm:w-auto px-2 py-1 bg-white/5 text-sm rounded">Clear</button>
      </div>

      {data.error && <div className="text-xs text-red-400">{data.error}</div>}
    </div>
  );
}
