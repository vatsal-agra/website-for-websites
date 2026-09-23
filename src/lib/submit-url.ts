/**
 * Submission-side wording for addresses the catalogue cannot take. The crawler
 * decides *whether* a URL is usable; this only decides how to say no to the
 * person who pasted it, so both the form and the server action can give the
 * same specific answer instead of one generic "that is not a web address".
 */

import { normalizeUrl } from './url'

/** Host we would end up with, before any of the normaliser's own rules apply. */
function hostOf(raw: string): string | null {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/\//, '')}`
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    return null
  }
}

/**
 * A message explaining why this address will not work, or null when it is fine.
 * Anything accepted here is accepted by `normalizeUrl`, so the form and the
 * action never disagree about what counts as valid.
 */
export function describeUrlProblem(input: string): string | null {
  const raw = input.trim()
  if (!raw) return 'Paste the address of the site you want to add, for example example.com.'
  if (normalizeUrl(raw)) return null

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw)?.[1]?.toLowerCase()
  if (scheme && !scheme.includes('.') && scheme !== 'http' && scheme !== 'https') {
    return `That is a ${scheme}: link rather than a web address. Paste the site itself, for example example.com.`
  }
  if (/\s/.test(raw)) {
    return 'A web address cannot contain spaces. Paste just the address, with nothing before or after it.'
  }
  if (/^[^\s/]+:\d+/.test(raw)) {
    return 'Addresses with a port number need the scheme in front, for example https://example.com:8080.'
  }

  const host = hostOf(raw)
  if (host) {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return 'We can only list sites that have a domain name, not a bare IP address.'
    }
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost')) {
      return 'That address only works on your own machine. We need one that anyone can open.'
    }
    if (!host.includes('.')) {
      return `"${host}" is missing a domain ending such as .com or .org.`
    }
  }

  return 'That does not look like a web address. Try something like example.com.'
}
