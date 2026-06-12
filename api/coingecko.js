export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname.replace('/api/coingecko', '')
    const query = url.search
    const target = `https://api.coingecko.com/api/v3${path}${query}`

    const response = await fetch(target)
    const body = await response.text()

    res.setHeader('Content-Type', 'application/json')
    res.status(response.status).end(body)
  } catch (error) {
    console.error('Coingecko proxy error', error)
    res.status(502).json({ error: 'Unable to fetch Coingecko data' })
  }
}
