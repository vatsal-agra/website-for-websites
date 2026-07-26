import fs from 'node:fs'
import path from 'node:path'

/**
 * Minimal .env loader for the CLI entrypoints. Next.js does this itself for the
 * web app; the worker and scripts need it done by hand.
 */
function loadEnvFile(file: string) {
  const full = path.resolve(process.cwd(), file)
  if (!fs.existsSync(full)) return
  const contents = fs.readFileSync(full, 'utf8')
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

export const colours = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

export function log(message: string) {
  const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false })
  console.log(`${colours.dim}${stamp}${colours.reset} ${message}`)
}

export function banner(text: string) {
  console.log(`\n${colours.bold}${colours.magenta}▍${text}${colours.reset}\n`)
}
