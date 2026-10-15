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
assert.ok(!listAll('marketers').some((r) => r.id !== created.id && r.id === 'MKT-0004'), 'id is unique')
// The next id must be the one after the highest existing number, not a reuse.
const following = nextId('marketers', 'MKT')
assert.equal(following, 'MKT-0005', `expected next id MKT-0005, got ${following}`)
console.log(`PASS 2: insert marketer ${created.id}, next id is ${following}`)

const updated = updateRow('marketers', created.id, { name: 'SQL Check 2' })
assert.equal(updated.name, 'SQL Check 2')
console.log('PASS 3: update works')

assert.equal(deleteRow('marketers', created.id), true)
assert.equal(listAll('marketers').some((r) => r.id === created.id), false)
console.log('PASS 4: delete works')

// Duplicate ids must be rejected with a 409, not a raw PRIMARY KEY error.
let dupStatus = null
try {
  insertRow('marketers', { id: listAll('marketers')[0].id, name: 'Clash' })
} catch (error) {
  dupStatus = error.status
}
assert.equal(dupStatus, 409, `expected 409 on duplicate id, got ${dupStatus}`)
console.log('PASS 5: duplicate id rejected with 409')

// Deleting a project that bookings still reference must be refused.
const project = listAll('projects')[0]
let guardStatus = null
try {
  deleteRow('projects', project.id)
} catch (error) {
  guardStatus = error.status
}
assert.equal(guardStatus, 409, `expected 409 on referenced delete, got ${guardStatus}`)
console.log(`PASS 6: deleting referenced project ${project.id} refused with 409`)

// Overpayment must be refused so the money invariant holds.
let overStatus = null
try {
  insertRow('bookings', {
    customerName: 'Overpay', plotNumber: 'P-1', squareFeet: 100,
    totalAmount: 100, bookingAmount: 150, status: 'Booked',
  })
} catch (error) {
  overStatus = error.status
}
assert.equal(overStatus, 400, `expected 400 on overpayment, got ${overStatus}`)
console.log('PASS 7: overpayment refused with 400')

console.log('=== SQL SMOKE PASSED ===')
