const COINGECKO_PROXY = "/api/coingecko";
const COINCAP_PROXY = "/api/coincap";
const BINANCE_PROXY = "/api/binance";
const YAHOO_PROXY = "/api/yahoo";

const MAX_CACHE_AGE = 1000 * 60 * 10;

function saveCache(key, data) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    }
  } catch {}
}

function loadCache(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (!raw) return { fresh: null, stale: null };
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts <= MAX_CACHE_AGE) return { fresh: parsed.data, stale: null };
      return { fresh: null, stale: parsed.data };
    }
  } catch {}
  return { fresh: null, stale: null };
}

function mapDays(rangeKey) {
  return {
    '24H': 1,
    '1W': 7,
    '1M': 30,
    '1Y': 365,
    MAX: 'max',
  }[rangeKey] ?? 1;
}

function mapCoinCapInterval(rangeKey) {
  return {
    '1H': 'm1',
    '24H': 'h1',
    '1W': 'h1',
    '1M': 'd1',
    '1Y': 'd1',
    MAX: 'd1',
  }[rangeKey] || 'h1';
}

function mapBinanceInterval(rangeKey) {
  return {
    '1H': '1m',
    '24H': '15m',
    '1W': '1h',
    '1M': '4h',
    '1Y': '1d',
    MAX: '1d',
  }[rangeKey] || '15m';
}

function mapBinanceLimit(rangeKey) {
  return {
    '1H': 60,
    '24H': 96,
    '1W': 168,
    '1M': 180,
    '1Y': 365,
    MAX: 365,
  }[rangeKey] ?? 96;
}

function mapBinanceSymbol(id) {
  const map = {
    bitcoin: 'BTCUSDT',
    ethereum: 'ETHUSDT',
    solana: 'SOLUSDT',
    cardano: 'ADAUSDT',
    dogecoin: 'DOGEUSDT',
    avalanche: 'AVAXUSDT',
    polkadot: 'DOTUSDT',
    chainlink: 'LINKUSDT',
    litecoin: 'LTCUSDT',
  };
  return map[id] || null;
}

async function fetchCoinGeckoChart(id, rangeKey) {
  const url = rangeKey === '1H'
    ? `${COINGECKO_PROXY}/coins/${id}/market_chart/range?vs_currency=usd&from=${Math.floor((Date.now() - 3600 * 1000) / 1000)}&to=${Math.floor(Date.now() / 1000)}`
    : `${COINGECKO_PROXY}/coins/${id}/market_chart?vs_currency=usd&days=${mapDays(rangeKey)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CoinGecko failed (${res.status}) ${text}`);
  }
  return await res.json();
}

async function fetchCoinCapHistory(id, rangeKey) {
  const interval = mapCoinCapInterval(rangeKey);
  const end = Date.now();
  const days = mapDays(rangeKey);
  const start = rangeKey === '1H'
    ? end - 3600 * 1000
    : rangeKey === '24H'
    ? end - 24 * 3600 * 1000
    : rangeKey === '1W'
    ? end - 7 * 24 * 3600 * 1000
    : rangeKey === '1M'
    ? end - 30 * 24 * 3600 * 1000
    : rangeKey === '1Y'
    ? end - 365 * 24 * 3600 * 1000
    : end - 365 * 24 * 3600 * 1000;

  const url = `${COINCAP_PROXY}/assets/${id}/history?interval=${interval}&start=${Math.floor(start)}&end=${Math.floor(end)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CoinCap failed (${res.status}) ${text}`);
  }
  const body = await res.json();
  if (!Array.isArray(body.data)) {
    throw new Error('CoinCap returned invalid data');
  }
  return {
    prices: body.data
      .map((row) => {
        const value = Number(row.priceUsd);
        return Number.isFinite(value) ? [row.time, value] : null;
      })
      .filter(Boolean),
  };
}

async function fetchBinanceKlines(id, rangeKey) {
  const symbol = mapBinanceSymbol(id);
  if (!symbol) {
    throw new Error(`Binance symbol missing for ${id}`);
  }
  const interval = mapBinanceInterval(rangeKey);
  const limit = mapBinanceLimit(rangeKey);
  const url = `${BINANCE_PROXY}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Binance klines failed (${res.status}) ${text}`);
  }
  const body = await res.json();
  if (!Array.isArray(body)) {
    throw new Error('Binance returned invalid kline data');
  }
  return {
    prices: body
      .map((row) => {
        const time = Number(row[0]);
        const close = Number(row[4]);
        return Number.isFinite(time) && Number.isFinite(close) ? [time, close] : null;
      })
      .filter(Boolean),
  };
}

async function fetchBinancePrice(id) {
  const symbol = mapBinanceSymbol(id);
  if (!symbol) {
    throw new Error(`Binance symbol missing for ${id}`);
  }
  const url = `${BINANCE_PROXY}/ticker/price?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Binance price failed (${res.status}) ${text}`);
  }
  const body = await res.json();
  const price = Number(body.price);
  if (!Number.isFinite(price)) {
    throw new Error('Binance returned invalid price');
  }
  return { prices: [[Date.now(), price]] };
}

export async function fetchCrypto(id, rangeSecStart, rangeSecEnd, rangeKey) {
  const cacheKey = `crypto-chart:${id}:${rangeKey}`;
  const { fresh: cached, stale } = loadCache(cacheKey);

  const fallbackPrice = async () => {
    try {
      return await fetchBinancePrice(id);
    } catch (err) {
      console.error('Binance fallback failed', err);
    }

    if (cached) return cached;
    if (stale) return stale;
    throw new Error('All crypto fallbacks failed');
  };

  const saveData = (data) => {
    saveCache(cacheKey, data);
    return data;
  };

  try {
    const primary = await fetchCoinGeckoChart(id, rangeKey);
    return saveData(primary);
  } catch (primaryError) {
    console.error('crypto fetch failed', primaryError.message);
    if (cached) return cached;
    if (stale && /429|rate limit|time range/i.test(primaryError.message)) return stale;
    try {
      const coinCap = await fetchCoinCapHistory(id, rangeKey);
      return saveData(coinCap);
    } catch (coinCapError) {
      console.error('CoinCap fallback failed', coinCapError.message);
      try {
        const binance = await fetchBinanceKlines(id, rangeKey);
        return saveData(binance);
      } catch (binanceError) {
        console.error('Binance klines fallback failed', binanceError.message);
        return fallbackPrice();
      }
    }
  }
}

export async function searchCrypto(query) {
  const url = `${COINGECKO_PROXY}/search?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('crypto search failed', res.statusText);
    return { coins: [] };
  }
  return res.json();
}

export async function fetchStock(ticker, rangeKey) {
  try {
    const map = {
      "1H": { range: "1d", interval: "1m" },
      "24H": { range: "1d", interval: "5m" },
      "1W": { range: "5d", interval: "15m" },
      "1M": { range: "1mo", interval: "60m" },
      "1Y": { range: "1y", interval: "1d" },
      MAX: { range: "max", interval: "1d" },
    };
    const cfg = map[rangeKey] || map["24H"];
    const url = `${YAHOO_PROXY}?type=chart&ticker=${encodeURIComponent(ticker)}&range=${cfg.range}&interval=${cfg.interval}`;
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    console.error("stock fetch error", e);
    throw e;
  }
}

export async function searchStock(query) {
  const url = `${YAHOO_PROXY}?type=search&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  return res.json();
}
