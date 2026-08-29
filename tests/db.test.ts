import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toPositional } from '../src/lib/db'

/**
 * The whole query layer is written with `?` placeholders and rewritten to
 * Postgres `$n` in one place. If that rewriter is wrong, every query is wrong,
 * so it is worth pinning down precisely.
 */
describe('toPositional', () => {
  it('numbers placeholders in order', () => {
    assert.equal(
      toPositional('SELECT * FROM sites WHERE a = ? AND b = ? AND c = ?'),
      'SELECT * FROM sites WHERE a = $1 AND b = $2 AND c = $3',
    )
  })

  it('leaves a query with no placeholders untouched', () => {
    assert.equal(toPositional('SELECT 1'), 'SELECT 1')
  })

  it('never rewrites a question mark inside a string literal', () => {
    assert.equal(
      toPositional("SELECT * FROM t WHERE label = 'what?' AND id = ?"),
      "SELECT * FROM t WHERE label = 'what?' AND id = $1",
    )
  })

  it('never rewrites inside a quoted identifier', () => {
    assert.equal(toPositional('SELECT "odd?column" FROM t WHERE id = ?'), 'SELECT "odd?column" FROM t WHERE id = $1')
  })

  it('handles the jsonb attribute filter the browse page builds', () => {
    assert.equal(
      toPositional(`SELECT * FROM sites WHERE (attributes::jsonb ->> 'free') = 'true' AND status = ?`),
      `SELECT * FROM sites WHERE (attributes::jsonb ->> 'free') = 'true' AND status = $1`,
    )
  })

  it('handles an IN list built from an array', () => {
    const ids = [1, 2, 3]
    const sql = `SELECT * FROM sites WHERE id IN (${ids.map(() => '?').join(',')})`
    assert.equal(toPositional(sql), 'SELECT * FROM sites WHERE id IN ($1,$2,$3)')
  })

  it('copes with an apostrophe inside a literal without losing track of quoting', () => {
    // a stray unbalanced quote must not swallow the rest of the statement
    assert.equal(
      toPositional("SELECT 'it''s fine' AS x WHERE id = ?"),
      "SELECT 'it''s fine' AS x WHERE id = $1",
    )
  })
})
