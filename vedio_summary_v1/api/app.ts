/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import tasksRoutes from './routes/tasks.js'
import settingsRoutes from './routes/settings.js'
import { asyncHandler } from './lib/asyncHandler.js'
import { getHealthSnapshot } from './services/healthService.js'
import { loadSettings } from './repositories/settingsRepo.js'
import { setTaskOutputDir } from './lib/paths.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

loadSettings()
  .then((settings) => setTaskOutputDir(settings.download.outputDir))
  .catch(() => undefined)

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/tasks', tasksRoutes)
app.use('/api/settings', settingsRoutes)

/**
 * health
 */
app.get(
  '/api/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await getHealthSnapshot()
    res.status(200).json(health)
  }),
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ success: false, error: error.message || 'Server internal error' })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
