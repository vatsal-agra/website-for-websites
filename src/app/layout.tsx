import type { Metadata, Viewport } from 'next'
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { env } from '@/lib/env'
import { getCurrentUser } from '@/lib/session'
import { listCategories } from '@/lib/queries/sites'
import { EMPTY_STATS, getStats } from '@/lib/queries/stats'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ThemeScript } from '@/components/theme-toggle'
import { SiteJsonLd } from '@/components/site-jsonld'

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${env.siteName} — a storefront for the whole web`,
    template: `%s · ${env.siteName}`,
  },
  description:
    'web-amble is a directory of websites worth knowing about. Browse by category, follow curated collections, or hit shuffle and land somewhere you did not expect.',
  keywords: ['website directory', 'discover websites', 'web curation', 'indie web', 'useful websites'],
  openGraph: {
    type: 'website',
    siteName: env.siteName,
    title: `${env.siteName} — a storefront for the whole web`,
    description:
      'A directory of websites worth knowing about. Browse, search, or hit shuffle and land somewhere you did not expect.',
    url: env.siteUrl,
  },
  twitter: { card: 'summary_large_image' },
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': `${env.siteUrl}/feed.xml` },
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0c' },
  ],
  width: 'device-width',
  initialScale: 1,
}

/**
 * The chrome renders on every page, so its data must never be able to take a
 * page — or a build — down. A missing footer stat is cosmetic; a throw here is
 * a blank site.
 */
async function chromeData() {
  try {
    const [user, categories, stats] = await Promise.all([getCurrentUser(), listCategories(), getStats()])
    return { user, categories, stats }
  } catch {
    return { user: null, categories: [] as Awaited<ReturnType<typeof listCategories>>, stats: EMPTY_STATS }
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, categories, stats } = await chromeData()

  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="alternate" type="application/rss+xml" title={`${env.siteName} feed`} href={`${env.siteUrl}/feed.xml`} />
        <SiteJsonLd />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas"
        >
          Skip to content
        </a>
        <Header user={user} pendingCount={user?.role === 'admin' ? stats.pending : 0} />
        <main id="main">{children}</main>
        <Footer categories={categories} stats={stats} />
      </body>
    </html>
  )
}
