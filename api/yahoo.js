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

      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
        encodeURIComponent(ticker) +
        '?range=' + encodeURIComponent(range) +
        '&interval=' + encodeURIComponent(interval);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          accept: 'application/json, text/plain, */*',
        },
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { error: { description: text.slice(0, 300) } };
      }

      if (!response.ok) {
        res.status(response.status).json({
          error: 'Yahoo request failed',
          details: data?.chart?.error?.description || data?.error?.description || 'Unknown Yahoo error',
        });
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=30');
      res.status(200).json(data);
      return;
    }

    if (type === 'search') {
      if (!q) {
        res.status(400).json({ error: 'Missing query' });
        return;
      }

      const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' +
        encodeURIComponent(q);

      const response = await fetch(url);
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { quotes: [] };
      }

      if (!response.ok) {
        res.status(response.status).json({
          error: 'Yahoo search failed',
          details: data?.message || 'Unknown Yahoo error',
        });
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=60');
      res.status(200).json(data);
      return;
    }

    res.status(400).json({ error: 'Invalid type parameter' });
  } catch (error) {
    console.error('Yahoo proxy error', error);
    res.status(502).json({ error: 'Unable to fetch Yahoo data', details: error.message });
  }
}
