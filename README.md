# Price Tracker Dashboard

Modern client-side dashboard built with React + Vite + Tailwind. Uses public APIs (CoinGecko, Yahoo via AllOrigins, CheapShark, SneakerDatabase). Deploy-ready for Vercel.

Run locally:

```
npm install
npm run dev --host
```

Build:

```
npm run build
npm run preview
```

Deploy on Render as a web service using `npm run build` then `npm start`.

The project exposes a serverless route at `/api/status` which responds to HEAD and GET.
# Website
Useful website

## CoinGecko API

The app supports a server-side `COINGECKO_API_KEY` environment variable. CoinGecko currently recommends using a Demo API key for API requests; the free public API can return HTTP 429 when its rate limit is reached. The key is read only by the server proxy and is never exposed to the browser.

On Render, add `COINGECKO_API_KEY` under Environment Variables, then redeploy. The app also caches chart responses server-side and throttles CoinGecko requests to avoid bursts.
