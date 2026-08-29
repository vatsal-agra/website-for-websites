import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isReadOnly, isTransient, toPositional } from '../src/lib/db'

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

/**
 * These two decide whether a failed statement is run a second time. Getting
 * `isReadOnly` wrong means replaying a write that may already have committed,
 * so it errs towards saying no.
 */
describe('retrying a dropped connection', () => {
  it('recognises the errors that mean the connection went away', () => {
    for (const code of ['ECONNRESET', 'EPIPE', 'CONNECTION_CLOSED', '57P01', '08006']) {
      assert.equal(isTransient({ code }), true, code)
    }
  })

  it('does not retry a query the database actually rejected', () => {
    // 42P01 undefined_table, 42703 undefined_column, 23505 unique_violation
    for (const code of ['42P01', '42703', '23505', undefined]) {
      assert.equal(isTransient({ code }), false, String(code))
    }
    assert.equal(isTransient(new Error('boom')), false)
  })

  it('retries reads, including CTEs and leading comments', () => {
    assert.equal(isReadOnly('SELECT 1'), true)
    assert.equal(isReadOnly('  \n select * from sites'), true)
    assert.equal(isReadOnly('WITH t AS (SELECT 1) SELECT * FROM t'), true)
    assert.equal(isReadOnly('-- a comment\nSELECT 1'), true)
  })

  it('never retries anything that writes', () => {
    for (const query of [
      'INSERT INTO sites (url) VALUES (?)',
      'UPDATE sites SET votes = votes + 1',
      'DELETE FROM jobs WHERE id = ?',
      "INSERT INTO x SELECT * FROM y",
      'CREATE INDEX foo ON sites(slug)',
      'TRUNCATE sites',
    ]) {
      assert.equal(isReadOnly(query), false, query)
    }
  })
})
