const COINGECKO_PROXY = "/api/coingecko";
const COINCAP_PROXY = "/api/coincap";
const BINANCE_PROXY = "/api/binance";
const YAHOO_PROXY = "/api/yahoo";

const CACHE_TTLS = {
  "1H": 1000 * 30,
  "24H": 1000 * 60,
  "1W": 1000 * 60 * 5,
  "1M": 1000 * 60 * 10,
  "1Y": 1000 * 60 * 30,
  MAX: 1000 * 60 * 30,
};
const SEARCH_CACHE_TTL = 1000 * 60;
const MAX_CONCURRENT_REQUESTS = 3;
const MAX_RETRIES = 1;

const memoryCache = new Map();
const inflightRequests = new Map();
const requestQueue = [];
let activeRequests = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveCache(key, data) {
  const entry = { ts: Date.now(), data };
  memoryCache.set(key, entry);

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(entry));
    }
  } catch {}
}

function loadCache(key, maxAge) {
  const memory = memoryCache.get(key);
  if (memory) {
    const age = Date.now() - memory.ts;
    return {
      fresh: age <= maxAge ? memory.data : null,
      stale: memory.data,
    };
  }

  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(key);
      if (!raw) return { fresh: null, stale: null };

      const parsed = JSON.parse(raw);
      if (!parsed || parsed.ts == null) return { fresh: null, stale: null };

      memoryCache.set(key, parsed);

      return {
        fresh: Date.now() - parsed.ts <= maxAge ? parsed.data : null,
        stale: parsed.data,
      };
    }
  } catch {}

  return { fresh: null, stale: null };
}

function enqueue(task) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ task, resolve, reject });
    drainQueue();
  });
}

function drainQueue() {
  while (activeRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length) {
    const job = requestQueue.shift();
    activeRequests += 1;

    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        activeRequests -= 1;
        drainQueue();
      });
  }
}

function formatApiError(response, body, url) {
  let detail = "";
  if (body && typeof body === "object") {
    detail = body.error?.message || body.error?.description || body.message || body.details || "";
  } else if (typeof body === "string") {
    detail = body.slice(0, 200);
  }

  return new Error(
    "Request failed (" +
      response.status +
      ")" +
      (detail ? " " + detail : "") +
      ": " +
      url
  );
}

async function fetchJsonWithRetry(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response;

    try {
      response = await fetch(url, {
        headers: { accept: "application/json, text/plain, */*" },
      });
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        await sleep(750 * (attempt + 1));
        continue;
      }
      throw error;
    }

    const text = await response.text();
    let body = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (response.ok) return body;

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5000)
          : 750 * (attempt + 1);

      await sleep(waitMs);
      continue;
    }

    throw formatApiError(response, body, url);
  }

  throw new Error("Request failed after retries: " + url);
}

function requestJson(url) {
  if (inflightRequests.has(url)) return inflightRequests.get(url);

  const promise = enqueue(() => fetchJsonWithRetry(url)).finally(() => {
    inflightRequests.delete(url);
  });

  inflightRequests.set(url, promise);
  return promise;
}

function getCachedOrThrow(cacheKey, ttl) {
  return loadCache(cacheKey, ttl);
}

function mapDays(rangeKey) {
  return {
    "24H": 1,
    "1W": 7,
    "1M": 30,
    "1Y": 365,
    MAX: "max",
  }[rangeKey] ?? 1;
}

function mapCoinCapInterval(rangeKey) {
  return {
    "1H": "m1",
    "24H": "h1",
    "1W": "h1",
    "1M": "d1",
    "1Y": "d1",
    MAX: "d1",
  }[rangeKey] || "h1";
}

function mapBinanceInterval(rangeKey) {
  return {
    "1H": "1m",
    "24H": "15m",
    "1W": "1h",
    "1M": "4h",
    "1Y": "1d",
    MAX: "1d",
  }[rangeKey] || "15m";
}

