import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import dataRoutes from './routes/data.js'
import { errorHandler } from './middleware/error.js'

const app = express()
const port = Number(process.env.PORT) || 4000

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  }),
)
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/auth', authRoutes)
app.use('/api', dataRoutes)

app.use(errorHandler)

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
