import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import statusHandler from './api/status.js'
import yahooHandler from './api/yahoo.js'
import coingeckoHandler from './api/coingecko.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 3000

app.use(express.static(path.join(__dirname, 'dist')))

app.get('/api/status', statusHandler)
app.get('/api/yahoo', yahooHandler)
app.get('/api/coingecko/*', coingeckoHandler)
app.get('/api/coingecko', coingeckoHandler)

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})
