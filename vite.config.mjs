import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function proxyMiddleware() {
  return {
    name: 'api-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/yahoo') && !req.url.startsWith('/api/coingecko') && !req.url.startsWith('/api/coincap') && !req.url.startsWith('/api/binance')) {
          return next()
        }

        try {
          const incomingUrl = new URL(req.url, 'http://localhost')
          let target

          if (incomingUrl.pathname.startsWith('/api/yahoo')) {
            const type = incomingUrl.searchParams.get('type')
            if (type === 'chart') {
              const ticker = incomingUrl.searchParams.get('ticker')
              const range = incomingUrl.searchParams.get('range')
              const interval = incomingUrl.searchParams.get('interval')
              if (!ticker || !range || !interval) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Missing ticker, range, or interval' }))
                return
              }
              target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`
            } else if (type === 'search') {
              const q = incomingUrl.searchParams.get('q')
              if (!q) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Missing query' }))
                return
              }
              target = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}`
            } else {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid type parameter' }))
              return
            }
          } else if (incomingUrl.pathname.startsWith('/api/coingecko')) {
            const proxiedPath = incomingUrl.pathname.replace('/api/coingecko', '')
            target = `https://api.coingecko.com/api/v3${proxiedPath}${incomingUrl.search}`
          } else if (incomingUrl.pathname.startsWith('/api/coincap')) {
            const proxiedPath = incomingUrl.pathname.replace('/api/coincap', '')
            target = `https://api.coincap.io/v2${proxiedPath}${incomingUrl.search}`
          } else if (incomingUrl.pathname.startsWith('/api/binance')) {
            const proxiedPath = incomingUrl.pathname.replace('/api/binance', '')
            target = `https://api.binance.com/api/v3${proxiedPath}${incomingUrl.search}`
          }

          const response = await fetch(target, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              accept: 'application/json, text/plain, */*',
            },
          })

          const buffer = Buffer.from(await response.arrayBuffer())
          res.statusCode = response.status
          response.headers.forEach((value, key) => {
            const lower = key.toLowerCase()
            if (lower === 'content-encoding' || lower === 'transfer-encoding') return
            res.setHeader(key, value)
          })
          res.setHeader('Content-Length', String(buffer.length))
          res.end(buffer)
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Proxy fetch failed', details: error.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), proxyMiddleware()],
})
