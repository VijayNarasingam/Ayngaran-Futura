/**
 * The form only serialises `fields`, so any value a resource supplies through
 * `createDefaults` but does NOT expose as a field is silently dropped on save.
 *
 * That is not hypothetical: vouchers.jsx seeded `type` through createDefaults
 * to choose which book a voucher belongs to, `type` was not a form field, and
 * every manually entered voucher was stored with type='' - which baseFilter
 * then hid from all four books. The entry saved fine and appeared nowhere, so
 * from the user's side manual entries simply did not save. It went unnoticed
 * because the seeded rows were inserted straight through the API with correct
 * types, and no test ever drove the form's own submit path.
 *
 * So: for every resource, assert that every key createDefaults() produces is
 * either a real form field or is re-asserted via sanitize.
 */

import { voucherResource, siteSpendResource } from '../src/resources/vouchers.jsx'
import { marketersResource } from '../src/resources/marketers.jsx'
import { bookingsResource } from '../src/resources/bookings.jsx'
import { loansResource } from '../src/resources/loans.jsx'
import { VOUCHER_TYPES } from '../src/data/reference.js'

let passed = 0
let failed = 0

function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? `  [${detail}]` : ''}`)
  }
}

/** Mirrors ResourcePage.handleSubmit's payload construction exactly. */
function buildPayload(resource, { fieldsFor, typeKey, entered = {} }) {
  const fields = fieldsFor ? fieldsFor(typeKey) : resource.fields || []
  const values = { ...(resource.createDefaults ? resource.createDefaults(typeKey) : {}), ...entered }
  const payload = { ...entered }
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(entered, f.key)) payload[f.key] = entered[f.key]
  }
  if (resource.typeField) payload[resource.typeField.key] = values[resource.typeField.key] || typeKey
  if (resource.sanitize) Object.assign(payload, resource.sanitize(payload, values) || {})
  return payload
}

console.log('=== createDefaults keys survive the form submit path ===')

const emptyData = { marketers: [], projects: [], bookings: [], loans: [], vouchers: [] }

// 1. The concrete regression: a manual voucher must land in its own book.
for (const [key, type] of Object.entries(VOUCHER_TYPES)) {
  const res = voucherResource(emptyData, type)
  const payload = buildPayload(res, { entered: { category: 'Rent', amount: '100', remarks: 'x' } })

  check(
    `voucher [${key}] carries its type through submit`,
    payload.type === key,
    `payload.type=${JSON.stringify(payload.type)}`,
  )
  check(
    `voucher [${key}] is visible to its own baseFilter`,
    res.baseFilter(payload),
    'baseFilter(type) returned false - the row would be invisible',
  )
}

// 2. Generic guard: every resource, plus every voucher book.
const resources = [
  ['marketers', marketersResource(emptyData)],
  ['loans', loansResource(emptyData)],
  ['bookings', bookingsResource(emptyData)],
  ['siteSpend', siteSpendResource(emptyData)],
]
for (const [key, type] of Object.entries(VOUCHER_TYPES)) {
  resources.push([`vouchers[${key}]`, voucherResource(emptyData, type)])
}

for (const [name, res] of resources) {
  if (!res?.createDefaults) continue
  const defaults = res.createDefaults('') || {}
  const fieldKeys = new Set((res.fields || []).map(f => f.key))
  const reasserted = res.sanitize ? res.sanitize({}, { ...defaults }) || {} : {}

  // A dropped key is only dangerous if it carried a real value. An empty-string
  // default for a key the form has no field for is benign: the column already
  // defaults to '' (that is why only vouchers[office] and vouchers[site-
  // miscellaneous], the two types that DO have a Category select, pass the
  // strict version of this check). `type` is the one that matters - a dropped
  // type made every manual voucher invisible.
  const lostValues = Object.entries(defaults)
    .filter(([k, v]) => !fieldKeys.has(k) && !Object.prototype.hasOwnProperty.call(reasserted, k))
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k]) => k)

  check(
    `${name}: no non-empty createDefaults value is dropped on submit`,
    lostValues.length === 0,
    `lost: ${lostValues.join(', ')}`,
  )
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exitCode = 1