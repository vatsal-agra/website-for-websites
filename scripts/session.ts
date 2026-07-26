import './_boot'
import { all, get, run, ready } from '../src/lib/db'
import { createSession, findUserByUsername } from '../src/lib/auth'
import { env } from '../src/lib/env'

/** Mint a session cookie for local testing: `npx tsx scripts/session.ts [username]` */
await ready()
const username = process.argv[2] || env.adminUsername
const user = await findUserByUsername(username)
if (!user) {
  console.error(`no such user: ${username}`)
  process.exit(1)
}
const { token } = await createSession(user.id)
console.log(token)
