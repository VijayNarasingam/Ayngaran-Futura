import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'ayngaran-sql-')), 'test.sqlite')

const { listAll, insertRow, updateRow, deleteRow, nextId } = await import('./db/database.js')
const { COLLECTION_TABLES } = await import('./db/schema.js')

console.log('=== SQL smoke (SQLite, temp db) ===')
for (const table of COLLECTION_TABLES) {
  assert.ok(Array.isArray(listAll(table)), `${table} lists`)
}
console.log('PASS 1: all 5 tables queryable and pre-seeded')

const created = insertRow('marketers', { name: 'SQL Check', status: 'Active' })
assert.ok(created.id.startsWith('MKT-'), 'auto id MKT-xxxx')
assert.equal(created.id, nextId('marketers', 'MKT') === created.id ? 'dup' : created.id)
console.log(`PASS 2: insert marketer ${created.id}`)

const updated = updateRow('marketers', created.id, { name: 'SQL Check 2' })
assert.equal(updated.name, 'SQL Check 2')
console.log('PASS 3: update works')

assert.equal(deleteRow('marketers', created.id), true)
assert.equal(listAll('marketers').some((r) => r.id === created.id), false)
console.log('PASS 4: delete works')
console.log('=== SQL SMOKE PASSED ===')
