import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describeUrlProblem } from '../src/lib/submit-url'
import { normalizeUrl } from '../src/lib/url'

describe('describeUrlProblem', () => {
  it('says nothing about addresses the normaliser accepts', () => {
    for (const ok of ['example.com', 'https://example.com', 'www.example.co.uk/about', '//example.dev']) {
      assert.equal(describeUrlProblem(ok), null, ok)
      assert.ok(normalizeUrl(ok), ok)
    }
  })

  it('asks for an address when the field is empty', () => {
    assert.match(describeUrlProblem('   ') ?? '', /Paste the address/)
  })

  it('names the scheme when the link is not a web address', () => {
    assert.match(describeUrlProblem('mailto:hi@example.com') ?? '', /mailto: link/)
    assert.match(describeUrlProblem('javascript:alert(1)') ?? '', /javascript: link/)
  })

  it('points at a stray space rather than blaming the whole address', () => {
    assert.match(describeUrlProblem('example .com') ?? '', /cannot contain spaces/)
  })

  it('explains that a port needs a scheme in front', () => {
    assert.match(describeUrlProblem('example.com:8080') ?? '', /port number/)
  })

  it('explains why an IP address or a local host will not do', () => {
    assert.match(describeUrlProblem('192.168.0.1') ?? '', /domain name/)
    assert.match(describeUrlProblem('http://localhost:3000') ?? '', /your own machine/)
  })

  it('spots a missing domain ending', () => {
    assert.match(describeUrlProblem('example') ?? '', /domain ending/)
  })

  it('falls back to a plain message for anything else', () => {
    assert.match(describeUrlProblem('%%%') ?? '', /does not look like a web address/)
  })

  it('never rejects something the action would go on to accept', () => {
    for (const input of ['example.com', 'HTTPS://Example.COM/x?utm_source=hn', 'sub.example.museum']) {
      assert.equal(describeUrlProblem(input), null, input)
    }
  })
})
