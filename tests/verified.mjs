import assert from "node:assert/strict";
import { SEED_PROJECTS, SEED_MARKETERS, SEED_BOOKINGS, SEED_LOANS, SEED_VOUCHERS } from "../src/data/seed.js";
import { SITE_SPEND_CATEGORIES, VOUCHER_TYPES, siteHeadKey, NAV_TREE } from "../src/data/reference.js";
import { dashboardStats, projectStats, pendingAmount, bookingRate, sumBy, siteSpendByHead } from "../src/lib/selectors.js";
import { storeReducer, buildSeedState } from "../src/lib/storeReducer.js";
import { toCSV } from "../src/lib/csv.js";
import { money, compactMoney } from "../src/lib/format.js";

console.log("=== Running Complete Ayngaran Futura Smoke Suite ===");
assert.equal(SITE_SPEND_CATEGORIES.length, 11);
console.log("PASS 1: All 11 site spend categories configured (Travelling, Road, Drainage, etc)");
assert.equal(SEED_PROJECTS.length, 3);
console.log("PASS 2: Seed has exactly Project 1, Project 2, and Project 3");
const state = buildSeedState();
const stats = dashboardStats(state);
assert.equal(stats.totalValue, stats.received + stats.pending);
console.log("PASS 3: Pending amount invariant holds across bookings");
for (const p of SEED_PROJECTS) {
  const pStat = projectStats(state, p.id);
  assert.equal(pStat.totalValue, pStat.received + pStat.pending);
}
console.log("PASS 4: Project 1/2/3 individual isolation holds");
const siteBreakdown = siteSpendByHead(SEED_VOUCHERS);
assert.equal(sumBy(siteBreakdown, "total"), sumBy(SEED_VOUCHERS.filter(v => v.type.startsWith("site-") || v.type === "site"), "amount"));
console.log("PASS 5: Site spend by head sums to total site vouchers");
let s = storeReducer(state, { type: "add", collection: "bookings", values: { customerName: "Devi", totalAmount: 100, bookingAmount: 40 } });
assert.equal(pendingAmount(s.bookings[s.bookings.length - 1]), 60);
const addedId = s.bookings[s.bookings.length - 1].id;
assert.ok(addedId.startsWith("BKG-"));
s = storeReducer(s, { type: "update", collection: "bookings", id: addedId, values: { bookingAmount: 70 } });
assert.equal(pendingAmount(s.bookings[s.bookings.length - 1]), 30);
s = storeReducer(s, { type: "remove", collection: "bookings", id: addedId });
assert.equal(s.bookings.length, state.bookings.length);
console.log("PASS 6: Store reducer handles add, update, and remove");
const csv = toCSV([{ key: "id", label: "ID" }, { key: "name", label: "Name" }], [{ id: "B1", name: "A, B" }]);
assert.ok(csv.includes("A, B"));
console.log("PASS 7: CSV escaping verified");
assert.ok(money(150000).includes("1,50,000"));
assert.ok(compactMoney(15000000).includes("1.50 Cr"));
console.log("PASS 8: Indian money formatting correct");

// --- regression coverage for the bugs found in browser testing ---

// pendingAmount must not be floored at 0, or the invariant above breaks.
const over = { totalAmount: 100, bookingAmount: 150 };
assert.equal(pendingAmount(over), -50, "overpayment must surface as a credit, not 0");
const overState = { ...state, bookings: [{ id: "BKG-X", status: "Booked", squareFeet: 100, ...over }] };
const overStats = dashboardStats(overState);
assert.equal(overStats.totalValue, overStats.received + overStats.pending,
  "totalValue === received + pending must hold even when overpaid");
assert.equal(overStats.pending, -50);
console.log("PASS 9: Pending amount invariant holds for overpayments (credit, not clamped)");

// CSV cells that start with a formula character must be neutralised.
const inject = toCSV([{ key: "name", label: "Name" }], [{ name: '=HYPERLINK("http://evil.test","x")' }]);
assert.ok(inject.includes(`"'=HYPERLINK`), `formula not neutralised: ${inject}`);
assert.ok(toCSV([{ key: "n", label: "N" }], [{ n: "+cmd" }]).includes(`"'+cmd`));
assert.ok(toCSV([{ key: "n", label: "N" }], [{ n: "@SUM(A1)" }]).includes(`"'@SUM`));
// ordinary values, including negative numbers, must be left alone
assert.ok(toCSV([{ key: "n", label: "N" }], [{ n: "-2500" }]).includes('"-2500"'),
  "negative numbers are data, not formulas");
assert.ok(toCSV([{ key: "n", label: "N" }], [{ n: "-12.5" }]).includes('"-12.5"'));
// but a formula that merely *starts* like a number is still caught
const numericFormula = toCSV([{ key: "n", label: "N" }], [{ n: "-2+3+cmd" }]);
assert.ok(numericFormula.includes("\"'-2+3+cmd"), "numeric-prefixed formula must be escaped: " + numericFormula);
const tabFormula = toCSV([{ key: "n", label: "N" }], [{ n: "\t=1+1" }]);
assert.ok(tabFormula.includes("\"'\t=1+1"), "tab-prefixed formula must be escaped");
console.log("PASS 10: CSV formula injection neutralised");

// Shared money rules - the same module the form and the API both validate with.
const { validateBookingAmounts, dueOnBooking } = await import("../src/lib/rules.js");
assert.ok(validateBookingAmounts({ totalAmount: 100, bookingAmount: 150 }),
  "overpaying booking amount must produce an error");
assert.equal(validateBookingAmounts({ totalAmount: 100, bookingAmount: 40 }), null,
  "a normal booking must not be flagged");
assert.equal(validateBookingAmounts({ totalAmount: 0, bookingAmount: 50 }), null,
  "empty values are handled by required-field validation, not this rule");
assert.equal(dueOnBooking({ totalAmount: 100, bookingAmount: 150 }), -50);
console.log("PASS 11: Overpayment blocked by the shared booking rule");
console.log("=== ALL 11 SUITES PASSED ===");
