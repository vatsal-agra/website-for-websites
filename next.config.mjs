/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Unrelated lockfiles sit in parent folders, so Next would otherwise infer a
  // workspace root several directories above the project and watch far too much.
  turbopack: { root: import.meta.dirname },
  // native / heavy node modules must not be bundled by the server compiler
  serverExternalPackages: ['sharp', '@libsql/client', '@netlify/blobs'],
  poweredByHeader: false,
  images: {
    // thumbnails are generated locally and served pre-optimised from /api/thumb
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/api/thumb/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
  async redirects() {
    return [{ source: '/discover', destination: '/', permanent: true }]
  },
}

export default nextConfig
