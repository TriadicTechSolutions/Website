const CACHE_TTL = 60_000
const SEARCH_CACHE_TTL = 60_000

const cache = new Map()
const inflight = new Map()
let lastUpstreamRequestAt = 0
let upstreamQueue = Promise.resolve()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function cacheKey(path, query) {
  return path + query
}

function getCache(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > entry.ttl) return null
  return entry.data
}

function getStaleCache(key) {
  return cache.get(key)?.data || null
}

function setCache(key, data, ttl) {
  cache.set(key, { ts: Date.now(), data, ttl })
}

function queueUpstream(task) {
  const run = async () => {
    const minGap = 4500
    const wait = Math.max(0, minGap - (Date.now() - lastUpstreamRequestAt))
    if (wait > 0) await sleep(wait)
    lastUpstreamRequestAt = Date.now()
    return task()
  }

  const result = upstreamQueue.then(run, run)
  upstreamQueue = result.catch(() => {})
  return result
}

async function fetchUpstream(url) {
  if (inflight.has(url)) return inflight.get(url)

  const promise = queueUpstream(async () => {
    let response = await fetch(url, {
      headers: {
        accept: 'application/json, text/plain, */*',
      },
    })

    if (response.status >= 500) {
      await sleep(1000)
      response = await fetch(url, {
        headers: {
          accept: 'application/json, text/plain, */*',
        },
      })
    }

    const text = await response.text()
    let body

    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }

    return { response, body }
  }).finally(() => inflight.delete(url))

  inflight.set(url, promise)
  return promise
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname.replace('/api/coingecko', '')
    const force = url.searchParams.get('force') === '1'
    url.searchParams.delete('force')

    const cleanQuery = url.search
    const key = cacheKey(path, cleanQuery)
    const isSearch = path === '/search'
    const days = url.searchParams.get('days')
    const ttl = isSearch
      ? SEARCH_CACHE_TTL
      : days === '1'
      ? 60_000
      : days === '7'
      ? 5 * 60_000
      : days === '30'
      ? 10 * 60_000
      : 30 * 60_000

    if (!force) {
      const cached = getCache(key)
      if (cached) {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('X-Price-Cache', 'HIT')
        res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
        res.status(200).json(cached)
        return
      }
    }

    const targetUrl = new URL('https://api.coingecko.com/api/v3' + path)
    url.searchParams.forEach((value, name) => targetUrl.searchParams.set(name, value))

    const apiKey = process.env.COINGECKO_API_KEY || process.env.COINGECKO_DEMO_API_KEY
    const headers = {
      accept: 'application/json, text/plain, */*',
    }
    if (apiKey) {
      headers['x-cg-demo-api-key'] = apiKey
    }

    const upstream = await fetchUpstreamWithHeaders(targetUrl.toString(), headers)

    if (upstream.response.ok) {
      setCache(key, upstream.body, ttl)
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Price-Cache', force ? 'REFRESHED' : 'MISS')
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
      res.status(200).json(upstream.body)
      return
    }

    const stale = getStaleCache(key)
    if (stale) {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Price-Cache', 'STALE')
      res.setHeader('X-Price-Upstream-Error', String(upstream.response.status))
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json(stale)
      return
    }

    const detail =
      upstream.body?.status?.error_message ||
      upstream.body?.error ||
      upstream.body?.message ||
      'CoinGecko request failed'

    res.setHeader('Content-Type', 'application/json')
    res.status(upstream.response.status).json({
      error: 'CoinGecko request failed',
      status: upstream.response.status,
      details: detail,
      hasApiKey: Boolean(apiKey),
    })
  } catch (error) {
    console.error('Coingecko proxy error', error)
    res.status(502).json({ error: 'Unable to fetch Coingecko data', details: error.message })
  }
}

async function fetchUpstreamWithHeaders(url, headers) {
  if (inflight.has(url)) return inflight.get(url)

  const promise = queueUpstream(async () => {
    let response = await fetch(url, { headers })

    if (response.status >= 500) {
      await sleep(1000)
      response = await fetch(url, { headers })
    }

    const text = await response.text()
    let body

    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }

    return { response, body }
  }).finally(() => inflight.delete(url))

  inflight.set(url, promise)
  return promise
}
