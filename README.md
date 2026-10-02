# Ayngaran Futura

**Plot Booking, Project & Daily Voucher Tracker** — a dashboard for a layout / real-estate sales
team, covering marketers, projects, plot bookings, loans & liabilities, and daily vouchers.

React 18 + Vite on the front end, a **zero-dependency Node API server on SQLite** (`node:sqlite`)
on the back end. No npm runtime dependencies on the server, no ORM, no external database to
install.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Architecture](#architecture)
- [REST API](#rest-api)
- [Database](#database)
- [Routes](#routes)
- [Project structure](#project-structure)
- [Tests](#tests)
- [Deployment](#deployment)
- [Design system](#design-system)
- [License](#license)

---

## Features

- **Marketer Details** — CRUD for marketers: region, commission percent, status, sourced business.
- **Project Details** — Project 1/2/3 seed data plus custom projects; per-project overview with
  area, plot count, pricing, approval / patta / survey numbers, and status.
- **Plot Booking** — book plots against a project with plot number, sq ft, total amount, booking
  amount, auto-computed pending amount, and status flow
  (`Enquiry → Advance Paid → Booked → Registered / Cancelled`).
- **Loan and Liabilities** — bank / private / vehicle loans, supplier liabilities and statutory
  dues, with principal, outstanding balance, interest rate, EMI, payment mode, and status.
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
- **Add / Edit / Delete** with validation, confirmation dialog, and error toasts when the API is
  unreachable.
- **Responsive** — fixed sidebar on desktop, off-canvas drawer on mobile.

---

## Tech stack

| Concern | Choice |
|---|---|
| UI | React 18 (function components + hooks) |
| Routing | react-router-dom 6 (`HashRouter`) |
| Build | Vite 8 + `@vitejs/plugin-react` |
| Server | Node's built-in `node:http` — no Express, no npm dependencies |
| Database | `node:sqlite` (`DatabaseSync`) — a single local `.sqlite` file |
| State | React Context over the API; SQL is the single source of truth |
| Icons | Bootstrap Icons (CDN) |
| Fonts | Inter + Space Grotesk (Google Fonts) |
| Styling | Hand-written CSS with custom properties (no CSS framework) |
| Tests | Plain Node scripts using `node:assert` — no test runner required |

---

## Getting started

**Requirements:** Node.js **22+** (for `node:sqlite` — it prints an *ExperimentalWarning* on
first run, which is expected) and npm.

```bash
git clone https://github.com/VijayNarasingam/Ayngaran-Futura.git
cd Ayngaran-Futura
npm install
```

Run the API server and the Vite dev server in **two terminals**:

```bash
# terminal 1 — SQL API on http://localhost:8080
npm run server

# terminal 2 — Vite dev server on http://localhost:5173
npm run dev
```

Open the Vite URL. The app opens on `#/marketers`.

Vite proxies `/api` → `http://localhost:8080`, so the frontend talks to a same-origin path in dev.
If the API is not running, the dashboard shows *"Could not reach the SQL server. Run `npm run
server`."* on every save.

The database file is created automatically at `server/ayngaran-futura.sqlite` on first boot and
seeded from `src/data/seed.js` — but only for tables that are **empty**, so restarting the server
never re-inserts or clobbers your data.

---

## Available scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server (frontend only, expects the API to be up) |
| `npm run server` | Start the Node + SQLite API on port 8080 |
| `npm run dev:all` | Both in one command — **POSIX shells only**, see the note below |
| `npm run build` | Production build of the frontend into `dist/` |
| `npm run preview` | Serve the production frontend build locally |
| `npm run test:logic` | Frontend logic / data invariants (`node:assert`) |
| `npm run test:sql` | SQLite smoke test against a throwaway temp database |
| `npm run test:classes` | Dump the CSS class inventory used by the app |

> **`dev:all` on Windows:** the script uses `cmd &` backgrounding, which PowerShell does not
> support. On Windows either run the two commands in separate terminals, or use
> `npx concurrently "npm run server" "npm run dev"`.

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | API server port |
| `SQLITE_PATH` | `server/ayngaran-futura.sqlite` | Database file location |

```bash
PORT=9000 SQLITE_PATH=/var/data/ayngaran.sqlite npm run server
```

---

## Architecture

```
  Browser (React SPA)
        │  fetch('/api/...')          ── src/lib/api.js
        ▼
  Vite dev proxy  /api → :8080        (dev only; same-origin in production)
        ▼
  Node http server  :8080              ── server/index.js
        │  tiny express-like route facade, CORS open, 5 MB body cap
        ▼
  /api routes                          ── server/routes/api.js
        │  whitelist collections, shape SQL params
        ▼
  DatabaseSync (node:sqlite)           ── server/db/database.js
        │  prepare() with bound parameters only
        ▼
  ayngaran-futura.sqlite               ── server/db/schema.js
```

**Frontend.** `StoreProvider` (`src/context/StoreContext.jsx`) fetches the whole dashboard state
once from `GET /api/state`, then keeps React state in sync optimistically from the row the API
returns. `add` / `update` / `remove` are `async` and reject on API failure, so the calling page can
show an error toast instead of silently dropping the edit. Pages consume `data`, `records()`,
`find()`, `loading`, `error` and `reload` through `useStore()`.

**Derived values are never stored.** Pending amount, project totals, KPI aggregates and
site-spend-by-head are all computed in `src/lib/selectors.js` from the raw rows, so the database
holds only what the user actually entered.

**`src/lib/storeReducer.js` is retained for the seed data** (`buildSeedState`) and for
`test:logic`. The live app no longer uses `localStorage` for persistence — SQLite is the source of
truth.

**The resources layer is the extension point.** Each module in `src/resources/` declares a
collection's fields, table columns, filters, and CSV filename; `ResourcePage` renders the add/edit
form and the table from that definition. Adding an entity is a data change, not a component
rewrite.

---

## REST API

Base path `/api`. JSON in, JSON out. Collection names match the UI: `marketers`, `projects`,
`bookings`, `loans`, `vouchers`.

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/state` | Whole dashboard state — `{ meta, settings, marketers[], projects[], bookings[], loans[], vouchers[] }` |
| `GET` | `/api/settings` | `{ theme }` |
| `PUT` | `/api/settings` | Body `{ theme }` → updated settings |
| `GET` | `/api/:collection` | Array of rows, ordered by insertion |
| `GET` | `/api/:collection/:id` | One row, or `404` |
| `POST` | `/api/:collection` | Inserts (auto-generates the id), returns `201` + the created row |
| `PUT` | `/api/:collection/:id` | Updates the supplied columns only, returns the updated row |
| `DELETE` | `/api/:collection/:id` | `{ ok: true, id }`, or `404` |

Ids are sequential with a per-collection prefix (`MKT-0001`, `PRJ-0001`, `BKG-0001`, `LN-0001`,
`VC-0001`). `createdAt` is preserved on update; `updatedAt` is always refreshed.

Errors return `{ error: "..." }` with a 4xx status. Unknown collections are rejected with `404`
before any SQL runs.

```bash
# examples
curl http://localhost:8080/api/projects
curl -X POST http://localhost:8080/api/vouchers \
  -H 'content-type: application/json' \
  -d '{"type":"office","date":"2026-01-15","amount":2500,"category":"Rent"}'
```

---

## Database

One table per collection plus a key/value `settings` table (`server/db/schema.js`). Every column is
nullable `TEXT`/`REAL` except the `id` primary key, which keeps the UI free to accept flexible
records; numeric columns are coerced and validated on write.

| Collection | ID prefix | Columns (excluding `id`, `createdAt`, `updatedAt`) |
|---|---|---|
| `marketers` | `MKT-0001` | name, phone, email, region, commissionPercent, status, joinedOn, remarks |
| `projects` | `PRJ-0001` | name, siteName, location, surveyNumber, pattaNumber, approvalNo, totalAreaAcres, totalAreaSqft, totalPlots, pricePerSqft, launchDate, landOwner, status, remarks |
| `bookings` | `BKG-0001` | customerName, phone, projectRef, plotNumber, areaCents, squareFeet, totalAmount, bookingAmount, bookingDate, marketerRef, status, remarks |
| `loans` | `LN-0001` | lenderName, liabilityType, projectRef, principalAmount, outstandingBalance, interestRate, emiAmount, emiDay, tenureMonths, sanctionDate, documentRef, status, remarks |
| `vouchers` | `VC-0001` | type, date, category, amount, paymentMode, paidTo, projectRef, remarks |

`projectRef` / `marketerRef` are loose references (id or free text), not foreign keys — the UI
resolves them for display. Keep `schema.js` in sync with `src/resources/*.jsx` field definitions.

**Backups** are a file copy:

```bash
# stop the server first
cp server/ayngaran-futura.sqlite backup/ayngaran-futura-$(date +%F).sqlite
```

---

## Routes

`HashRouter` is used deliberately so the built frontend works on any static host without server
rewrite rules.

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

## Project structure

```
.
├── index.html                  # Vite entry, fonts + Bootstrap Icons
├── vite.config.js              # base: './' + /api dev proxy
├── server/
│   ├── index.js                # http server, route matching, CORS, body parsing
│   ├── routes/api.js           # /api endpoints
│   ├── db/
│   │   ├── schema.js           # DDL + column whitelists + numeric columns
│   │   └── database.js         # DatabaseSync wrapper: list/find/insert/update/delete/seed
│   ├── test-sql.mjs            # npm run test:sql
│   └── ayngaran-futura.sqlite  # generated, git-ignored
├── public/favicon.svg
├── tests/
│   ├── verified.mjs            # npm run test:logic
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
    ├── lib/                    # api.js (fetch client), selectors, csv, format, storeReducer
    ├── data/                   # reference.js (master data), seed.js (demo records)
    ├── styles/                 # global.css (theme), compat.css
    └── asserts/                # logo assets
```

---

## Tests

```bash
npm run test:logic   # frontend data + selector invariants
npm run test:sql     # SQLite CRUD against a temp database
```

`tests/verified.mjs` asserts what matters most on the data layer:

- all 11 site-spend categories are configured
- seed contains exactly Project 1, 2 and 3
- the pending-amount invariant holds (`totalValue === received + pending`) across bookings and per project
- site spend grouped by head sums to total site vouchers
- reducer `add` / `update` / `remove` generate sequential ids and mutate correctly
- CSV escaping and currency formatting

`server/test-sql.mjs` points `SQLITE_PATH` at a throwaway temp database, then checks that all five
tables list, seed, insert (auto id `MKT-xxxx`), update and delete correctly — so running it never
touches your real data.

---

## Deployment

The frontend is a static build and the server is a single Node process — there is no bundling step
for the API.

```bash
npm run build              # → dist/
```

```bash
# 1. frontend → any static host (GitHub Pages, Netlify, S3, Nginx)
# 2. api → any Node 22+ host
PORT=8080 SQLITE_PATH=/var/lib/ayngaran/ayngaran.sqlite node server/index.js
```

Because routing is hash-based and Vite builds with `base: './'`, the frontend can be served from a
sub-path. Serve the API **same-origin** with the static files (a reverse-proxy rule for `/api`) or
set a CORS-allowed origin — the server currently sends `access-control-allow-origin: *`, which is
fine for a trusted internal deployment but should be locked down before exposing the API publicly.

There is **no authentication** in this build. Put the app behind your network boundary, VPN, or an
authenticating reverse proxy before exposing it.

---

## Design system

A single **Castle** theme (sampled from the project logo): deep green `#071E16` base, gold
`#E8CD82` / `#D4AF37` primary, `#2FA97A` for positive states. Tokens are CSS custom properties
defined in `src/styles/global.css`; `ThemeContext` sets `data-theme="castle"` on `<html>`.
`src/styles/compat.css` holds layout/compatibility overrides.

---

## License

© BrainWays Tech. All rights reserved.