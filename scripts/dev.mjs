import { spawn } from 'node:child_process'

/**
 * `next dev` with room to breathe.
 *
 * The dev server accumulates memory as it compiles and recompiles — roughly
 * fifty megabytes per handful of requests here, and image generation is heavier
 * than the rest. V8's default old-space limit on this machine is about 4 GB,
 * and as the heap approaches it the process does not crash: it starts spending
 * every request in garbage collection. What you see is a server that answers
 * `/robots.txt` in 60ms and every database-backed page in two minutes, with
 * `next.js: 5ms, application-code: 120s` in the log — which looks exactly like
 * a database outage and is not one. (`docs/debugging.md` has the full
 * symptom.)
 *
 * More headroom does not fix the growth, but it turns a wedge every twenty
 * minutes into one you can go a working session without meeting. Override with
 * DEV_HEAP_MB, or set NODE_OPTIONS yourself and this leaves it alone.
 *
 * Production is unaffected — `next start` does no compilation.
 */

const heapMb = Number(process.env.DEV_HEAP_MB || 6144)
const existing = process.env.NODE_OPTIONS ?? ''

const nodeOptions = /max-old-space-size/.test(existing)
  ? existing
  : `${existing} --max-old-space-size=${heapMb}`.trim()

const child = spawn('next', ['dev', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
