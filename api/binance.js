const cache = new Map()
const CACHE_TTL = 15_000

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const incoming = new URL(req.url, 'http://localhost')
    const path = incoming.pathname.replace('/api/binance', '')
    const target = 'https://api.binance.com/api/v3' + path + incoming.search
    const cached = cache.get(target)

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Price-Cache', 'HIT')
      res.setHeader('Cache-Control', 'public, max-age=15')
      res.status(200).json(cached.data)
      return
    }

    const response = await fetch(target, {
      headers: { accept: 'application/json, text/plain, */*' },
    })
    const text = await response.text()
    let data
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (response.ok) {
      cache.set(target, { ts: Date.now(), data })
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.status(response.status).send(typeof data === 'string' ? data : JSON.stringify(data))
  } catch (error) {
    console.error('Binance proxy error', error)
    res.status(502).json({ error: 'Unable to fetch Binance data', details: error.message })
  }
}
