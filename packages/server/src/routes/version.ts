import type { RequestHandler } from 'express'
import { getServerVersion } from '../config.js'

export const sendServerVersion: RequestHandler = (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json(getServerVersion())
}
