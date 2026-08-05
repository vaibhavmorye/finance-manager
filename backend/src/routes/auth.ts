import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { validateBody } from '../middleware/error.js'

const router = Router()

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

function signToken(userId: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET missing')
  return jwt.sign({ userId }, secret, { expiresIn: '7d' })
}

router.post('/signup', validateBody(credentialsSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof credentialsSchema>
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' })
    }
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: { create: {} },
        salary: { create: {} },
        settings: { create: {} },
      },
    })
    const token = signToken(user.id)
    res.status(201).json({ token, user: { id: user.id, email: user.email } })
  } catch (err) {
    next(err)
  }
})

router.post('/login', validateBody(credentialsSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof credentialsSchema>
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    const token = signToken(user.id)
    res.json({ token, user: { id: user.id, email: user.email } })
  } catch (err) {
    next(err)
  }
})

export default router
