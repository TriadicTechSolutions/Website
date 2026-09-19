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

The app can use CoinGecko without any API key. The optional server-side `COINGECKO_API_KEY` enables the free CoinGecko Demo plan when you want its higher, trackable allowance. The key is read only by the server proxy and is never exposed to the browser.

Nothing needs to be configured for keyless mode. On Render, add `COINGECKO_API_KEY` only if you choose to use a Demo key, then redeploy. The app caches chart responses server-side and throttles CoinGecko requests to avoid bursts.
