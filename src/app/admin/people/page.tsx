import Link from 'next/link'
import { all } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/primitives'
import { PersonActions, type Person } from './rows'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'People' }

export default async function PeoplePage() {
  const [viewer, people] = await Promise.all([
    getCurrentUser(),
    all<Person>(
      `SELECT u.id, u.username, u.display_name, u.role, u.created_at,
              (SELECT COUNT(*)::int FROM collections c WHERE c.curator_id = u.id)   AS collections,
              (SELECT COUNT(*)::int FROM sites s WHERE s.submitted_by = u.id)       AS submissions,
              (SELECT COUNT(*)::int FROM votes v WHERE v.user_id = u.id)            AS votes
       FROM users u
       ORDER BY (u.role = 'admin') DESC, u.created_at ASC`,
    ),
  ])

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">People</h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
          web-amble sends no email, so there is no automated password reset. Somebody locked out of their account
          has no way back on their own — issue them a new one here and pass it on however you already talk to
          them. It is shown once and replaces the old one immediately, signing out every device they were on.
        </p>
      </header>

      <div className="space-y-3">
        {people.map((person) => (
          <article key={person.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/u/${person.username}`} className="font-medium no-underline hover:underline">
                    {person.display_name || person.username}
                  </Link>
                  <span className="font-mono text-2xs text-faint">@{person.username}</span>
                  {person.role === 'admin' && <Badge tone="accent">editor</Badge>}
                  {viewer?.id === person.id && <Badge>you</Badge>}
                </div>
                <p className="mt-1.5 font-mono text-2xs text-faint">
                  joined {formatDate(person.created_at)} · {person.collections} collection
                  {person.collections === 1 ? '' : 's'} · {person.submissions} submission
                  {person.submissions === 1 ? '' : 's'} · {person.votes} vote{person.votes === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <PersonActions person={person} isSelf={viewer?.id === person.id} />
          </article>
        ))}
      </div>

      {people.length === 0 && <p className="text-sm text-muted">Nobody has an account yet.</p>}
    </div>
  )
}
