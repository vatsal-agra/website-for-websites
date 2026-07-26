import type { Config } from '@netlify/functions'

/**
 * Portico's background worker on Netlify.
 *
 * There is no long-running process here, so instead of the `npm run worker`
 * loop this scheduled function pokes /api/worker every five minutes. Each poke
 * schedules any due discovery sources, promotes candidate URLs and drains a
 * slice of the job queue inside the function timeout.
 */
export default async function handler() {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? 'http://localhost:3000'
  const token = process.env.WORKER_TOKEN ?? ''

  if (!token) {
    console.warn('WORKER_TOKEN is not set — skipping. The catalogue will not update until it is configured.')
    return new Response('WORKER_TOKEN not configured', { status: 503 })
  }

  const started = Date.now()
  try {
    const res = await fetch(`${base}/api/worker?max=8`, {
      method: 'POST',
      headers: { 'x-worker-token': token },
    })
    const body = await res.text()
    console.log(`worker tick ${res.status} in ${Date.now() - started}ms: ${body.slice(0, 500)}`)
    return new Response(body, { status: res.status, headers: { 'content-type': 'application/json' } })
  } catch (error) {
    console.error('worker tick failed', error)
    return new Response(String(error), { status: 500 })
  }
}

export const config: Config = {
  schedule: '*/5 * * * *',
}
