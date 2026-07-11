# Strike Yard — QR Table Ordering

QR-based ordering system for the Strike Yard café (futsal + pickleball complex, Nepal).
Customers scan a table QR → browse a bilingual menu → order → track status. Staff manage
orders, the kitchen display, menu, tables, reports, inventory, and settings.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000:

- **Customer app** — pick a demo table on the home page (in production the table QR
  deep-links to `/t/<table>` directly). Language toggle EN/ने in the header.
- **Staff panel** — `/staff`. Demo PINs: Owner `1234`, Kitchen `2222`, Waiter `3333`.
- **Billing counter** — `/staff/billing` (detailed bills, cash/QR payment marking).
- **Kitchen display** — `/staff/kitchen` (dark, large type; run fullscreen on a tablet).

Open a customer tab and a staff tab side by side: orders, status changes, and waiter
calls sync live between tabs.

## How it works

- **Demo mode (current)**: all data lives in `localStorage`, synced across tabs with
  `BroadcastChannel`. Perfect for evaluating the product and running on a single device.
  Reset anytime from Settings → "Reset demo data".
- **Production (go-live)**: swap the store for Supabase. The schema with RLS policies is
  ready in [supabase/schema.sql](supabase/schema.sql); every screen reads/writes through
  the single interface in [src/lib/store.ts](src/lib/store.ts). See [SETUP.md](SETUP.md).

## Feature map

| Area | Where |
|---|---|
| Menu, cart, notes, order tracker, waiter call, feedback | `src/components/customer/` |
| Orders dashboard, status flow, cancel, waiter-call alerts | `src/app/staff/page.tsx` |
| Billing counter, detailed bill, payment collection | `src/app/staff/billing/page.tsx` |
| Kitchen display (rounds, timers, urgency) | `src/app/staff/kitchen/page.tsx` |
| Menu CRUD, stock, photos, specials, time windows | `src/app/staff/menu/page.tsx` |
| Tables + QR generate/download/print | `src/app/staff/tables/page.tsx` |
| Sales, best sellers, peak hours, staff perf, CSV | `src/app/staff/reports/page.tsx` |
| Inventory counts, low-stock alerts, adjustment log | `src/app/staff/inventory/page.tsx` |
| Café profile, VAT/service, sound, staff PINs | `src/app/staff/settings/page.tsx` |
| Types / seed / store / i18n | `src/lib/` |

Payments v1 is cash / counter-QR with staff marking orders paid. eSewa/Khalti API
integration is a planned phase 2 (see SETUP.md).
