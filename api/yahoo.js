export default async function handler(req, res) {
  const { type, ticker, range, interval, q } = req.query;

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (type === 'chart') {
      if (!ticker || !range || !interval) {
        res.status(400).json({ error: 'Missing ticker, range, or interval' });
        return;
      }

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          accept: 'application/json, text/plain, */*',
        },
      });
      const data = await response.json();
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(data);
      return;
    }

    if (type === 'search') {
      if (!q) {
        res.status(400).json({ error: 'Missing query' });
        return;
      }

      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}`;
      const response = await fetch(url);
      const data = await response.json();
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(data);
      return;
    }

    res.status(400).json({ error: 'Invalid type parameter' });
  } catch (error) {
    console.error('Yahoo proxy error', error);
    res.status(502).json({ error: 'Unable to fetch Yahoo data' });
  }
}