function mapBinanceLimit(rangeKey) {
  return {
    "1H": 60,
    "24H": 96,
    "1W": 168,
    "1M": 180,
    "1Y": 365,
    MAX: 365,
  }[rangeKey] ?? 96;
}

function mapBinanceSymbol(id) {
  const map = {
    bitcoin: "BTCUSDT",
    ethereum: "ETHUSDT",
    solana: "SOLUSDT",
    cardano: "ADAUSDT",
    dogecoin: "DOGEUSDT",
    avalanche: "AVAXUSDT",
    polkadot: "DOTUSDT",
    chainlink: "LINKUSDT",
    litecoin: "LTCUSDT",
  };

  return map[id] || null;
}

async function fetchCoinGeckoChart(id, rangeKey, forceRefresh = false) {
  const days = rangeKey === "1H" ? 1 : mapDays(rangeKey);
  const url =
    COINGECKO_PROXY +
    "/coins/" +
    encodeURIComponent(id) +
    "/market_chart?vs_currency=usd&days=" +
    encodeURIComponent(days) + (forceRefresh ? "&force=1" : "");

  const body = await requestJson(url);

  if (!body || !Array.isArray(body.prices)) {
    throw new Error("CoinGecko returned invalid chart data");
  }

  if (rangeKey !== "1H") return body;

  const cutoff = Date.now() - 3600 * 1000;
  return {
    ...body,
    prices: body.prices.filter((point) => Number(point?.[0]) >= cutoff),
  };
}

async function fetchCoinCapHistory(id, rangeKey) {
  const interval = mapCoinCapInterval(rangeKey);
  const end = Date.now();
  const start =
    rangeKey === "1H"
      ? end - 3600 * 1000
      : rangeKey === "24H"
      ? end - 24 * 3600 * 1000
      : rangeKey === "1W"
      ? end - 7 * 24 * 3600 * 1000
      : rangeKey === "1M"
      ? end - 30 * 24 * 3600 * 1000
      : rangeKey === "1Y"
      ? end - 365 * 24 * 3600 * 1000
      : end - 365 * 24 * 3600 * 1000;

  const url =
    COINCAP_PROXY +
    "/assets/" +
    encodeURIComponent(id) +
    "/history?interval=" +
    encodeURIComponent(interval) +
    "&start=" +
    Math.floor(start) +
    "&end=" +
    Math.floor(end);

  const body = await requestJson(url);

  if (!Array.isArray(body?.data)) {
    throw new Error("CoinCap returned invalid data");
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
    throw new Error("Binance symbol missing for " + id);
  }

  const interval = mapBinanceInterval(rangeKey);
  const limit = mapBinanceLimit(rangeKey);
  const url =
    BINANCE_PROXY +
    "/klines?symbol=" +
    encodeURIComponent(symbol) +
    "&interval=" +
    encodeURIComponent(interval) +
    "&limit=" +
    limit;

  const body = await requestJson(url);

  if (!Array.isArray(body)) {
    throw new Error("Binance returned invalid kline data");
  }

  return {
    prices: body
      .map((row) => {
        const time = Number(row?.[0]);
        const close = Number(row?.[4]);
        return Number.isFinite(time) && Number.isFinite(close) ? [time, close] : null;
      })
      .filter(Boolean),
  };
}

async function fetchBinancePrice(id) {
  const symbol = mapBinanceSymbol(id);
  if (!symbol) {
    throw new Error("Binance symbol missing for " + id);
  }

  const url =
    BINANCE_PROXY +
    "/ticker/price?symbol=" +
    encodeURIComponent(symbol);

  const body = await requestJson(url);
  const price = Number(body?.price);

  if (!Number.isFinite(price)) {
    throw new Error("Binance returned invalid price");
  }

  return { prices: [[Date.now(), price]] };
}

