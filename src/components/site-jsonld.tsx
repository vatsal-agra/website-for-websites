import { env } from '@/lib/env'

export function SiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: env.siteName,
    url: env.siteUrl,
    description:
      'A storefront for the whole web. Browse websites by category, follow collections, or press shuffle.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${env.siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
