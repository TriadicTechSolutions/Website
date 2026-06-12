export default function handler(req, res) {
  if (req.method === 'HEAD') {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache')
    return res.status(200).end()
  }
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({ status: 'ok', timestamp: Date.now() })
  }
  res.status(405).json({ error: 'Method not allowed' })
}