export async function fetchCrypto(id, rangeSecStart, rangeSecEnd, rangeKey, forceRefresh = false) {
  const cacheKey = "crypto-chart:" + id + ":" + rangeKey;
  const ttl = CACHE_TTLS[rangeKey] ?? CACHE_TTLS["24H"];
  const { fresh: cached, stale } = getCachedOrThrow(cacheKey, ttl);

  if (cached && !forceRefresh) return cached;

  const saveData = (data) => {
    saveCache(cacheKey, data);
    return data;
  };

  try {
    return saveData(await fetchCoinGeckoChart(id, rangeKey, forceRefresh));
  } catch (primaryError) {
    console.error("CoinGecko fetch failed", primaryError.message);

    try {
      return saveData(await fetchCoinCapHistory(id, rangeKey));
    } catch (coinCapError) {
      console.error("CoinCap fallback failed", coinCapError.message);

      try {
        return saveData(await fetchBinanceKlines(id, rangeKey));
      } catch (binanceError) {
        console.error("Binance klines fallback failed", binanceError.message);

        try {
          return saveData(await fetchBinancePrice(id));
        } catch (binancePriceError) {
          console.error("Binance price fallback failed", binancePriceError.message);
          if (stale) return stale;
          throw primaryError;
        }
      }
    }
  }
}

export async function searchCrypto(query) {
  const normalized = query.trim().toLowerCase();
  const cacheKey = "crypto-search:" + normalized;
  const { fresh: cached } = getCachedOrThrow(cacheKey, SEARCH_CACHE_TTL);

  if (cached) return cached;

  try {
    const url = COINGECKO_PROXY + "/search?query=" + encodeURIComponent(query);
    const body = await requestJson(url);
    const result = body && body.coins ? body : { coins: [] };
    saveCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("crypto search failed", error.message);
    return { coins: [] };
  }
}

export async function fetchStock(ticker, rangeKey, forceRefresh = false) {
  const map = {
    "1H": { range: "1d", interval: "1m" },
    "24H": { range: "1d", interval: "5m" },
    "1W": { range: "5d", interval: "15m" },
    "1M": { range: "1mo", interval: "60m" },
    "1Y": { range: "1y", interval: "1d" },
    MAX: { range: "max", interval: "1d" },
  };

  const cfg = map[rangeKey] || map["24H"];
  const cacheKey = "stock-chart:" + ticker + ":" + rangeKey;
  const ttl = CACHE_TTLS[rangeKey] ?? CACHE_TTLS["24H"];
  const { fresh: cached, stale } = getCachedOrThrow(cacheKey, ttl);

  if (cached && !forceRefresh) return cached;

  const url =
    YAHOO_PROXY +
    "?type=chart&ticker=" +
    encodeURIComponent(ticker) +
    "&range=" +
    encodeURIComponent(cfg.range) +
    "&interval=" +
    encodeURIComponent(cfg.interval) +
    (forceRefresh ? "&force=1" : "");

  try {
    const body = await requestJson(url);

    if (body?.chart?.error) {
      const description =
        body.chart.error.description ||
        body.chart.error.code ||
        "Yahoo returned an error";
      throw new Error(description);
    }

    if (!body?.chart?.result?.[0]) {
      throw new Error("Yahoo returned no chart data");
    }

    saveCache(cacheKey, body);
    return body;
  } catch (error) {
    console.error("stock fetch error", error.message);
    if (stale) return stale;
    throw error;
  }
}

export async function searchStock(query) {
  const normalized = query.trim().toLowerCase();
  const cacheKey = "stock-search:" + normalized;
  const { fresh: cached } = getCachedOrThrow(cacheKey, SEARCH_CACHE_TTL);

  if (cached) return cached;

  try {
    const url = YAHOO_PROXY + "?type=search&q=" + encodeURIComponent(query);
    const body = await requestJson(url);
    const result = body && body.quotes ? body : { quotes: [] };
    saveCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error("stock search failed", error.message);
    return { quotes: [] };
  }
}
