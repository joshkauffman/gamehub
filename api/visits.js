import { Redis } from '@upstash/redis'

const OPENS_KEY = 'school-prep:opens'
const VISITORS_KEY = 'school-prep:visitors'
const MAX_ID_LENGTH = 64

// POST records an open (and the visitor id, if sent); GET just reads the totals.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'method not allowed' })
  }
  try {
    const redis = Redis.fromEnv()
    if (req.method === 'POST') {
      const id = req.body?.visitorId
      const validId = typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH
      const pipe = redis.pipeline().incr(OPENS_KEY)
      if (validId) pipe.sadd(VISITORS_KEY, id)
      await pipe.exec()
    }
    const [opens, uniques] = await Promise.all([redis.get(OPENS_KEY), redis.scard(VISITORS_KEY)])
    res.status(200).json({ opens: Number(opens) || 0, uniques: Number(uniques) || 0 })
  } catch (err) {
    console.error('visits counter failed', err)
    res.status(500).json({ error: 'counter unavailable' })
  }
}
