import type { Request, Response, NextFunction } from 'express'
import { ZodError, type ZodType } from 'zod'

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.issues })
      }
      next(err)
    }
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
