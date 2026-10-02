# Ayngaran Futura

**Plot Booking, Project & Daily Voucher Tracker** — a single-page operations dashboard for a
layout/real-estate sales team, covering marketers, projects, plot bookings, loans & liabilities,
and daily vouchers.

Built with React 18 + Vite. **No backend required**: all data lives in `localStorage`, so the
built `dist/` can be hosted on any static host (or opened straight from disk).

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Routes](#routes)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Tests](#tests)
- [Deployment](#deployment)
- [Design system](#design-system)
- [License](#license)

---

## Features

- **Marketer Details** — CRUD for marketers with commission-related fields, active/inactive status.
- **Project Details** — Project 1/2/3 seed data plus custom projects; per-project overview with
  area, plot count, pricing, approval/patta numbers, and status.
- **Plot Booking** — book plots against a project with plot number, sq ft, total amount, booking
  amount, auto-computed pending amount, and status flow
  (`Enquiry → Advance Paid → Booked → Registered / Cancelled`).
- **Loan and Liabilities** — bank/private/vehicle loans, supplier liabilities and statutory dues,
  with principal, outstanding balance, EMI, payment mode, and status.
- **Daily Vouchers** — four sections, each its own voucher book:
  | Section | Category fields |
  |---|---|
  | Office Spend | Rent, Salary, Stationery, EB/Electricity, Water, Internet & Mobile, Travel, Food & Refreshment, Office Maintenance, Software Subscription, Bank Charges, Miscellaneous |
  | Promotion | *(no category)* — Date + Remarks |
  | Registration | *(no category)* — Date + Remarks |
  | Site Spend | 11 fixed heads: Site Travelling, Electricity, Road, Drainage, Compound Wall, Water Tank, Plot Stone, Street Light, CCTV, OSR, Miscellaneous (only *Miscellaneous* carries a Category field) |
- **KPI dashboards** — aggregate totals per page (portfolio value, received vs pending, booking
  rate, site spend by head, liability outstanding).
- **Filters, search and sorting** on every data table.
- **CSV export** for every table (UTF-8 BOM so Excel opens ₹ amounts correctly).
- **Add / Edit / Delete** with validation, confirmation dialog and toasts.
- **Responsive** — fixed sidebar on desktop, off-canvas drawer on mobile.

---

## Tech stack

| Concern | Choice |
|---|---|
| UI | React 18 (function components + hooks) |
| Routing | react-router-dom 6 (`HashRouter`) |
| Build | Vite 8 + `@vitejs/plugin-react` |
| State | React Context + a pure reducer, persisted to `localStorage` |
| Icons | Bootstrap Icons (CDN) |
| Fonts | Inter + Space Grotesk (Google Fonts) |
| Styling | Hand-written CSS with custom properties (no CSS framework) |
| Tests | Plain Node scripts using `node:assert` — no test runner required |

---

## Getting started

**Requirements:** Node.js 18+ and npm.

```bash
git clone https://github.com/VijayNarasingam/Ayngaran-Futura.git
cd Ayngaran-Futura
npm install
npm run dev
```

Vite prints the local URL (default <http://localhost:5173>). The app opens on
`#/marketers`.

> First load seeds demo records (Project 1/2/3, marketers, bookings, loans, vouchers). All edits
> persist to `localStorage` under the key `ayngaran-futura:data:v1`.

---

## Available scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test:logic` | Run the logic/data smoke suite (`node:assert`) |
| `npm run test:classes` | Dump the CSS class inventory used by the app |

---

## Routes

`HashRouter` is used deliberately so the built dashboard works on any static host — or even by
opening `dist/index.html` from disk — without server rewrite rules.

| Route | View |
|---|---|
| `/` | redirects to `/marketers` |
| `/marketers` | Marketer Details |
| `/projects` | Project Details |
| `/projects/:projectId` | Project Details, focused on one project |
| `/bookings` | Plot Booking |
| `/loans` | Loan and Liabilities |
| `/vouchers` | Daily Vouchers hub (section buttons) |
| `/vouchers/office` | Office Spend voucher book |
| `/vouchers/promotion` | Promotion voucher book |
| `/vouchers/registration` | Registration voucher book |
| `/vouchers/site` | Site Spend hub (11 head buttons) |
| `/vouchers/site/:head` | One site spend head |
| `*` | Not Found |

---

## Data model

Five collections, all records shaped `{ id, createdAt, updatedAt, ...fields }`.

| Collection | ID prefix | Key fields |
|---|---|---|
| `marketers` | `MKT-0001` | name, phone, email, area, status, commission |
| `projects` | `PRJ-0001` | name, siteName, location, area (acres/sq ft), totalPlots, pricePerSqft, launchDate, approval/patta/survey numbers, status |
| `bookings` | `BKG-0001` | projectId, customerName, plotNumber, squareFeet, totalAmount, bookingAmount, pending (derived), bookingDate, status |
| `loans` | `LN-0001` | lenderName, liabilityType, principalAmount, outstandingBalance, emiAmount, paymentMode, status |
| `vouchers` | `VC-0001` | type (`office`, `promotion`, `registration`, `site-*`), date, amount, category (where applicable), remarks |

Mutation flow: `src/lib/storeReducer.js` is a pure reducer (`add` / `update` / `remove` /
`settings` / `import` / `reset`); `StoreContext` wires it to React state and persists to
`localStorage`. Ids are generated sequentially by `nextId()`. `normalizeState()` guards against
partial or stale payloads from `localStorage` or a backup file.

Derived numbers (pending amount, project totals, dashboard KPIs, site spend by head) live in
`src/lib/selectors.js` — never stored on the record.

---

## Project structure

```
.
├── index.html                  # Vite entry, fonts + Bootstrap Icons
├── vite.config.js              # base: './' for portable builds
├── public/favicon.svg
├── tests/
│   ├── verified.mjs            # logic/data smoke suite (npm run test:logic)
│   ├── check-classes.mjs
│   └── dump-classes.mjs
└── src/
    ├── main.jsx
    ├── App.jsx                 # providers + HashRouter routes
    ├── pages/                  # Marketers, Projects, PlotBooking, Loans, Vouchers, NotFound
    ├── resources/              # per-domain field + column + filter definitions
    ├── components/             # Layout, Sidebar, DataTable, ResourcePage, FormField,
    │                           # Modal, ConfirmDialog, Charts, KpiCard, Badge, PageHeader
    ├── context/                # StoreContext, ThemeContext, ToastContext
    ├── lib/                    # storeReducer, selectors, csv, format
    ├── data/                   # reference.js (master data), seed.js (demo records)
    ├── styles/                 # global.css (theme), compat.css
    └── asserts/                # logo assets
```

**The resources layer is the extension point.** Each module in `src/resources/` declares a
collection's fields, table columns, filters, and CSV filename; `ResourcePage` renders add/edit
forms and the table from that definition. Adding a new entity is a data change, not a component
rewrite.

---

## Tests

```bash
npm run test:logic
```

`tests/verified.mjs` asserts the invariants that matter most:

- all 11 site-spend categories are configured
- seed contains exactly Project 1, 2 and 3
- the pending-amount invariant holds (`totalValue === received + pending`) across bookings and per project
- site spend grouped by head sums to total site vouchers
- reducer `add` / `update` / `remove` behave correctly and generate sequential `BKG-` ids
- CSV escaping and currency formatting

`npm run test:classes` prints the CSS class inventory — useful when refactoring `global.css`.

---

## Deployment

```bash
npm run build     # → dist/
```

`dist/` is fully static and portable (`base: './'` + hash routing). Publish it to any static host:
GitHub Pages, Netlify, Vercel, S3, or a plain Nginx document root. Because state is browser-local,
data is per-device — there is no server to back up, and clearing site data clears the records.

---

## Design system

A single **Castle** theme (sampled from the project logo): deep green `#071E16` base, gold
`#E8CD82` / `#D4AF37` primary, `#2FA97A` for positive states. Tokens are CSS custom properties
defined in `src/styles/global.css`; `ThemeContext` sets `data-theme="castle"` on `<html>`.
`src/styles/compat.css` holds layout/compatibility overrides.

---

## License

© BrainWays Tech. All rights reserved.