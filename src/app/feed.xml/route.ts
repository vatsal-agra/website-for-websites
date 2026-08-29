import { env } from '@/lib/env'
import { feedResponse } from '@/lib/feed'
import { newestSites } from '@/lib/queries/sites'

export const dynamic = 'force-dynamic'

export async function GET() {
  return feedResponse({
    title: 'newest listings',
    description: `Websites recently added to the ${env.siteName} catalogue.`,
    path: '/feed.xml',
    sites: await newestSites(50),
  })
}
